import assert from 'node:assert/strict';
import test from 'node:test';
import type { GitHubApi } from '../../../scripts/github.ts';
import {
  deployedRuns,
  guardDecision,
  runGuard,
} from '../../scripts/deploy-guard.ts';

const REPO = 'aletheia-works/formicarium';
interface FakeRun {
  id: number;
  run_number: number;
  deploy?: 'success' | 'failure' | 'skipped';
}
function api(
  runs: FakeRun[],
  options: { failRuns?: boolean; failJobs?: number } = {},
): GitHubApi & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    async get(path) {
      paths.push(path);
      if (path.includes('/workflows/showcase-site.yml/runs')) {
        if (options.failRuns)
          throw new Error('http-status: GitHub API answered 500');
        return {
          workflow_runs: runs.map(({ deploy: _deploy, ...run }) => ({
            ...run,
            updated_at: '2026-10-19T00:00:00Z',
          })),
        };
      }
      const id = Number(/runs\/(\d+)\/jobs/.exec(path)?.[1]);
      if (id === options.failJobs) throw new Error('offline');
      const run = runs.find((item) => item.id === id);
      return {
        jobs: [
          { name: 'build', conclusion: 'success' },
          ...(run?.deploy
            ? [
                {
                  name: 'deploy',
                  conclusion: run.deploy,
                  completed_at: `2026-10-${10 + (run.run_number % 10)}T04:30:00Z`,
                },
              ]
            : []),
          { name: 'verify-deployment', conclusion: 'failure' },
        ],
      };
    },
    async getOptional() {
      return null;
    },
    async redirectLocation() {
      return '';
    },
  };
}

test('only runs whose deploy job succeeded count, newest run number first', async () => {
  const runs = await deployedRuns(
    api([
      { id: 1, run_number: 5, deploy: 'success' },
      { id: 2, run_number: 7, deploy: 'failure' },
      { id: 3, run_number: 6, deploy: 'success' },
      { id: 4, run_number: 8 },
    ]),
    REPO,
  );
  assert.deepEqual(
    runs.map((run) => run.runNumber),
    [6, 5],
  );
  assert.equal(runs[0]!.deployedAt, '2026-10-16T04:30:00Z');
});

test('a newer deployed run refuses this deployment', async () => {
  const decision = await runGuard(
    api([
      { id: 1, run_number: 12, deploy: 'success' },
      { id: 2, run_number: 9, deploy: 'success' },
    ]),
    REPO,
    10,
  );
  assert.deepEqual(decision, {
    allowed: false,
    runNumber: 10,
    newestDeployed: 12,
    reason: 'run 12 already deployed a newer site',
  });
});

test('the first deployment and older deployments are allowed', async () => {
  assert.equal((await runGuard(api([]), REPO, 1)).allowed, true);
  const fake = api([
    { id: 2, run_number: 9, deploy: 'success' },
    { id: 3, run_number: 11 },
  ]);
  assert.deepEqual(await runGuard(fake, REPO, 10), {
    allowed: true,
    runNumber: 10,
    newestDeployed: null,
    reason: 'no newer deployment',
  });
  // Only runs above this one are inspected.
  assert.deepEqual(
    fake.paths.filter((path) => path.includes('/jobs')),
    [`repos/${REPO}/actions/runs/3/jobs?filter=latest&per_page=100`],
  );
  assert.equal(
    guardDecision(10, [{ id: 1, runNumber: 8, deployedAt: '' }]).allowed,
    true,
  );
});

test('an API failure fails closed', async () => {
  await assert.rejects(
    runGuard(api([], { failRuns: true }), REPO, 10),
    /api-failed: workflow runs could not be listed/,
  );
  await assert.rejects(
    runGuard(api([{ id: 3, run_number: 11 }], { failJobs: 3 }), REPO, 10),
    /api-failed: jobs of run 3/,
  );
});

test('the run number and repository are checked first', async () => {
  await assert.rejects(runGuard(api([]), REPO, Number.NaN), /config-invalid/);
  await assert.rejects(runGuard(api([]), '../x', 3), /config-invalid/);
});
