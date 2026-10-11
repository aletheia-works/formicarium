import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { TestContext } from 'node:test';
import test from 'node:test';
import type { GuestBuild } from '../../integration/terrarium/guest-distribution/index.js';
import {
  resolveGuest,
  validateGuestElf,
  validateProvenance,
} from '../../integration/terrarium/guest-distribution/resolver.js';

// Only synthetic schema/ELF data, never a verified actual tool distribution.
const base = 'https://example.test/site/';
const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
function elf(marker = 1) {
  const bytes = new Uint8Array(128);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 2, true);
  view.setUint16(18, 62, true);
  view.setUint32(20, 1, true);
  view.setBigUint64(32, 64n, true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint32(64, 1, true);
  view.setBigUint64(72, 0n, true);
  view.setBigUint64(96, 128n, true);
  view.setBigUint64(104, 128n, true);
  bytes[127] = marker;
  return bytes;
}
function scenario() {
  const assets = new Map<string, Uint8Array<ArrayBuffer>>();
  const builds: Record<string, GuestBuild> = {};
  for (const [index, ref] of ['main', 'pr-1645'].entries()) {
    const source = {
      url: 'https://example.test/source',
      ref,
      commit: String(index + 1).repeat(40),
    };
    const built_at = '2026-10-08T00:00:00Z';
    const add = (name: string, bytes: Uint8Array<ArrayBuffer>) => {
      const url = `dist/aube/${index}/${name}`;
      assets.set(new URL(url, base).href, bytes);
      return { url, sha256: hash(bytes) };
    };
    builds[ref] = {
      schemaVersion: 1,
      tool: 'aube',
      ref,
      source,
      built_at,
      guest: { ...add('guest', elf(index + 1)), format: 'static-musl-x86_64' },
      fixtures: { seed: add('seed.json', json({ 'app/name': ref })) },
      buildInfo: add(
        'build-info.json',
        json({
          schemaVersion: 1,
          tool: 'aube',
          ref,
          source,
          built_at,
          target: 'x86_64-linux-musl',
          linkage: 'static',
          libc: 'musl',
        }),
      ),
    };
  }
  const tools = {
    aube: { default: 'main', fixture: 'seed', cwd: '/work/app' },
  };
  return { assets, builds, tools };
}
function mock(
  t: TestContext,
  data: ReturnType<typeof scenario>,
  transform: (response: Response, url: string) => Response = (response) =>
    response,
) {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, options?: RequestInit) => {
      const url = String(input);
      return (async () => {
        calls.push({ url, options });
        const bytes = url.endsWith('/tools.json')
          ? json(data.tools)
          : url.endsWith('/dist/builds.json')
            ? json({ builds: { aube: data.builds } })
            : data.assets.get(url);
        return transform(
          new Response(bytes, { status: bytes ? 200 : 404 }),
          url,
        );
      })();
    },
  );
  return calls;
}
const select = (ref?: string, fixture?: string) =>
  resolveGuest({ tool: 'aube', ref, fixture, base });

test('two refs resolve distinct owned bytes/commits/entries with matching digests and cwd', async (t) => {
  const data = scenario();
  const calls = mock(t, data);
  for (const ref of ['main', 'pr-1645']) {
    const result = await select(ref);
    assert.equal(result.build.ref, ref);
    assert.equal(result.build.source.commit, data.builds[ref].source.commit);
    assert.equal(hash(result.guest), result.build.guest.sha256);
    assert.equal(result.cwd, '/work/app');
    assert.equal(
      new TextDecoder().decode(
        result.entries.find((e) => e.type === 'file')?.data,
      ),
      ref,
    );
    assert.notEqual(result.build, data.builds[ref]);
  }
  assert.equal(calls.length, 10);
  assert.ok(calls.every((call) => call.options?.redirect === 'error'));
});

test('default ref and explicit empty fixture preserve selection and skip fixture fetching', async (t) => {
  const calls = mock(t, scenario());
  const result = await select(undefined, '');
  assert.equal(result.build.ref, 'main');
  assert.equal(result.cwd, '/work');
  assert.deepEqual(result.entries, []);
  assert.equal(calls.length, 4);
});

test('unknown tool/ref/fixture and 404 stop with identifiable errors and no fallback/retry', async (t) => {
  const data = scenario();
  const calls = mock(t, data);
  await assert.rejects(select('unknown'), /unknown ref/);
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  await assert.rejects(resolveGuest({ tool: 'other', base }), /unknown tool/);
  await assert.rejects(select('main', 'unknown'), /unknown fixture/);
  data.assets.delete(new URL(data.builds.main.buildInfo.url, base).href);
  await assert.rejects(select('main'), /build-info: HTTP 404/);
  assert.equal(
    calls.filter((call) => call.url.endsWith('/build-info.json')).length,
    1,
  );
  assert.equal(calls.filter((call) => call.url.endsWith('/guest')).length, 0);
});

test('every fetched asset digest is independently enforced', async (t) => {
  const data = scenario();
  mock(t, data);
  for (const asset of [
    data.builds.main.buildInfo,
    data.builds.main.guest,
    data.builds.main.fixtures.seed,
  ]) {
    const saved = asset.sha256;
    asset.sha256 = '0'.repeat(64);
    await assert.rejects(select('main'), /SHA-256 mismatch/);
    asset.sha256 = saved;
  }
});

test('build-info binds schema/tool/ref/commit/time and static musl provenance', async (t) => {
  const data = scenario();
  mock(t, data);
  const build = data.builds.main;
  const url = new URL(build.buildInfo.url, base).href;
  const original = JSON.parse(new TextDecoder().decode(data.assets.get(url)));
  assert.doesNotThrow(() =>
    validateProvenance(
      { ...original, target: 'x86_64-unknown-linux-musl' },
      build,
    ),
  );
  for (const mutate of [
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.schemaVersion = 2),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.tool = 'pitchfork'),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.ref = 'other'),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.source.commit = 'f'.repeat(40)),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.target = 'x86_64-linux-gnu'),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.linkage = 'dynamic'),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.libc = 'glibc'),
    (i: {
      schemaVersion: unknown;
      tool: unknown;
      ref: unknown;
      source: { commit: unknown };
      target: unknown;
      linkage: unknown;
      libc: unknown;
      built_at: unknown;
    }) => (i.built_at = 'different'),
  ]) {
    const info = structuredClone(original);
    mutate(info);
    const bytes = json(info);
    data.assets.set(url, bytes);
    build.buildInfo.sha256 = hash(bytes);
    await assert.rejects(select('main'), /build-info/);
  }
  const pitchfork = { ...build, tool: 'pitchfork' as const };
  const info = {
    ...original,
    tool: 'pitchfork',
  };
  assert.doesNotThrow(() => validateProvenance(info, pitchfork));
});

test('ELF header/program/segment bounds and dynamic interpreter are rejected', () => {
  assert.notEqual(validateGuestElf(elf()), elf());
  for (const mutate of [
    (v: DataView) => v.setUint8(0, 0),
    (v: DataView) => v.setUint16(18, 3, true),
    (v: DataView) => v.setBigUint64(32, 99999999999999n, true),
    (v: DataView) => v.setUint16(56, 0, true),
    (v: DataView) => v.setUint32(64, 3, true),
    (v: DataView) => v.setUint32(64, 0, true),
    (v: DataView) => v.setBigUint64(96, 999n, true),
    (v: DataView) => v.setBigUint64(104, 1n, true),
  ]) {
    const bytes = elf();
    mutate(new DataView(bytes.buffer));
    assert.throws(() => validateGuestElf(bytes), /guest:/);
  }
  assert.throws(() => validateGuestElf(new Uint8Array(20)), /header/);
});

test('redirect, network failure and malformed UTF8/JSON fail without execution or leaking data', async (t) => {
  const data = scenario();
  mock(
    t,
    data,
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: 'https://outside.test/' },
      }),
  );
  await assert.rejects(select('main'), /redirect/);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('secret-network-value');
  });
  await assert.rejects(
    select('main'),
    (error: Error) =>
      /fetch failed/.test(error.message) &&
      !error.message.includes('secret-network-value') &&
      !(error.cause as Error).message.includes('secret-network-value'),
  );
  t.mock.restoreAll();
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(new Uint8Array([255])),
  );
  await assert.rejects(select('main'), /invalid UTF-8 JSON/);
});
