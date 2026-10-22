import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validateGuest } from '@aletheia-works/formicarium';
import {
  acquireOfficial,
  fetchBounded,
  loadAcquired,
  PROVENANCE_NOTE,
  runAcquireOfficialJob,
} from '../scripts/acquire.ts';
import { canonicalJson } from '../scripts/build-key.ts';
import {
  readConfigFile,
  type ToolConfig,
  validateToolsConfig,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import { TRANSFER_POLICY } from '../scripts/limits.ts';
import { resolveTool, runResolveJob } from '../scripts/resolve.ts';
import { dynamicElf, staticElf } from './fixtures/elf.ts';
import {
  bytes,
  commit,
  fakeFetch,
  redirect,
  releaseRoutes,
  sha,
} from './fixtures/github.ts';
import { tgz } from './fixtures/tar.ts';
import { MAIN_ALLOWED, readMain, withLayout } from './fixtures/work.ts';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);
const body = new Uint8Array(64).fill(7);
const url = 'https://assets.example/a.bin';
const tools = validateToolsConfig(
  await readConfigFile('tools.json'),
  JSON.parse(MAIN_ALLOWED),
);
const aube = tools.tools.find((item) => item.tool === 'aube') as ToolConfig;
const aubeElf = staticElf(256, 1);
const aubeTar = tgz([
  { name: 'aube', body: aubeElf, mode: 0o755 },
  { name: 'aubr', type: '2', linkname: 'aube' },
]);
const aubeName = 'aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz';
const biomeElf = staticElf(300, 2);

test('the download limit accepts its value and refuses one byte more', async () => {
  const fetchImpl = fakeFetch({ [url]: bytes(body) });
  const ok = await fetchBounded(url, { maxBytes: body.length, fetchImpl });
  assert.equal(ok.bytes.length, body.length);
  await rejects(
    fetchBounded(url, { maxBytes: body.length - 1, fetchImpl }),
    'size-limit',
  );
  assert.equal(TRANSFER_POLICY.maxDownloadBytes, 134217728);
  assert.equal(TRANSFER_POLICY.fetchDeadlineMs, 120000);
});

test('the streamed size must equal the declared size in both directions', async () => {
  const fetchImpl = fakeFetch({ [url]: bytes(body) });
  await rejects(
    fetchBounded(url, {
      maxBytes: 1024,
      expectedBytes: body.length - 1,
      fetchImpl,
    }),
    'size-mismatch',
  );
  await rejects(
    fetchBounded(url, {
      maxBytes: 1024,
      expectedBytes: body.length + 1,
      fetchImpl,
    }),
    'size-mismatch',
  );
});

test('each redirect hop is checked: five hops pass, the sixth and bad hops fail', async () => {
  const hop = (index: number) => `https://hop${index}.example/file`;
  const chain: Record<string, Response> = {};
  for (let index = 0; index < 6; index++)
    chain[hop(index)] = redirect(hop(index + 1));
  chain[hop(6)] = bytes(body);
  const five = await fetchBounded(hop(1), {
    maxBytes: 1024,
    fetchImpl: fakeFetch(chain),
  });
  assert.equal(five.finalUrl, hop(6));
  await rejects(
    fetchBounded(hop(0), { maxBytes: 1024, fetchImpl: fakeFetch(chain) }),
    'redirect',
  );
  for (const location of [
    'http://plain.example/file',
    'https://user:secret@cred.example/file',
    url,
  ]) {
    const routes = {
      [url]: redirect(location),
      'http://plain.example/file': bytes(body),
    };
    await rejects(
      fetchBounded(url, { maxBytes: 1024, fetchImpl: fakeFetch(routes) }),
      'redirect',
    );
  }
  await rejects(
    fetchBounded(url, {
      maxBytes: 1024,
      fetchImpl: fakeFetch({ [url]: new Response(null, { status: 302 }) }),
    }),
    'redirect',
  );
});

test('requests omit credentials, follow redirects manually and drop signed queries', async () => {
  const fetchImpl = fakeFetch({
    [url]: redirect('https://objects.example/blob?sig=secret'),
    'https://objects.example/blob?sig=secret': bytes(body),
  });
  const result = await fetchBounded(url, { maxBytes: 1024, fetchImpl });
  assert.equal(result.finalUrl, 'https://objects.example/blob');
  assert.equal(fetchImpl.calls[0]!.init!.credentials, 'omit');
  assert.equal(fetchImpl.calls[0]!.init!.redirect, 'manual');
});

test('the deadline covers the whole request and is reported as deadline', async () => {
  const hanging = (async (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    })) as typeof fetch;
  await rejects(
    fetchBounded(url, { maxBytes: 10, deadlineMs: 30, fetchImpl: hanging }),
    'deadline',
  );
  const failing = fakeFetch({ [url]: new Response('no', { status: 404 }) });
  await rejects(
    fetchBounded(url, { maxBytes: 10, fetchImpl: failing }),
    'http-status',
  );
});

async function resolvedAube(assetBytes: Uint8Array) {
  const routes = releaseRoutes({
    slug: 'aubepkg/aube',
    tag: 'v2.7.0',
    commit: commit('aube'),
    assets: [{ name: aubeName, bytes: assetBytes }],
  });
  const { resolution } = await resolveTool(
    createGitHubApi({ fetchImpl: fakeFetch(routes) }),
    aube,
  );
  return { resolution, routes };
}

test('an official tar.gz asset yields the configured entry and guest metadata', async () => {
  const { resolution, routes } = await resolvedAube(aubeTar);
  const result = await acquireOfficial(aube, resolution, {
    validate: validateGuest,
    hash: 'b'.repeat(64),
    fetchImpl: fakeFetch(routes),
  });
  assert.deepEqual(result.elf, aubeElf);
  assert.equal(result.record.elfSha256, sha(aubeElf));
  assert.equal(result.record.buildInfo.rustc, null);
  assert.deepEqual(result.record.buildInfo.sourcePatches, []);
  assert.equal(result.record.buildInfo.source.commit, commit('aube'));
  assert.equal(result.record.provenance.note, PROVENANCE_NOTE);
  assert.equal(
    result.record.buildInfoSha256,
    sha(canonicalJson(result.record.buildInfo)),
  );
});

test('a checksum mismatch and a dynamic ELF are refused', async () => {
  const { resolution, routes } = await resolvedAube(aubeTar);
  const tampered = new Uint8Array(aubeTar);
  tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;
  routes[resolution.asset!.url] = bytes(tampered);
  await rejects(
    acquireOfficial(aube, resolution, {
      validate: validateGuest,
      hash: 'b'.repeat(64),
      fetchImpl: fakeFetch(routes),
    }),
    'checksum-mismatch',
  );
  const dynamic = tgz([{ name: 'aube', body: dynamicElf(), mode: 0o755 }]);
  const resolvedDynamic = await resolvedAube(dynamic);
  await rejects(
    acquireOfficial(aube, resolvedDynamic.resolution, {
      validate: validateGuest,
      hash: 'b'.repeat(64),
      fetchImpl: fakeFetch(resolvedDynamic.routes),
    }),
    'elf-invalid',
  );
});

function siteRoutes() {
  return {
    ...releaseRoutes({
      slug: 'aubepkg/aube',
      tag: 'v2.7.0',
      commit: commit('aube'),
      assets: [{ name: aubeName, bytes: aubeTar }],
    }),
    ...releaseRoutes({
      slug: 'jdx/pitchfork',
      tag: 'v2.30.0',
      commit: commit('pitchfork'),
    }),
    ...releaseRoutes({
      slug: 'biomejs/biome',
      tag: '@biomejs/biome@2.5.15',
      commit: commit('biome'),
      assets: [{ name: 'biome-linux-x64-musl', bytes: biomeElf }],
    }),
  };
}

test('the acquire job stores verified copies and never builds a release-asset tool', async () => {
  await withLayout(async (layout) => {
    const routes = siteRoutes();
    await runResolveJob({
      api: createGitHubApi({ fetchImpl: fakeFetch(routes) }),
      readMain,
      layout,
    });
    const records = await runAcquireOfficialJob({
      validate: validateGuest,
      fetchImpl: fakeFetch(routes),
      layout,
      readMain,
    });
    assert.deepEqual(
      records.map((record) => record.tool),
      ['aube', 'biome'],
    );
    assert.deepEqual(
      (await loadAcquired(layout)).map((record) => record.tool),
      ['aube', 'biome'],
    );
    assert.deepEqual(
      new Uint8Array(await readFile(join(layout.acquired, 'aube', 'guest'))),
      aubeElf,
    );
  });
  await withLayout(async (layout) => {
    const routes = siteRoutes();
    await runResolveJob({
      api: createGitHubApi({ fetchImpl: fakeFetch(routes) }),
      readMain,
      layout,
    });
    const missing: Record<string, unknown> = { ...routes };
    delete missing[
      'https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%402.5.15/biome-linux-x64-musl'
    ];
    await rejects(
      runAcquireOfficialJob({
        validate: validateGuest,
        fetchImpl: fakeFetch(missing as Parameters<typeof fakeFetch>[0]),
        layout,
        readMain,
      }),
      'offline',
    );
    assert.equal(
      (await loadAcquired(layout)).some(
        (record) => record.tool === 'pitchfork',
      ),
      false,
    );
  });
});
