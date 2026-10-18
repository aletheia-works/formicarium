import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COMMIT_PATTERN, parseUniqueJson, sha256 } from './build-key.ts';
import {
  assetName,
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
export interface ToolResolution {
  tool: string;
  repository: string;
  tag: string;
  version: string;
  commit: string;
  asset: AssetRecord | null;
  attestation: 'present' | 'absent' | null;
  license: LicenseRecord;
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
}): Promise<Resolutions> {
  const layout = options.layout ?? workLayout();
  const tools = await loadVerifiedTools(options.readMain);
  const resolved: ToolResolution[] = [];
  const licenses: [string, Uint8Array][] = [];
  for (const config of tools.tools) {
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
