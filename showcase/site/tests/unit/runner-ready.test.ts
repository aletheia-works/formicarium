import assert from 'node:assert/strict';
import test from 'node:test';

// The site unit tests run as TypeScript through Node's type stripping, like
// the showcase tests: no compile step, no second test framework.
test('node runs the site TypeScript tests directly', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(
    major! > 26 || (major === 26 && minor! >= 12),
    process.versions.node,
  );
  const typed: { value: number } = { value: 1 };
  assert.equal(typed.value, 1);
});
