import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type FormicariumManifest,
  LoaderError,
  loadFormicarium,
  packageAssets,
  packageUrl,
} from '../../src/terminal/formicarium-loader.ts';

const ROOT = new URL('https://aletheia-works.github.io/formicarium/');
const manifest = (): FormicariumManifest => ({
  version: '0.3.0',
  base: '_formicarium/0.3.0/',
  root: 'runtime/public.js',
  browser: 'runtime/web/api.js',
  assets: {
    loader: 'assets/paludarium/index.mjs',
    wasm: 'assets/paludarium/paludarium.wasm',
    worker: 'runtime/web/package-worker.bundle.js',
    buildInfo: 'assets/paludarium/build-info.json',
  },
  files: [
    'assets/paludarium/index.mjs',
    'assets/paludarium/paludarium.wasm',
    'assets/paludarium/build-info.json',
    'runtime/public.js',
    'runtime/web/api.js',
    'runtime/web/package-worker.bundle.js',
  ].map((path) => ({ path, sha256: 'a'.repeat(64), bytes: 1 })),
});

test('the four public Assets URLs point into the same-origin _formicarium copy', () => {
  assert.deepEqual(packageAssets(manifest(), ROOT), {
    loaderURL:
      'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/assets/paludarium/index.mjs',
    wasmURL:
      'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/assets/paludarium/paludarium.wasm',
    workerURL:
      'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/runtime/web/package-worker.bundle.js',
    buildInfoURL:
      'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/assets/paludarium/build-info.json',
  });
});

test('unlisted files, `..`, a foreign base and another version directory are refused', () => {
  assert.throws(
    () => packageUrl(manifest(), ROOT, 'runtime/node/api.js'),
    /not a staged file/,
  );
  const dotted = manifest();
  dotted.files.push({ path: '../x.js', sha256: 'a'.repeat(64), bytes: 1 });
  assert.throws(() => packageUrl(dotted, ROOT, '../x.js'), /path refused/);
  for (const base of [
    '../outside/',
    'https://cdn.example/',
    '_formicarium/0.2.1/',
    '_formicarium/0.3.0/../',
  ])
    assert.throws(
      () => packageUrl({ ...manifest(), base }, ROOT, 'runtime/public.js'),
      LoaderError,
      base,
    );
});

test('the entries are imported from their staged URLs', async () => {
  const imported: string[] = [];
  const loaded = await loadFormicarium(manifest(), ROOT, async (url) => {
    imported.push(url);
    return url.endsWith('public.js')
      ? { createCommandSession() {} }
      : { createSession() {} };
  });
  assert.deepEqual(imported, [
    'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/runtime/public.js',
    'https://aletheia-works.github.io/formicarium/_formicarium/0.3.0/runtime/web/api.js',
  ]);
  assert.equal(typeof loaded.root.createCommandSession, 'function');
  assert.equal(
    loaded.assets.wasmURL.toString().endsWith('paludarium.wasm'),
    true,
  );
});

test('a failed import is reported as ASSET_LOAD without the import error text', async () => {
  await assert.rejects(
    loadFormicarium(manifest(), ROOT, async () => {
      throw new Error('<script>x</script>');
    }),
    (error: unknown) =>
      error instanceof LoaderError &&
      /^ASSET_LOAD: formicarium 0\.3\.0 could not be imported$/.test(
        error.message,
      ),
  );
});

test('modules without the public API are refused', async () => {
  await assert.rejects(
    loadFormicarium(manifest(), ROOT, async () => ({})),
    /lack the public API/,
  );
});
