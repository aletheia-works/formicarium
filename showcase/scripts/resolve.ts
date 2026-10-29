import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COMMIT_PATTERN, parseUniqueJson, sha256 } from './build-key.ts';
import {
  assetName,
  type GnuPackage,
  readConfigFile,
  type ToolConfig,
  type ToolsConfig,
  validateAllowedSources,
  validateToolsConfig,
} from './config.ts';
import { fail, runCli } from './errors.ts';
import {
  createGitHubApi,
  encodeTag,
  type GitHubApi,
  repositorySlug,
} from './github.ts';
import {
  copyingOf,
  type Exec,
  type GnuTransferOptions,
  lsRemoteCommit,
  resolveGnuPackage,
  type SignedTarball,
  signatureNameOf,
  sourceOf,
} from './gnu.ts';
import { TRANSFER_POLICY } from './limits.ts';
import {
  REPOSITORY_ROOT,
  type WorkLayout,
  workLayout,
  writeOnce,
} from './paths.ts';

export interface AssetRecord {
  name: string;
  url: string;
  sha256: string;
  size: number;
}
export interface LicenseRecord {
  path: string;
  file: string;
  sha256: string;
  spdx: string | null;
}
/**
 * One signed GNU tarball, identified by the tag commit of its repository.
 * A library without a repository (GMP) has null repository, tag and commit:
 * its signed tarball is its only identity.
 */
export interface GnuPackageResolution {
  package: string;
  repository: string | null;
  tag: string | null;
  version: string;
  commit: string | null;
  tarball: SignedTarball;
  license: LicenseRecord;
}
export interface ToolResolution {
  tool: string;
  repository: string;
  tag: string;
  version: string;
  commit: string;
  asset: AssetRecord | null;
  attestation: 'present' | 'absent' | null;
  license: LicenseRecord;
  /** gnu-source only: the tool's own tarball and its libraries, in build order. */
  gnu?: { tarball: SignedTarball; libraries: GnuPackageResolution[] };
}
export interface Resolutions {
  schemaVersion: 1;
  resolvedAt: string;
  tools: ToolResolution[];
}

type Json = Record<string, unknown>;
const object = (value: unknown, what: string): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('bad-body', `${what} is not an object`);
  return value as Json;
};

/** Peels lightweight and annotated tags down to one 40-hex commit. */
export async function resolveTagCommit(
  api: GitHubApi,
  slug: string,
  tag: string,
): Promise<string> {
  const ref = object(
    await api.get(`repos/${slug}/git/ref/tags/${encodeTag(tag)}`),
    'tag ref',
  );
  if (ref.ref !== `refs/tags/${tag}`)
    fail('tag-mismatch', `tag ref does not name ${tag}`);
  let target = object(ref.object, 'tag ref object');
  for (let depth = 0; depth < 4; depth++) {
    if (typeof target.sha !== 'string' || !COMMIT_PATTERN.test(target.sha))
      fail('commit-unreachable', `tag ${tag} object is not 40-hex`);
    if (target.type === 'commit') return target.sha;
    if (target.type !== 'tag')
      fail('commit-unreachable', `tag ${tag} does not point at a commit`);
    target = object(
      object(await api.get(`repos/${slug}/git/tags/${target.sha}`), 'tag')
        .object,
      'annotated tag object',
    );
  }
  return fail('commit-unreachable', `tag ${tag} nests too deeply`);
}

export function releaseAsset(
  release: Json,
  slug: string,
  tag: string,
  name: string,
): AssetRecord {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const matches = assets.filter(
    (asset) => object(asset, 'release asset').name === name,
  );
  if (matches.length !== 1)
    fail('release-invalid', `expected exactly one asset ${name}`);
  const asset = matches[0] as Json;
  const digest =
    typeof asset.digest === 'string'
      ? /^sha256:([a-f0-9]{64})$/.exec(asset.digest)?.[1]
      : undefined;
  if (!digest) fail('release-invalid', `asset ${name} has no SHA256 digest`);
  if (
    typeof asset.size !== 'number' ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0
  )
    fail('release-invalid', `asset ${name} size invalid`);
  if (asset.size > TRANSFER_POLICY.maxDownloadBytes)
    fail('size-limit', `asset ${name} exceeds the download limit`);
  const url = asset.browser_download_url;
  if (
    typeof url !== 'string' ||
    !url.startsWith('https://github.com/') ||
    decodeURIComponent(url) !==
      `https://github.com/${slug}/releases/download/${tag}/${name}`
  )
    fail('release-invalid', `asset ${name} URL is not this release`);
  return { name, url, sha256: digest, size: asset.size };
}

async function attestation(
  api: GitHubApi,
  slug: string,
  digest: string,
): Promise<'present' | 'absent'> {
  const result = await api.getOptional(
    `repos/${slug}/attestations/sha256:${digest}`,
  );
  if (result === null) return 'absent';
  const list = object(result, 'attestations').attestations;
  return Array.isArray(list) && list.length > 0 ? 'present' : 'absent';
}

async function license(
  api: GitHubApi,
  tool: string,
  slug: string,
  commit: string,
): Promise<{ record: LicenseRecord; bytes: Uint8Array }> {
  const raw = object(
    await api.get(`repos/${slug}/license?ref=${commit}`),
    'license',
  );
  if (
    raw.encoding !== 'base64' ||
    typeof raw.content !== 'string' ||
    typeof raw.path !== 'string' ||
    !/^[A-Za-z0-9._/-]{1,256}$/.test(raw.path)
  )
    fail('release-invalid', `license of ${tool} is not readable`);
  const bytes = Buffer.from(raw.content, 'base64');
  if (bytes.length === 0 || bytes.length > TRANSFER_POLICY.maxMetadataBytes)
    fail('release-invalid', `license of ${tool} size invalid`);
  const info =
    raw.license && typeof raw.license === 'object' ? (raw.license as Json) : {};
  return {
    record: {
      path: raw.path,
      file: `${tool}-${raw.path.replaceAll('/', '_')}`,
      sha256: sha256(bytes),
      spdx: typeof info.spdx_id === 'string' ? info.spdx_id : null,
    },
    bytes,
  };
}

export type GnuResolveOptions = GnuTransferOptions;
type Resolved = {
  resolution: ToolResolution;
  /** License files by name; the tarballs are kept for the build and the site. */
  files: [string, Uint8Array][];
};

/** A tag commit on GitHub (peeled through the API) or in a Savannah repository. */
export async function tagCommit(
  api: GitHubApi,
  repository: string,
  tag: string,
  exec?: Exec,
  retryDelaysMs?: readonly number[],
): Promise<string> {
  return repository.startsWith('https://github.com/')
    ? resolveTagCommit(api, repositorySlug(repository), tag)
    : lsRemoteCommit(repository, tag, exec, retryDelaysMs);
}

/**
 * A tag that also names its release date (nettle's
 * `nettle_{version}_release_{date}`): the one tag of the GitHub repository
 * that matches the template with eight digits in place of `{date}`.
 */
export async function datedTag(
  api: GitHubApi,
  repository: string,
  template: string,
): Promise<string> {
  const [before = '', after = ''] = template.split('{date}');
  const refs = await api.get(
    `repos/${repositorySlug(repository)}/git/matching-refs/tags/${encodeTag(before)}`,
  );
  if (!Array.isArray(refs)) fail('bad-body', 'matching refs is not an array');
  const literal = (value: string) =>
    value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `^refs/tags/(${literal(before)}\\d{8}${literal(after)})$`,
  );
  const tags = refs.flatMap((ref) => {
    const name = object(ref, 'matching ref').ref;
    const match = typeof name === 'string' ? pattern.exec(name) : null;
    return match ? [match[1]!] : [];
  });
  if (tags.length !== 1)
    fail('tag-mismatch', `${tags.length} tags match ${template}, not one`);
  return tags[0]!;
}

async function gnuPackage(
  api: GitHubApi,
  pkg: GnuPackage,
  repository: string | null,
  options: GnuResolveOptions,
) {
  const found = await resolveGnuPackage(pkg, options);
  if (repository && found.tag?.includes('{date}'))
    found.tag = await datedTag(api, repository, found.tag);
  const licensePath = sourceOf(pkg).license;
  const copying = await copyingOf(found.bytes, licensePath, found.record.name);
  const resolution: GnuPackageResolution = {
    package: pkg.package,
    repository,
    tag: found.tag,
    version: found.version,
    commit:
      repository && found.tag
        ? await tagCommit(
            api,
            repository,
            found.tag,
            options.exec,
            options.retryDelaysMs,
          )
        : null,
    tarball: found.record,
    license: {
      path: licensePath,
      file: `${pkg.package}-${licensePath.split('/').at(-1)}`,
      sha256: sha256(copying),
      spdx: pkg.spdx,
    },
  };
  const files: [string, Uint8Array][] = [[resolution.license.file, copying]];
  return {
    resolution,
    files,
    tarball: found.bytes,
    signature: found.signature,
  };
}

/**
 * gnu-source: the latest signed tarball of the tool and of each library.
 * The tool's tag must match tagPattern and name the same version.
 */
export async function resolveGnuTool(
  api: GitHubApi,
  config: ToolConfig,
  options: GnuResolveOptions = {},
): Promise<Resolved & { tarballs: [string, Uint8Array][] }> {
  if (config.acquire.kind !== 'gnu-source')
    fail('config-invalid', `${config.tool} is not a gnu-source tool`);
  const acquire = config.acquire;
  const packages = [];
  for (const [pkg, repository] of [
    [acquire, config.repository] as const,
    ...acquire.libraries.map((item) => [item, item.repository] as const),
  ])
    packages.push(await gnuPackage(api, pkg, repository, options));
  const [own, ...libraries] = packages;
  // The tool always has its repository and tag (config.ts refuses otherwise).
  const tag = own!.resolution.tag ?? '';
  const version = new RegExp(config.tagPattern).exec(tag)?.[1];
  if (version !== own!.resolution.version || !own!.resolution.commit)
    fail('tag-mismatch', `${config.tool} tag ${tag} has no match`);
  return {
    resolution: {
      tool: config.tool,
      repository: config.repository,
      tag,
      version,
      commit: own!.resolution.commit,
      asset: null,
      attestation: null,
      license: own!.resolution.license,
      gnu: {
        tarball: own!.resolution.tarball,
        libraries: libraries.map((item) => item.resolution),
      },
    },
    files: packages.flatMap((item) => item.files),
    tarballs: packages.flatMap((item) => [
      [item.resolution.tarball.name, item.tarball] as [string, Uint8Array],
      [signatureNameOf(item.resolution.tarball), item.signature] as [
        string,
        Uint8Array,
      ],
    ]),
  };
}

/** One latest-stable resolution per tool; the result is fixed for the run. */
export async function resolveTool(
  api: GitHubApi,
  config: ToolConfig,
): Promise<{ resolution: ToolResolution; licenseBytes: Uint8Array }> {
  const slug = repositorySlug(config.repository);
  const release = object(
    await api.get(`repos/${slug}/releases/latest`),
    'release',
  );
  if (release.draft !== false || release.prerelease !== false)
    fail('release-invalid', `${config.tool} latest release is not stable`);
  const tag = release.tag_name;
  if (typeof tag !== 'string')
    fail('release-invalid', `${config.tool} release has no tag`);
  const version = new RegExp(config.tagPattern).exec(tag)?.[1];
  if (!version) fail('tag-mismatch', `${config.tool} tag ${tag} has no match`);
  const commit = await resolveTagCommit(api, slug, tag);
  let asset: AssetRecord | null = null;
  let attested: ToolResolution['attestation'] = null;
  if (config.acquire.kind === 'release-asset') {
    asset = releaseAsset(
      release,
      slug,
      tag,
      assetName(config.acquire.asset, tag, version),
    );
    attested = await attestation(api, slug, asset.sha256);
  }
  const found = await license(api, config.tool, slug, commit);
  return {
    resolution: {
      tool: config.tool,
      repository: config.repository,
      tag,
      version,
      commit,
      asset,
      attestation: attested,
      license: found.record,
    },
    licenseBytes: found.bytes,
  };
}

/** Reads a file from the main branch definition, never from the PR head. */
export function readFromMain(path: string): string {
  try {
    return execFileSync('git', ['show', `origin/main:${path}`], {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      maxBuffer: TRANSFER_POLICY.maxMetadataBytes,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return fail('config-invalid', `origin/main:${path} is unreadable`, error);
  }
}

export async function loadVerifiedTools(
  readMain: (path: string) => string = readFromMain,
): Promise<ToolsConfig> {
  const allowed = validateAllowedSources(
    parseUniqueJson(readMain('showcase/allowed-sources.json')),
  );
  return validateToolsConfig(await readConfigFile('tools.json'), allowed);
}

export async function runResolveJob(options: {
  api: GitHubApi;
  readMain?: (path: string) => string;
  layout?: WorkLayout;
  now?: () => Date;
  gnu?: GnuResolveOptions;
}): Promise<Resolutions> {
  const layout = options.layout ?? workLayout();
  const tools = await loadVerifiedTools(options.readMain);
  const resolved: ToolResolution[] = [];
  const licenses: [string, Uint8Array][] = [];
  const tarballs: [string, Uint8Array][] = [];
  for (const config of tools.tools) {
    if (config.acquire.kind === 'gnu-source') {
      const found = await resolveGnuTool(options.api, config, options.gnu);
      resolved.push(found.resolution);
      licenses.push(...found.files);
      tarballs.push(...found.tarballs);
      continue;
    }
    const { resolution, licenseBytes } = await resolveTool(options.api, config);
    resolved.push(resolution);
    licenses.push([resolution.license.file, licenseBytes]);
  }
  const resolutions: Resolutions = {
    schemaVersion: 1,
    resolvedAt: (options.now ?? (() => new Date()))().toISOString(),
    tools: resolved,
  };
  await writeOnce(
    layout.resolutions,
    `${JSON.stringify(resolutions, null, 2)}\n`,
  );
  for (const [file, bytes] of licenses)
    await writeOnce(join(layout.licenses, file), bytes);
  for (const [file, bytes] of tarballs)
    await writeOnce(join(layout.tarballs, file), bytes);
  return resolutions;
}

/** Later jobs read only this fixed file and never resolve again. */
export async function loadResolutions(
  layout: WorkLayout = workLayout(),
): Promise<Resolutions> {
  const value = object(
    parseUniqueJson(await readFile(layout.resolutions, 'utf8')),
    'resolutions',
  );
  if (value.schemaVersion !== 1 || !Array.isArray(value.tools))
    fail('config-invalid', 'resolutions.json schema invalid');
  for (const tool of value.tools) {
    const entry = object(tool, 'resolution');
    if (
      typeof entry.tool !== 'string' ||
      typeof entry.tag !== 'string' ||
      typeof entry.version !== 'string' ||
      typeof entry.commit !== 'string' ||
      !COMMIT_PATTERN.test(entry.commit)
    )
      fail('config-invalid', 'resolutions.json entry invalid');
  }
  return value as unknown as Resolutions;
}

export function resolutionFor(
  resolutions: Resolutions,
  tool: string,
): ToolResolution {
  const found = resolutions.tools.filter((entry) => entry.tool === tool);
  if (found.length !== 1)
    fail('config-invalid', `resolutions.json lacks exactly one ${tool}`);
  return found[0]!;
}

if (import.meta.main)
  await runCli('resolve', async () => {
    const resolutions = await runResolveJob({
      api: createGitHubApi({ token: process.env.GITHUB_TOKEN }),
    });
    for (const tool of resolutions.tools)
      console.log(`${tool.tool} ${tool.tag} ${tool.commit}`);
  });
