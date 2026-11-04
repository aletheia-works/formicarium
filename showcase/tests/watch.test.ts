import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { causeOf, ShowcaseError } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import { REPOSITORY_ROOT } from '../scripts/paths.ts';
import {
  decide,
  differences,
  failedJobs,
  fetchDeployedVersions,
  ISSUE_TITLE,
  issueBody,
  loadWatchIssue,
  resolvedVersions,
  runWatch,
  SITE_CATALOG_URL,
  type SiteRun,
  versionsKey,
} from '../scripts/watch.ts';
import { fakeFetch, json } from './fixtures/github.ts';

const OLD = { jj: '0.46.0', nano: '9.3' };
const NEW = { jj: '0.47.0', nano: '9.3' };
const KEY = 'jj=0.47.0,nano=9.3';
const run = (status: string): SiteRun => ({
  id: 7,
  status,
  url: 'https://example.test/run/7',
});
const FAILED = [
  { name: 'accept-chromium', conclusion: 'failure', steps: 9 },
  { name: 'showcase-site-required', conclusion: 'failure', steps: 2 },
];
const CANCELLED = [
  { name: 'accept-safari', conclusion: 'cancelled', steps: 0 },
  { name: 'candidate / accept-safari', conclusion: 'cancelled', steps: 0 },
  { name: 'candidate / showcase-required', conclusion: 'failure', steps: 2 },
  { name: 'showcase-site-required', conclusion: 'failure', steps: 2 },
  { name: 'summary', conclusion: 'failure', steps: 2 },
];
const base = {
  wanted: NEW,
  deployed: OLD,
  runs: [run('completed')],
  lastJobs: [],
  issue: null,
};

test('differences lists only tools whose version changed, including new ones', () => {
  assert.deepEqual(differences(NEW, OLD), ['jj 0.46.0 -> 0.47.0']);
  assert.deepEqual(differences(NEW, NEW), []);
  assert.deepEqual(differences({ aube: '2.9.0' }, {}), ['aube none -> 2.9.0']);
  // A companion the catalog holds but resolve does not name is not compared.
  assert.deepEqual(
    differences(NEW, { ...NEW, 'git-remote-https': '2.56.0' }),
    [],
  );
});

test('versionsKey does not depend on the order of the tools', () => {
  assert.equal(versionsKey({ nano: '9.3', jj: '0.47.0' }), KEY);
});

test('a job the runner never picked up and the collecting jobs are not failures', () => {
  assert.deepEqual(failedJobs(FAILED), ['accept-chromium']);
  assert.deepEqual(failedJobs(CANCELLED), []);
});

test('an unreachable download site in resolve says nothing about the versions', () => {
  assert.deepEqual(
    failedJobs([
      { name: 'candidate / resolve', conclusion: 'failure', steps: 6 },
    ]),
    [],
  );
  assert.deepEqual(
    decide({
      ...base,
      lastJobs: [
        { name: 'candidate / resolve', conclusion: 'failure', steps: 6 },
      ],
    }),
    { kind: 'dispatch' },
  );
});

test('a job that started and did not succeed counts, whatever its conclusion', () => {
  const job = (conclusion: string | null, steps = 3) => ({
    name: 'accept-webkit',
    conclusion,
    steps,
  });
  for (const conclusion of ['timed_out', 'startup_failure', 'action_required'])
    assert.deepEqual(failedJobs([job(conclusion)]), ['accept-webkit']);
  // Cancelled after it started: the time limit of a job looks like this.
  assert.deepEqual(failedJobs([job('cancelled')]), ['accept-webkit']);
  for (const conclusion of ['success', 'skipped', 'neutral', null])
    assert.deepEqual(failedJobs([job(conclusion)]), []);
});

test('the same versions as the site start nothing, and close an open report', () => {
  assert.deepEqual(decide({ ...base, deployed: NEW }), { kind: 'none' });
  assert.deepEqual(
    decide({
      ...base,
      deployed: NEW,
      issue: { number: 3, key: KEY, runId: 7 },
    }),
    { kind: 'close', issue: 3 },
  );
});

test('new versions start a run, and a run in progress is left to finish', () => {
  assert.deepEqual(decide(base), { kind: 'dispatch' });
  assert.deepEqual(decide({ ...base, runs: [] }), { kind: 'dispatch' });
  for (const status of ['queued', 'in_progress', 'waiting', 'pending'])
    assert.deepEqual(decide({ ...base, runs: [run(status)] }), {
      kind: 'wait',
    });
});

test('a run stopped only by missing runners is tried again without a report', () => {
  assert.deepEqual(decide({ ...base, lastJobs: CANCELLED }), {
    kind: 'dispatch',
  });
});

test('a failed run is reported once and the same versions are not tried again', () => {
  assert.deepEqual(decide({ ...base, lastJobs: FAILED }), {
    kind: 'report',
    issue: null,
    failedJobs: ['accept-chromium'],
  });
  assert.deepEqual(
    decide({
      ...base,
      lastJobs: FAILED,
      issue: { number: 3, key: KEY, runId: 7 },
    }),
    { kind: 'none' },
  );
});

test('newer versions are tried again, and their failure updates the report', () => {
  const issue = { number: 3, key: 'jj=0.46.5,nano=9.3' };
  // The report already names this run: it belongs to the reported versions.
  assert.deepEqual(
    decide({ ...base, lastJobs: FAILED, issue: { ...issue, runId: 7 } }),
    { kind: 'dispatch' },
  );
  // A later run failed: the new versions failed too.
  assert.deepEqual(
    decide({ ...base, lastJobs: FAILED, issue: { ...issue, runId: 5 } }),
    { kind: 'report', issue: 3, failedJobs: ['accept-chromium'] },
  );
});

test('the report names the versions, the run and the failed jobs', () => {
  const body = issueBody({
    wanted: NEW,
    deployed: OLD,
    failedJobs: ['accept-chromium'],
    runId: 7,
    runUrl: 'https://example.test/run/7',
  });
  assert.ok(body.startsWith(`<!-- showcase-watch versions=${KEY} run=7 -->`));
  assert.match(body, /`jj 0\.46\.0 -> 0\.47\.0`/);
  assert.match(body, /`accept-chromium`/);
  assert.match(body, /https:\/\/example\.test\/run\/7/);
});

test('the deployed versions come from the defaults of the site catalog', async () => {
  const good = fakeFetch({ [SITE_CATALOG_URL]: json({ defaults: OLD }) });
  assert.deepEqual(await fetchDeployedVersions(good), OLD);
  for (const body of [{}, { defaults: [] }, { defaults: { jj: 1 } }, null]) {
    await assert.rejects(
      fetchDeployedVersions(fakeFetch({ [SITE_CATALOG_URL]: json(body) })),
      (error: unknown) => causeOf(error) === 'catalog-invalid',
    );
  }
  await assert.rejects(
    fetchDeployedVersions(fakeFetch({ [SITE_CATALOG_URL]: json({}, 404) })),
    (error: unknown) =>
      error instanceof ShowcaseError && error.code === 'http-status',
  );
  await assert.rejects(
    fetchDeployedVersions(fakeFetch({})),
    (error: unknown) => causeOf(error) === 'offline',
  );
});

const API = 'https://api.github.com/repos/o/r';
const RUNS = `${API}/actions/workflows/showcase-site.yml/runs?branch=main&per_page=30`;
const issuesPage = (page: number) =>
  `${API}/issues?state=open&per_page=100&page=${page}`;
const ISSUES = issuesPage(1);
const apiRun = (id: number, event: string, status = 'completed') => ({
  id,
  event,
  status,
  html_url: `https://example.test/run/${id}`,
});
const issue = {
  number: 3,
  title: ISSUE_TITLE,
  body: `<!-- showcase-watch versions=${KEY} run=6 -->\ntext`,
};
const watch = (routes: Parameters<typeof fakeFetch>[0]) => {
  const fetchImpl = fakeFetch({
    [SITE_CATALOG_URL]: json({ defaults: OLD }),
    ...routes,
  });
  return runWatch({
    api: createGitHubApi({ fetchImpl }),
    repository: 'o/r',
    wanted: NEW,
    fetchImpl,
  });
};

test('a report is found by its title; a pull request or another issue is not', async () => {
  const load = (issues: unknown[]) =>
    loadWatchIssue(
      createGitHubApi({ fetchImpl: fakeFetch({ [ISSUES]: json(issues) }) }),
      'o/r',
    );
  assert.equal(await load([{ number: 1, title: 'other' }]), null);
  assert.equal(await load([{ ...issue, pull_request: {} }]), null);
  assert.deepEqual(await load([issue]), {
    number: 3,
    key: KEY,
    runId: 6,
  });
  assert.deepEqual(await load([{ ...issue, body: 'edited' }]), {
    number: 3,
    key: null,
    runId: null,
  });
});

test('a report on a later page of open issues is found', async () => {
  const others = Array.from({ length: 100 }, (_, index) => ({
    number: index + 10,
    title: 'other',
  }));
  const fetchImpl = fakeFetch({
    [issuesPage(1)]: json(others),
    [issuesPage(2)]: json([issue]),
  });
  assert.equal(
    (await loadWatchIssue(createGitHubApi({ fetchImpl }), 'o/r'))?.number,
    3,
  );
  assert.equal(fetchImpl.calls.length, 2);
});

test('pull request runs do not count, and a running run needs no job list', async () => {
  const none = await watch({
    [RUNS]: json({ workflow_runs: [apiRun(9, 'pull_request')] }),
    [ISSUES]: json([]),
  });
  assert.deepEqual(none.action, { kind: 'dispatch' });
  const waiting = await watch({
    [RUNS]: json({ workflow_runs: [apiRun(8, 'push', 'in_progress')] }),
    [ISSUES]: json([]),
  });
  assert.deepEqual(waiting.action, { kind: 'wait' });
});

test('the newest completed run decides, and its failure becomes the report body', async () => {
  const { action, body } = await watch({
    [RUNS]: json({
      workflow_runs: [apiRun(8, 'workflow_dispatch'), apiRun(6, 'push')],
    }),
    [`${API}/actions/runs/8/jobs?per_page=100`]: json({
      jobs: [{ name: 'accept-webkit', conclusion: 'failure', steps: [{}] }],
    }),
    [ISSUES]: json([]),
  });
  assert.deepEqual(action, {
    kind: 'report',
    issue: null,
    failedJobs: ['accept-webkit'],
  });
  assert.match(body, /example\.test\/run\/8/);
  assert.match(body, / run=8 -->/);
});

test('a malformed API answer fails instead of starting a run', async () => {
  await assert.rejects(
    watch({ [RUNS]: json({}), [ISSUES]: json([]) }),
    (error: unknown) => causeOf(error) === 'bad-body',
  );
});

test('the wanted versions are the ones resolve found', () => {
  assert.deepEqual(
    resolvedVersions({
      tools: [{ tool: 'jj', version: '0.47.0' }],
    } as never),
    { jj: '0.47.0' },
  );
});

test('the workflow runs daily with the least rights and starts only the main site run', async () => {
  const workflow = await readFile(
    join(REPOSITORY_ROOT, '.github', 'workflows', 'showcase-watch.yml'),
    'utf8',
  );
  assert.match(workflow, /schedule:\n\s+- cron: '17 4 \* \* \*'/);
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.match(
    workflow,
    /permissions:\n\s+actions: write\n\s+contents: read\n\s+issues: write/,
  );
  assert.match(workflow, /persist-credentials: false/);
  assert.match(
    workflow,
    /gh workflow run showcase-site\.yml --repo "\$GITHUB_REPOSITORY" --ref main/,
  );
  assert.ok(workflow.includes(`ISSUE_TITLE: '${ISSUE_TITLE}'`));
  // The versions come from the same resolve a site run uses.
  assert.ok(
    workflow.indexOf('showcase/scripts/resolve.ts') <
      workflow.indexOf('showcase/scripts/watch.ts'),
  );
});

test('distribution itself still refuses a schedule', async () => {
  const site = await readFile(
    join(REPOSITORY_ROOT, '.github', 'workflows', 'showcase-site.yml'),
    'utf8',
  );
  assert.doesNotMatch(site.split('jobs:')[0]!, /schedule:/);
});
