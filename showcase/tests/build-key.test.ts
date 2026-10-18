import assert from 'node:assert/strict';
import test from 'node:test';
import type { GuestBuildInfo } from '@aletheia-works/formicarium';
import {
  builderHash,
  buildKey,
  canonicalJson,
  canonicalSha256,
  parseUniqueJson,
} from '../scripts/build-key.ts';
import { causeOf } from '../scripts/errors.ts';

const throwsCause = (run: () => unknown, code: string) =>
  assert.throws(run, (error) => causeOf(error) === code);

function info(overrides: Partial<GuestBuildInfo> = {}): GuestBuildInfo {
  return {
    schemaVersion: 1,
    tool: 'pitchfork',
    versionOrName: '2.30.0',
    source: {
      repository: 'https://github.com/jdx/pitchfork',
      commit: 'a'.repeat(40),
    },
    target: 'x86_64-unknown-linux-musl',
    rustc: 'rustc 1.99.0',
    sourcePatches: [],
    dependencies: [
      {
        tool: 'cargo-lock',
        repository: 'https://github.com/jdx/pitchfork',
        commit: 'a'.repeat(40),
        digest: 'c'.repeat(64),
      },
      {
        tool: 'aube',
        repository: 'https://github.com/aubepkg/aube',
        commit: 'b'.repeat(40),
        digest: 'd'.repeat(64),
      },
    ],
    builderHash: 'e'.repeat(64),
    buildKey: '',
    elfSha256: 'f'.repeat(64),
    ...overrides,
  };
}

test('canonical JSON sorts keys recursively, keeps array order and has no spaces', () => {
  assert.equal(
    canonicalJson({ b: [3, { z: 1, a: null }], a: 'x', c: true }),
    '{"a":"x","b":[3,{"a":null,"z":1}],"c":true}',
  );
  assert.equal(
    canonicalSha256({ b: 1, a: 2 }),
    canonicalSha256({ a: 2, b: 1 }),
  );
});

test('canonical JSON refuses lone surrogates, unsafe numbers and non-JSON values', () => {
  throwsCause(() => canonicalJson({ a: '\uD800' }), 'config-invalid');
  throwsCause(() => canonicalJson({ '\uDC00': 1 }), 'config-invalid');
  assert.equal(canonicalJson('😀'), '"😀"');
  throwsCause(() => canonicalJson(1.5), 'config-invalid');
  throwsCause(() => canonicalJson(2 ** 53), 'config-invalid');
  throwsCause(() => canonicalJson(new Date(0)), 'config-invalid');
  throwsCause(() => canonicalJson({ a: undefined }), 'config-invalid');
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  throwsCause(() => canonicalJson(cycle), 'config-invalid');
});

test('unique JSON parsing refuses duplicate keys, including escaped aliases', () => {
  assert.deepEqual(parseUniqueJson('{"a":[1,{"b":2}],"c":"d"}'), {
    a: [1, { b: 2 }],
    c: 'd',
  });
  throwsCause(() => parseUniqueJson('{"a":1,"a":2}'), 'bad-body');
  throwsCause(() => parseUniqueJson('{"a":1,"\\u0061":2}'), 'bad-body');
  throwsCause(() => parseUniqueJson('{"a":1} x'), 'bad-body');
  throwsCause(() => parseUniqueJson('{"a":tru}'), 'bad-body');
});

test('buildKey is independent of key order, dependency order, time and output digest', () => {
  const base = buildKey(info());
  const reordered = info();
  reordered.dependencies = [...reordered.dependencies].reverse();
  assert.equal(buildKey(reordered), base);
  assert.equal(
    buildKey(
      info({
        elfSha256: '0'.repeat(64),
        builtAt: '2026-10-18',
      } as Partial<GuestBuildInfo>),
    ),
    base,
  );
});

test('changing any single buildKey input changes the key', () => {
  const base = buildKey(info());
  const variants: Partial<GuestBuildInfo>[] = [
    { tool: 'other' },
    {
      source: {
        repository: 'https://github.com/jdx/pitchfork',
        commit: '1'.repeat(40),
      },
    },
    {
      source: {
        repository: 'https://github.com/other/pitchfork',
        commit: 'a'.repeat(40),
      },
    },
    { builderHash: '1'.repeat(64) },
    { rustc: 'rustc 1.100.0' },
    { rustc: null },
    { sourcePatches: [{ name: 'fix.patch', sha256: '2'.repeat(64) }] },
    { dependencies: [] },
  ];
  const keys = variants.map((variant) => buildKey(info(variant)));
  assert.ok(keys.every((key) => key !== base));
  assert.equal(new Set(keys).size, keys.length);
});

test('duplicate dependency identities and duplicate builder files are refused', () => {
  const duplicate = info();
  duplicate.dependencies = [
    duplicate.dependencies[0]!,
    { ...duplicate.dependencies[0]!, digest: '9'.repeat(64) },
  ];
  throwsCause(() => buildKey(duplicate), 'config-invalid');
  const files = [{ path: 'scripts/a.ts', sha256: 'a'.repeat(64) }];
  assert.notEqual(
    builderHash(files, { rustc: 'x' }),
    builderHash(files, { rustc: 'y' }),
  );
  assert.equal(
    builderHash([...files, { path: 'b', sha256: 'b'.repeat(64) }], {}),
    builderHash([{ path: 'b', sha256: 'b'.repeat(64) }, ...files], {}),
  );
  throwsCause(() => builderHash([...files, ...files], {}), 'config-invalid');
});
