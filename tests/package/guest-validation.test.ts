import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GUEST_LIMITS,
  type GuestHandle,
  guestCanonical,
  guestSha256,
  guestSnapshot,
  validateGuest,
} from '../../runtime/guest-validation.js';
import { digest, elf, expectation } from './session-fixtures.js';

const invalid = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'INVALID_INPUT';

test('synchronous SHA256 matches independent empty, UTF8 and multiblock vectors', () => {
  for (const text of [
    '',
    'abc',
    '日本語🪴',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000000),
  ]) {
    const bytes = new TextEncoder().encode(text);
    assert.equal(guestSha256(bytes), digest(bytes));
  }
});
test('canonical keys sort recursively and reject unsafe numbers, cycles and lone surrogate', () => {
  assert.equal(
    guestCanonical({ z: [3, { b: true, a: null }], a: 'x' }),
    '{{"a":"x","z":[3,{"a":null,"b":true}]}}'.slice(1, -1),
  );
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const value of [
    NaN,
    Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    '\ud800',
    { value: undefined },
    cycle,
    Array(1),
  ])
    assert.throws(() => guestCanonical(value), invalid);
});
test('valid guest owns bytes and independent frozen public metadata', () => {
  const bytes = elf();
  const expected = expectation(bytes, { provenance: { note: 'original' } });
  const handle = validateGuest(bytes, expected);
  bytes[0] = 0;
  (expected.identity.provenance as { note: string }).note = 'changed';
  assert.equal(guestSnapshot(handle).bytes[0], 127);
  assert.equal(
    (handle.buildInfo.provenance as { note: string }).note,
    'original',
  );
  assert.equal(Object.isFrozen(handle.buildInfo.provenance), true);
  const snapshot = guestSnapshot(handle);
  snapshot.bytes[0] = 0;
  assert.equal(guestSnapshot(handle).bytes[0], 127);
});
test('forged and another module instance handles carry no authority', async () => {
  assert.throws(
    () =>
      guestSnapshot({
        digest: 'a'.repeat(64),
        buildInfo: expectation().identity,
      }),
    invalid,
  );
  const another = await import(
    `../../runtime/guest-validation.js?instance=${Date.now()}`
  );
  const handle = another.validateGuest(elf(), expectation()) as GuestHandle;
  assert.throws(() => guestSnapshot(handle), invalid);
});
test('full ELF and metadata digests reject tamper and unknown fields affect identity', () => {
  const bytes = elf();
  const expected = expectation(bytes);
  const changed = new Uint8Array(bytes);
  changed[119] = 1;
  assert.throws(() => validateGuest(changed, expected), invalid);
  expected.identity.note = 'extra';
  assert.throws(() => validateGuest(bytes, expected), invalid);
  const accepted = expectation(bytes, { note: 'extra' });
  assert.notEqual(accepted.buildInfoSha256, expectation(bytes).buildInfoSha256);
  validateGuest(bytes, accepted);
});
test('metadata required identities, schema, key and duplicate dependency reject', () => {
  const changes: Record<string, unknown>[] = [
    { schemaVersion: 2 },
    { target: 'wasm32' },
    { buildKey: 'a'.repeat(64) },
    { source: { repository: 'https://example.org', commit: 'main' } },
    { tool: '../tool' },
    { builderHash: 'bad' },
    { rustc: '' },
    { sourcePatches: [{ name: 'patch', sha256: 'bad' }] },
    {
      dependencies: Array(2).fill({
        tool: 'dep',
        repository: 'https://example.org/dep',
        commit: 'd'.repeat(40),
        digest: 'e'.repeat(64),
      }),
    },
  ];
  for (const change of changes) {
    const expected = expectation();
    Object.assign(expected.identity, change);
    expected.buildInfoSha256 = digest(guestCanonical(expected.identity));
    assert.throws(() => validateGuest(elf(), expected), invalid);
  }
});
test('ELF architecture, dynamic interpreter, table overflow and load memory overflow reject', () => {
  for (const modify of [
    (view: DataView) => view.setUint16(18, 3, true),
    (view: DataView) => view.setUint32(64, 3, true),
    (view: DataView) => view.setBigUint64(32, 0xffffffffffffffffn, true),
    (view: DataView) => view.setBigUint64(72, 121n, true),
    (view: DataView) => {
      view.setBigUint64(80, 0xffffffffffffffffn, true);
      view.setBigUint64(104, 1n, true);
    },
  ]) {
    const bytes = elf();
    modify(new DataView(bytes.buffer));
    assert.throws(() => validateGuest(bytes, expectation(bytes)), invalid);
  }
  assert.throws(
    () => validateGuest(elf().subarray(0, 119), expectation()),
    invalid,
  );
});
test('metadata exact byte limit accepts and plus one refuses', () => {
  const bytes = elf();
  const expected = expectation(bytes, { padding: '' });
  const size = new TextEncoder().encode(
    guestCanonical(expected.identity),
  ).length;
  expected.identity.padding = 'x'.repeat(GUEST_LIMITS.metadata - size);
  expected.buildInfoSha256 = digest(guestCanonical(expected.identity));
  validateGuest(bytes, expected);
  expected.identity.padding += 'x';
  expected.buildInfoSha256 = digest(guestCanonical(expected.identity));
  assert.throws(() => validateGuest(bytes, expected), invalid);
});
test('ELF exact byte limit accepts and plus one refuses before digest', () => {
  const bytes = elf(GUEST_LIMITS.elf);
  validateGuest(bytes, expectation(bytes));
  assert.throws(
    () => validateGuest(new Uint8Array(GUEST_LIMITS.elf + 1), expectation()),
    invalid,
  );
});
