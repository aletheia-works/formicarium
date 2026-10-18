import assert from 'node:assert/strict';
import { readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  extractEntry,
  gunzipBounded,
  readTar,
  readZip,
  writeTree,
} from '../scripts/archive.ts';
import { causeOf } from '../scripts/errors.ts';
import { ASSET_ARCHIVE_LIMITS, TRANSFER_POLICY } from '../scripts/limits.ts';
import { staticElf } from './fixtures/elf.ts';
import { pax, type TarSpec, tar, tgz, zip } from './fixtures/tar.ts';
import { withLayout } from './fixtures/work.ts';

const limits = {
  maxExpandedBytes: 1 << 20,
  maxArchiveEntries: 16,
  maxPathBytes: 64,
};
const elf = staticElf();
const throwsCause = (run: () => unknown, code: string) =>
  assert.throws(run, (error) => causeOf(error) === code);
const rejectsCause = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);

test('default archive limits are the C11 values', () => {
  assert.deepEqual(ASSET_ARCHIVE_LIMITS, {
    maxExpandedBytes: TRANSFER_POLICY.maxExpandedBytes,
    maxArchiveEntries: 4096,
    maxPathBytes: 4096,
  });
  assert.equal(TRANSFER_POLICY.maxExpandedBytes, 268435456);
});

test('expanded size, entry count and path bytes accept the limit and refuse +1', async () => {
  const raw = tar([{ name: 'bin/tool', body: elf }]);
  const compressed = new Uint8Array(gzipSync(raw));
  assert.equal(
    (await gunzipBounded(compressed, raw.length)).length,
    raw.length,
  );
  await rejectsCause(gunzipBounded(compressed, raw.length - 1), 'size-limit');
  const entries: TarSpec[] = Array.from({ length: 4 }, (_, index) => ({
    name: `f${index}`,
    body: 'x',
  }));
  assert.equal(
    readTar(tar(entries), { ...limits, maxArchiveEntries: 4 }).entries.size,
    4,
  );
  throwsCause(
    () => readTar(tar(entries), { ...limits, maxArchiveEntries: 3 }),
    'size-limit',
  );
  const long = `${'d/'.repeat(31)}ab`;
  assert.equal(new TextEncoder().encode(long).length, 64);
  const longTar = (name: string) =>
    tar([
      { name: 'PaxHeader', type: 'x', body: pax({ path: name }) },
      { name: 'placeholder', body: 'x' },
    ]);
  assert.ok(readTar(longTar(long), limits).entries.has(long));
  throwsCause(() => readTar(longTar(`${long}c`), limits), 'size-limit');
});

test('traversal, absolute paths and duplicate entries are refused', () => {
  for (const name of ['../escape', '/etc/passwd', 'a/../../b'])
    throwsCause(
      () => readTar(tar([{ name, body: 'x' }]), limits),
      'archive-invalid',
    );
  throwsCause(
    () =>
      readTar(
        tar([
          { name: 'a', body: 'x' },
          { name: './a', body: 'y' },
        ]),
        limits,
      ),
    'archive-invalid',
  );
});

test('links are resolved inside the root; escapes, cycles and dangling links fail', async () => {
  const selected = await extractEntry(
    tgz([
      { name: 'bin', type: '5' },
      { name: 'bin/tool', body: elf },
      { name: 'tool', type: '2', linkname: 'bin/tool' },
      { name: 'hard', type: '1', linkname: 'bin/tool' },
    ]),
    'tool',
    limits,
  );
  assert.deepEqual(selected, elf);
  const cases: TarSpec[][] = [
    [{ name: 'tool', type: '2', linkname: '../../outside' }],
    [{ name: 'tool', type: '2', linkname: '/etc/passwd' }],
    [{ name: 'tool', type: '1', linkname: 'missing' }],
    [
      { name: 'a', type: '2', linkname: 'b' },
      { name: 'b', type: '2', linkname: 'a' },
    ],
  ];
  for (const entries of cases)
    throwsCause(() => readTar(tar(entries), limits), 'archive-invalid');
});

test('broken headers, truncation, special entries and a non-file selection fail', async () => {
  const raw = tar([{ name: 'tool', body: elf }]);
  const corrupt = new Uint8Array(raw);
  corrupt[0] = (corrupt[0] ?? 0) ^ 1;
  throwsCause(() => readTar(corrupt, limits), 'archive-invalid');
  throwsCause(() => readTar(raw.subarray(0, 700), limits), 'archive-invalid');
  throwsCause(
    () =>
      readTar(tar([{ name: 'tool', body: elf }], { trailer: false }), limits),
    'archive-invalid',
  );
  throwsCause(
    () => readTar(tar([{ name: 'dev', type: '3' }]), limits),
    'archive-invalid',
  );
  throwsCause(
    () =>
      readTar(
        tar([{ name: 'g', type: 'g', body: pax({ comment: 'x' }) }]),
        limits,
      ),
    'archive-invalid',
  );
  await rejectsCause(
    extractEntry(tgz([{ name: 'bin', type: '5' }]), 'bin', limits),
    'archive-invalid',
  );
  await rejectsCause(
    extractEntry(new Uint8Array([1, 2, 3]), 'tool', limits),
    'archive-invalid',
  );
});

test('a git archive tree keeps its commit comment and is written without its root', async () => {
  const source = tar([
    {
      name: 'pax_global_header',
      type: 'g',
      body: pax({ comment: 'c'.repeat(40) }),
    },
    { name: 'repo-abc', type: '5' },
    { name: 'repo-abc/Cargo.lock', body: 'lock' },
    { name: 'repo-abc/run.sh', body: '#!/bin/sh\n', mode: 0o755 },
    { name: 'repo-abc/link', type: '2', linkname: 'Cargo.lock' },
  ]);
  const result = readTar(source, { ...limits, allowGlobalHeader: true });
  assert.equal(result.globalComment, 'c'.repeat(40));
  await withLayout(async (layout) => {
    const destination = join(layout.root, 'tree');
    await writeTree(result.entries, destination, 'repo-abc');
    assert.equal(
      await readFile(join(destination, 'Cargo.lock'), 'utf8'),
      'lock',
    );
    assert.equal(await readlink(join(destination, 'link')), 'Cargo.lock');
    await rejectsCause(
      writeTree(result.entries, destination, 'repo-abc'),
      'archive-invalid',
    );
  });
});

test('artifact zips are read with CRC and size checks', () => {
  const files = readZip(
    zip({ 'manifest.json': '{}', 'site/a.bin': elf }),
    limits,
  );
  assert.deepEqual(files.get('site/a.bin'), elf);
  const corrupt = zip({ 'manifest.json': '{}' });
  const at = 30 + 'manifest.json'.length;
  corrupt[at] = (corrupt[at] ?? 0) ^ 1;
  throwsCause(() => readZip(corrupt, limits), 'archive-invalid');
  throwsCause(() => readZip(zip({ '../x': 'y' }), limits), 'archive-invalid');
  throwsCause(() => readZip(new Uint8Array(10), limits), 'archive-invalid');
});
