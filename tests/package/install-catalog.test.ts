import assert from 'node:assert/strict';
import test from 'node:test';
import type { GuestBuildInfo } from '../../runtime/guest-validation.js';
import {
  guestBuildKey,
  guestCanonical,
  guestSha256,
} from '../../runtime/guest-validation.js';
import type { GuestCatalog } from '../../runtime/install-catalog.js';
import {
  archivePath,
  assetURL,
  selectCatalog,
  snapshotCatalog,
} from '../../runtime/install-catalog.js';

function catalog(): GuestCatalog {
  const info: GuestBuildInfo = {
    schemaVersion: 1,
    tool: 'demo',
    versionOrName: 'fixed',
    source: { repository: 'https://example.test/demo', commit: 'a'.repeat(40) },
    target: 'x86_64-unknown-linux-musl',
    rustc: null,
    sourcePatches: [],
    dependencies: [],
    builderHash: 'b'.repeat(64),
    buildKey: '',
    elfSha256: 'c'.repeat(64),
    additional: { spelling: '保持', count: 1 },
  };
  info.buildKey = guestBuildKey(info);
  return {
    schemaVersion: 1,
    catalogId: 'test',
    defaults: { demo: 'fixed' },
    entries: [
      {
        tool: 'demo',
        versionOrName: 'fixed',
        url: 'https://example.test/demo',
        format: 'elf',
        downloadSha256: info.elfSha256,
        downloadBytes: 64,
        elfBytes: 64,
        buildInfo: info,
        buildInfoSha256: guestSha256(
          new TextEncoder().encode(guestCanonical(info)),
        ),
      },
    ],
  };
}
const invalidInput = { code: 'INVALID_INPUT' };
test('catalog deep snapshot retains unknown identity fields and exact defaults', () => {
  const input = catalog();
  const copy = snapshotCatalog(input);
  input.defaults = { demo: 'other' };
  input.entries[0]!.url = 'https://changed.test';
  input.entries[0]!.buildInfo.source.commit = 'd'.repeat(40);
  assert.equal(selectCatalog(copy, 'demo'), selectCatalog(copy, 'demo@fixed'));
  assert.equal(copy.entries[0]!.url, 'https://example.test/demo');
  assert.equal(copy.entries[0]!.buildInfo.source.commit, 'a'.repeat(40));
  assert.deepEqual(copy.entries[0]!.buildInfo.additional, {
    count: 1,
    spelling: '保持',
  });
  assert.ok(Object.isFrozen(copy.entries[0]!.buildInfo.source));
});
test('empty catalog valid but missing defaults and invalid exact selection reject', () => {
  const empty = snapshotCatalog({
    schemaVersion: 1,
    catalogId: 'empty',
    defaults: {},
    entries: [],
  });
  for (const selection of [
    'demo',
    '',
    'demo@',
    'demo@@fixed',
    'https://example.test',
    'demo@unknown',
    'demo extra',
    '@fixed',
  ])
    assert.throws(() => selectCatalog(empty, selection), invalidInput);
  const input = catalog();
  input.defaults = { demo: 'missing' };
  assert.throws(() => snapshotCatalog(input), invalidInput);
});
test('duplicate entries, missing metadata, unknown schema and canonical unsafe values reject', () => {
  const input = catalog();
  input.entries = [...input.entries, input.entries[0]!];
  assert.throws(() => snapshotCatalog(input), invalidInput);
  for (const mutation of [
    { schemaVersion: 2 },
    { defaults: [] },
    { catalogId: '' },
    { additional: NaN },
    { additional: '\ud800' },
  ])
    assert.throws(
      () => snapshotCatalog({ ...catalog(), ...mutation }),
      invalidInput,
    );
  for (const metadata of [null, undefined, {}]) {
    const raw = catalog();
    (raw.entries[0] as unknown as Record<string, unknown>).buildInfo = metadata;
    assert.throws(() => snapshotCatalog(raw), invalidInput);
  }
});
test('unknown metadata fields participate in digest and build identity is mandatory', () => {
  const raw = catalog();
  raw.entries[0]!.buildInfo.additional = { count: 2 };
  assert.throws(() => snapshotCatalog(raw), invalidInput);
  const changed = catalog();
  changed.entries[0]!.buildInfo.buildKey = 'f'.repeat(64);
  changed.entries[0]!.buildInfoSha256 = guestSha256(
    new TextEncoder().encode(guestCanonical(changed.entries[0]!.buildInfo)),
  );
  assert.throws(() => snapshotCatalog(changed), invalidInput);
});
test('metadata validates source, target, patches, dependencies and tool selection', () => {
  for (const fields of [
    { source: { repository: '/relative', commit: 'a'.repeat(40) } },
    { source: { repository: 'https://example.test', commit: 'abc' } },
    { target: 'other' },
    {
      sourcePatches: [
        { name: 'one', sha256: 'a'.repeat(64) },
        { name: 'one', sha256: 'a'.repeat(64) },
      ],
    },
    { dependencies: [{}] },
    { rustc: '' },
    { tool: 'different' },
  ]) {
    const raw = catalog();
    Object.assign(raw.entries[0]!.buildInfo, fields);
    assert.throws(() => snapshotCatalog(raw), invalidInput);
  }
});
test('name and numeric byte boundaries include maxima but reject overflow', () => {
  for (const amount of [134217727, 134217728]) {
    const raw = catalog();
    raw.entries[0]!.downloadBytes = amount;
    raw.entries[0]!.elfBytes = amount;
    assert.equal(snapshotCatalog(raw).entries[0]!.elfBytes, amount);
  }
  for (const amount of [
    -1,
    134217729,
    0.5,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const raw = catalog();
    raw.entries[0]!.downloadBytes = amount;
    assert.throws(() => snapshotCatalog(raw), invalidInput);
  }
  for (const name of ['a'.repeat(65), '-bad', 'space name', 'bad@name']) {
    const raw = catalog();
    raw.entries[0]!.tool = name;
    assert.throws(() => snapshotCatalog(raw), invalidInput);
  }
});
test('URL rejects origin-less relative, HTTP, credentials, fragments and alternate schemes', () => {
  assert.equal(
    assetURL('https://example.test/demo'),
    'https://example.test/demo',
  );
  for (const url of [
    '/demo',
    '//example.test/demo',
    'http://example.test',
    'https://u:p@example.test',
    'data:text/plain,x',
    'https://example.test/#x',
    'https://example.test/ space',
  ])
    assert.throws(() => assetURL(url), invalidInput);
});
test('URL rejects every ASCII control and space, DEL and backslash while preserving valid Unicode paths', () => {
  for (const code of [
    ...Array.from({ length: 33 }, (_, index) => index),
    0x7f,
  ]) {
    assert.throws(
      () => assetURL(`https://example.test/a${String.fromCharCode(code)}b`),
      invalidInput,
    );
  }
  assert.throws(() => assetURL('https://example.test/a\\b'), invalidInput);
  assert.equal(assetURL('https://example.test/!'), 'https://example.test/!');
  assert.equal(
    assetURL('https://example.test/é'),
    'https://example.test/%C3%A9',
  );
  assert.equal(assetURL('https://example.test/~'), 'https://example.test/~');
});
test('archive paths normalize dot components, preserve UTF8 bound and reject traversal or wrong format', () => {
  assert.equal(archivePath('./bin//demo'), 'bin/demo');
  assert.equal(
    new TextEncoder().encode(archivePath('é'.repeat(2048))).length,
    4096,
  );
  for (const path of [
    'é'.repeat(2049),
    '../demo',
    'bin/../demo',
    '/demo',
    '.',
    'bin\\demo',
    'demo\0',
  ])
    assert.throws(() => archivePath(path), invalidInput);
  const raw = catalog();
  raw.entries[0]!.archiveEntry = 'demo';
  assert.throws(() => snapshotCatalog(raw), invalidInput);
  raw.entries[0]!.format = 'tar.gz';
  assert.equal(snapshotCatalog(raw).entries[0]!.archiveEntry, 'demo');
});
test('catalog and metadata serialized bounds reject oversized unknown fields', () => {
  const raw = catalog();
  raw.extra = 'x'.repeat(4194304);
  assert.throws(() => snapshotCatalog(raw), invalidInput);
  const metadata = catalog();
  metadata.entries[0]!.buildInfo.extra = 'x'.repeat(1048576);
  assert.throws(() => snapshotCatalog(metadata), invalidInput);
});
