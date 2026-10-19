import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, cp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  assemble,
  type BuildContext,
  copiedPackages,
  prepare,
  terminalPages,
} from '../../scripts/build-site.ts';
import { SITE_ROOT, siteLayout } from '../../scripts/common.ts';
import { computeInventory, readInventory } from '../../scripts/inventory.ts';
import { writeCandidate } from './candidate-fixture.ts';
import { tempDir, WORKFLOW, writeFiles } from './helpers.ts';
import { writePack } from './pack-fixture.ts';

const TOOLS = ['aube', 'biome', 'pitchfork'];

async function setup(options: { tamper?: boolean } = {}) {
  const root = await tempDir('build');
  const layout = siteLayout(join(root, '.work'), join(root, 'site'));
  await writeCandidate(join(layout.work, 'inputs'), { realFixtures: true });
  if (options.tamper)
    await writeFile(join(layout.candidate, 'site', 'extra.js'), 'x');
  await writePack(join(layout.work, 'inputs', 'resolve'));
  await writeFiles(layout.public, { 'favicon.svg': '<svg/>' });
  await copyFile(
    join(SITE_ROOT, 'public', 'coi-config.js'),
    join(layout.public, 'coi-config.js'),
  );
  const context: BuildContext = {
    layout,
    mode: 'verify',
    env: { GITHUB_RUN_NUMBER: '41', SHOWCASE_SOURCE_COMMIT: 'd'.repeat(40) },
    steps: [],
    packages: {
      site: join(root, 'pkg-site'),
      showcase: join(root, 'pkg-showcase'),
    },
  };
  return { root, layout, context };
}

/** Stands in for `astro build`: copies public/ and writes the pages and a map. */
function fakeBuild(extra: Record<string, string> = {}) {
  return async (context: BuildContext) => {
    const { layout } = context;
    await cp(layout.public, layout.dist, { recursive: true });
    const terminal =
      '<!doctype html><html><head><meta charset="utf-8"><script src="/formicarium/coi-config.js"></script><script src="/formicarium/coi-serviceworker.js"></script><script>theme()</script><script type="module" src="/formicarium/_astro/term.js"></script></head><body><div data-terminal-host="{}"></div></body></html>';
    const doc =
      '<!doctype html><html><head><script type="module" src="/formicarium/_astro/doc.js"></script></head><body><h1>x</h1></body></html>';
    const files: Record<string, string> = {
      'index.html': doc,
      'ja/index.html': doc,
      '404.html': doc,
      '_astro/doc.js': 'export {}',
      '_astro/term.js': 'document.querySelector("[data-terminal-host]")',
      '_astro/term.js.map': '{"version":3}',
      ...Object.fromEntries(
        terminalPages(TOOLS).map((page) => [page, terminal]),
      ),
      ...extra,
    };
    await writeFiles(layout.dist, files);
    await writeFiles(layout.build, {
      'bundle-modules.json': JSON.stringify([
        join(SITE_ROOT, 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.mjs'),
      ]),
    });
  };
}
const npm = (integrity: string | null) => () => integrity;
const packIntegrity = async (context: BuildContext) =>
  `sha512-${createHash('sha512')
    .update(
      await readFile(
        join(context.layout.pack, 'aletheia-works-formicarium-0.3.0.tgz'),
      ),
    )
    .digest('base64')}`;

test('the steps run in the build order and the site gets every placed file', async () => {
  const { layout, context } = await setup();
  await prepare(context);
  const result = await assemble(context, {
    build: fakeBuild(),
    npm: npm(await packIntegrity(context)),
    workflow: WORKFLOW,
  });
  assert.deepEqual(context.steps, [
    'verify-candidate',
    'stage-formicarium',
    'fixture-index',
    'place',
    'astro-build',
    'strip-maps',
    'inject-csp',
    'notices',
    'identity',
    'check-site',
    'inventory',
  ]);
  for (const path of [
    '_formicarium/0.3.0/runtime/public.js',
    '_formicarium/0.3.0/runtime/web/package-worker.bundle.js',
    'catalog.json',
    'guests/aube/2.7.2/aube',
    'licenses/aube-LICENSE',
    'coi-serviceworker.js',
    'coi-config.js',
    'demo-fixtures/aube-local-deps.json',
    'THIRD_PARTY_NOTICES.md',
    'site-identity.json',
  ])
    assert.ok((await stat(join(layout.dist, path))).isFile(), path);
  assert.equal(
    result.inventorySha256,
    (await readInventory(join(layout.build, 'site-inventory.json'))).sha256,
  );
  assert.equal(
    JSON.parse(await readFile(join(layout.logs, 'npm-check.json'), 'utf8'))
      .published,
    true,
  );
});

test('the source maps leave the site and the inventory is of the bytes after inject-csp', async () => {
  const { layout, context } = await setup();
  await prepare(context);
  const result = await assemble(context, {
    build: fakeBuild(),
    npm: npm(null),
    workflow: WORKFLOW,
  });
  await assert.rejects(stat(join(layout.dist, '_astro', 'term.js.map')));
  assert.equal(
    await readFile(join(layout.sourcemaps, '_astro', 'term.js.map'), 'utf8'),
    '{"version":3}',
  );
  assert.match(
    await readFile(join(layout.dist, 'tools', 'aube', 'index.html'), 'utf8'),
    /<head><meta http-equiv="Content-Security-Policy"/,
  );
  assert.equal(
    (await computeInventory(layout.dist)).sha256,
    result.inventorySha256,
  );
  assert.equal(
    JSON.parse(await readFile(join(layout.build, 'site-identity.json'), 'utf8'))
      .runNumber,
    41,
  );
  assert.equal(
    JSON.parse(await readFile(join(layout.logs, 'npm-check.json'), 'utf8'))
      .published,
    false,
  );
});

test('a candidate mismatch stops the build before anything is staged', async () => {
  const { layout, context } = await setup({ tamper: true });
  await assert.rejects(
    prepare(context),
    /candidate-mismatch: 3-asset site\/extra\.js/,
  );
  assert.deepEqual(context.steps, ['verify-candidate']);
  await assert.rejects(stat(join(layout.public, '_formicarium')));
});

test('a failed site check stops the build before the inventory', async () => {
  const { layout, context } = await setup();
  await prepare(context);
  await assert.rejects(
    assemble(context, {
      build: fakeBuild({
        'index.html':
          '<html><head></head><body><img src="https://example.com/x.png"></body></html>',
      }),
      npm: npm(null),
      workflow: WORKFLOW,
    }),
    /site-check: index\.html <img> loads cross-origin https:\/\/example\.com\/x\.png/,
  );
  assert.equal(context.steps.at(-1), 'check-site');
  await assert.rejects(stat(join(layout.build, 'site-inventory.json')));
});

test('code copied outside Vite is named for the notices', async () => {
  const dist = await tempDir('dist');
  await writeFiles(dist, {
    'pagefind/pagefind.js': '',
    '_astro/ec.abc.js': '',
  });
  assert.deepEqual((await copiedPackages(dist)).slice(0, 3), [
    'coi-serviceworker',
    'pagefind',
    'astro-expressive-code',
  ]);
  const bare = await tempDir('dist');
  await writeFiles(bare, { 'index.html': '' });
  assert.deepEqual(await copiedPackages(bare), ['coi-serviceworker']);
});
