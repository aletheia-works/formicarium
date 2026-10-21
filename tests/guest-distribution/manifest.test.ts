import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertResponseUrl,
  normalizeBase,
  resolveAssetUrl,
  selectBuild,
  validateBuild,
} from '../../integration/guest-distribution/manifest.js';

// Fabricated schema fixtures; these are not actual aube/pitchfork supply assets.
const base = 'https://example.test/site/';
const digest = '1'.repeat(64);
function build(ref = 'main') {
  return {
    schemaVersion: 1,
    tool: 'aube',
    ref,
    source: { url: 'https://example.test/source', ref, commit: 'a'.repeat(40) },
    guest: {
      url: 'dist/aube/one/guest',
      sha256: digest,
      format: 'static-musl-x86_64',
    },
    fixtures: { seed: { url: 'dist/aube/one/seed.json', sha256: digest } },
    buildInfo: { url: 'dist/aube/one/build-info.json', sha256: digest },
    built_at: '2026-10-08T00:00:00Z',
    upstream_pr: null,
  };
}
function catalog() {
  return {
    tools: { aube: { default: 'main', fixture: 'seed', cwd: '/work/app' } },
    builds: {
      aube: { main: build(), 'v1.0': build('v1.0') },
      legacy: { old: { custom: true } },
    },
  };
}
const choose = (all: unknown, ref?: string) =>
  selectBuild(all, { tool: 'aube', ref, base });

test('selects two registered refs with provenance and preserves catalogue/legacy metadata', () => {
  const all: {
    tools: Record<string, { default: string; fixture: string; cwd: string }>;
    builds: {
      aube: Record<string, ReturnType<typeof build>>;
      legacy: { old: { custom: boolean } };
    };
  } = catalog();
  const first = choose(all, 'main');
  const second = choose(all, 'v1.0');
  assert.equal(first.catalog, all);
  assert.equal(first.build, all.builds.aube.main);
  assert.equal(second.ref, 'v1.0');
  assert.equal(second.build.source.ref, 'v1.0');
  assert.deepEqual(all.builds.legacy.old, { custom: true });
  assert.equal(first.build.upstream_pr, null);
});

test('branch, tag, full commit and pr-N are registered keys; paths come only from metadata', () => {
  const refs = ['feature/guest', 'v2.0.0', 'b'.repeat(40), 'pr-1645'];
  const all: {
    tools: Record<string, { default: string; fixture: string; cwd: string }>;
    builds: {
      aube: Record<string, ReturnType<typeof build>>;
      legacy: { old: { custom: boolean } };
    };
  } = catalog();
  all.builds.aube = Object.fromEntries(refs.map((ref) => [ref, build(ref)]));
  for (const ref of refs) {
    const result = choose(all, ref);
    assert.equal(result.ref, ref);
    assert.equal(result.build.guest.url, 'dist/aube/one/guest');
  }
});

test('omitted ref follows default-first then locale ordering; unknown ref never falls back', () => {
  const all: {
    tools: Record<string, { default: string; fixture: string; cwd: string }>;
    builds: {
      aube: Record<string, ReturnType<typeof build>>;
      legacy: { old: { custom: boolean } };
    };
  } = catalog();
  assert.equal(choose(all).ref, 'main');
  delete all.builds.aube.main;
  assert.equal(choose(all).ref, 'v1.0');
  assert.throws(() => choose(all, 'main'), /unknown ref/);
  all.builds.aube = {};
  assert.throws(() => choose(all), /no published builds/);
});

test('unknown tools, inherited keys and malformed catalogue/selection are refused', () => {
  for (const tool of ['other', '__proto__', undefined]) {
    assert.throws(() => selectBuild(catalog(), { tool, base }), /unknown tool/);
  }
  assert.throws(() => selectBuild(null, {}), /catalogue/);
  assert.throws(() => selectBuild(catalog(), null), /selection/);
  assert.throws(() => choose(catalog(), 'toString'), /unknown ref/);
  const all: {
    tools: Record<string, { default: string; fixture: string; cwd: string }>;
    builds: {
      aube: Record<string, ReturnType<typeof build>>;
      legacy: { old: { custom: boolean } };
    };
  } = catalog();
  delete all.tools.aube;
  assert.throws(() => choose(all), /unknown tool/);
});

test('validates schema, identity, source commit, format, hashes and build time', () => {
  const mutations: ((b: ReturnType<typeof build>) => unknown)[] = [
    (b) => (b.schemaVersion = 2),
    (b) => (b.tool = 'pitchfork'),
    (b) => (b.ref = 'else'),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => delete b.source.commit,
    (b) => (b.source.commit = 'short'),
    (b) => (b.source.ref = ''),
    (b) => (b.source.url = 'file:///tmp/source'),
    (b) => (b.guest.format = 'dynamic-x86_64'),
    (b) => (b.guest.sha256 = 'x'.repeat(64)),
    (b) => (b.buildInfo.sha256 = 'short'),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => (b.fixtures.seed.sha256 = null),
    (b) => (b.built_at = 'invalid'),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => (b.fixtures = []),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => (b.guest = null),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => (b.source.commit = ['a'.repeat(40)]),
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    (b) => (b.guest.sha256 = ['1'.repeat(64)]),
  ];
  for (const mutate of mutations) {
    const candidate = build();
    mutate(candidate);
    assert.throws(() =>
      validateBuild(candidate, { tool: 'aube', ref: 'main', base }),
    );
  }
});

test('distribution boundary rejects traversal, credentials, external origin and malformed URLs', () => {
  assert.equal(normalizeBase('https://example.test/site'), base);
  assert.equal(resolveAssetUrl('dist/guest', base), `${base}dist/guest`);
  assert.equal(resolveAssetUrl(`${base}dist/guest`, base), `${base}dist/guest`);
  for (const path of [
    '../guest',
    './guest',
    '%2e%2e/guest',
    'dist/%2fguest',
    'dist/%252e%252e/guest',
    'dist\\guest',
    '/site-other/guest',
    '/guest',
    'https://outside.test/site/guest',
    'https://user:secret@example.test/site/guest',
    'dist/%zz',
    'dist/guest#fragment',
    'dist/guest?q=1',
  ]) {
    assert.throws(() => resolveAssetUrl(path, base));
  }
  for (const invalid of [
    'relative/',
    'file:///tmp/',
    'https://user:secret@example.test/site/',
    'https://example.test/site/../',
    ' https://example.test/site/',
  ]) {
    assert.throws(() => normalizeBase(invalid));
  }
});

test('redirects and unexpected final URLs are refused without exposing credential values', () => {
  const requested = resolveAssetUrl('dist/guest', base);
  assert.doesNotThrow(() =>
    assertResponseUrl({ status: 200, url: requested }, requested, base),
  );
  for (const response of [
    { status: 302 },
    { status: 200, redirected: true },
    { status: 200, url: 'https://outside.test/guest' },
    { status: 200, url: `${base}dist/other` },
  ]) {
    assert.throws(() => assertResponseUrl(response, requested, base));
  }
  assert.throws(
    () => resolveAssetUrl('https://user:secret@example.test/site/guest', base),
    (error: Error) =>
      !error.message.includes('secret') && /credentials/.test(error.message),
  );
});
