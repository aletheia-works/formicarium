import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitRange,
  validateCommitSubject,
} from '../../scripts/ci/commit-format.js';

test('trusted Conventional Commit validation accepts syntax and rejects malformed subjects', () => {
  for (const subject of [
    'feat: add CI',
    'fix(worker)!: retain Node flags',
    'chore(deps): update types',
  ])
    assert.doesNotThrow(() => validateCommitSubject(subject));
  for (const subject of [
    'fix:',
    'anything goes',
    'feat: \nscript',
    'unknown: subject',
  ])
    assert.throws(() => validateCommitSubject(subject), /Conventional/);
  assert.equal(
    commitRange('0'.repeat(40), 'a'.repeat(40)),
    `${'a'.repeat(40)}^!`,
  );
  assert.throws(() => commitRange('main; injected', 'a'.repeat(40)), /SHA/);
});
