import { daysSince } from '../../scripts/candidate.ts';
import { createGitHubApi } from '../../scripts/github.ts';
import { fail, runCli, summary } from './common.ts';
import { deployedRuns } from './deploy-guard.ts';

export interface JobResult {
  name: string;
  result: string;
}
export interface RunSummary {
  markdown: string;
  days: number | null;
  failedJobs: string[];
}

/** `needs` of the summary job (toJSON(needs)) as job name/result pairs. */
export function jobResults(needsJson: string): JobResult[] {
  let needs: unknown;
  try {
    needs = JSON.parse(needsJson || '{}');
  } catch (error) {
    return fail('config-invalid', 'needs JSON invalid', error);
  }
  if (!needs || typeof needs !== 'object')
    fail('config-invalid', 'needs must be an object');
  return Object.entries(needs as Record<string, { result?: unknown }>)
    .map(([name, value]) => ({
      name,
      result: String(value?.result ?? 'unknown'),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * The run summary only reports: the site deploys when its sources change, so
 * an old deployment is not a failure (the two-day check was dropped
 * with the daily schedule).
 */
export function summarize(input: {
  distribute: boolean;
  lastDeployAt: string | null;
  now: Date;
  jobs: readonly JobResult[];
}): RunSummary {
  const days = daysSince(input.lastDeployAt, input.now);
  const failedJobs = input.jobs
    .filter((job) => job.result === 'failure' || job.result === 'cancelled')
    .map((job) => job.name);
  const markdown = [
    '## showcase site',
    '',
    `- mode: ${input.distribute ? 'distribute' : 'verify'}`,
    `- 最後に deploy した run からの日数: ${days === null ? 'まだ deploy していない' : `${days}日`}`,
    `- 失敗した job: ${failedJobs.length ? failedJobs.join(', ') : 'なし'}`,
    '',
  ].join('\n');
  return { markdown, days, failedJobs };
}

/** The jobs each kind of run must finish with success (showcase-site-required). */
export const REQUIRED_JOBS = Object.freeze({
  verify: [
    'changes',
    'fetch-candidate',
    'verify-pack',
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
    'accept-safari',
    'coverage',
    'evidence',
  ],
  /** A PR that changes the guests builds from its own showcase candidate. */
  'verify-pr-candidate': [
    'changes',
    'pr-candidate',
    'verify-pack',
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
    'accept-safari',
    'coverage',
    'evidence',
  ],
  distribute: [
    'changes',
    'candidate',
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
    'accept-safari',
    'coverage',
    'evidence',
    'deploy',
    'verify-deployment',
  ],
} as const);

export interface RequiredCheck {
  /** `unrelated`: a PR that touches none of the site paths. */
  mode: 'unrelated' | 'verify' | 'distribute';
  /** Required jobs whose result is not success (a skip counts). */
  missing: string[];
  ok: boolean;
  markdown: string;
}

/**
 * The single required check of this workflow. A PR without site changes
 * passes once the change detection succeeded; every other run passes only
 * when each job of its kind succeeded, so a skipped job fails the check.
 */
export function requiredCheck(input: {
  distribute: boolean;
  /** `needs.changes.outputs.site`: 'true' or 'false'; anything else fails. */
  site: string;
  /** `needs.changes.outputs.guests`: 'true' when the PR changes the guests. */
  guests?: string;
  jobs: readonly JobResult[];
}): RequiredCheck {
  const results = new Map(input.jobs.map((job) => [job.name, job.result]));
  const changes = results.get('changes') === 'success';
  const unrelated = !input.distribute && changes && input.site === 'false';
  const mode = input.distribute
    ? 'distribute'
    : unrelated
      ? 'unrelated'
      : 'verify';
  const missing = unrelated
    ? []
    : !input.distribute && changes && input.site !== 'true'
      ? ['changes']
      : REQUIRED_JOBS[
          mode === 'distribute'
            ? 'distribute'
            : input.guests === 'true'
              ? 'verify-pr-candidate'
              : 'verify'
        ].filter((name) => results.get(name) !== 'success');
  const markdown = [
    '## showcase site required check',
    '',
    `- mode: ${mode}${mode === 'verify' && input.guests === 'true' ? '（この PR の候補）' : ''}`,
    `- 成功していない必須の job: ${missing.length ? missing.join(', ') : 'なし'}`,
    '',
  ].join('\n');
  return { mode, missing, ok: missing.length === 0, markdown };
}

if (import.meta.main && process.argv.includes('--required'))
  await runCli('required', async () => {
    const result = requiredCheck({
      distribute: process.env.SHOWCASE_DIST === 'true',
      site: process.env.SHOWCASE_SITE ?? '',
      guests: process.env.SHOWCASE_GUESTS ?? '',
      jobs: jobResults(process.env.SHOWCASE_NEEDS ?? '{}'),
    });
    await summary(result.markdown);
    console.log(result.markdown);
    if (!result.ok)
      fail('required-failed', `not successful: ${result.missing.join(', ')}`);
  });
else if (import.meta.main)
  await runCli('summary', async () => {
    const repository = process.env.GITHUB_REPOSITORY ?? '';
    const runs = await deployedRuns(
      createGitHubApi({ token: process.env.GITHUB_TOKEN }),
      repository,
      { limit: 30, first: true },
    );
    const result = summarize({
      distribute: process.env.SHOWCASE_DIST === 'true',
      lastDeployAt: runs[0]?.deployedAt ?? null,
      now: new Date(),
      jobs: jobResults(process.env.SHOWCASE_NEEDS ?? '{}'),
    });
    await summary(result.markdown);
    console.log(result.markdown);
  });
