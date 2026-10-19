import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  moduleGraph,
  relativeImports,
  stageFormicarium,
} from '../../scripts/stage-formicarium.ts';
import { tempDir, writeFiles } from './helpers.ts';
import { PACKAGE_FILES, writePack } from './pack-fixture.ts';

test('relative imports: static, re-export, type and literal dynamic import', () => {
  assert.deepEqual(
    relativeImports(
      "import a from './a.js';\nexport * from '../b.js';\nimport type { C } from './c.js';\nconst d = await import('./d.js');\nimport './e.js';",
    ).sort(),
    ['../b.js', './a.js', './c.js', './d.js', './e.js'],
  );
});

test('the module graph follows the public entries only', async () => {
  const root = await tempDir('graph');
  await writeFiles(root, PACKAGE_FILES);
  assert.deepEqual(
    await moduleGraph(root, ['runtime/public.js', 'runtime/web/api.js']),
    [
      'runtime/core.js',
      'runtime/errors.js',
      'runtime/public.js',
      'runtime/web/api.js',
    ],
  );
});

test('a bare import or an import leaving the package fails the stage', async () => {
  const root = await tempDir('graph');
  await writeFiles(root, {
    // Spelled apart so U7's boundary scan does not read test data as imports.
    'a.js': `${'imp'}ort x from 'left-pad';\n`,
    'b.js': "import '../../x.js';\n",
  });
  await assert.rejects(
    moduleGraph(root, ['a.js']),
    /pack-invalid: a\.js imports bare left-pad/,
  );
  await assert.rejects(moduleGraph(root, ['b.js']), /leaves the package/);
  await assert.rejects(moduleGraph(root, ['missing.js']), /module missing/);
});

test("a Node-only dynamic import('node:…') is skipped; a static node: import fails", async () => {
  const root = await tempDir('graph');
  await writeFiles(root, {
    'core.js':
      "export async function local() { const fs = await import('node:fs/promises'); return fs; }\n",
    'static.js': "import { readFile } from 'node:fs/promises';\n",
  });
  assert.deepEqual(await moduleGraph(root, ['core.js']), ['core.js']);
  await assert.rejects(
    moduleGraph(root, ['static.js']),
    /static\.js imports bare node:fs\/promises/,
  );
});

test('the checked pack is copied byte for byte below _formicarium/<version>/', async () => {
  const work = await tempDir('stage');
  const pack = await writePack(work);
  const publicDir = join(work, 'public');
  const { manifest, record } = await stageFormicarium({
    packDir: pack,
    publicDir,
    destination: join(work, 'node_modules', '@aletheia-works', 'formicarium'),
  });
  assert.equal(record.mode, 'verify');
  assert.equal(manifest.base, '_formicarium/0.3.0/');
  assert.deepEqual(manifest.assets, {
    loader: 'assets/blink.mjs',
    wasm: 'assets/blink.wasm',
    worker: 'runtime/web/package-worker.bundle.js',
    buildInfo: 'assets/build-info.json',
  });
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    [
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'assets/blink.mjs',
      'assets/blink.wasm',
      'assets/build-info.json',
      'runtime/core.js',
      'runtime/errors.js',
      'runtime/public.js',
      'runtime/web/api.js',
      'runtime/web/package-worker.bundle.js',
    ],
  );
  assert.equal(
    await readFile(
      join(publicDir, '_formicarium/0.3.0/runtime/web/api.js'),
      'utf8',
    ),
    PACKAGE_FILES['runtime/web/api.js'],
  );
});

test('a pack that changed after it was recorded is refused', async () => {
  const work = await tempDir('stage');
  const pack = await writePack(work, PACKAGE_FILES, 'f'.repeat(64));
  await assert.rejects(
    stageFormicarium({
      packDir: pack,
      publicDir: join(work, 'public'),
      destination: join(work, 'pkg'),
    }),
    /checksum-mismatch/,
  );
});

test('a pack without the single-file Worker, or a wrong directory name, fails', async () => {
  const work = await tempDir('stage');
  const { 'runtime/web/package-worker.bundle.js': _worker, ...rest } =
    PACKAGE_FILES;
  const pack = await writePack(work, rest);
  await assert.rejects(
    stageFormicarium({
      packDir: pack,
      publicDir: join(work, 'public'),
      destination: join(work, 'pkg'),
    }),
    /pack-invalid: pack file missing: runtime\/web\/package-worker\.bundle\.js/,
  );
  await assert.rejects(
    stageFormicarium({ packDir: work }),
    /must be named pack/,
  );
});
