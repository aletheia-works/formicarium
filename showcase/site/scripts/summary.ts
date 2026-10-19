import { daysSince } from '../../scripts/candidate.ts';
import { createGitHubApi } from '../../scripts/github.ts';
import { fail, runCli, summary } from './common.ts';
import { deployedRuns } from './deploy-guard.ts';

/** NFR8.9: the distribute run fails once the last deployment is this old. */
export const STALE_DAYS = 2;

export interface JobResult {
  name: string;
  result: string;
}
export interface RunSummary {
  markdown: string;
  days: number | null;
  failedJobs: string[];
  /** true only for a distribute run with an earlier deployment ≥ 2 days old. */
  fail: boolean;
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
  const stale = input.distribute && days !== null && days >= STALE_DAYS;
  const markdown = [
    '## showcase site',
    '',
    `- mode: ${input.distribute ? 'distribute' : 'verify'}`,
    `- 最後に deploy した run からの日数: ${days === null ? 'まだ deploy していない' : `${days}日`}`,
    `- 失敗した job: ${failedJobs.length ? failedJobs.join(', ') : 'なし'}`,
    ...(stale
      ? [
          `- 日次の配布が ${days} 日止まっている（${STALE_DAYS} 日以上で失敗にする）`,
        ]
      : []),
    '',
  ].join('\n');
  return { markdown, days, failedJobs, fail: stale };
}

if (import.meta.main)
  await runCli('summary', async () => {
    const repository = process.env.GITHUB_REPOSITORY ?? '';
    const runs = await deployedRuns(
      createGitHubApi({ token: process.env.GITHUB_TOKEN }),
      repository,
      { limit: 30 },
    );
    const result = summarize({
      distribute: process.env.SHOWCASE_DIST === 'true',
      lastDeployAt: runs[0]?.deployedAt ?? null,
      now: new Date(),
      jobs: jobResults(process.env.SHOWCASE_NEEDS ?? '{}'),
    });
    await summary(result.markdown);
    console.log(result.markdown);
    if (result.fail)
      fail('stale-deploy', `last deployment is ${result.days} days old`);
  });
