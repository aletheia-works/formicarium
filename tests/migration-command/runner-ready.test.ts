import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const U4_UNIT_FILES = [
  'runner-ready',
  'parse',
  'dispatch',
  'public',
  'consumer',
  'acceptance',
  'acceptance-ci',
];

test('U4 runner executes Node 26.12.0 ESM with the string and encoding primitives the parser uses', () => {
  assert.equal(process.versions.node, '26.12.0');
  assert.equal(typeof import.meta.url, 'string');
  assert.equal(typeof String.prototype.isWellFormed, 'function');
  assert.equal('\uD800'.isWellFormed(), false);
  assert.equal(new TextEncoder().encode('日本語').length, 9);
  assert.equal(typeof AbortSignal.any, 'function');
});

test('U4 runner keeps the root export, Bun manager and the updated @types/node line', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.packageManager, 'bun@1.4.3');
  assert.equal(manifest.exports['.'].import, './runtime/public.js');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  assert.equal(manifest.devDependencies['@types/node'], '^26.6.5');
  for (const path of ['runtime/command.js', 'runtime/command-parse.js'])
    assert.ok(manifest.files.includes(path), path);
  const installed = JSON.parse(
    await readFile(
      new URL('../../node_modules/@types/node/package.json', import.meta.url),
      'utf8',
    ),
  );
  assert.match(installed.version, /^26\./);
  for (const name of [
    'typescript',
    '@playwright/test',
    'istanbul-lib-coverage',
  ]) {
    const dependency = JSON.parse(
      await readFile(
        new URL(`../../node_modules/${name}/package.json`, import.meta.url),
        'utf8',
      ),
    );
    assert.equal(dependency.name, name);
  }
});

test('U4 unit task names exactly the seven approved files by path, without globs', async () => {
  // mise-tasks/migration/command-unit.sh runs this package.json script.
  const { scripts } = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const task: string | undefined = scripts['migration:command:unit'];
  assert.ok(task);
  assert.ok(task.includes('--test-concurrency=1'));
  assert.equal(task.includes('*'), false);
  for (const name of U4_UNIT_FILES)
    assert.ok(task.includes(`tests/migration-command/${name}.test.js`), name);
  assert.equal(
    task.match(/tests\/migration-command\/[\w-]+\.test\.js/g)?.length,
    U4_UNIT_FILES.length,
  );
  const browser: string | undefined = scripts['migration:command:browser'];
  assert.ok(browser?.includes('tests/migration-command/consumer.spec.ts'));
  assert.ok(browser?.includes('--workers=1'));
  assert.ok(browser?.includes('--retries=0'));
});
