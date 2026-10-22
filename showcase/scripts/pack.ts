import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fetchBounded } from './acquire.ts';
import { gunzipBounded, readTar, singleRoot, writeTree } from './archive.ts';
import { COMMIT_PATTERN, parseUniqueJson, sha256 } from './build-key.ts';
import { type B1Pack, validateB1Pack } from './config.ts';
import { fail, runCli, ShowcaseError } from './errors.ts';
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
  releaseTag: string | null;
  evidenceSha256: string | null;
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
    releaseTag: null,
    evidenceSha256: null,
  };
  await writeJson(join(layout.pack, 'pack.json'), record);
  return record;
}

async function releaseAsset(
  repository: string,
  tag: string,
  asset: string,
  fetchImpl?: FetchLike,
): Promise<Uint8Array> {
  try {
    return (
      await fetchBounded(
        `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`,
        { maxBytes: TRANSFER_POLICY.maxDownloadBytes, fetchImpl },
      )
    ).bytes;
  } catch (error) {
    return fail(
      'b1-pack-unavailable',
      `release asset ${asset} unavailable`,
      error,
    );
  }
}

/** The ApiAcceptance evidence must name this pack and hold only passed checks. */
export function checkEvidence(evidence: unknown, pack: B1Pack): string {
  const value = evidence as Record<string, unknown> | null;
  if (
    !value ||
    typeof value !== 'object' ||
    value.schemaVersion !== 1 ||
    value.packSha256 !== pack.packSha256 ||
    typeof value.sourceCommit !== 'string' ||
    !COMMIT_PATTERN.test(value.sourceCommit) ||
    !Array.isArray(value.checks) ||
    value.checks.length === 0 ||
    value.checks.some(
      (check) => (check as { status?: unknown } | null)?.status !== 'passed',
    )
  )
    fail('b1-pack-mismatch', 'acceptance evidence does not accept this pack');
  return value.sourceCommit as string;
}

/** distribute: only the B1-accepted pack, checked against the evidence packSha256. */
export async function packDistribute(options: {
  b1: B1Pack | null;
  repository: string;
  layout?: WorkLayout;
  fetchImpl?: FetchLike;
}): Promise<PackRecord> {
  const layout = options.layout ?? workLayout();
  const b1 = options.b1;
  if (!b1) fail('b1-pack-unavailable', 'b1-pack.json names no Release yet');
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repository))
    fail('config-invalid', 'repository owner/repo required');
  const pack = await releaseAsset(
    options.repository,
    b1.releaseTag,
    b1.packAsset,
    options.fetchImpl,
  );
  if (sha256(pack) !== b1.packSha256)
    fail('b1-pack-mismatch', 'B1 pack SHA256 differs from b1-pack.json');
  const evidenceBytes = await releaseAsset(
    options.repository,
    b1.releaseTag,
    b1.evidenceAsset,
    options.fetchImpl,
  );
  if (sha256(evidenceBytes) !== b1.evidenceSha256)
    fail(
      'b1-pack-mismatch',
      'acceptance evidence SHA256 differs from b1-pack.json',
    );
  let evidence: unknown;
  try {
    evidence = parseUniqueJson(
      new TextDecoder('utf-8', { fatal: true }).decode(evidenceBytes),
    );
  } catch (error) {
    return fail(
      'b1-pack-mismatch',
      'acceptance evidence is not unique JSON',
      error,
    );
  }
  const formicariumSourceCommit = checkEvidence(evidence, b1);
  await writeOnce(join(layout.pack, b1.packAsset), pack);
  await writeOnce(join(layout.pack, b1.evidenceAsset), evidenceBytes);
  const record: PackRecord = {
    schemaVersion: 1,
    mode: 'distribute',
    tarball: b1.packAsset,
    packSha256: b1.packSha256,
    formicariumSourceCommit,
    releaseTag: b1.releaseTag,
    evidenceSha256: b1.evidenceSha256,
  };
  await writeJson(join(layout.pack, 'pack.json'), record);
  return record;
}

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
      record.mode === 'distribute' ? 'b1-pack-mismatch' : 'checksum-mismatch',
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
    let b1: B1Pack | null;
    try {
      b1 = validateB1Pack(
        parseUniqueJson(readFromMain('showcase/b1-pack.json')),
      );
    } catch (error) {
      if (
        error instanceof ShowcaseError &&
        error.code === 'b1-pack-unavailable'
      )
        throw error;
      return fail('b1-pack-unavailable', 'main b1-pack.json unusable', error);
    }
    record = await packDistribute({
      b1,
      repository: process.env.GITHUB_REPOSITORY ?? '',
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
