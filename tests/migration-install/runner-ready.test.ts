import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('U3 runner executes Node 26 ESM with web stream primitives', async () => {
  assert.equal(process.versions.node, '26.12.0');
  assert.equal(typeof import.meta.url, 'string');
  const response = new Response(new Uint8Array([127, 69, 76, 70]));
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [127, 69, 76, 70],
  );
  assert.equal(typeof DecompressionStream, 'function');
  assert.equal(typeof crypto.subtle.digest, 'function');
});

test('U3 runner keeps independent consumer exports and fixed development inputs', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.packageManager, 'bun@1.4.3');
  assert.equal(manifest.exports['.'].import, './runtime/public.js');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  const lock = await readFile(
    new URL('../../blink.lock', import.meta.url),
    'utf8',
  );
  assert.match(lock, /^commit=[a-f0-9]{40}$/m);
  for (const name of [
    'typescript',
    '@playwright/test',
    'istanbul-lib-coverage',
  ]) {
    const installed = JSON.parse(
      await readFile(
        new URL(`../../node_modules/${name}/package.json`, import.meta.url),
        'utf8',
      ),
    );
    assert.equal(installed.name, name);
  }
});

test('U3 unit task names only the eight approved unit test files', async () => {
  // mise-tasks/migration/install-unit.sh runs this package.json script.
  const { scripts } = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const task: string | undefined = scripts['migration:install:unit'];
  assert.ok(task);
  assert.ok(task.includes('--test-concurrency=1'));
  assert.equal(task.includes('*'), false);
  for (const name of [
    'runner-ready',
    'catalog',
    'transfer',
    'archive',
    'lifecycle',
    'public',
    'consumer',
    'hash-regression',
  ]) {
    assert.ok(task.includes(`tests/migration-install/${name}.test.js`), name);
  }
  assert.equal(
    task.match(/tests\/migration-install\/[\w-]+\.test\.js/g)?.length,
    8,
  );
});
