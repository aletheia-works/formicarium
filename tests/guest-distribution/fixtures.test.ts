import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertFixture,
  selectFixture,
} from '../../integration/guest-distribution/fixtures.js';
import { entryAt } from '../shared/assertions.js';

const file = (path = '/work/app/file', extra = {}) => ({
  path,
  type: 'file' as const,
  mode: 0o644,
  inodeId: 'file-one',
  data: new Uint8Array([0, 255]),
  ...extra,
});

test('UTF-8 legacy map becomes owned /work files and implicit directories', () => {
  const entries = convertFixture(
    { 'app/package.json': '{"name":"例"}', 'outside/value': 'ok' },
    { cwd: '/work/app' },
  );
  assert.deepEqual(
    entries.filter((e) => e.type === 'dir').map((e) => e.path),
    ['/work', '/work/app', '/work/outside'],
  );
  const entry = entryAt(entries, '/work/app/package.json', 'file');
  assert.equal(new TextDecoder().decode(entry.data), '{"name":"例"}');
  assert.equal(entry.mode, 0o644);
  assert.notEqual(
    entry.inodeId,
    entryAt(entries, '/work/outside/value', 'file').inodeId,
  );
});

test('fixture default, empty seed selection and cwd semantics', () => {
  const tool = { fixture: 'default', cwd: '/work/app' };
  const fixtures = { default: {}, other: {} };
  assert.deepEqual(selectFixture(tool, undefined, fixtures), {
    name: 'default',
    cwd: '/work/app',
  });
  assert.deepEqual(selectFixture(tool, '', fixtures), {
    name: '',
    cwd: '/work',
  });
  assert.deepEqual(selectFixture({}, undefined, {}), {
    name: '',
    cwd: '/work',
  });
  assert.deepEqual(selectFixture({ fixture: 'other' }, undefined, fixtures), {
    name: 'other',
    cwd: '/work',
  });
  assert.throws(
    () => selectFixture(tool, 'missing', fixtures),
    /unknown fixture/,
  );
  assert.throws(
    () => selectFixture(tool, 'toString', fixtures),
    /unknown fixture/,
  );
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  assert.throws(() => selectFixture(tool, null, fixtures), /invalid selection/);
});

test('explicit binary bytes are copied and mode/inode are preserved', () => {
  const source = file();
  const entries = convertFixture([
    source,
    file('/work/app/other', { inodeId: 'file-two', data: [128, 0] }),
  ]);
  const copy = entries.find((e) => e.type === 'file')!;
  assert.deepEqual(copy.data, source.data);
  assert.notEqual(copy.data, source.data);
  source.data[0] = 17;
  assert.equal(copy.data[0], 0);
  assert.equal(copy.inodeId, 'file-one');
  assert.equal(copy.mode, 0o644);
  assert.equal(
    convertFixture([file('/root/config')]).find((e) => e.type === 'file')?.path,
    '/root/config',
  );
});

test('duplicate normalized paths, traversal, outside roots and invalid UTF-8 maps fail', () => {
  for (const payload of [
    [file(), file('/work/app/./file')],
    [file('/work/../file')],
    [file('/tmp/file')],
    [file('relative')],
    [file('/work/a\0b')],
    { '/absolute': 'value' },
    { '../file': 'value' },
    { file: 123 },
    null,
  ]) {
    assert.throws(() => convertFixture(payload));
  }
});

test('entry types, modes, inode identity and hard-link byte consistency are validated', () => {
  for (const extra of [
    { type: 'socket' },
    { mode: -1 },
    { mode: 0o10000 },
    { mode: 1.1 },
    { inodeId: '' },
    { inodeId: 'x\0y' },
    { data: 'secret' },
    { data: [256] },
  ]) {
    assert.throws(() => convertFixture([file('/work/app/file', extra)]));
  }
  assert.doesNotThrow(() => convertFixture([file(), file('/work/app/link')]));
  assert.throws(
    () => convertFixture([file(), file('/work/app/link', { data: [1] })]),
    /hard-link/,
  );
  assert.throws(
    () => convertFixture([file(), file('/work/app/link', { mode: 0o600 })]),
    /hard-link/,
  );
  assert.throws(() => convertFixture([file('/work')]), /root/);
});

test('symlink targets stay inside /work and cannot be intermediate parents', () => {
  const link = {
    path: '/work/app/link',
    type: 'symlink' as const,
    target: '../data',
  };
  assert.equal(
    convertFixture([link]).find((e) => e.type === 'symlink')?.target,
    '../data',
  );
  for (const target of ['../../../etc', '/etc/passwd', '', 'x\0y']) {
    assert.throws(() => convertFixture([{ ...link, target }]));
  }
  assert.throws(
    () => convertFixture([link, file('/work/app/link/file')]),
    /non-directory parent/,
  );
  assert.throws(
    () => convertFixture([file('/work/app'), file()]),
    /non-directory parent/,
  );
});

test('cwd is normalized, lies inside root, remains a directory, and error excludes file values', () => {
  assert.equal(
    convertFixture({}, { cwd: '/work/./app/' }).at(-1)?.path,
    '/work/app',
  );
  assert.throws(
    () => convertFixture([file('/work/app')], { cwd: '/work/app' }),
    /cwd/,
  );
  assert.throws(() => convertFixture({}, { cwd: '/guest' }), /outside/);
  assert.throws(
    () =>
      selectFixture({ fixture: 'seed', cwd: '/etc' }, undefined, { seed: {} }),
    /outside/,
  );
  assert.throws(
    () => convertFixture({ '../x': 'secret-value' }),
    (error: Error) => !error.message.includes('secret-value'),
  );
});
