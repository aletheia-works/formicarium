import assert from 'node:assert/strict';
import test from 'node:test';

// The site unit tests run as TypeScript in Bun, like the showcase tests: no
// compile step, no second test framework.
test('bun runs the site TypeScript tests directly', () => {
  const [major, minor, patch] = process.versions.bun!.split('.').map(Number);
  assert.ok(
    major! > 1 || (major === 1 && (minor! > 4 || (minor === 4 && patch! >= 4))),
    process.versions.bun!,
  );
  const typed: { value: number } = { value: 1 };
  assert.equal(typed.value, 1);
});
