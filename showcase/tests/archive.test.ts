import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readlink, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  expandTarball,
  extractEntry,
  gunzipBounded,
  readTar,
  readZip,
  unxzBounded,
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

test('default archive limits are the TransferPolicy values', () => {
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

test('a v7 header is read only when the caller allows it', () => {
  const v7 = tar([
    { name: 'root/', type: '5', format: 'v7' },
    { name: 'root/file', type: '\0' as never, body: 'x', format: 'v7' },
  ]);
  assert.throws(
    () => readTar(v7, ASSET_ARCHIVE_LIMITS),
    (error) => causeOf(error) === 'archive-invalid',
  );
  const { entries } = readTar(v7, {
    ...ASSET_ARCHIVE_LIMITS,
    allowV7Header: true,
  });
  assert.equal(entries.get('root/file')?.kind, 'file');
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

test('a written tree keeps the archive times, so make sees configure.ac older than aclocal.m4', async () => {
  const source = tar([
    { name: 'pkg-1', type: '5' },
    { name: 'pkg-1/configure.ac', body: 'AC_INIT', mtime: 1_700_000_000 },
    { name: 'pkg-1/aclocal.m4', body: 'm4', mtime: 1_700_000_100 },
    // A PAX mtime wins over the header's, as tar gives it.
    { name: 'PaxHeader', type: 'x', body: pax({ mtime: '1700000200.5' }) },
    { name: 'pkg-1/configure', body: '#!/bin/sh\n', mtime: 1, mode: 0o755 },
    { name: 'pkg-1/copy', type: '1', linkname: 'pkg-1/aclocal.m4' },
  ]);
  const result = readTar(source, limits);
  await withLayout(async (layout) => {
    const destination = join(layout.root, 'tree');
    await writeTree(result.entries, destination, 'pkg-1');
    const seconds = async (name: string) =>
      Math.floor((await stat(join(destination, name))).mtimeMs / 1000);
    assert.equal(await seconds('configure.ac'), 1_700_000_000);
    assert.equal(await seconds('aclocal.m4'), 1_700_000_100);
    assert.equal(await seconds('configure'), 1_700_000_200);
    assert.equal(await seconds('copy'), 1_700_000_100);
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

test('xz output is read through the system xz and bounded like gzip', async () => {
  const raw = new Uint8Array(200_000).fill(7);
  const compressed = new Uint8Array(execFileSync('xz', ['-c'], { input: raw }));
  assert.deepEqual(await unxzBounded(compressed, raw.length), raw);
  assert.deepEqual(
    await expandTarball('a-1.0.tar.xz', compressed, raw.length),
    raw,
  );
  assert.deepEqual(
    await expandTarball('a-1.0.tar.gz', gzipSync(raw), raw.length),
    new Uint8Array(raw),
  );
  // Past the limit xz is killed; a broken stream, a missing xz, a stalled
  // xz and another suffix are refused with their own causes.
  await rejectsCause(unxzBounded(compressed, raw.length - 1), 'size-limit');
  await rejectsCause(
    unxzBounded(new Uint8Array([1, 2, 3]), 10),
    'archive-invalid',
  );
  await rejectsCause(
    unxzBounded(compressed, raw.length, { command: '/nonexistent/xz' }),
    'archive-invalid',
  );
  await withLayout(async (layout) => {
    const stalled = join(layout.root, 'xz');
    await mkdir(layout.root, { recursive: true });
    await writeFile(stalled, '#!/bin/sh\nexec sleep 30\n', { mode: 0o755 });
    await rejectsCause(
      unxzBounded(compressed, raw.length, {
        command: stalled,
        deadlineMs: 200,
      }),
      'deadline',
    );
  });
  await rejectsCause(
    expandTarball('a-1.0.tar.bz2', compressed, raw.length),
    'archive-invalid',
  );
});
