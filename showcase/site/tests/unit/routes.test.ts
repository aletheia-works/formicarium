import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { fileInventory } from '../../../scripts/paths.ts';
import { terminalPages } from '../../scripts/build-site.ts';
import {
  checkSite,
  htmlSubresources,
  missingTranslations,
} from '../../scripts/check-site.ts';
import {
  injectTerminalPages,
  isTerminalPage,
} from '../../scripts/inject-csp.ts';
import { parsePageData } from '../../src/terminal/page-data.ts';
import { WORKFLOW, writeFiles } from './helpers.ts';
import { buildTestSite, TEST_TOOLS } from './site-fixture.ts';

let out = '';
let html: string[] = [];
const read = (path: string) => readFile(join(out, path), 'utf8');

before(async () => {
  ({ out } = await buildTestSite());
  html = (await fileInventory(out))
    .map((file) => file.path)
    .filter((path) => path.endsWith('.html'));
});

test('every page exists in English and Japanese', () => {
  const expected = [
    'index.html',
    'tools/index.html',
    'terminal/index.html',
    ...TEST_TOOLS.map((tool) => `tools/${tool.tool}/index.html`),
    ...[
      'getting-started',
      'embedding',
      'source-builds',
      'releases',
      'architecture',
      'maintenance',
    ].map((name) => `guides/${name}/index.html`),
  ];
  for (const page of expected) {
    assert.ok(html.includes(page), page);
    assert.ok(html.includes(`ja/${page}`), `ja/${page}`);
  }
  assert.deepEqual(missingTranslations(html), []);
  assert.equal(html.length, expected.length * 2 + 1); // and 404.html
});

test('only the tool pages and /terminal/ are terminal pages, with their page data', async () => {
  const terminals: string[] = [];
  for (const page of html)
    if (isTerminalPage(await read(page))) terminals.push(page);
  assert.deepEqual(
    terminals.sort(),
    terminalPages(TEST_TOOLS.map((tool) => tool.tool)),
  );
  const page = await read('ja/tools/aube/index.html');
  const raw = /data-terminal-host="([^"]*)"/
    .exec(page)?.[1]
    ?.replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
  const data = parsePageData(raw);
  assert.deepEqual(
    [
      data.mode,
      data.locale,
      data.tool,
      data.version,
      data.base,
      data.fixture?.path,
    ],
    [
      'preinstalled',
      'ja',
      'aube',
      '2.7.2',
      '/formicarium/',
      'demo-fixtures/aube-local-deps.json',
    ],
  );
  const empty = parsePageData(
    /data-terminal-host="([^"]*)"/
      .exec(await read('terminal/index.html'))?.[1]
      ?.replaceAll('&quot;', '"'),
  );
  assert.deepEqual(
    [empty.mode, empty.locale, empty.fixture],
    ['empty', 'en', null],
  );
});

test('documentation pages and /tools/ load no terminal module and no service worker', async () => {
  for (const page of [
    'index.html',
    'tools/index.html',
    'ja/tools/index.html',
    'guides/embedding/index.html',
  ]) {
    const text = await read(page);
    assert.ok(!isTerminalPage(text), page);
    for (const { url } of htmlSubresources(text))
      assert.doesNotMatch(
        url,
        /coi-serviceworker|coi-config|_formicarium|TerminalPage/,
        page,
      );
  }
});

test('the built site passes check-site once the build adds CSP, notices and identity', async () => {
  const pages = terminalPages(TEST_TOOLS.map((tool) => tool.tool));
  // build-site moves the hidden source maps out of the site (strip-maps).
  for (const file of await fileInventory(out))
    if (file.path.endsWith('.map')) await rm(join(out, file.path));
  await injectTerminalPages(out, pages);
  await writeFiles(out, {
    'THIRD_PARTY_NOTICES.md': '# notices',
    'site-identity.json': '{}',
  });
  const result = await checkSite({
    siteDir: out,
    base: '/formicarium/',
    terminalPages: pages,
    workflow: WORKFLOW,
  });
  assert.deepEqual(result.problems, []);
});

test('the terminal pages keep the hints, status line and isolation scripts in order', async () => {
  const page = await read('tools/pitchfork/index.html');
  assert.match(page, /<code[^>]*>pitchfork --version<\/code>/);
  assert.match(page, /role="status"[^>]*>\s*Preparing cross-origin isolation…/);
  assert.ok(
    page.indexOf('/formicarium/coi-config.js') <
      page.indexOf('/formicarium/coi-serviceworker.js'),
  );
  const empty = await read('ja/terminal/index.html');
  for (const tool of TEST_TOOLS)
    assert.match(
      empty,
      new RegExp(`<code[^>]*>install ${tool.tool}</code>`),
      tool.tool,
    );
});
