// Checks a fixed guest set from the vivarium builder on the formicarium side
// and runs `--version` through formicarium's own runtime (FR9, NFR8.2).
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  guestBuildKey,
  guestCanonical,
} from '../../runtime/guest-validation.js';
import { runValidatedGuest, validateGuest } from '../../runtime/public.js';
import type { GuestBuildInfo, Session } from '../../types/index.js';
import { parseUniqueJSON } from '../migration-preflight/unique-json.js';

export const LIMITS = Object.freeze({
  elf: 134_217_728,
  buildInfo: 1_048_576,
  catalog: 4_194_304,
});
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;

export interface ExpectedSet {
  tool: string;
  key: string;
  repository: string;
  commit: string;
}

export interface SetFiles {
  elf: Uint8Array;
  buildInfo: Uint8Array;
  catalog: Uint8Array;
}

export interface SetEvidence {
  schemaVersion: 1;
  tool: string;
  buildKey: string;
  source: { repository: string; commit: string };
  elfSha256: string;
  buildInfoSha256: string;
  catalogSha256: string;
  version: { exitCode: number; stdout: string; stdoutSha256: string };
}

export const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

function refuse(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_INPUT' });
}

function readJson(bytes: Uint8Array, limit: number, label: string): unknown {
  if (bytes.byteLength > limit)
    refuse(`${label} is larger than ${limit} bytes`);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    refuse(`${label} is not UTF-8`);
  }
  try {
    return parseUniqueJSON(text);
  } catch (error) {
    refuse(`${label}: ${(error as Error).message}`);
  }
}

// Every check the builder makes, made again independently here.
export function checkSet(
  files: SetFiles,
  expected: ExpectedSet,
): {
  info: GuestBuildInfo;
  elfSha256: string;
  buildInfoSha256: string;
  catalogSha256: string;
} {
  if (!SHA256.test(expected.key)) refuse('expected key must be 64 hex');
  if (!COMMIT.test(expected.commit)) refuse('expected commit must be 40 hex');
  if (files.elf.byteLength > LIMITS.elf) refuse('ELF is larger than the limit');
  const info = readJson(
    files.buildInfo,
    LIMITS.buildInfo,
    'build-info',
  ) as GuestBuildInfo;
  const catalog = readJson(files.catalog, LIMITS.catalog, 'catalog') as {
    schemaVersion?: unknown;
    entries?: Record<string, unknown>[];
  };
  const elfSha256 = sha256(files.elf);
  const buildInfoSha256 = sha256(files.buildInfo);
  // C03 takes buildInfoSha256 over the canonical JSON of the build-info.
  if (new TextDecoder().decode(files.buildInfo) !== guestCanonical(info))
    refuse('build-info is not in canonical JSON form');
  if (info.buildKey !== expected.key) refuse('build-info is for another key');
  if (
    info.tool !== expected.tool ||
    info.source?.repository !== expected.repository ||
    info.source?.commit !== expected.commit
  )
    refuse('build-info is for another source');
  if (guestBuildKey(info) !== info.buildKey)
    refuse('build-info buildKey does not follow from its inputs');
  if (info.elfSha256 !== elfSha256) refuse('ELF differs from build-info');
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.entries) ||
    catalog.entries.length !== 1
  )
    refuse('catalog must hold exactly one entry');
  const entry = catalog.entries[0] as Record<string, unknown>;
  if (
    entry.format !== 'elf' ||
    entry.downloadSha256 !== elfSha256 ||
    entry.buildInfoSha256 !== buildInfoSha256 ||
    entry.elfBytes !== files.elf.byteLength ||
    entry.downloadBytes !== files.elf.byteLength ||
    (entry.buildInfo as GuestBuildInfo | undefined)?.buildKey !== expected.key
  )
    refuse('catalog entry differs from the files');
  return {
    info,
    elfSha256,
    buildInfoSha256,
    catalogSha256: sha256(files.catalog),
  };
}

// Validates the ELF with the public C03 API and runs `--version` in the
// given formicarium Session. A non-zero exit is reported, not hidden.
export async function verifySet(
  files: SetFiles,
  expected: ExpectedSet,
  session: Session,
): Promise<SetEvidence> {
  const checked = checkSet(files, expected);
  const handle = validateGuest(files.elf, {
    elfSha256: checked.elfSha256,
    buildInfoSha256: checked.buildInfoSha256,
    identity: checked.info,
  });
  const result = await runValidatedGuest(session, handle, {
    args: ['--version'],
  });
  const stdout = new TextDecoder().decode(result.stdout);
  if (result.exitCode !== 0) refuse(`--version exited with ${result.exitCode}`);
  return {
    schemaVersion: 1,
    tool: expected.tool,
    buildKey: expected.key,
    source: { repository: expected.repository, commit: expected.commit },
    elfSha256: checked.elfSha256,
    buildInfoSha256: checked.buildInfoSha256,
    catalogSha256: checked.catalogSha256,
    version: {
      exitCode: result.exitCode,
      stdout: stdout.slice(0, 4096),
      stdoutSha256: sha256(result.stdout),
    },
  };
}

export interface BuildReceipt {
  buildKey: string;
  compiled: boolean;
  elfSha256: string;
  buildInfoSha256: string;
  catalogSha256: string;
  source: { repository: string; commit: string };
}

// The second run of the same key must reuse the first set without compiling (FR7).
export function checkReuse(
  first: BuildReceipt,
  second: BuildReceipt,
  evidence: SetEvidence,
): void {
  if (first.compiled !== true) refuse('the first run must have compiled');
  if (second.compiled !== false)
    refuse('the second run must not have compiled');
  for (const receipt of [first, second]) {
    if (receipt.buildKey !== evidence.buildKey)
      refuse('a receipt is for another key');
    if (
      receipt.source.repository !== evidence.source.repository ||
      receipt.source.commit !== evidence.source.commit
    )
      refuse('a receipt is for another source');
    if (
      receipt.elfSha256 !== evidence.elfSha256 ||
      receipt.buildInfoSha256 !== evidence.buildInfoSha256 ||
      receipt.catalogSha256 !== evidence.catalogSha256
    )
      refuse('a receipt records other digests');
  }
}

export async function readSet(
  directory: string,
  binary: string,
): Promise<SetFiles> {
  return {
    elf: new Uint8Array(await readFile(join(directory, binary))),
    buildInfo: new Uint8Array(
      await readFile(join(directory, 'build-info.json')),
    ),
    catalog: new Uint8Array(await readFile(join(directory, 'catalog.json'))),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      set: { type: 'string' },
      binary: { type: 'string' },
      tool: { type: 'string' },
      key: { type: 'string' },
      repository: { type: 'string' },
      commit: { type: 'string' },
      'first-receipt': { type: 'string' },
      'reuse-receipt': { type: 'string' },
      out: { type: 'string' },
    },
    strict: true,
  });
  for (const name of [
    'set',
    'binary',
    'tool',
    'key',
    'repository',
    'commit',
    'out',
  ] as const)
    if (values[name] === undefined) refuse(`--${name} is required`);
  const { createSession } = await import('../../runtime/node/api.js');
  const { nodeAssets } = await import('./assets.js');
  const session = await createSession({ assets: await nodeAssets() });
  try {
    const evidence = await verifySet(
      await readSet(values.set as string, values.binary as string),
      {
        tool: values.tool as string,
        key: values.key as string,
        repository: values.repository as string,
        commit: values.commit as string,
      },
      session,
    );
    if (
      values['first-receipt'] !== undefined ||
      values['reuse-receipt'] !== undefined
    ) {
      if (
        values['first-receipt'] === undefined ||
        values['reuse-receipt'] === undefined
      )
        refuse('--first-receipt and --reuse-receipt go together');
      const first = JSON.parse(
        await readFile(values['first-receipt'], 'utf8'),
      ) as BuildReceipt;
      const reuse = JSON.parse(
        await readFile(values['reuse-receipt'], 'utf8'),
      ) as BuildReceipt;
      checkReuse(first, reuse, evidence);
    }
    await writeFile(
      values.out as string,
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: 'wx' },
    );
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    await session.dispose();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: Error) => {
    process.stderr.write(
      `${JSON.stringify({ error: { message: error.message } })}\n`,
    );
    process.exitCode = 1;
  });
}
