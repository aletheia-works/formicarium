import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  readConfigFile,
  type ToolConfig,
  validateToolsConfig,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import {
  loadResolutions,
  loadVerifiedTools,
  resolveTool,
  runResolveJob,
} from '../scripts/resolve.ts';
import {
  commit,
  fakeFetch,
  json,
  type Route,
  releaseRoutes,
} from './fixtures/github.ts';
import { gnuOptions, ncursesTagRoutes } from './fixtures/gnu.ts';
import { MAIN_ALLOWED, readMain, withLayout } from './fixtures/work.ts';

const tools = validateToolsConfig(
  await readConfigFile('tools.json'),
  JSON.parse(MAIN_ALLOWED),
);
const tool = (name: string) =>
  tools.tools.find((item) => item.tool === name) as ToolConfig;
const aubeAsset = {
  name: 'aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz',
  bytes: new Uint8Array([1, 2, 3]),
};
const biomeAsset = {
  name: 'biome-linux-x64-musl',
  bytes: new Uint8Array([4, 5]),
};
const jjAsset = {
  name: 'jj-v0.46.0-x86_64-unknown-linux-musl.tar.gz',
  bytes: new Uint8Array([6, 7]),
};
const all = () => ({
  ...releaseRoutes({
    slug: 'aubepkg/aube',
    tag: 'v2.7.0',
    commit: commit('aube'),
    assets: [aubeAsset],
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
    assets: [biomeAsset],
    annotated: true,
  }),
  ...ncursesTagRoutes(),
  ...releaseRoutes({
    slug: 'jj-vcs/jj',
    tag: 'v0.46.0',
    commit: commit('jj'),
    assets: [jjAsset],
  }),
});
const api = (routes: Record<string, Route>) =>
  createGitHubApi({ token: 'test-token', fetchImpl: fakeFetch(routes) });
const latest = 'https://api.github.com/repos/aubepkg/aube/releases/latest';
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);

test('resolves every tool once, peels annotated tags and writes resolutions once', async () => {
  await withLayout(async (layout) => {
    const resolutions = await runResolveJob({
      api: api(all()),
      readMain,
      layout,
      now: () => new Date('2026-10-18T00:00:00Z'),
      gnu: gnuOptions(),
    });
    assert.deepEqual(
      resolutions.tools.map((item) => [item.tool, item.version, item.commit]),
      [
        ['aube', '2.7.0', commit('aube')],
        ['pitchfork', '2.30.0', commit('pitchfork')],
        ['biome', '2.5.15', commit('biome')],
        ['nano', '9.3', commit('nano')],
        ['jj', '0.46.0', commit('jj')],
      ],
    );
    assert.equal(resolutions.tools[1]!.asset, null);
    assert.equal(resolutions.tools[0]!.attestation, 'absent');
    assert.equal(
      (await loadResolutions(layout)).resolvedAt,
      '2026-10-18T00:00:00.000Z',
    );
    assert.equal(
      await readFile(join(layout.licenses, 'aube-LICENSE'), 'utf8'),
      'MIT License\n',
    );
    await rejects(
      runResolveJob({ api: api(all()), readMain, layout, gnu: gnuOptions() }),
      'output-exists',
    );
  });
});

test('a prerelease or draft latest release is refused', async () => {
  const routes = all();
  routes[latest] = () =>
    json({ tag_name: 'v2.7.0', draft: false, prerelease: true, assets: [] });
  await rejects(resolveTool(api(routes), tool('aube')), 'release-invalid');
});

test('a tag outside the configured shape is refused', async () => {
  const routes = releaseRoutes({
    slug: 'aubepkg/aube',
    tag: 'release-2',
    commit: commit('x'),
  });
  await rejects(resolveTool(api(routes), tool('aube')), 'tag-mismatch');
});

test('zero, two or digest-less matching assets are refused', async () => {
  for (const assets of [[], [aubeAsset, aubeAsset]]) {
    const routes = releaseRoutes({
      slug: 'aubepkg/aube',
      tag: 'v2.7.0',
      commit: commit('a'),
      assets,
    });
    await rejects(resolveTool(api(routes), tool('aube')), 'release-invalid');
  }
  const routes = all();
  routes[latest] = () =>
    json({
      tag_name: 'v2.7.0',
      draft: false,
      prerelease: false,
      assets: [
        {
          name: aubeAsset.name,
          size: 3,
          browser_download_url: 'https://github.com/x',
        },
      ],
    });
  await rejects(resolveTool(api(routes), tool('aube')), 'release-invalid');
});

test('rate limits, offline and invalid bodies keep their cause and are not retried', async () => {
  const limited = all();
  limited[latest] = () => json({}, 403, { 'x-ratelimit-remaining': '0' });
  await rejects(resolveTool(api(limited), tool('aube')), 'rate-limit');
  const many = all();
  many[latest] = () => json({}, 429);
  await rejects(resolveTool(api(many), tool('aube')), 'rate-limit');
  const status = all();
  status[latest] = () => json({}, 500);
  await rejects(resolveTool(api(status), tool('aube')), 'http-status');
  const broken = all();
  broken[latest] = () => new Response('{"tag_name":"v1","tag_name":"v2"}');
  await rejects(resolveTool(api(broken), tool('aube')), 'bad-body');
  const offline = fakeFetch({});
  await rejects(
    resolveTool(createGitHubApi({ fetchImpl: offline }), tool('aube')),
    'offline',
  );
  assert.equal(offline.calls.length, 1);
});

test('the token is sent to the API and the default fetch can be replaced', async (t) => {
  const routes = all();
  const fetched = fakeFetch(routes);
  t.mock.method(globalThis, 'fetch', fetched);
  const { resolution } = await resolveTool(
    createGitHubApi({ token: 't0' }),
    tool('pitchfork'),
  );
  assert.equal(resolution.tag, 'v2.30.0');
  const headers = fetched.calls[0]!.init!.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer t0');
});

test('a repository missing from the main allow list is refused before any request', async () => {
  const narrowed = (path: string) =>
    path === 'showcase/allowed-sources.json'
      ? JSON.stringify({
          schemaVersion: 1,
          repositories: [
            'https://github.com/aubepkg/aube',
            'https://github.com/jdx/pitchfork',
          ],
        })
      : readMain(path);
  await rejects(loadVerifiedTools(narrowed), 'source-not-allowed');
});
