import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FsEntry } from '../../runtime/contracts.js';
import {
  fixtureToFsEntries,
  GUEST_LIMITS,
} from '../../runtime/guest-validation.js';

const file = (
  path = '/work/a',
  data = new Uint8Array([1]),
  inodeId = 'same',
): FsEntry => ({ path, type: 'file', mode: 0o644, inodeId, data });
const invalid = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'INVALID_INPUT';
test('empty fixture and normalized absolute paths produce independent byte copies', () => {
  assert.deepEqual(fixtureToFsEntries([]), []);
  const data = new Uint8Array([1]);
  const output = fixtureToFsEntries([file('/work/./a', data)]);
  data[0] = 2;
  assert.equal(output[0].path, '/work/a');
  assert.equal(output[0].type === 'file' && output[0].data[0], 1);
});
test('relative, NUL, root escape, duplicate normalized and non-directory root reject', () => {
  for (const entries of [
    [file('relative')],
    [file('/x\0')],
    [file('/../../x')],
    [file('/work/a'), file('/work/./a')],
    [file('/')],
  ])
    assert.throws(() => fixtureToFsEntries(entries), invalid);
});
test('full fixture rejects bad last entry and does not change earlier input', () => {
  const valid = file();
  const before = structuredClone(valid);
  assert.throws(
    () =>
      fixtureToFsEntries([
        valid,
        {
          path: '/last',
          type: 'file',
          mode: 0o644,
          data: new Uint8Array(),
        } as FsEntry,
      ]),
    invalid,
  );
  assert.deepEqual(valid, before);
  assert.throws(
    () => fixtureToFsEntries([{ path: '/dir', type: 'dir' } as FsEntry]),
    invalid,
  );
});
test('safe sibling link accepts while root escape, direct and parent-component loops reject', () => {
  const link = (path: string, target: string): FsEntry => ({
    path,
    type: 'symlink',
    target,
  });
  fixtureToFsEntries([file('/work/b'), link('/work/a', '../work/b')]);
  for (const entries of [
    [link('/a', '../../x')],
    [link('/a', '/b'), link('/b', '/a')],
    [link('/a', 'a/../x')],
    [link('/a', '/a')],
  ])
    assert.throws(() => fixtureToFsEntries(entries), invalid);
});
test('symlink prefix chain and non-directory parent are checked throughout paths', () => {
  assert.throws(
    () =>
      fixtureToFsEntries([
        { path: '/work/a', type: 'symlink', target: '/work/b' },
        { path: '/work/b', type: 'symlink', target: '/work/a' },
        {
          path: '/work/a/file',
          type: 'file',
          mode: 0o644,
          inodeId: 'x',
          data: new Uint8Array(),
        },
      ]),
    invalid,
  );
  assert.throws(() => fixtureToFsEntries([file('/a'), file('/a/b')]), invalid);
});
test('finite symlink reuse resolves targets before the remaining path suffix', () => {
  for (const target of ['/link/../link/file', '/link/../link/../link/file']) {
    const entries: FsEntry[] = [
      { path: '/real', type: 'dir', mode: 0o755 },
      file('/real/file'),
      { path: '/link', type: 'symlink', target: '/real' },
      { path: '/x', type: 'symlink', target },
    ];
    assert.deepEqual(
      fixtureToFsEntries(entries),
      [...entries].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
      ),
    );
  }
  assert.throws(
    () =>
      fixtureToFsEntries([
        file('/real/file'),
        { path: '/link', type: 'symlink', target: '/real/file' },
        { path: '/x', type: 'symlink', target: '/link/child' },
      ]),
    invalid,
  );
});
test('hardlinks preserve inode identity but differ in mode or content reject', () => {
  const entries = [file('/a'), file('/b')];
  const output = fixtureToFsEntries(entries);
  assert.equal(output[0].type === 'file' && output[0].inodeId, 'same');
  assert.equal(output[1].type === 'file' && output[1].inodeId, 'same');
  assert.throws(
    () => fixtureToFsEntries([file('/a'), file('/b', new Uint8Array([2]))]),
    invalid,
  );
  assert.throws(
    () =>
      fixtureToFsEntries([
        file('/a'),
        { ...file('/b'), mode: 0o600 } as FsEntry,
      ]),
    invalid,
  );
});
test('entry and UTF8 path exact boundaries accept and plus one rejects', () => {
  const entries = Array.from(
    { length: GUEST_LIMITS.entries },
    (_, index): FsEntry => ({ path: `/d${index}`, type: 'dir', mode: 0o755 }),
  );
  assert.equal(fixtureToFsEntries(entries).length, GUEST_LIMITS.entries);
  assert.throws(
    () =>
      fixtureToFsEntries([
        ...entries,
        { path: '/extra', type: 'dir', mode: 0o755 },
      ]),
    invalid,
  );
  const exact = '/' + 'é'.repeat(2047) + 'x';
  fixtureToFsEntries([file(exact)]);
  assert.throws(() => fixtureToFsEntries([file(exact + 'x')]), invalid);
});
test('expanded file byte exact boundary accepts and plus one refuses', () => {
  const bytes = new Uint8Array(GUEST_LIMITS.fixture);
  assert.equal(fixtureToFsEntries([file('/a', bytes)])[0].type, 'file');
  assert.throws(
    () =>
      fixtureToFsEntries([
        file('/a', bytes),
        file('/b', new Uint8Array([1]), 'other'),
      ]),
    invalid,
  );
});
