import assert from 'node:assert/strict';
import { copyFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkSite,
  cssUrls,
  htmlSubresources,
  MAX_SITE_BYTES,
  missingTranslations,
  scriptImports,
  sizeProblems,
} from '../../scripts/check-site.ts';
import { SITE_ROOT } from '../../scripts/common.ts';
import { injectCsp } from '../../scripts/inject-csp.ts';
import { tempDir, WORKFLOW, writeFiles } from './helpers.ts';

const BASE = '/formicarium/';
/** Spelled apart so U7's boundary scan does not read test data as imports. */
const IMPORT = 'import';
const doc = (body = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/formicarium/_astro/site.css"><link rel="canonical" href="https://aletheia-works.github.io/formicarium/"><script type="module" src="/formicarium/_astro/doc.js"></script></head><body><a href="https://github.com/aletheia-works/formicarium">GitHub</a>${body}</body></html>`;
const terminal = () =>
  injectCsp(
    `<!doctype html><html><head><meta charset="utf-8"><script src="/formicarium/coi-config.js"></script><script src="/formicarium/coi-serviceworker.js"></script><script>document.documentElement.dataset.theme='dark'</script><script type="module" src="/formicarium/_astro/term.js"></script></head><body><div data-terminal-host="{}"></div></body></html>`,
  ).html;
const TERMINAL_PAGES = ['terminal/index.html', 'ja/terminal/index.html'];

async function site() {
  const root = await tempDir('site');
  await writeFiles(root, {
    'index.html': doc(),
    'ja/index.html': doc(),
    'guides/maintenance/index.html': doc(),
    'ja/guides/maintenance/index.html': doc(),
    'terminal/index.html': terminal(),
    'ja/terminal/index.html': terminal(),
    '404.html': doc(),
    '_astro/doc.js': 'import"./shared.js";',
    '_astro/shared.js': 'export const a=1;',
    '_astro/term.js':
      'import"./shared.js";document.querySelector("[data-terminal-host]");',
    '_astro/site.css': 'body{background:url(/formicarium/bg.png)}',
    'coi-config.js': 'window.coi={}',
    'THIRD_PARTY_NOTICES.md': '# notices',
    'site-identity.json': '{}',
    'guests/aube/2.7.2/aube': 'ELF',
  });
  await copyFile(
    join(
      SITE_ROOT,
      'node_modules',
      'coi-serviceworker',
      'coi-serviceworker.js',
    ),
    join(root, 'coi-serviceworker.js'),
  );
  return root;
}
const check = (siteDir: string, workflow = WORKFLOW) =>
  checkSite({ siteDir, base: BASE, terminalPages: TERMINAL_PAGES, workflow });

test('a complete site passes and reports its size and guests', async () => {
  const result = await check(await site());
  assert.deepEqual(result.problems, []);
  assert.equal(result.files, 16);
  assert.equal(result.largest?.path, 'coi-serviceworker.js');
  assert.ok(result.largest!.bytes > 0);
  assert.deepEqual(result.guests, [
    { path: 'guests/aube/2.7.2/aube', bytes: 3 },
  ]);
});

test('a page that exists in only one language fails', async () => {
  assert.deepEqual(
    missingTranslations([
      'index.html',
      'ja/index.html',
      'tools/index.html',
      'ja/guides/x/index.html',
      '404.html',
    ]),
    [
      'ja/guides/x/index.html has no en page guides/x/index.html',
      'tools/index.html has no ja page ja/tools/index.html',
    ],
  );
  const root = await site();
  await rm(join(root, 'ja', 'guides', 'maintenance', 'index.html'));
  assert.deepEqual((await check(root)).problems, [
    'guides/maintenance/index.html has no ja page ja/guides/maintenance/index.html',
  ]);
});

test('cross-origin images, styles, fonts and scripts fail; links and canonical do not', async () => {
  const found = htmlSubresources(
    `<img src="https://x.test/a.png" srcset="/a.png 1x, //cdn.test/b.png 2x"><link rel="preload" href="https://fonts.test/f.woff2"><link rel="alternate" href="https://x.test/"><div style="background:url('https://x.test/bg.png')"></div><style>@${IMPORT} "https://x.test/s.css";</style>`,
  );
  assert.deepEqual(
    found.map((item) => item.url),
    [
      'https://x.test/a.png',
      '/a.png',
      '//cdn.test/b.png',
      'https://fonts.test/f.woff2',
      'https://x.test/bg.png',
      'https://x.test/s.css',
    ],
  );
  assert.deepEqual(cssUrls('a{b:url("x.png")}@import \'y.css\';'), [
    'x.png',
    'y.css',
  ]);
  const root = await site();
  await writeFile(
    join(root, 'index.html'),
    doc('<img src="https://example.com/logo.png">'),
  );
  await writeFile(
    join(root, '_astro/site.css'),
    '@font-face{src:url(https://fonts.example/f.woff2)}',
  );
  assert.deepEqual((await check(root)).problems, [
    'index.html <img> loads cross-origin https://example.com/logo.png',
    '_astro/site.css loads cross-origin https://fonts.example/f.woff2',
  ]);
});

test('terminal pages need the first-in-head CSP that matches their inline scripts', async () => {
  const root = await site();
  const html = terminal().replace(
    "dataset.theme='dark'",
    "dataset.theme='light'",
  );
  await writeFile(join(root, 'terminal/index.html'), html);
  await writeFile(
    join(root, 'ja/terminal/index.html'),
    terminal().replace(/<meta http-equiv[^>]*>/, ''),
  );
  assert.deepEqual((await check(root)).problems, [
    'ja/terminal/index.html has no CSP meta as the first element of <head>',
    'terminal/index.html CSP differs from the inline script hashes',
  ]);
});

test('a documentation page that reaches the terminal module or the isolation scripts fails', async () => {
  assert.deepEqual(
    scriptImports(
      `${IMPORT}{a}from"./x.js";${IMPORT}"./y.mjs";${IMPORT}("/formicarium/z.js")`,
    ),
    ['./x.js', './y.mjs', '/formicarium/z.js'],
  );
  const root = await site();
  await writeFile(join(root, '_astro/shared.js'), 'import"./term.js";');
  await writeFile(
    join(root, 'ja/index.html'),
    doc('<script src="/formicarium/coi-serviceworker.js"></script>'),
  );
  const problems = (await check(root)).problems;
  assert.ok(
    problems.includes(
      'index.html loads the terminal module through /formicarium/_astro/doc.js',
    ),
  );
  assert.ok(
    problems.includes(
      'ja/index.html loads terminal resource /formicarium/coi-serviceworker.js',
    ),
  );
});

test('upload settings, coi-serviceworker bytes, source maps and required files are checked', async () => {
  const root = await site();
  await writeFile(join(root, 'coi-serviceworker.js'), '// changed');
  await writeFile(join(root, '_astro/doc.js.map'), '{}');
  await rm(join(root, 'THIRD_PARTY_NOTICES.md'));
  const problems = (
    await check(
      root,
      WORKFLOW.replace(
        'include-hidden-files: true',
        'include-hidden-files: false',
      ),
    )
  ).problems;
  assert.deepEqual(problems, [
    'upload-pages-artifact leaves dotfiles out (include-hidden-files: true missing)',
    'coi-serviceworker.js SHA256 differs from 0.1.7',
    'source map left in the site: _astro/doc.js.map',
    'THIRD_PARTY_NOTICES.md missing',
  ]);
});

test('the site must stay below 1073741824 bytes, and every expected terminal page exists', async () => {
  assert.deepEqual(sizeProblems(MAX_SITE_BYTES - 1), []);
  assert.deepEqual(sizeProblems(MAX_SITE_BYTES), [
    'site is 1073741824 bytes (limit below 1073741824)',
  ]);
  const root = await site();
  const result = await checkSite({
    siteDir: root,
    base: BASE,
    terminalPages: [...TERMINAL_PAGES, 'tools/aube/index.html'],
    workflow: WORKFLOW,
  });
  assert.deepEqual(result.problems, [
    'terminal page missing: tools/aube/index.html',
  ]);
});
