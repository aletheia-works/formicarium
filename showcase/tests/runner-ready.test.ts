import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { REPOSITORY_ROOT, SHOWCASE_ROOT } from '../scripts/paths.ts';

const { scripts } = JSON.parse(
  await readFile(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
// mise-tasks/showcase/<name>.sh runs `bun run showcase:<name>`.
const task = (name: string) =>
  scripts[name.replace(/^showcase-/, 'showcase:')] ?? '';
const { engines } = JSON.parse(
  await readFile(join(SHOWCASE_ROOT, 'package.json'), 'utf8'),
) as { engines: { node: string } };
const version = (text: string) => text.split('.').map(Number);

test('runs on the Node version showcase/package.json requires, as ESM with type stripping', () => {
  const required = version(/^>=(\d+\.\d+\.\d+)$/.exec(engines.node)![1]!);
  const actual = version(process.versions.node);
  const order = actual.findIndex((part, index) => part !== required[index]);
  assert.ok(order === -1 || actual[order]! > required[order]!);
  // `require` is undefined in an ES module; a typed binding proves stripping.
  assert.equal(typeof require, 'undefined');
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
  assert.match(command, /--test-concurrency=1/);
  assert.match(command, /--experimental-test-coverage/);
  assert.match(command, /--test-coverage-include='showcase\/scripts\/\*\*'/);
  assert.match(command, /--test-coverage-lines=80(?:\s|$)/);
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
