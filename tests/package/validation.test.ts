import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkInterpreter,
  elfInterpreter,
  normalizePath,
  normalizeRoots,
  SYSTEM_ENTRY_LIMITS,
  validateAssets,
  validateElf,
  validateEntries,
  validateRun,
  validateSystemEntries,
} from '../../runtime/validation.js';
import { entryAt } from '../shared/assertions.js';
import { dynamicElfHeader, elfHeader, fileEntry } from './fixtures.js';

const roots = ['/root', '/work'];
test('absolute POSIX paths normalize dots and slashes but reject traversal and NUL', () => {
  assert.equal(normalizePath('/work//./input/'), '/work/input');
  for (const input of [
    '',
    'relative',
    '/work/../root',
    '/work/\0input',
    null,
  ]) {
    assert.throws(() => normalizePath(input), { code: 'INVALID_INPUT' });
  }
});
test('persistence roots merge overlap and reject reserved locations at component boundaries', () => {
  assert.deepEqual(normalizeRoots('/work', '/work/home'), ['/work']);
  assert.deepEqual(normalizeRoots('/work', '/work'), ['/work']);
  assert.deepEqual(normalizeRoots('/worker', '/root'), ['/root', '/worker']);
  for (const path of ['/', '/guest', '/dev/fd', '/proc/x', '/tmp/a']) {
    assert.throws(() => normalizeRoots(path, '/root'), {
      code: 'INVALID_INPUT',
    });
  }
});
test('seed parents are 0755 and explicit directory modes do not depend on ordering', () => {
  const file = fileEntry('/work/nested/input');
  const directory = { path: '/work/nested', type: 'dir' as const, mode: 0o700 };
  const options = { seed: true, directories: roots };
  const a = validateEntries([file, directory], roots, options);
  assert.deepEqual(a, validateEntries([directory, file], roots, options));
  assert.equal(entryAt(a, '/work', 'dir').mode, 0o755);
  assert.equal(entryAt(a, directory.path, 'dir').mode, 0o700);
});
test('seed refuses a file or symlink parent atomically', () => {
  for (const parent of [
    fileEntry('/work/parent'),
    { path: '/work/parent', type: 'symlink' as const, target: '/work' },
  ]) {
    assert.throws(
      () =>
        validateEntries([fileEntry('/work/parent/child'), parent], roots, {
          seed: true,
        }),
      { code: 'INVALID_INPUT' },
    );
  }
});
test('entry boundary rejects duplicates, escapes, invalid modes/types and missing inode', () => {
  const file = fileEntry();
  for (const entries of [
    [file, { ...file, path: '/work/./input' }],
    [fileEntry('/worker/x')],
    [{ ...file, mode: 4096 }],
    [{ ...file, type: 'socket' }],
    [{ ...file, inodeId: '' }],
    [{ ...file, data: 'text' }],
  ]) {
    assert.throws(() => validateEntries(entries, roots, { seed: true }), {
      code: 'INVALID_INPUT',
    });
  }
});
test('hard-link groups must have identical copied data and modes', () => {
  const first = fileEntry();
  const second = { ...first, path: '/work/peer' };
  const copy = validateEntries([first, second], roots, { seed: true });
  first.data[0] = 99;
  assert.equal(entryAt(copy, second.path, 'file').data[0], 1);
  for (const mismatch of [
    { ...second, mode: 0o600 },
    { ...second, data: Uint8Array.of(9) },
  ]) {
    assert.throws(
      () => validateEntries([first, mismatch], roots, { seed: true }),
      { code: 'INVALID_INPUT' },
    );
  }
});
test('symlink relative targets remain inside roots and snapshot cannot invent parents', () => {
  const dir = { path: '/work', type: 'dir' as const, mode: 0o755 };
  assert.equal(
    validateEntries(
      [
        dir,
        { path: '/work/link', type: 'symlink' as const, target: './child' },
      ],
      roots,
    ).length,
    2,
  );
  for (const target of ['../../etc/passwd', '/outside', '', '\0']) {
    assert.throws(
      () =>
        validateEntries(
          [{ path: '/work/link', type: 'symlink' as const, target }],
          roots,
          { seed: true },
        ),
      { code: 'INVALID_INPUT' },
    );
  }
  assert.throws(
    () => validateEntries([fileEntry('/work/child/input')], roots),
    { code: 'INVALID_INPUT' },
  );
  assert.throws(() => validateEntries([fileEntry('/work')], roots), {
    code: 'INVALID_INPUT',
  });
  assert.deepEqual(validateEntries([], roots), []);
});
test('ELF validation copies accepted ELF and rejects incompatible headers', () => {
  const elf = elfHeader();
  const copy = validateElf(elf);
  elf[0] = 0;
  assert.equal(copy[0], 127);
  for (const [offset, value] of [
    [0, 0],
    [4, 1],
    [5, 2],
    [18, 3],
    [52, 0],
    [16, 1],
  ]) {
    const wrong = elfHeader();
    wrong[offset] = value;
    assert.throws(() => validateElf(wrong), { code: 'INVALID_INPUT' });
  }
  assert.throws(() => validateElf(new Uint8Array(63)), {
    code: 'INVALID_INPUT',
  });
});
test('ELF header and segment bounds cannot overflow', () => {
  const wrong = elfHeader();
  const header = new DataView(wrong.buffer);
  header.setBigUint64(32, 2n ** 63n, true);
  header.setUint16(56, 1, true);
  assert.throws(() => validateElf(wrong), { code: 'INVALID_INPUT' });
  for (const mutate of [
    (view: DataView) => view.setUint16(56, 0, true),
    (view: DataView) => view.setUint16(56, 257, true),
    (view: DataView) => view.setUint16(54, 0, true),
    (view: DataView) => view.setBigUint64(32, 0n, true),
    (view: DataView) => view.setUint32(64, 4, true),
    (view: DataView) => view.setBigUint64(72, 1n, true),
    (view: DataView) => view.setBigUint64(104, 119n, true),
  ]) {
    const bytes = elfHeader();
    mutate(new DataView(bytes.buffer));
    assert.throws(() => validateElf(bytes), { code: 'INVALID_INPUT' });
  }
});
test('run inputs copy guest, args and env and retain the public default timeout', () => {
  const options = {
    guest: elfHeader(),
    args: ['one'],
    env: { TEST: 'original' },
  };
  const copy = validateRun(options, '/root');
  options.guest[0] = 0;
  options.args[0] = 'changed';
  options.env.TEST = 'changed';
  assert.equal(copy.guest[0], 127);
  assert.deepEqual(copy.args, ['one']);
  assert.equal(copy.env.TEST, 'original');
  assert.equal(copy.env.HOME, '/root');
  assert.equal(copy.timeoutMs, 600000);
});
test('run validation rejects invalid strings, env, timeout, callback and abort state', () => {
  for (const extra of [
    { args: ['\0'] },
    { args: 'one' },
    { env: { 'A=B': 'x' } },
    { env: { A: 1 } },
    { env: { HOME: '/other' } },
    { env: { A: '\0' } },
    { timeoutMs: 0 },
    { timeoutMs: Infinity },
    { timeoutMs: 1.2 },
    { onOutput: 1 },
    { signal: {} },
  ]) {
    assert.throws(
      // @ts-expect-error Deliberately malformed input exercises the runtime guard.
      () => validateRun({ guest: elfHeader(), ...extra }, '/root'),
      { code: 'INVALID_INPUT' },
    );
  }
  const controller = new AbortController();
  controller.abort();
  assert.throws(
    () =>
      validateRun({ guest: elfHeader(), signal: controller.signal }, '/root'),
    { code: 'ABORTED' },
  );
});
test('asset URLs are copied and absolute supported schemes are mandatory', () => {
  const assets = Object.fromEntries(
    ['loaderURL', 'wasmURL', 'workerURL', 'buildInfoURL'].map((name) => [
      name,
      new URL(`https://example.test/${name}`),
    ]),
  );
  assert.equal(typeof validateAssets(assets).loaderURL, 'string');
  for (const loaderURL of [
    'relative',
    'blob:https://example.test/id',
    undefined,
  ]) {
    assert.throws(() => validateAssets({ ...assets, loaderURL }), {
      code: 'INVALID_INPUT',
    });
  }
});

test('a dynamically linked ELF names one absolute dynamic linker ending in NUL', () => {
  const guest = validateElf(dynamicElfHeader());
  assert.equal(elfInterpreter(guest), '/lib/ld-musl-x86_64.so.1');
  assert.equal(elfInterpreter(validateElf(elfHeader())), null);
  const encode = (text: string) => new TextEncoder().encode(text);
  for (const text of [
    encode(''),
    encode('\0'),
    encode('lib/ld.so\0'),
    encode('/lib/ld.so'),
    encode('/lib\0/ld.so\0'),
    encode(`/${'a'.repeat(4095)}\0`),
  ])
    assert.throws(() => validateElf(dynamicElfHeader('', text)), {
      code: 'INVALID_INPUT',
      message: 'ELF interpreter must be one absolute path ending in NUL',
    });
  assert.equal(
    elfInterpreter(validateElf(dynamicElfHeader(`/${'a'.repeat(4094)}`))),
    `/${'a'.repeat(4094)}`,
  );
  const twice = dynamicElfHeader();
  new DataView(twice.buffer).setUint32(64, 3, true);
  assert.throws(() => validateElf(twice), { code: 'INVALID_INPUT' });
});
test('system entries stay outside the roots and reserved paths, with their parents added', () => {
  const library = fileEntry('/lib/x86_64-linux-gnu/libc.so.6');
  const entries = validateSystemEntries(
    [
      library,
      { path: '/lib64', type: 'symlink', target: 'lib' },
      { path: '/usr', type: 'dir', mode: 0o700 },
      { path: '/etc/ssl/certs', type: 'dir', mode: 0o755 },
      { path: '/bin', type: 'symlink', target: 'usr/bin' },
    ],
    roots,
  );
  assert.deepEqual(
    entries.map((entry) => entry.path),
    [
      '/bin',
      '/etc',
      '/etc/ssl',
      '/etc/ssl/certs',
      '/lib',
      '/lib/x86_64-linux-gnu',
      '/lib/x86_64-linux-gnu/libc.so.6',
      '/lib64',
      '/usr',
    ],
  );
  library.data[0] = 9;
  assert.equal(
    entryAt(entries, '/lib/x86_64-linux-gnu/libc.so.6', 'file').data[0],
    1,
  );
  assert.deepEqual(validateSystemEntries([], roots), []);
  for (const [raw, message] of [
    [fileEntry('/work/lib.so'), /outside the persistence roots/],
    [fileEntry('/root'), /outside the persistence roots/],
    [fileEntry('/tmp/lib.so'), /outside the persistence roots/],
    [fileEntry('/usr/bin/tool'), /outside the persistence roots/],
    [fileEntry('/guest/program'), /outside the persistence roots/],
    [{ path: '/', type: 'dir', mode: 0o755 }, /outside the persistence roots/],
    [
      { path: '/usr', type: 'symlink', target: 'opt' },
      /only a system directory/,
    ],
    [fileEntry('/usr'), /only a system directory/],
    [
      { path: '/lib', type: 'symlink', target: '/work' },
      /into the persistence roots/,
    ],
    [
      { path: '/lib', type: 'symlink', target: '../root/x' },
      /into the persistence roots/,
    ],
    [
      { path: '/x', type: 'symlink', target: '/' },
      /into the persistence roots/,
    ],
    [
      { path: '/lib', type: 'symlink', target: '..' },
      /into the persistence roots/,
    ],
    [{ path: '/lib', type: 'pipe' }, /type is invalid/],
    [{ path: '/lib', type: 'dir', mode: 0o10000 }, /mode is invalid/],
    [{ ...fileEntry('/lib/a'), inodeId: '' }, /inodeId is invalid/],
    [null, /must be an object/],
    [{ path: 'lib' }, /absolute POSIX path/],
  ] as const)
    assert.throws(() => validateSystemEntries([raw], roots), {
      code: 'INVALID_INPUT',
      message: message as RegExp,
    });
  for (const bad of [
    [fileEntry('/lib/a'), fileEntry('/lib/a')],
    [fileEntry('/lib'), fileEntry('/lib/a')],
    [
      { ...fileEntry('/lib/a'), inodeId: 'same' },
      { ...fileEntry('/lib/b', Uint8Array.of(3)), inodeId: 'same' },
    ],
  ])
    assert.throws(() => validateSystemEntries(bad, roots), {
      code: 'INVALID_INPUT',
    });
  // A target above a root other than `/` leads into it too.
  assert.throws(
    () =>
      validateSystemEntries(
        [{ path: '/srv', type: 'symlink', target: '/home' }],
        ['/home/guest', '/work'],
      ),
    { code: 'INVALID_INPUT', message: /into the persistence roots/ },
  );
  assert.throws(() => validateSystemEntries('/lib', roots), {
    code: 'INVALID_INPUT',
  });
  assert.throws(
    () =>
      validateSystemEntries(
        Array.from({ length: SYSTEM_ENTRY_LIMITS.entries + 1 }, (_, index) => ({
          path: `/lib/${index}`,
          type: 'dir',
          mode: 0o755,
        })),
        roots,
      ),
    { code: 'INVALID_INPUT', message: /at most 4096 entries/ },
  );
  const half = new Uint8Array(SYSTEM_ENTRY_LIMITS.bytes / 2 + 1);
  assert.throws(
    () =>
      validateSystemEntries(
        [fileEntry('/lib/a', half), fileEntry('/lib/b', half)],
        roots,
      ),
    { code: 'INVALID_INPUT', message: /exceed 268435456 bytes/ },
  );
});
test('the dynamic linker must be a file the run places, found through symlinks', () => {
  const guest = validateElf(dynamicElfHeader('/lib64/./ld.so'));
  const linker = fileEntry('/usr/lib/ld.so');
  const placed = [
    { path: '/lib64', type: 'symlink', target: 'usr/lib' },
    { path: '/usr', type: 'dir' },
    { path: '/usr/lib', type: 'dir' },
    linker,
  ];
  checkInterpreter(guest, placed);
  checkInterpreter(
    validateElf(dynamicElfHeader('/usr/lib/../lib/ld.so')),
    placed,
  );
  checkInterpreter(validateElf(dynamicElfHeader('/usr/bin/ld')), [
    { path: '/usr/bin/ld' },
  ]);
  checkInterpreter(validateElf(dynamicElfHeader('/lib64/ld.so')), [
    { path: '/lib64', type: 'symlink', target: '/usr/lib' },
    { path: '/usr/lib/ld.so', type: 'symlink', target: 'real.so' },
    { path: '/usr/lib/real.so', type: 'file' },
  ]);
  checkInterpreter(validateElf(elfHeader()), []);
  const missing = { code: 'INVALID_INPUT', message: /is not in the session/ };
  assert.throws(() => checkInterpreter(guest, []), missing);
  assert.throws(
    () => checkInterpreter(validateElf(dynamicElfHeader('/usr/lib')), placed),
    missing,
  );
  assert.throws(
    () =>
      checkInterpreter(validateElf(dynamicElfHeader('/lib/ld.so')), [
        { path: '/lib', type: 'symlink', target: 'lib' },
      ]),
    missing,
  );
});
