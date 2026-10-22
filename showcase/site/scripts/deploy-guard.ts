import { join } from 'node:path';
import { createGitHubApi, type GitHubApi } from '../../scripts/github.ts';
import {
  fail,
  REPOSITORY_SLUG,
  runCli,
  siteLayout,
  summary,
  writeJsonFile,
} from './common.ts';

/** The workflow file and job whose success counts as a deployment. */
export const SITE_WORKFLOW = 'showcase-site.yml';
export const DEPLOY_JOB = 'deploy';
const MAX_RUNS = 100;

export interface DeployedRun {
  id: number;
  runNumber: number;
  /** Completion time of the successful deploy job. */
  deployedAt: string;
}
type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Runs of this workflow whose `deploy` job succeeded, newest run number first.
 * Every API failure propagates: the guard and the summary fail closed.
 */
export async function deployedRuns(
  api: GitHubApi,
  repository: string,
  options: { above?: number; limit?: number } = {},
): Promise<DeployedRun[]> {
  if (!REPOSITORY_SLUG.test(repository))
    fail('config-invalid', 'repository owner/repo required');
  let listed: unknown;
  try {
    listed = await api.get(
      `repos/${repository}/actions/workflows/${SITE_WORKFLOW}/runs?branch=main&per_page=${MAX_RUNS}`,
    );
  } catch (error) {
    return fail('api-failed', 'workflow runs could not be listed', error);
  }
  const runs =
    (isRecord(listed) && Array.isArray(listed.workflow_runs)
      ? listed.workflow_runs
      : null) ?? fail('api-failed', 'workflow_runs missing');
  const candidates = runs
    .filter(isRecord)
    .filter(
      (run) =>
        typeof run.id === 'number' &&
        Number.isSafeInteger(run.run_number) &&
        (options.above === undefined ||
          (run.run_number as number) > options.above),
    )
    .sort((a, b) => (b.run_number as number) - (a.run_number as number))
    .slice(0, options.limit ?? MAX_RUNS);
  const found: DeployedRun[] = [];
  for (const run of candidates) {
    let jobs: unknown;
    try {
      jobs = await api.get(
        `repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      );
    } catch (error) {
      return fail(
        'api-failed',
        `jobs of run ${run.id} could not be read`,
        error,
      );
    }
    const list =
      isRecord(jobs) && Array.isArray(jobs.jobs)
        ? jobs.jobs
        : fail('api-failed', `jobs of run ${run.id} missing`);
    const deploy = list
      .filter(isRecord)
      .find((job) => job.name === DEPLOY_JOB && job.conclusion === 'success');
    if (deploy)
      found.push({
        id: run.id as number,
        runNumber: run.run_number as number,
        deployedAt: String(deploy.completed_at ?? run.updated_at ?? ''),
      });
  }
  return found;
}

export interface GuardDecision {
  allowed: boolean;
  runNumber: number;
  newestDeployed: number | null;
  reason: string;
}

/** A newer deployed run wins; the first deployment (none yet) is allowed. */
export function guardDecision(
  runNumber: number,
  newer: readonly DeployedRun[],
): GuardDecision {
  const newest = newer.reduce<number | null>(
    (max, run) => (max === null || run.runNumber > max ? run.runNumber : max),
    null,
  );
  if (newest !== null && newest > runNumber)
    return {
      allowed: false,
      runNumber,
      newestDeployed: newest,
      reason: `run ${newest} already deployed a newer site`,
    };
  return {
    allowed: true,
    runNumber,
    newestDeployed: newest,
    reason:
      newest === null ? 'no newer deployment' : 'newest deployment is older',
  };
}

export async function runGuard(
  api: GitHubApi,
  repository: string,
  runNumber: number,
): Promise<GuardDecision> {
  if (!Number.isSafeInteger(runNumber) || runNumber < 1)
    fail('config-invalid', 'run number required');
  return guardDecision(
    runNumber,
    await deployedRuns(api, repository, { above: runNumber }),
  );
}

if (import.meta.main)
  await runCli('deploy-guard', async () => {
    const decision = await runGuard(
      createGitHubApi({ token: process.env.GITHUB_TOKEN }),
      process.env.GITHUB_REPOSITORY ?? '',
      Number(process.env.GITHUB_RUN_NUMBER),
    );
    await writeJsonFile(join(siteLayout().logs, 'deploy-guard.json'), {
      schemaVersion: 1,
      ...decision,
      checkedAt: new Date().toISOString(),
    });
    await summary(
      `- deploy-guard: ${decision.allowed ? 'allowed' : 'refused'} (run ${decision.runNumber}; ${decision.reason})`,
    );
    if (!decision.allowed) fail('stale-deploy', decision.reason);
  });
