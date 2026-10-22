import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { guestSha256 } from '../../runtime/guest-validation.js';

const encoder = new TextEncoder();
const known = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
] as const;
for (const [text, expected] of known) {
  test(`SHA256 published vector (${text.length} bytes)`, () => {
    const bytes = encoder.encode(text);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    assert.equal(guestSha256(bytes), expected);
  });
}
for (const length of [55, 56, 63, 64, 65, 127, 128, 129, 65537]) {
  test(`SHA256 binary padding/block boundary ${length} matches Node crypto`, () => {
    const bytes = Uint8Array.from(
      { length },
      (_, index) => (index * 197 + (index >>> 8) + 11) & 255,
    );
    const before = bytes.slice();
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(guestSha256(bytes), expected);
    assert.deepEqual(bytes, before);
  });
}
test('SHA256 offset view excludes prefix/suffix and does not mutate backing bytes', () => {
  const backing = Uint8Array.from({ length: 151 }, (_, index) => index ^ 0xa5);
  const before = backing.slice();
  const bytes = backing.subarray(7, 136);
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.notEqual(expected, createHash('sha256').update(backing).digest('hex'));
  assert.equal(guestSha256(bytes), expected);
  assert.deepEqual(backing, before);
});
test('SHA256 one million a vector preserves complete multi-block hashing', () => {
  const bytes = new Uint8Array(1000000).fill(97);
  const expected =
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0';
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  assert.equal(guestSha256(bytes), expected);
});
