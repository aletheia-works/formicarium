import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { resolveGuest } from '../../integration/guest-distribution/resolver.js';
import { stageDistribution } from '../../scripts/guest-distribution/stage.js';
import { createSyntheticSite, serveDistribution } from './serve.js';

let synthetic: Awaited<ReturnType<typeof createSyntheticSite>>,
  server: Awaited<ReturnType<typeof serveDistribution>>;
before(async () => {
  synthetic = await createSyntheticSite();
  server = await serveDistribution({
    synthetic: synthetic.site,
    actual: process.env.U2_ACTUAL_SITE,
  });
});
after(async () => {
  await server?.close();
  await synthetic?.cleanup();
});
const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const select = (ref?: string, fixture?: string) =>
  resolveGuest({
    tool: 'aube',
    ref,
    fixture,
    base: `${server.base}synthetic/`,
  });

test('synthetic HTTP contract: two refs resolve independently to expected bytes and seed', async (t) => {
  const results = [];
  for (const ref of ['main', 'pr-1645']) {
    const selected = await select(ref);
    results.push(selected);
    assert.equal(selected.build.ref, ref);
    assert.equal(hash(selected.guest), selected.build.guest.sha256);
    assert.equal(
      new TextDecoder().decode(
        selected.entries.find((e) => e.type === 'file')?.data,
      ),
      ref,
    );
    assert.equal(selected.cwd, '/work/app');
  }
  assert.notEqual(
    results[0].build.source.commit,
    results[1].build.source.commit,
  );
  assert.notDeepEqual(results[0].guest, results[1].guest);
  // Adding only the newer ref must still produce a complete standalone site.
  const directory = await mkdtemp(join(tmpdir(), 'retained-ref-http-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tools = JSON.parse(
    await readFile(join(synthetic.site, 'tools.json'), 'utf8'),
  );
  const manifest = JSON.parse(
    await readFile(join(synthetic.site, 'dist/builds.json'), 'utf8'),
  );
  const latest = results[1].build;
  const candidate = join(directory, 'site');
  const next = Object.assign(
    {
      tools,
      manifest,
      builds: [
        {
          tool: 'aube',
          ref: latest.ref,
          guestPath: join(synthetic.site, latest.guest.url),
          buildInfoPath: join(synthetic.site, latest.buildInfo.url),
          fixturePaths: Object.fromEntries(
            Object.entries(latest.fixtures).map(([name, asset]) => [
              name,
              join(synthetic.site, asset.url),
            ]),
          ),
        },
      ],
    },
    { existingRoot: synthetic.site },
  );
  await stageDistribution(next, candidate);
  const retainedServer = await serveDistribution({ synthetic: candidate });
  t.after(() => retainedServer.close());
  for (const expected of results) {
    const selected = await resolveGuest({
      tool: 'aube',
      ref: expected.build.ref,
      base: `${retainedServer.base}synthetic/`,
    });
    assert.deepEqual(selected.guest, expected.guest);
    assert.deepEqual(selected.entries, expected.entries);
    assert.equal(selected.build.source.commit, expected.build.source.commit);
    for (const asset of [
      selected.build.guest,
      selected.build.buildInfo,
      ...Object.values(selected.build.fixtures),
    ]) {
      const response = await fetch(
        new URL(asset.url, `${retainedServer.base}synthetic/`),
      );
      assert.equal(response.status, 200);
      assert.equal(
        hash(new Uint8Array(await response.arrayBuffer())),
        asset.sha256,
      );
    }
  }
});

test('synthetic default/explicit empty fixture survives HTTP boundary', async () => {
  const selected = await select(undefined, '');
  assert.equal(selected.build.ref, 'main');
  assert.deepEqual(selected.entries, []);
  assert.equal(selected.cwd, '/work');
});

test('unknown tool/ref/fixture never reaches guest execution', async () => {
  let executions = 0;
  const handoff = async (input: Parameters<typeof resolveGuest>[0]) => {
    await resolveGuest(input);
    executions++;
  };
  for (const input of [
    { tool: 'other' },
    { tool: 'aube', ref: 'not-published' },
    { tool: 'aube', fixture: 'not-published' },
  ]) {
    await assert.rejects(
      // @ts-expect-error Deliberately malformed input exercises the runtime guard.
      handoff({ ...input, base: `${server.base}synthetic/` }),
    );
  }
  assert.equal(executions, 0);
});

test('HTTP catalogue 404 does not trigger implicit retries or execution', async (t) => {
  const native = globalThis.fetch;
  let calls = 0,
    executions = 0;
  t.mock.method(globalThis, 'fetch', (...args: Parameters<typeof fetch>) => {
    calls++;
    return native(...args);
  });
  await assert.rejects(
    resolveGuest({ tool: 'aube', base: `${server.base}missing/` }).then(
      () => executions++,
    ),
    /tools: HTTP 404/,
  );
  assert.equal(calls, 1);
  assert.equal(executions, 0);
});

test('HTTP digest mismatch is rejected before execution', async (t) => {
  const native = globalThis.fetch;
  let executions = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (...args: Parameters<typeof fetch>) => {
      const response = await native(...args);
      if (String(args[0]).endsWith('/guest'))
        return new Response(new Uint8Array([1, 2, 3]));
      return response;
    },
  );
  await assert.rejects(
    select('main').then(() => executions++),
    /guest: SHA-256 mismatch/,
  );
  assert.equal(executions, 0);
});

test('HTTP redirect is refused before execution and target is never contacted', async (t) => {
  const native = globalThis.fetch;
  let calls = 0,
    executions = 0;
  const before = server.stats.redirectTargetRequests;
  t.mock.method(
    globalThis,
    'fetch',
    async (...args: Parameters<typeof fetch>) => {
      calls++;
      return native(...args);
    },
  );
  await assert.rejects(
    resolveGuest({
      tool: 'aube',
      ref: 'main',
      base: `${server.base}redirect/`,
    }).then(() => executions++),
    /guest: fetch failed.*redirect/,
  );
  assert.equal(executions, 0);
  assert.equal(calls, 4);
  assert.equal(server.stats.redirectTargetRequests, before);
});

test('actual official aube release supply: two refs match staged files and observed commits', {
  skip: !process.env.U2_ACTUAL_SITE
    ? 'Actual release assets absent; actual supply verification remains unverified'
    : false,
}, async () => {
  const root = resolve(process.env.U2_ACTUAL_SITE!);
  const manifest = JSON.parse(
    await readFile(join(root, 'dist/builds.json'), 'utf8'),
  );
  for (const ref of ['v2.6.1', 'v2.7.0']) {
    const selected = await resolveGuest({
      tool: 'aube',
      ref,
      base: `${server.base}actual/`,
    });
    assert.equal(
      selected.build.source.commit,
      manifest.builds.aube[ref].source.commit,
    );
    assert.equal(
      selected.build.source.commit,
      ref === 'v2.7.0'
        ? 'd36fec01764689ef6d99a5e43de98925b571d67f'
        : 'bd94e42f54d3b5e3dd102716b7197f316cb5f4ed',
    );
    assert.equal(
      hash(selected.guest),
      hash(await readFile(join(root, manifest.builds.aube[ref].guest.url))),
    );
    assert.equal(selected.build.ref, ref);
    assert.equal(selected.cwd, '/work/app');
  }
});

test('actual latest pitchfork patched static musl supply matches staged guest/provenance', {
  skip: !process.env.U2_ACTUAL_SITE
    ? 'Actual release assets absent; actual supply verification remains unverified'
    : false,
}, async () => {
  const root = resolve(process.env.U2_ACTUAL_SITE!);
  const manifest = JSON.parse(
    await readFile(join(root, 'dist/builds.json'), 'utf8'),
  );
  const selected = await resolveGuest({
    tool: 'pitchfork',
    ref: 'v2.30.0',
    base: `${server.base}actual/`,
  });
  assert.equal(
    selected.build.source.commit,
    manifest.builds.pitchfork['v2.30.0'].source.commit,
  );
  assert.equal(
    selected.build.source.commit,
    '60e97b1c39183d56e2124f84f9a68ad550fc4011',
  );
  assert.equal(
    hash(selected.guest),
    hash(await readFile(join(root, selected.build.guest.url))),
  );
  assert.equal(selected.build.ref, 'v2.30.0');
  assert.equal(selected.cwd, '/work/app');
});
