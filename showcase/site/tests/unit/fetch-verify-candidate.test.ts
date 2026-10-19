import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { GitHubApi } from '../../../scripts/github.ts';
import { siteLayout } from '../../scripts/common.ts';
import {
  candidateRuns,
  fetchToLayout,
  findVerifyCandidate,
  RECOVERY,
} from '../../scripts/fetch-verify-candidate.ts';
import { tempDir } from './helpers.ts';

const run = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  path: '.github/workflows/showcase.yml@refs/heads/main',
  head_branch: 'main',
  event: 'push',
  conclusion: 'success',
  head_sha: String(id).repeat(40).slice(0, 40),
  created_at: `2026-10-${String(10 + id).padStart(2, '0')}T00:00:00Z`,
  ...extra,
});
const manifest = (distributable: boolean) =>
  new TextEncoder().encode(JSON.stringify({ candidateId: 'x', distributable }));

function api(
  runs: unknown[],
  artifacts: Record<number, unknown[]>,
): GitHubApi & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    async get(path) {
      paths.push(path);
      if (path.includes('/workflows/showcase.yml/runs'))
        return { workflow_runs: runs };
      const id = Number(/runs\/(\d+)\/artifacts/.exec(path)?.[1]);
      return { artifacts: artifacts[id] ?? [] };
    },
    async getOptional() {
      return null;
    },
    async redirectLocation() {
      return 'https://example.invalid/zip';
    },
  };
}
const artifact = (id: number, expired = false) => [
  { id, name: 'showcase-candidate', expired },
];

test('only successful push and manual runs of main showcase.yml qualify, newest first', () => {
  const runs = candidateRuns([
    run(1),
    run(2, { event: 'workflow_dispatch' }),
    run(3, { event: 'pull_request' }),
    run(4, { event: 'schedule' }),
    run(5, { head_branch: 'feature' }),
    run(6, { conclusion: 'failure' }),
    run(7, { path: '.github/workflows/showcase-site.yml' }),
  ]);
  assert.deepEqual(
    runs.map((item) => item.id),
    [2, 1],
  );
  assert.throws(() => candidateRuns(null), /api-failed/);
});

test('the newest qualifying run supplies the candidate', async () => {
  const downloads: number[] = [];
  const fetched = await findVerifyCandidate({
    api: api([run(1), run(2)], { 2: artifact(22), 1: artifact(11) }),
    repository: 'aletheia-works/formicarium',
    download: async (id) => {
      downloads.push(id);
      return new Map([['manifest.json', manifest(false)]]);
    },
  });
  assert.equal(fetched.run.id, 2);
  assert.deepEqual(downloads, [22]);
});

test('no run, or an expired artifact, fails with the manual recovery', async () => {
  const unavailable = (error: unknown) =>
    error instanceof Error &&
    /candidate-unavailable/.test(error.message) &&
    error.message.includes(RECOVERY);
  await assert.rejects(
    findVerifyCandidate({
      api: api([], {}),
      repository: 'aletheia-works/formicarium',
    }),
    unavailable,
  );
  await assert.rejects(
    findVerifyCandidate({
      api: api([run(1)], { 1: artifact(11, true) }),
      repository: 'aletheia-works/formicarium',
      download: async () => new Map(),
    }),
    unavailable,
  );
  await assert.rejects(
    findVerifyCandidate({
      api: api([run(1)], { 1: [] }),
      repository: 'aletheia-works/formicarium',
    }),
    unavailable,
  );
});

test('a distributable candidate is never taken as a verify input', async () => {
  const fetched = await findVerifyCandidate({
    api: api([run(1), run(2)], { 2: artifact(22), 1: artifact(11) }),
    repository: 'aletheia-works/formicarium',
    download: async (id) => new Map([['manifest.json', manifest(id === 22)]]),
  });
  assert.equal(fetched.run.id, 1);
});

test('the repository name is checked before any request', async () => {
  const fake = api([run(1)], {});
  await assert.rejects(
    findVerifyCandidate({ api: fake, repository: '../x' }),
    /config-invalid/,
  );
  assert.deepEqual(fake.paths, []);
});

test('the fetched files are written below the layout and traversal is refused', async () => {
  const layout = siteLayout(await tempDir('fetch'));
  const files = new Map([
    ['manifest.json', manifest(false)],
    ['site/catalog.json', new TextEncoder().encode('{}')],
  ]);
  await fetchToLayout({ run: candidateRuns([run(1)])[0]!, files }, layout);
  assert.equal(
    await readFile(join(layout.candidate, 'site', 'catalog.json'), 'utf8'),
    '{}',
  );
  await assert.rejects(
    fetchToLayout(
      {
        run: candidateRuns([run(1)])[0]!,
        files: new Map([['../evil', new Uint8Array()]]),
      },
      layout,
    ),
    /relative segment/,
  );
});
