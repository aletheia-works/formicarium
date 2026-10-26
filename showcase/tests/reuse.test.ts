import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGuest } from '@aletheia-works/formicarium';
import { type BuildPlan, sourceBuildInfo } from '../scripts/build.ts';
import { canonicalJson } from '../scripts/build-key.ts';
import { readConfigFile, validateTrustedCallers } from '../scripts/config.ts';
import { createGitHubApi } from '../scripts/github.ts';
import { eligibleRuns, findReusable } from '../scripts/reuse.ts';
import { staticElf } from './fixtures/elf.ts';
import {
  bytes,
  commit,
  fakeFetch,
  json,
  type Route,
  redirect,
  sha,
} from './fixtures/github.ts';
import { zip } from './fixtures/tar.ts';

const trusted = validateTrustedCallers(
  await readConfigFile('trusted-callers.json'),
);
const elf = staticElf(180, 4);
const plan: BuildPlan = {
  builder: 'cargo',
  tool: 'pitchfork',
  version: '2.30.0',
  tag: 'v2.30.0',
  repository: 'https://github.com/jdx/pitchfork',
  commit: commit('pitchfork'),
  sourceDir: '/unused',
  binary: 'pitchfork',
  package: null,
  ui: null,
  toolchain: {
    rustChannel: 'stable',
    rustDeclaredBy: null,
    nodeVersion: null,
    nodeDeclaredBy: null,
  },
  cargo: '/opt/rust/cargo',
  rustc: '/opt/rust/rustc',
  rustcVersion: 'rustc 1.99.0 (fake)',
  nodeBin: null,
  nodeVersion: null,
  runner: null,
  gnu: null,
  dependencies: [
    {
      tool: 'cargo-lock',
      repository: 'https://github.com/jdx/pitchfork',
      commit: commit('pitchfork'),
      digest: sha('lock'),
    },
  ],
  builderHash: 'b'.repeat(64),
  buildKey: '',
};
plan.buildKey = sourceBuildInfo(plan, '0'.repeat(64)).buildKey;

const run = (overrides: Record<string, unknown>) => ({
  id: 10,
  path: '.github/workflows/showcase.yml',
  head_branch: 'main',
  event: 'push',
  conclusion: 'success',
  run_attempt: 1,
  created_at: '2026-10-17T00:00:00Z',
  ...overrides,
});
const api = 'https://api.github.com/repos/owner/repo';
function routes(
  runs: Record<string, unknown>[],
  files: Record<string, Uint8Array | string>,
  artifacts: Record<number, unknown[]> = {},
): Record<string, Route> {
  const result: Record<string, Route> = {
    [`${api}/actions/runs?branch=main&status=success&per_page=50`]: () =>
      json({ workflow_runs: runs }),
    [`${api}/actions/artifacts/77/zip`]: redirect(
      'https://blob.example/a.zip?sig=secret',
    ),
    'https://blob.example/a.zip?sig=secret': () => bytes(zip(files)),
  };
  for (const item of runs)
    result[`${api}/actions/runs/${item.id}/artifacts?name=showcase-candidate`] =
      () =>
        json({
          artifacts: artifacts[item.id as number] ?? [
            { id: 77, name: 'showcase-candidate', expired: false },
          ],
        });
  return result;
}
const prefix = 'site/guests/pitchfork/2.30.0/';
const goodFiles = () => ({
  [`${prefix}pitchfork`]: elf,
  [`${prefix}build-info.json`]: canonicalJson(sourceBuildInfo(plan, sha(elf))),
});
const reuse = (table: Record<string, Route>) => {
  const fetchImpl = fakeFetch(table);
  return findReusable(plan, {
    api: createGitHubApi({ token: 'read', fetchImpl }),
    repository: 'owner/repo',
    trusted,
    validate: validateGuest,
    fetchImpl,
  });
};

test('only successful main runs of trusted workflows outside pull_request are eligible', () => {
  const runs = [
    run({ id: 1, event: 'pull_request', created_at: '2026-10-18T00:00:00Z' }),
    run({ id: 2, path: '.github/workflows/other.yml' }),
    run({ id: 3, conclusion: 'failure' }),
    run({ id: 4, head_branch: 'feature' }),
    run({
      id: 5,
      path: '.github/workflows/showcase-site.yml',
      event: 'schedule',
      created_at: '2026-10-16T00:00:00Z',
    }),
    run({
      id: 6,
      event: 'workflow_dispatch',
      created_at: '2026-10-17T12:00:00Z',
    }),
  ];
  assert.deepEqual(
    eligibleRuns(runs, trusted).map((item) => item.id),
    [6, 5],
  );
});

test('a matching artifact is reused and the source run is recorded', async () => {
  const found = await reuse(
    routes([run({ id: 11, run_attempt: 2 })], goodFiles()),
  );
  assert.ok(found);
  assert.deepEqual(found.record.provenance.reusedFromRun, {
    runId: 11,
    runAttempt: 2,
    workflow: '.github/workflows/showcase.yml',
  });
  assert.equal(found.record.buildInfo.buildKey, plan.buildKey);
  assert.deepEqual(found.elf, elf);
});

test('a different buildKey or a different ELF digest causes a build', async () => {
  const other = sourceBuildInfo(
    { ...plan, builderHash: 'c'.repeat(64) },
    sha(elf),
  );
  assert.equal(
    await reuse(
      routes([run({})], {
        ...goodFiles(),
        [`${prefix}build-info.json`]: canonicalJson(other),
      }),
    ),
    null,
  );
  assert.equal(
    await reuse(
      routes([run({})], {
        ...goodFiles(),
        [`${prefix}pitchfork`]: staticElf(180, 5),
      }),
    ),
    null,
  );
});

test('pull_request runs, other workflows and expired artifacts are never reused', async () => {
  assert.equal(
    await reuse(routes([run({ event: 'pull_request' })], goodFiles())),
    null,
  );
  assert.equal(
    await reuse(
      routes([run({ path: '.github/workflows/ci.yml' })], goodFiles()),
    ),
    null,
  );
  assert.equal(
    await reuse(
      routes([run({ id: 12 })], goodFiles(), {
        12: [{ id: 77, name: 'showcase-candidate', expired: true }],
      }),
    ),
    null,
  );
});

test('an unavailable artifact download falls back to a build', async () => {
  const table = routes([run({})], goodFiles());
  delete table['https://blob.example/a.zip?sig=secret'];
  assert.equal(await reuse(table), null);
});
