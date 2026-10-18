import assert from 'node:assert/strict';
import test from 'node:test';
import * as shared from '../../runtime/public.js';

test('shared public surface contains approved C03/C04/C05 functions, decoder and public errors only', () => {
  assert.deepEqual(Object.keys(shared).sort(), [
    'ERROR_CODES',
    'ExecutionError',
    'createCommandSession',
    'createInstaller',
    'decodeUtf8',
    'fixtureToFsEntries',
    'registerValidatedGuest',
    'runValidatedGuest',
    'validateGuest',
  ]);
});
test('decoder handles valid UTF8 multibyte text', () => {
  assert.equal(
    shared.decodeUtf8(new TextEncoder().encode('こんにちは')),
    'こんにちは',
  );
});
test('decoder preserves NUL character for consumers to choose presentation', () => {
  assert.equal(shared.decodeUtf8(Uint8Array.of(65, 0, 66)), 'A\0B');
});
test('invalid UTF8 has explicit replacement display without mutating authoritative bytes', () => {
  const bytes = Uint8Array.of(255);
  assert.equal(shared.decodeUtf8(bytes), '\ufffd');
  assert.equal(bytes[0], 255);
});
test('empty bytes decode to empty text and decoder rejects nonbytes', () => {
  assert.equal(shared.decodeUtf8(new Uint8Array()), '');
  for (const input of ['text', [65], undefined])
    assert.throws(
      () => shared.decodeUtf8(input as unknown as Uint8Array),
      TypeError,
    );
});
test('public error identity and immutable error inventory match run contract', () => {
  assert.equal(new shared.ExecutionError('SNAPSHOT').code, 'SNAPSHOT');
  assert.ok(shared.ERROR_CODES.includes('DISPOSED'));
  assert.equal(Object.isFrozen(shared.ERROR_CODES), true);
});
