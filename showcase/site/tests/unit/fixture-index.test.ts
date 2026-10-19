import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { FixtureIndex } from '../../src/model/fixture-index.ts';
import { FetchFailure, sha256Hex } from '../../src/terminal/fetch-limited.ts';
import {
  emptyEntries,
  fixtureToEntries,
  loadFixtureIndex,
  WORK_CWD,
} from '../../src/terminal/fixture-index.ts';
import { chunked } from './helpers.ts';

const file = (path: string, text: string, mode = 0o644) => ({
  path,
  type: 'file' as const,
  mode,
  sha256: createHash('sha256').update(text).digest('hex'),
  size: Buffer.byteLength(text),
  bytes: Buffer.from(text).toString('base64'),
});
const index: FixtureIndex = {
  schemaVersion: 1,
  fixture: 'aube-local-deps',
  entries: [
    { path: 'app', type: 'dir', mode: 0o755 },
    file('app/package.json', '{"name":"app"}\n'),
    file('app/run.sh', '#!/bin/sh\n', 0o755),
    { path: 'outside', type: 'dir', mode: 0o755 },
    { path: 'outside/linked', type: 'dir', mode: 0o755 },
    file('outside/linked/package.json', '{"name":"linked","note":"日本語"}\n'),
  ],
};
const URL_ = 'https://localhost/formicarium/demo-fixtures/aube-local-deps.json';
const served = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { bytes, fetchImpl: async () => chunked([bytes]) };
};

test('the fetched index becomes FsEntry below /work with one inodeId per file', async () => {
  const { bytes, fetchImpl } = served(index);
  const loaded = await loadFixtureIndex({
    url: URL_,
    sha256: await sha256Hex(bytes),
    fetch: { fetchImpl },
  });
  const entries = await fixtureToEntries(loaded);
  assert.deepEqual(
    entries.map((entry) => entry.path),
    [
      '/work',
      '/work/app',
      '/work/app/package.json',
      '/work/app/run.sh',
      '/work/outside',
      '/work/outside/linked',
      '/work/outside/linked/package.json',
    ],
  );
  const files = entries.filter((entry) => entry.type === 'file');
  assert.equal(new Set(files.map((entry) => entry.inodeId)).size, 3);
  assert.equal(files[1]!.mode, 0o755);
  assert.equal(
    new TextDecoder().decode(files[2]!.data),
    '{"name":"linked","note":"日本語"}\n',
  );
});

test('an index whose SHA256 differs from the page value is not used', async () => {
  const { fetchImpl } = served(index);
  await assert.rejects(
    loadFixtureIndex({
      url: URL_,
      sha256: 'f'.repeat(64),
      fetch: { fetchImpl },
    }),
    (error: unknown) =>
      error instanceof FetchFailure && error.kind === 'digest-mismatch',
  );
});

test('a file whose bytes differ from its entry SHA256 or size is refused', async () => {
  const tampered = structuredClone(index);
  (tampered.entries[1] as { bytes: string }).bytes =
    Buffer.from('{"name":"evil"}\n').toString('base64');
  await assert.rejects(fixtureToEntries(tampered), /digest-mismatch/);
  const shorter = structuredClone(index);
  (shorter.entries[1] as { size: number }).size = 1;
  await assert.rejects(fixtureToEntries(shorter), /digest-mismatch/);
});

test('an index with a `..` path is refused even when its SHA256 matches', async () => {
  const evil = structuredClone(index) as unknown as {
    entries: { path: string }[];
  };
  evil.entries[1]!.path = 'app/../../etc/passwd';
  const { bytes, fetchImpl } = served(evil);
  await assert.rejects(
    loadFixtureIndex({
      url: URL_,
      sha256: await sha256Hex(bytes),
      fetch: { fetchImpl },
    }),
    (error: unknown) =>
      error instanceof FetchFailure &&
      error.kind === 'bad-body' &&
      /relative segment/.test(error.message),
  );
});

test('the empty terminal starts in an empty /work/app', () => {
  assert.deepEqual(emptyEntries(), [
    { path: '/work', type: 'dir', mode: 0o755 },
    { path: WORK_CWD, type: 'dir', mode: 0o755 },
  ]);
});
