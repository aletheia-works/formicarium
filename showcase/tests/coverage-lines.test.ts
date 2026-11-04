import assert from 'node:assert/strict';
import test from 'node:test';
import { scriptsLineCoverage } from '../scripts/coverage-lines.ts';
import { causeOf } from '../scripts/errors.ts';

const record = (path: string, hits: number[]) =>
  [
    `SF:${path}`,
    ...hits.map((count, index) => `DA:${index + 1},${count}`),
    'end_of_record',
  ].join('\n');

test('the percentage is over all files together, not for each file', () => {
  // One file is at 25%: Bun's per-file threshold would refuse this report.
  const result = scriptsLineCoverage(
    [
      record('showcase/scripts/low.ts', [1, 0, 0, 0]),
      record('showcase/scripts/high.ts', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ].join('\n'),
  );
  assert.deepEqual(result, {
    files: 2,
    lines: 16,
    covered: 13,
    percent: 81.25,
  });
});

test('only showcase/scripts counts; absolute paths match too', () => {
  const result = scriptsLineCoverage(
    [
      record('showcase/tests/fixtures/github.ts', [0, 0, 0]),
      record('runtime/core.ts', [0, 0]),
      record('/home/runner/work/x/showcase/scripts/a.ts', [1, 0]),
    ].join('\n'),
  );
  assert.deepEqual(result, { files: 1, lines: 2, covered: 1, percent: 50 });
});

test('a report without showcase/scripts is refused, not read as covered', () => {
  for (const lcov of ['', record('runtime/core.ts', [1])])
    assert.throws(
      () => scriptsLineCoverage(lcov),
      (error: unknown) => causeOf(error) === 'config-invalid',
    );
});
