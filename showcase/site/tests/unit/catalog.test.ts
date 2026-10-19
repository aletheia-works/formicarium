import assert from 'node:assert/strict';
import test from 'node:test';
import type { GuestCatalog } from '@aletheia-works/formicarium';
import {
  loadCatalog,
  resolveCatalog,
  siteRootFrom,
} from '../../src/terminal/catalog.ts';
import {
  FetchFailure,
  MAX_CATALOG_BYTES,
  sha256Hex,
} from '../../src/terminal/fetch-limited.ts';
import { chunked } from './helpers.ts';

const ORIGIN = 'https://aletheia-works.github.io';
const catalog = (url = 'guests/aube/2.7.2/aube.tar.gz') =>
  ({
    schemaVersion: 1,
    catalogId: 'showcase-test',
    defaults: { aube: '2.7.2' },
    entries: [{ tool: 'aube', versionOrName: '2.7.2', url, format: 'tar.gz' }],
  }) as unknown as GuestCatalog;

test('en, ja and pages of different depth resolve the same guest URL', () => {
  const urls = [
    `${ORIGIN}/formicarium/terminal/`,
    `${ORIGIN}/formicarium/ja/terminal/`,
    `${ORIGIN}/formicarium/tools/aube/`,
    `${ORIGIN}/formicarium/ja/tools/aube/`,
  ].map(
    (page) =>
      resolveCatalog(catalog(), siteRootFrom(page, '/formicarium')).entries[0]!
        .url,
  );
  assert.deepEqual(
    new Set(urls),
    new Set([`${ORIGIN}/formicarium/guests/aube/2.7.2/aube.tar.gz`]),
  );
});

test('absolute, root-relative, other-scheme and `..` entry URLs are refused', () => {
  const root = siteRootFrom(`${ORIGIN}/formicarium/terminal/`, '/formicarium/');
  for (const url of [
    'https://example.com/aube.tar.gz',
    '//example.com/aube.tar.gz',
    '/guests/aube.tar.gz',
    'javascript:alert(1)',
    'guests/../../secret',
    'guests\\aube',
    '',
  ])
    assert.throws(() => resolveCatalog(catalog(url), root), FetchFailure, url);
});

test('loadCatalog checks the embedded SHA256 and resolves the URLs', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(catalog()));
  const loaded = await loadCatalog({
    url: `${ORIGIN}/formicarium/catalog.json`,
    sha256: await sha256Hex(bytes),
    siteRoot: new URL(`${ORIGIN}/formicarium/`),
    fetch: { fetchImpl: async () => chunked([bytes]) },
  });
  assert.equal(
    loaded.entries[0]!.url,
    `${ORIGIN}/formicarium/guests/aube/2.7.2/aube.tar.gz`,
  );
  assert.equal(loaded.catalogId, 'showcase-test');
});

test('a changed catalog is not used', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(catalog()));
  await assert.rejects(
    loadCatalog({
      url: `${ORIGIN}/formicarium/catalog.json`,
      sha256: 'f'.repeat(64),
      siteRoot: new URL(`${ORIGIN}/formicarium/`),
      fetch: { fetchImpl: async () => chunked([bytes]) },
    }),
    (error: unknown) =>
      error instanceof FetchFailure && error.kind === 'digest-mismatch',
  );
});

test('the catalog is bounded at maxCatalogBytes and needs an entries array', async () => {
  const huge = new Uint8Array(MAX_CATALOG_BYTES + 1);
  await assert.rejects(
    loadCatalog({
      url: `${ORIGIN}/formicarium/catalog.json`,
      sha256: 'f'.repeat(64),
      siteRoot: new URL(`${ORIGIN}/formicarium/`),
      fetch: { fetchImpl: async () => chunked([huge]) },
    }),
    (error: unknown) =>
      error instanceof FetchFailure && error.kind === 'size-limit',
  );
  const noEntries = new TextEncoder().encode('{"schemaVersion":1}');
  await assert.rejects(
    loadCatalog({
      url: `${ORIGIN}/formicarium/catalog.json`,
      sha256: await sha256Hex(noEntries),
      siteRoot: new URL(`${ORIGIN}/formicarium/`),
      fetch: { fetchImpl: async () => chunked([noEntries]) },
    }),
    /entries missing/,
  );
});
