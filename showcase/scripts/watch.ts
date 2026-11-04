import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUniqueJson } from './build-key.ts';
import { fail, runCli } from './errors.ts';
import {
  createGitHubApi,
  discardBody,
  type FetchLike,
  type GitHubApi,
  readBounded,
  statusCause,
  transportFailure,
} from './github.ts';
import { MAX_API_BODY_BYTES, TRANSFER_POLICY } from './limits.ts';
import { loadResolutions, type Resolutions } from './resolve.ts';

/**
 * The daily check of showcase-watch.yml: compares the versions a run would
 * resolve now with those the deployed site offers, and decides whether to start
 * showcase-site.yml, which accepts and deploys them as a manual run does.
 */
export const SITE_CATALOG_URL =
  'https://aletheia-works.github.io/formicarium/catalog.json';
export const ISSUE_TITLE = 'Showcase: new guest versions did not deploy';
const SITE_WORKFLOW = 'showcase-site.yml';
/**
 * Their failure says nothing about the versions: the first three only collect
 * the results of other jobs, and resolve fails when a download site is
 * unreachable. A release that resolve cannot handle stops this check's own
 * resolve first, so it never starts a run.
 */
const IGNORED_JOBS: ReadonlySet<string> = new Set([
  'summary',
  'showcase-site-required',
  'candidate / showcase-required',
  'candidate / resolve',
]);
const PASSING_CONCLUSIONS: ReadonlySet<string> = new Set([
  'success',
  'skipped',
  'neutral',
]);
const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'in_progress',
  'waiting',
  'requested',
  'pending',
]);

export type Versions = Record<string, string>;
export interface SiteRun {
  id: number;
  status: string;
  url: string;
}
export interface SiteJob {
  name: string;
  conclusion: string | null;
  /** How many steps started; none when no runner picked the job up. */
  steps: number;
}
export interface WatchIssue {
  number: number;
  /** The versions the issue reports. */
  key: string | null;
  /** The failed run the issue reports. */
  runId: number | null;
}
export type WatchAction =
  | { kind: 'none' | 'wait' | 'dispatch' }
  | { kind: 'close'; issue: number }
  | { kind: 'report'; issue: number | null; failedJobs: string[] };

/** The tools whose resolved version differs from the deployed one. */
export function differences(wanted: Versions, deployed: Versions): string[] {
  return Object.keys(wanted)
    .filter((tool) => wanted[tool] !== deployed[tool])
    .sort()
    .map((tool) => `${tool} ${deployed[tool] ?? 'none'} -> ${wanted[tool]}`);
}

/** Names one set of versions, so that an issue can say which set it reports. */
export function versionsKey(wanted: Versions): string {
  return Object.keys(wanted)
    .sort()
    .map((tool) => `${tool}=${wanted[tool]}`)
    .join(',');
}

/**
 * Jobs that ran and did not succeed. A job no runner picked up is cancelled with
 * no steps and says nothing about the versions, so a run with only those is
 * tried again. A job cancelled after it started may have hit its time limit.
 */
export function failedJobs(jobs: readonly SiteJob[]): string[] {
  return jobs
    .filter(
      (job) =>
        !IGNORED_JOBS.has(job.name) &&
        !PASSING_CONCLUSIONS.has(job.conclusion ?? '') &&
        job.conclusion !== null &&
        !(job.conclusion === 'cancelled' && job.steps === 0),
    )
    .map((job) => job.name);
}

/**
 * What the daily check does. `lastJobs` belongs to `runs[0]`, the newest run of
 * the distribution on main. A failure is reported once per set of versions, and
 * a new set is tried again: the release may have fixed the failure.
 */
export function decide(input: {
  wanted: Versions;
  deployed: Versions;
  runs: readonly SiteRun[];
  lastJobs: readonly SiteJob[];
  issue: WatchIssue | null;
}): WatchAction {
  const { wanted, deployed, runs, lastJobs, issue } = input;
  if (differences(wanted, deployed).length === 0)
    return issue ? { kind: 'close', issue: issue.number } : { kind: 'none' };
  if (runs.some((run) => ACTIVE_STATUSES.has(run.status)))
    return { kind: 'wait' };
  if (issue?.key === versionsKey(wanted)) return { kind: 'none' };
  const failed = failedJobs(lastJobs);
  const last = runs[0];
  // The run the issue already reports says nothing about newer versions.
  if (failed.length > 0 && last && last.id !== issue?.runId)
    return {
      kind: 'report',
      issue: issue?.number ?? null,
      failedJobs: failed,
    };
  return { kind: 'dispatch' };
}

export function issueBody(input: {
  wanted: Versions;
  deployed: Versions;
  failedJobs: readonly string[];
  runId: number;
  runUrl: string;
}): string {
  const list = (items: readonly string[]) =>
    items.map((item) => `- \`${item}\``).join('\n');
  return [
    `<!-- showcase-watch versions=${versionsKey(input.wanted)} run=${input.runId} -->`,
    `The latest distribution failed in [this run](${input.runUrl}), so the site keeps the versions it has.`,
    '',
    'Versions waiting to deploy:',
    '',
    list(differences(input.wanted, input.deployed)),
    '',
    'Jobs that started and did not succeed (a job cancelled by hand counts too):',
    '',
    list(input.failedJobs),
    '',
    'The daily check starts no run for these versions while this issue is open. It starts one when a newer version appears, and closes this issue once the site has the versions.',
  ].join('\n');
}

/** The versions the deployed site offers (GuestCatalog.defaults). */
export async function fetchDeployedVersions(
  fetchImpl: FetchLike = fetch,
): Promise<Versions> {
  const signal = AbortSignal.timeout(TRANSFER_POLICY.fetchDeadlineMs);
  let response: Response;
  let bytes: Uint8Array;
  try {
    response = await fetchImpl(SITE_CATALOG_URL, { signal });
    if (!response.ok) {
      discardBody(response);
      fail(statusCause(response), `catalog answered ${response.status}`);
    }
    bytes = await readBounded(response, MAX_API_BODY_BYTES);
  } catch (error) {
    return transportFailure(error, signal.aborted, SITE_CATALOG_URL);
  }
  const defaults = (
    parseUniqueJson(new TextDecoder().decode(bytes)) as {
      defaults?: unknown;
    } | null
  )?.defaults;
  if (
    !defaults ||
    typeof defaults !== 'object' ||
    Array.isArray(defaults) ||
    !Object.values(defaults).every((value) => typeof value === 'string')
  )
    fail('catalog-invalid', 'the deployed catalog has no valid defaults');
  return defaults as Versions;
}

interface RawList {
  workflow_runs?: unknown;
  jobs?: unknown;
}
const arrayOf = (value: unknown, what: string): Record<string, unknown>[] =>
  Array.isArray(value) ? value : fail('bad-body', `${what} is not an array`);

/** The distribution runs on main, newest first; pull requests never deploy. */
export async function loadSiteRuns(
  api: GitHubApi,
  repository: string,
): Promise<SiteRun[]> {
  const body = (await api.get(
    `repos/${repository}/actions/workflows/${SITE_WORKFLOW}/runs?branch=main&per_page=30`,
  )) as RawList;
  return arrayOf(body.workflow_runs, 'workflow runs')
    .filter((run) => run.event === 'push' || run.event === 'workflow_dispatch')
    .map((run) => ({
      id: Number(run.id),
      status: String(run.status),
      url: String(run.html_url),
    }));
}

export async function loadSiteJobs(
  api: GitHubApi,
  repository: string,
  run: number,
): Promise<SiteJob[]> {
  const body = (await api.get(
    `repos/${repository}/actions/runs/${run}/jobs?per_page=100`,
  )) as RawList;
  return arrayOf(body.jobs, 'jobs').map((job) => ({
    name: String(job.name),
    conclusion: typeof job.conclusion === 'string' ? job.conclusion : null,
    steps: Array.isArray(job.steps) ? job.steps.length : 0,
  }));
}

export async function loadWatchIssue(
  api: GitHubApi,
  repository: string,
): Promise<WatchIssue | null> {
  let found: Record<string, unknown> | undefined;
  for (let page = 1; !found; page++) {
    const issues = arrayOf(
      await api.get(
        `repos/${repository}/issues?state=open&per_page=100&page=${page}`,
      ),
      'issues',
    );
    found = issues.find(
      (issue) => issue.title === ISSUE_TITLE && !issue.pull_request,
    );
    if (issues.length < 100) break;
  }
  if (!found) return null;
  const mark = /<!-- showcase-watch versions=(\S+) run=(\d+) -->/.exec(
    String(found.body),
  );
  return {
    number: Number(found.number),
    key: mark?.[1] ?? null,
    runId: mark ? Number(mark[2]) : null,
  };
}

export function resolvedVersions(resolutions: Resolutions): Versions {
  return Object.fromEntries(
    resolutions.tools.map((tool) => [tool.tool, tool.version]),
  );
}

export async function runWatch(options: {
  api: GitHubApi;
  repository: string;
  wanted: Versions;
  fetchImpl?: FetchLike;
}): Promise<{ action: WatchAction; body: string }> {
  const { api, repository, wanted } = options;
  const deployed = await fetchDeployedVersions(options.fetchImpl);
  const runs = await loadSiteRuns(api, repository);
  const last = runs[0];
  const lastJobs =
    last && !ACTIVE_STATUSES.has(last.status)
      ? await loadSiteJobs(api, repository, last.id)
      : [];
  const issue = await loadWatchIssue(api, repository);
  const action = decide({ wanted, deployed, runs, lastJobs, issue });
  for (const line of differences(wanted, deployed)) console.log(line);
  return {
    action,
    body:
      action.kind === 'report'
        ? issueBody({
            wanted,
            deployed,
            failedJobs: action.failedJobs,
            runId: last?.id ?? 0,
            runUrl: last?.url ?? '',
          })
        : '',
  };
}

if (import.meta.main)
  await runCli('watch', async () => {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) fail('config-invalid', 'GITHUB_REPOSITORY is not set');
    const { action, body } = await runWatch({
      api: createGitHubApi({ token: process.env.GITHUB_TOKEN }),
      repository,
      wanted: resolvedVersions(await loadResolutions()),
    });
    const issue =
      action.kind === 'close' || action.kind === 'report'
        ? (action.issue ?? '')
        : '';
    if (body && process.env.RUNNER_TEMP)
      await writeFile(join(process.env.RUNNER_TEMP, 'watch-issue.md'), body);
    if (process.env.GITHUB_OUTPUT)
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `action=${action.kind}\nissue=${issue}\n`,
      );
    console.log(`action=${action.kind}`);
  });
