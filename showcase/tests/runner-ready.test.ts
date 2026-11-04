import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MIN_LINE_PERCENT } from '../scripts/coverage-lines.ts';
import { REPOSITORY_ROOT, SHOWCASE_ROOT } from '../scripts/paths.ts';

const { scripts } = JSON.parse(
  await readFile(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
// mise-tasks/showcase/<name>.sh runs `bun run showcase:<name>`.
const task = (name: string) =>
  scripts[name.replace(/^showcase-/, 'showcase:')] ?? '';
const { engines } = JSON.parse(
  await readFile(join(SHOWCASE_ROOT, 'package.json'), 'utf8'),
) as { engines: { bun: string } };
const version = (text: string) => text.split('.').map(Number);

test('runs on the Bun version showcase/package.json requires, as TypeScript', () => {
  const required = version(/^>=(\d+\.\d+\.\d+)$/.exec(engines.bun)![1]!);
  const actual = version(process.versions.bun!);
  const order = actual.findIndex((part, index) => part !== required[index]);
  assert.ok(order === -1 || actual[order]! > required[order]!);
  // A typed binding proves that the TypeScript runs without a compile step.
  const typed: number = 1;
  assert.equal(typed, 1);
  assert.match(import.meta.url, /\/showcase\/tests\/runner-ready\.test\.ts$/);
});

test('showcase-unit lists every showcase test file exactly once', async () => {
  const command = task('showcase-unit');
  const listed = command
    .split(/\s+/)
    .filter((part) => /^showcase\/tests\/[\w-]+\.test\.ts$/.test(part));
  const present = (await readdir(join(SHOWCASE_ROOT, 'tests')))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `showcase/tests/${name}`)
    .sort();
  assert.deepEqual([...listed].sort(), present);
  assert.equal(new Set(listed).size, listed.length);
});

test('showcase-unit measures line coverage of showcase/scripts at 80%', () => {
  const command = task('showcase-unit');
  assert.match(command, /^bun test --coverage /);
  assert.match(command, /--coverage-reporter=lcov /);
  assert.match(
    command,
    / && bun showcase\/scripts\/coverage-lines\.ts showcase\/\.work\/coverage\/lcov\.info$/,
  );
  assert.equal(MIN_LINE_PERCENT, 80);
});

test('browser acceptance keeps one worker, no retry and the 840 s timeout', async () => {
  const config = await readFile(
    join(SHOWCASE_ROOT, 'tests', 'playwright.config.ts'),
    'utf8',
  );
  assert.match(config, /workers: 1,/);
  assert.match(config, /retries: 0,/);
  assert.match(config, /timeout: 840000,/);
  assert.match(task('showcase-accept-browser'), /--workers=1 --retries=0/);
});
