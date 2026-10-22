import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { copySharedTestHelpers } from '../../scripts/package/coverage.js';
import { compiledTestConfig } from '../../scripts/playwright-build-config.js';

test('coverage preparation preserves shared assertion helpers imported by selected tests', async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), 'formicarium-coverage-'));
  try {
    const out = resolve(scratch, 'instrumented');
    await copySharedTestHelpers(
      fileURLToPath(new URL('../../', import.meta.url)),
      out,
    );
    const original = await readFile(
      new URL('../shared/assertions.js', import.meta.url),
    );
    const helperPath = resolve(out, 'tests/shared/assertions.js');
    assert.deepEqual(await readFile(helperPath), original);
    const helpers = await import(pathToFileURL(helperPath).href);
    assert.ok(Object.keys(helpers).length > 0);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('package coverage selects instrumented JavaScript with valid TypeScript configuration', async () => {
  const source = await readFile(
    new URL('../package/playwright.config.ts', import.meta.url),
    'utf8',
  );
  const config = compiledTestConfig(source, '/tmp/browser-results');
  assert.match(config, /testMatch:\s*['"][^'"]*\.spec\.js['"]/);
  assert.match(config, /outputDir:/);
  assert.doesNotThrow(() => stripTypeScriptTypes(config));
});
test('coverage refuses a missing test selector', () => {
  assert.throws(() => compiledTestConfig('export default {};'), /testMatch/);
});
test('emitted isolation worker remains a classic script and installs all handlers', async () => {
  const handlers: string[] = [];
  const source = await readFile(
    new URL('../../web/coi-sw.js', import.meta.url),
    'utf8',
  );
  const script = new Script(source);
  script.runInNewContext({
    self: {
      addEventListener(name: string) {
        handlers.push(name);
      },
    },
    Headers,
    Response,
    fetch,
    console,
  });
  assert.deepEqual(handlers, ['install', 'activate', 'fetch']);
});
