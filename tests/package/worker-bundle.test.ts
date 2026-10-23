import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import * as babel from '@babel/types';
import { chromium } from '@playwright/test';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
  sha256,
  stagePackage,
} from '../../scripts/package/stage-package.js';
import {
  buildWorkerBundle,
  WORKER_BUNDLE,
  WORKER_BUNDLE_ENTRY,
  WORKER_BUNDLE_MAP,
  workerBundleSources,
} from '../../scripts/package/worker-bundle.js';
import { PACKAGE_FILES as RELEASE_PACKAGE_FILES } from '../../scripts/release/inventory.js';
import { elfHeader, serveDirectory } from './fixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFile(resolve(root, path), 'utf8');
// Scratch parent below the workspace. The override lets a run reproduce a
// clean checkout (no `.artifacts` yet) without deleting the real directory.
const artifacts = resolve(
  root,
  process.env.FORMICARIUM_WORKER_BUNDLE_ARTIFACTS ?? '.artifacts',
);

/** Every module-graph edge in one file: static imports, re-exports, import.meta and import(). */
function moduleEdges(text: string) {
  const edges = {
    statics: [] as string[],
    meta: 0,
    literal: [] as string[],
    computed: 0,
  };
  const visit = (node: babel.Node) => {
    if (
      babel.isImportDeclaration(node) ||
      ((babel.isExportNamedDeclaration(node) ||
        babel.isExportAllDeclaration(node)) &&
        node.source)
    )
      edges.statics.push(node.source?.value ?? '');
    if (
      babel.isMetaProperty(node) &&
      node.meta.name === 'import' &&
      node.property.name === 'meta'
    )
      edges.meta++;
    const specifier = babel.isImportExpression(node)
      ? node.source
      : babel.isCallExpression(node) && babel.isImport(node.callee)
        ? node.arguments[0]
        : undefined;
    if (specifier) {
      if (babel.isStringLiteral(specifier)) edges.literal.push(specifier.value);
      else edges.computed++;
    }
    for (const key of babel.VISITOR_KEYS[node.type] ?? []) {
      const child: unknown = Reflect.get(node, key);
      for (const item of Array.isArray(child) ? child : [child])
        if (babel.isNode(item)) visit(item);
    }
  };
  visit(parse(text, { sourceType: 'module' }));
  return edges;
}

test('built Worker bundle has no static import, re-export or import.meta', async () => {
  const edges = moduleEdges(await read(WORKER_BUNDLE));
  assert.deepEqual(edges.statics, []);
  assert.equal(edges.meta, 0);
  // The original module graph does have them, so the check is not vacuous.
  assert.ok(moduleEdges(await read(WORKER_BUNDLE_ENTRY)).statics.length > 0);
});

test('only node:* and the verified loader URL imports of core remain dynamic', async () => {
  const edges = moduleEdges(await read(WORKER_BUNDLE));
  assert.ok(edges.literal.length > 0);
  assert.ok(
    edges.literal.every((specifier) => specifier.startsWith('node:')),
    edges.literal.join(),
  );
  // Runtime URLs (the verified core loader) are data, not package modules.
  const core = moduleEdges(await read('runtime/core.js'));
  assert.equal(core.computed, 2);
  assert.equal(edges.computed, core.computed);
});

test('bundle source map names the package Worker and only fixed-inventory modules', async () => {
  const sources = await workerBundleSources(root);
  assert.ok(sources.includes(WORKER_BUNDLE_ENTRY));
  for (const path of [
    'runtime/core.js',
    'runtime/protocol.js',
    'runtime/worker-execution.js',
  ])
    assert.ok(sources.includes(path), path);
  for (const path of sources) assert.ok(FIRST_PARTY_JS.includes(path), path);
});

test('two Bun builds of the same modules give the built bundle bytes', async (t) => {
  // `.artifacts/` is ignored by SCM, so a clean checkout does not have it.
  await mkdir(artifacts, { recursive: true });
  const scratch = await mkdtemp(join(artifacts, 'worker-bundle-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await cp(resolve(root, 'runtime'), resolve(scratch, 'runtime'), {
    recursive: true,
    filter: (source) => !/\.(?:ts|map)$/.test(source),
  });
  await rm(resolve(scratch, WORKER_BUNDLE));
  const digests = [];
  for (let build = 0; build < 2; build++) {
    buildWorkerBundle({ root: scratch });
    digests.push(sha256(await readFile(resolve(scratch, WORKER_BUNDLE))));
  }
  assert.equal(digests[0], digests[1]);
  assert.equal(
    digests[0],
    sha256(await readFile(resolve(root, WORKER_BUNDLE))),
  );
});

test('staged package bundle has the bytes of a Bun rebuild from the staged originals', async (t) => {
  await mkdir(artifacts, { recursive: true });
  const scratch = await mkdtemp(join(artifacts, 'worker-bundle-stage-'));
  const out = join(scratch, 'package');
  t.after(() => rm(scratch, { recursive: true, force: true }));
  // stagePackage writes the shipped files and the manifest beside them.
  const candidate = await stagePackage({ out: relative(root, out), root });
  const shipped = candidate.files.find(
    (file: { path: string }) => file.path === WORKER_BUNDLE,
  );
  assert.ok(shipped);
  assert.equal(
    sha256(await readFile(resolve(out, WORKER_BUNDLE))),
    shipped.sha256,
  );
  // Rebuild only from the shipped runtime modules, not the working tree.
  await rm(resolve(out, WORKER_BUNDLE));
  buildWorkerBundle({ root: out });
  assert.equal(
    sha256(await readFile(resolve(out, WORKER_BUNDLE))),
    shipped.sha256,
  );
  for (const path of await workerBundleSources(out))
    assert.ok(FIRST_PARTY_JS.includes(path), path);
});

test('bundle is distributed and packed, but excluded from the coverage denominator', async () => {
  assert.ok(PACKAGE_FILES.includes(WORKER_BUNDLE));
  assert.ok(RELEASE_PACKAGE_FILES.includes(WORKER_BUNDLE));
  assert.ok(!FIRST_PARTY_JS.includes(WORKER_BUNDLE));
  assert.ok(!PACKAGE_FILES.includes(WORKER_BUNDLE_MAP));
  const manifest = JSON.parse(await read('package.json'));
  assert.ok(manifest.files.includes(WORKER_BUNDLE));
  const inventory = JSON.parse(
    await read('scripts/package/coverage-inventory.json'),
  );
  assert.ok(!inventory.files.includes(WORKER_BUNDLE));
  assert.ok(inventory.files.includes(WORKER_BUNDLE_ENTRY));
  assert.match(inventory.exclusions[WORKER_BUNDLE], /generated/);
  const npm = resolve(
    dirname(process.execPath),
    '../lib/node_modules/npm/bin/npm-cli.js',
  );
  const [pack] = JSON.parse(
    execFileSync(
      process.execPath,
      [npm, 'pack', '--dry-run', '--json', '--ignore-scripts'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  );
  const packed = pack.files.map((file: { path: string }) => file.path);
  assert.ok(packed.includes(WORKER_BUNDLE));
  assert.ok(packed.includes(WORKER_BUNDLE_ENTRY));
  assert.ok(!packed.includes(WORKER_BUNDLE_MAP));
});

async function workerURLs(assets: 'default' | 'module') {
  const server = await serveDirectory(root);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.url);
    return await page.evaluate(
      async ({ guest, assets }) => {
        const urls: string[] = [];
        const original = Worker;
        globalThis.Worker = class extends original {
          constructor(...args: ConstructorParameters<typeof Worker>) {
            urls.push(String(new URL(args[0], location.href)));
            super(...args);
          }
        };
        try {
          const { createSession } = await import('/runtime/web/api.js');
          const base = `${location.origin}/assets/paludarium/`;
          const session = await createSession(
            assets === 'module'
              ? {
                  assets: {
                    loaderURL: `${base}index.mjs`,
                    wasmURL: `${base}paludarium.wasm`,
                    buildInfoURL: `${base}build-info.json`,
                    workerURL: `${location.origin}/runtime/web/package-worker.js`,
                  },
                }
              : {},
          );
          let code = 'accepted';
          try {
            // The core assets are absent here; the Worker start is the oracle.
            await session.run({ guest: Uint8Array.from(guest) });
          } catch (error) {
            code = (error as { code: string }).code;
          } finally {
            await session.dispose();
          }
          return {
            urls: urls.map((url) => new URL(url).pathname),
            code,
            isolated: crossOriginIsolated,
          };
        } finally {
          globalThis.Worker = original;
        }
      },
      { guest: [...elfHeader()], assets },
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

test('browser createSession starts the bundle Worker by default', async () => {
  const result = await workerURLs('default');
  assert.equal(result.isolated, true);
  assert.deepEqual(result.urls, [`/${WORKER_BUNDLE}`]);
  assert.notEqual(result.code, 'accepted');
});

test('options.assets Worker URL is used as given instead of the bundle', async () => {
  const result = await workerURLs('module');
  assert.equal(result.isolated, true);
  assert.deepEqual(result.urls, [`/${WORKER_BUNDLE_ENTRY}`]);
  assert.notEqual(result.code, 'accepted');
});
