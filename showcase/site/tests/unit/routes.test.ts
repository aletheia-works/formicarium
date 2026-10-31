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
import { RELAY_TOKEN_URL } from '../../src/terminal/relay.ts';
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

test('every page exists in English and Japanese', async () => {
  const expected = [
    'index.html',
    'tools/index.html',
    'terminal/index.html',
    ...TEST_TOOLS.map((tool) => `tools/${tool.tool}/index.html`),
    ...[
      'getting-started',
      'embedding',
      'install-api',
      'command-api',
      'errors',
      'source-builds',
      'releases',
      'architecture',
      'maintenance',
    ].map((name) => `guides/${name}/index.html`),
    ...[
      'architecture',
      'releases',
      'licenses',
      'decisions',
      'decisions/0002-interpreter-only-jit-deferred',
      'decisions/0003-core-boundary',
      'decisions/0007-no-guest-network-in-browser',
      'decisions/0008-fresh-instance-per-step',
      'decisions/0010-wasm-memory-1gb',
      'decisions/0011-host-baseline-in-measurements',
      'decisions/0013-interactive-guest-runs',
      'decisions/0014-guest-tcp-clients-in-nodejs',
      'decisions/0015-guest-network-in-browser-through-a-relay',
    ].map((name) => `development/${name}/index.html`),
  ];
  for (const page of expected) {
    assert.ok(html.includes(page), page);
    assert.ok(html.includes(`ja/${page}`), `ja/${page}`);
  }
  assert.deepEqual(missingTranslations(html), []);
  // The API pages moved to the guides; their old URLs redirect there.
  const moved = ['install-api', 'command-api'].flatMap((name) =>
    ['', 'ja/'].map((locale): [string, string] => [
      `${locale}development/${name}/index.html`,
      `/formicarium/${locale}guides/${name}/`,
    ]),
  );
  for (const [page, target] of moved)
    assert.match(
      await read(page),
      new RegExp(`http-equiv="refresh" content="0;url=${target}"`),
      page,
    );
  assert.equal(html.length, expected.length * 2 + moved.length + 1); // and 404.html
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
      data.interactive,
      data.everyPage,
      data.homeFiles,
      data.companions,
      data.network,
      data.relay,
      data.caBundle,
    ],
    [
      'preinstalled',
      'ja',
      'aube',
      '2.7.2',
      '/formicarium/',
      'demo-fixtures/aube-local-deps.json',
      [],
      [],
      [],
      { git: ['git-remote-https'] },
      ['git', 'jj'],
      { tokenUrl: RELAY_TOKEN_URL, allow: ['github.com:443'] },
      { path: 'ca/cacert.pem', sha256: 'a'.repeat(64) },
    ],
  );
  // The help names the network tools and the relay they go through.
  assert.match(
    page,
    /git と jj は github\.com の公開 repository を clone・fetch できます/,
  );
  assert.match(
    await read('tools/git/index.html'),
    /git and jj can clone and fetch public repositories from github\.com.*Aletheia Works(?:'|&#39;|&#x27;) relay on AWS/s,
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
  // The tool lists must be tool names; anything else stops the page.
  for (const name of ['interactive', 'everyPage', 'network'])
    for (const value of [undefined, 'nano', ['../nano'], [1]])
      assert.throws(
        () => parsePageData(JSON.stringify({ ...empty, [name]: value })),
        new RegExp(`page data ${name} invalid`),
      );
  // The relay is an http(s) token URL without credentials and an allow list
  // of host:port entries; network tools need the CA bundle.
  for (const value of [
    undefined,
    {},
    { tokenUrl: 'ftp://relay.test/', allow: ['github.com:443'] },
    { tokenUrl: 'https://user:pw@relay.test/', allow: ['github.com:443'] },
    { tokenUrl: 'https://relay.test/#x', allow: ['github.com:443'] },
    { tokenUrl: 'not a url', allow: ['github.com:443'] },
    { tokenUrl: RELAY_TOKEN_URL, allow: [] },
    { tokenUrl: RELAY_TOKEN_URL, allow: ['github.com'] },
    { tokenUrl: RELAY_TOKEN_URL, allow: ['github.com:65536'] },
    { tokenUrl: RELAY_TOKEN_URL, allow: ['github.com:0'] },
    { tokenUrl: RELAY_TOKEN_URL, allow: [1] },
  ])
    assert.throws(
      () => parsePageData(JSON.stringify({ ...empty, relay: value })),
      /page data relay invalid/,
    );
  assert.deepEqual(
    parsePageData(
      JSON.stringify({
        ...empty,
        relay: {
          tokenUrl: 'http://localhost:8080/t',
          allow: ['*.example.com:22'],
        },
      }),
    ).relay,
    { tokenUrl: 'http://localhost:8080/t', allow: ['*.example.com:22'] },
  );
  for (const value of [
    'ca/cacert.pem',
    { path: '../x', sha256: 'a'.repeat(64) },
  ])
    assert.throws(
      () => parsePageData(JSON.stringify({ ...empty, caBundle: value })),
      /page data caBundle invalid/,
    );
  assert.throws(
    () => parsePageData(JSON.stringify({ ...empty, caBundle: null })),
    /page data caBundle missing for the network tools/,
  );
  assert.equal(
    parsePageData(JSON.stringify({ ...empty, network: [], caBundle: null }))
      .caBundle,
    null,
  );
  // Companions are tool names by tool name, never an empty list.
  for (const value of [
    undefined,
    [],
    'git',
    { git: 'git-remote-https' },
    { git: [] },
    { git: ['../git'] },
    { '../git': ['git-remote-https'] },
  ])
    assert.throws(
      () => parsePageData(JSON.stringify({ ...empty, companions: value })),
      /page data companions invalid/,
    );
  // Home files stay below the home and within the tools.json limit.
  for (const value of [
    undefined,
    {},
    [null],
    [{ path: '../etc/passwd', text: 'x' }],
    [{ path: '/etc/passwd', text: 'x' }],
    [{ path: 'a//b', text: 'x' }],
    [{ path: '.config/./jj', text: 'x' }],
    [{ path: '.config/jj/config.toml', text: 1 }],
    [{ path: '.config/jj/config.toml', text: 'x'.repeat(4097) }],
  ])
    assert.throws(
      () => parsePageData(JSON.stringify({ ...empty, homeFiles: value })),
      /page data homeFiles invalid/,
    );
  assert.deepEqual(
    parsePageData(
      JSON.stringify({
        ...empty,
        homeFiles: [{ path: '.config/jj/config.toml', text: 'x'.repeat(4096) }],
      }),
    ).homeFiles,
    [{ path: '.config/jj/config.toml', text: 'x'.repeat(4096) }],
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
