import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import {
  type PagesServer,
  serverFromEnvironment,
  startPagesServer,
  typeOf,
} from '../../scripts/serve-pages-like.ts';
import { tempDir, writeFiles } from './helpers.ts';

let server: PagesServer;
let site = '';
before(async () => {
  site = await tempDir('pages');
  await writeFiles(site, {
    'index.html': '<h1>top</h1>',
    'tools/index.html': '<h1>tools</h1>',
    '404.html': '<h1>missing</h1>',
    '_astro/a.js': 'export {}',
    'guests/x.wasm': '\0asm',
    'harness.js': 'export const fake = 1;',
  });
  server = await startPagesServer({
    siteDir: site,
    http: true,
    overlay: new Map([['/formicarium/_astro/a.js', join(site, 'harness.js')]]),
  });
});
after(() => server?.close());
const get = (path: string, init?: RequestInit) =>
  fetch(`${server.origin}${path}`, { redirect: 'manual', ...init });

test('pages are served below /formicarium/ with no isolation or CSP header', async () => {
  const response = await get('/formicarium/');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<h1>top</h1>');
  assert.equal(
    response.headers.get('content-type'),
    'text/html; charset=utf-8',
  );
  for (const header of [
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
    'content-security-policy',
  ])
    assert.equal(response.headers.get(header), null, header);
  assert.equal((await get('/formicarium/tools/')).status, 200);
  assert.equal(typeOf('a.wasm'), 'application/wasm');
  assert.equal(typeOf('a.unknown'), 'application/octet-stream');
});

test('a directory without its trailing slash redirects, like Pages', async () => {
  const response = await get('/formicarium/tools?x=1');
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), '/formicarium/tools/?x=1');
  assert.equal(
    (await get('/formicarium')).headers.get('location'),
    '/formicarium/',
  );
});

test('misses answer 404.html; paths outside the base, traversal and POST are refused', async () => {
  const missing = await get('/formicarium/nope/');
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), '<h1>missing</h1>');
  assert.equal((await get('/elsewhere/')).status, 404);
  assert.equal(
    (await get('/formicarium/%2e%2e/%2e%2e/etc/passwd')).status,
    404,
  );
  assert.equal((await get('/formicarium/', { method: 'POST' })).status, 405);
  assert.equal((await get('/formicarium/', { method: 'HEAD' })).status, 200);
});

test('the test overlay replaces one file of the site', async () => {
  assert.equal(
    await (await get('/formicarium/_astro/a.js')).text(),
    'export const fake = 1;',
  );
  assert.ok(server.requests.includes('/formicarium/_astro/a.js'));
});

test('HTTPS material or the explicit local HTTP mode is required', async () => {
  await assert.rejects(startPagesServer({ siteDir: site }), /config-invalid/);
  await assert.rejects(
    serverFromEnvironment({ SHOWCASE_SITE_DIR: site }),
    /config-invalid/,
  );
  await assert.rejects(
    serverFromEnvironment({ SHOWCASE_TLS_CERT: '/x' }),
    /SHOWCASE_TLS_CA\/CERT\/KEY\/SHA256 must be set together/,
  );
  const local = await serverFromEnvironment({
    SHOWCASE_SITE_DIR: site,
    SHOWCASE_SITE_LOCAL_HTTP: '1',
  });
  try {
    assert.match(local.origin, /^http:\/\/localhost:\d+$/);
  } finally {
    await local.close();
  }
});
