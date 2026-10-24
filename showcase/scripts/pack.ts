import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fetchBounded } from './acquire.ts';
import { gunzipBounded, readTar, singleRoot, writeTree } from './archive.ts';
import { COMMIT_PATTERN, parseUniqueJson, sha256 } from './build-key.ts';
import {
  type FormicariumRelease,
  validateFormicariumRelease,
} from './config.ts';
import { fail, runCli } from './errors.ts';
import type { FetchLike } from './github.ts';
import { ASSET_ARCHIVE_LIMITS, TRANSFER_POLICY } from './limits.ts';
import {
  REPOSITORY_ROOT,
  readJson,
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
  writeJson,
  writeOnce,
} from './paths.ts';
import { readFromMain } from './resolve.ts';

export const PACKAGE_NAME = '@aletheia-works/formicarium';
export interface PackRecord {
  schemaVersion: 1;
  mode: 'verify' | 'distribute';
  tarball: string;
  packSha256: string;
  formicariumSourceCommit: string;
  /** The npm version and its dist.integrity; null for a verify pack. */
  npmVersion: string | null;
  integrity: string | null;
}
export type RunFile = (
  file: string,
  args: readonly string[],
  cwd: string,
) => string;
const runFile: RunFile = (file, args, cwd) =>
  execFileSync(file, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: TRANSFER_POLICY.maxMetadataBytes,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
export const npmCli = () =>
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');

/** verify: the package of this same commit, staged by the body's own stager. */
export async function packVerify(options: {
  sourceCommit: string;
  layout?: WorkLayout;
  run?: RunFile;
}): Promise<PackRecord> {
  const layout = options.layout ?? workLayout();
  const run = options.run ?? runFile;
  if (!COMMIT_PATTERN.test(options.sourceCommit))
    fail('config-invalid', 'verify needs the 40-hex source commit');
  const stage = join(
    REPOSITORY_ROOT,
    '.artifacts',
    'showcase',
    `package-${randomUUID()}`,
  );
  run(
    process.execPath,
    [
      join(REPOSITORY_ROOT, 'scripts', 'package', 'stage-package.js'),
      '--out',
      relative(REPOSITORY_ROOT, stage),
    ],
    REPOSITORY_ROOT,
  );
  await mkdir(layout.pack, { recursive: true });
  const listed = parseUniqueJson(
    run(
      process.execPath,
      [
        npmCli(),
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        layout.pack,
      ],
      stage,
    ),
  );
  const filename =
    Array.isArray(listed) && listed.length === 1
      ? (listed[0] as { filename?: unknown }).filename
      : undefined;
  if (typeof filename !== 'string' || !/^[\w.-]+\.tgz$/.test(filename))
    fail('bad-body', 'npm pack did not report one tarball');
  const record: PackRecord = {
    schemaVersion: 1,
    mode: 'verify',
    tarball: filename,
    packSha256: sha256(await readFile(join(layout.pack, filename))),
    formicariumSourceCommit: options.sourceCommit,
    npmVersion: null,
    integrity: null,
  };
  await writeJson(join(layout.pack, 'pack.json'), record);
  return record;
}

export const REGISTRY = 'https://registry.npmjs.org';
/** The commit a release tag points at, peeled; null when the tag is missing. */
export type TagCommit = (tag: string) => string | null;

async function fetchRegistry(
  url: string,
  maxBytes: number,
  fetchImpl?: FetchLike,
): Promise<Uint8Array> {
  try {
    return (await fetchBounded(url, { maxBytes, fetchImpl })).bytes;
  } catch (error) {
    return fail(
      'release-unavailable',
      `npm registry fetch failed: ${url}`,
      error,
    );
  }
}

/** npm's SRI form of the SHA-512 of the bytes. */
export const sha512Integrity = (bytes: Uint8Array) =>
  `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

/**
 * distribute: the npm release pinned in formicarium-release.json. The
 * registry's dist.integrity and the downloaded bytes must both match the
 * pin, and the release tag v<version> must point at the pinned commit.
 */
export async function packDistribute(options: {
  release: FormicariumRelease | null;
  tagCommit: TagCommit;
  layout?: WorkLayout;
  fetchImpl?: FetchLike;
}): Promise<PackRecord> {
  const layout = options.layout ?? workLayout();
  const release = options.release;
  if (!release)
    fail('release-unavailable', 'formicarium-release.json pins no release yet');
  const metadataBytes = await fetchRegistry(
    `${REGISTRY}/${PACKAGE_NAME.replace('/', '%2f')}/${release.version}`,
    TRANSFER_POLICY.maxMetadataBytes,
    options.fetchImpl,
  );
  let metadata: {
    name?: unknown;
    version?: unknown;
    dist?: Record<string, unknown>;
  };
  try {
    metadata = parseUniqueJson(
      new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes),
    ) as typeof metadata;
  } catch (error) {
    return fail('pack-mismatch', 'npm metadata is not unique JSON', error);
  }
  const tarballUrl = metadata.dist?.tarball;
  if (
    metadata.name !== PACKAGE_NAME ||
    metadata.version !== release.version ||
    metadata.dist?.integrity !== release.integrity ||
    typeof tarballUrl !== 'string' ||
    !tarballUrl.startsWith(`${REGISTRY}/`)
  )
    fail('pack-mismatch', 'npm metadata differs from formicarium-release.json');
  const pack = await fetchRegistry(
    tarballUrl,
    TRANSFER_POLICY.maxDownloadBytes,
    options.fetchImpl,
  );
  if (sha512Integrity(pack) !== release.integrity)
    fail('pack-mismatch', 'npm tarball differs from its pinned integrity');
  const tag = `v${release.version}`;
  const commit = options.tagCommit(tag);
  if (commit === null)
    fail('release-unavailable', `release tag ${tag} is missing`);
  if (commit !== release.sourceCommit)
    fail('pack-mismatch', `release tag ${tag} points at another commit`);
  const tarball = `aletheia-works-formicarium-${release.version}.tgz`;
  await writeOnce(join(layout.pack, tarball), pack);
  const record: PackRecord = {
    schemaVersion: 1,
    mode: 'distribute',
    tarball,
    packSha256: sha256(pack),
    formicariumSourceCommit: release.sourceCommit,
    npmVersion: release.version,
    integrity: release.integrity,
  };
  await writeJson(join(layout.pack, 'pack.json'), record);
  return record;
}

/** The commit of a tag in `git ls-remote` output, peeled when annotated. */
export function tagCommitFromListing(listing: string, tag: string) {
  const refs = new Map<string, string>();
  for (const line of listing.split('\n')) {
    const [commit, ref] = line.trim().split('\t');
    if (commit && ref && COMMIT_PATTERN.test(commit)) refs.set(ref, commit);
  }
  return (
    refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`) ?? null
  );
}

/** The peeled commit of a tag on origin, read without fetching the tag. */
export const remoteTagCommit: TagCommit = (tag) => {
  try {
    return tagCommitFromListing(
      execFileSync(
        'git',
        ['ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
        {
          cwd: REPOSITORY_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ),
      tag,
    );
  } catch (error) {
    return fail('release-unavailable', `cannot list tag ${tag}`, error);
  }
};

/** Extracts the recorded pack only after its SHA256 matches the record. */
export async function installPack(
  record: PackRecord,
  options: { layout?: WorkLayout; destination?: string } = {},
): Promise<string> {
  const layout = options.layout ?? workLayout();
  const destination =
    options.destination ??
    join(SHOWCASE_ROOT, 'node_modules', '@aletheia-works', 'formicarium');
  const bytes = await readFile(join(layout.pack, record.tarball));
  if (sha256(bytes) !== record.packSha256)
    fail(
      record.mode === 'distribute' ? 'pack-mismatch' : 'checksum-mismatch',
      'pack tarball changed after it was recorded',
    );
  const tar = await gunzipBounded(bytes, ASSET_ARCHIVE_LIMITS.maxExpandedBytes);
  const { entries } = readTar(tar, ASSET_ARCHIVE_LIMITS);
  if (singleRoot(entries) !== 'package')
    fail('archive-invalid', 'npm pack root must be package/');
  await rm(destination, { recursive: true, force: true });
  await writeTree(entries, destination, 'package');
  const manifest = (await readJson(join(destination, 'package.json'))) as {
    name?: unknown;
  };
  if (manifest.name !== PACKAGE_NAME)
    fail('archive-invalid', `pack is not ${PACKAGE_NAME}`);
  return destination;
}

async function main(verb: string | undefined) {
  const layout = workLayout();
  let record: PackRecord;
  if (verb === 'verify') {
    record = await packVerify({
      sourceCommit:
        process.env.SHOWCASE_SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? '',
      layout,
    });
  } else if (verb === 'distribute') {
    let release: FormicariumRelease | null;
    try {
      release = validateFormicariumRelease(
        parseUniqueJson(readFromMain('showcase/formicarium-release.json')),
      );
    } catch (error) {
      return fail(
        'release-unavailable',
        'main formicarium-release.json unusable',
        error,
      );
    }
    record = await packDistribute({
      release,
      tagCommit: remoteTagCommit,
      layout,
    });
  } else if (verb === 'install') {
    record = (await readJson(join(layout.pack, 'pack.json'))) as PackRecord;
  } else
    return fail('config-invalid', 'usage: pack.ts verify|distribute|install');
  console.log(
    `${record.mode} ${record.packSha256} -> ${await installPack(record, { layout })}`,
  );
}

if (import.meta.main)
  await runCli(`pack ${process.argv[2] ?? ''}`.trim(), () =>
    main(process.argv[2]),
  );
