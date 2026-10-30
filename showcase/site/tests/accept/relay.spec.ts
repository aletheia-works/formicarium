import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { siteLayout } from '../../scripts/common.ts';
import type { PagesServer } from '../../scripts/serve-pages-like.ts';
import { RELAY_TOKEN_URL } from '../../src/terminal/relay.ts';
import { test } from './site-page.ts';
import {
  cspViolations,
  run,
  startServer,
  statusText,
  waitState,
} from './support.ts';

// The relay of the network tools without any network: the page's token URL
// points at a same-origin file of this server (or at a missing one), and the
// harness's stand-in for formicarium records the `network` each command got.
// Neither the real token function nor github.com is ever reached; no
// WebSocket opens, since the stand-in runs no guest.
const siteDir = process.env.SHOWCASE_SITE_DIR ?? siteLayout().dist;
const [version] = readdirSync(join(siteDir, '_formicarium'));
const HARNESS = join(import.meta.dirname, 'harness');
const TOKEN_PATH = '/formicarium/__relay/token.json';
const MISSING_PATH = '/formicarium/__relay/missing.json';
const TOKEN = {
  url: 'wss://acceptance.lambda-microvm.ap-northeast-1.on.aws/',
  protocols: [
    'lambda-microvms',
    'lambda-microvms.authentication.acceptance',
    'lambda-microvms.port.8080',
  ],
  expiresInMinutes: 15,
};
const CLONE = 'git clone https://github.com/octocat/Hello-World';
const JJ_CLONE = 'jj git clone https://github.com/octocat/Hello-World';

const work = mkdtempSync(join(tmpdir(), 'showcase-relay-'));
const files = {
  en: join(work, 'terminal.html'),
  ja: join(work, 'ja-terminal.html'),
  token: join(work, 'token.json'),
};

/** The built terminal page with its token URL moved to `tokenUrl`. */
function pageWithToken(page: string, tokenUrl: string): string {
  const html = readFileSync(join(siteDir, page), 'utf8');
  if (!html.includes(RELAY_TOKEN_URL))
    throw new Error(`${page} does not name the relay's token URL`);
  return html.replaceAll(RELAY_TOKEN_URL, tokenUrl);
}

let server: PagesServer;
test.beforeAll(async () => {
  server = await startServer(
    test.info().project.name,
    new Map([
      [
        `/formicarium/_formicarium/${version}/runtime/public.js`,
        join(HARNESS, 'fake-public.js'),
      ],
      [
        `/formicarium/_formicarium/${version}/runtime/web/api.js`,
        join(HARNESS, 'fake-browser.js'),
      ],
      ['/formicarium/terminal/', files.en],
      ['/formicarium/ja/terminal/', files.ja],
      [TOKEN_PATH, files.token],
    ]),
  );
  // The overlay reads its files on each request, so they can name the origin.
  writeFileSync(files.token, JSON.stringify(TOKEN));
  writeFileSync(
    files.en,
    pageWithToken('terminal/index.html', `${server.origin}${TOKEN_PATH}`),
  );
  writeFileSync(
    files.ja,
    pageWithToken('ja/terminal/index.html', `${server.origin}${MISSING_PATH}`),
  );
});
test.afterAll(async () => {
  await server?.close();
});

const network = (site: Parameters<typeof cspViolations>[0]) =>
  site.evaluate(
    () =>
      (globalThis as unknown as { __harnessNetwork: [string, unknown][] })
        .__harnessNetwork,
  );

test('[relay-network] only git and jj get the network, through one token of the token URL', async ({
  site,
}) => {
  await site.goto(`${server.origin}/formicarium/terminal/`);
  await waitState(site, ['ready']);
  // The CA bundle came with the session; no token is asked for before a
  // network tool runs.
  expect(server.requests).toContain('/formicarium/ca/cacert.pem');
  expect(server.requests).not.toContain(TOKEN_PATH);
  await run(site, CLONE);
  await run(site, 'ls');
  await run(site, JJ_CLONE);
  const relay = {
    allow: ['github.com:443'],
    relay: { url: TOKEN.url, protocols: TOKEN.protocols },
  };
  expect(await network(site)).toEqual([
    [CLONE, relay],
    ['ls', null],
    [JJ_CLONE, relay],
  ]);
  expect(server.requests.filter((path) => path === TOKEN_PATH)).toHaveLength(1);
  expect(await cspViolations(site)).toEqual([]);
});

test('[relay-network] without a token the command runs without the network and says so', async ({
  site,
}) => {
  await site.goto(`${server.origin}/formicarium/ja/terminal/`);
  await waitState(site, ['ready']);
  const output = await run(site, CLONE);
  expect(output).toContain(
    'relay に届かないので、network なしで実行します。clone と fetch は失敗します。',
  );
  expect(server.requests).toContain(MISSING_PATH);
  expect(await network(site)).toEqual([[CLONE, null]]);
  await run(site, 'ls');
  expect(await network(site)).toEqual([
    [CLONE, null],
    ['ls', null],
  ]);
  expect(await cspViolations(site)).toEqual([]);
});
