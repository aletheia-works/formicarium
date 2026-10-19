import { rm } from 'node:fs/promises';
import { parseUniqueJson } from '../../scripts/build-key.ts';
import { createGitHubApi, type GitHubApi } from '../../scripts/github.ts';
import { downloadArtifact } from '../../scripts/reuse.ts';
import {
  fail,
  REPOSITORY_SLUG,
  runCli,
  type SiteLayout,
  siteLayout,
  summary,
  writeTree,
} from './common.ts';

/**
 * PR, push and non-main manual runs do not call showcase.yml. They take the
 * candidate of the newest successful push or manual run of main's
 * showcase.yml (Infrastructure Design, Q1=A). Such a candidate is a verify
 * candidate (distributable false) and is never deployed.
 */
export const SHOWCASE_WORKFLOW = '.github/workflows/showcase.yml';
export const CANDIDATE_ARTIFACT = 'showcase-candidate';
export const CANDIDATE_EVENTS: readonly string[] = [
  'push',
  'workflow_dispatch',
];
export const RECOVERY =
  'main で showcase.yml を手動で実行し（Actions の画面の Run workflow）、成功の後にこの run をやり直す。';
const MAX_RUNS = 10;

export interface CandidateRun {
  id: number;
  event: string;
  headSha: string;
  createdAt: string;
}
type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Successful push/manual runs of main's showcase.yml, newest first. */
export function candidateRuns(runs: unknown): CandidateRun[] {
  if (!Array.isArray(runs)) fail('api-failed', 'workflow_runs is not an array');
  return runs
    .filter(isRecord)
    .filter(
      (run) =>
        typeof run.id === 'number' &&
        typeof run.path === 'string' &&
        run.path.replace(/@.*$/, '') === SHOWCASE_WORKFLOW &&
        run.head_branch === 'main' &&
        CANDIDATE_EVENTS.includes(String(run.event)) &&
        run.conclusion === 'success' &&
        typeof run.head_sha === 'string' &&
        typeof run.created_at === 'string',
    )
    .map((run) => ({
      id: run.id as number,
      event: run.event as string,
      headSha: run.head_sha as string,
      createdAt: run.created_at as string,
    }))
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? b.id - a.id
        : a.createdAt < b.createdAt
          ? 1
          : -1,
    );
}

export interface FetchedCandidate {
  run: CandidateRun;
  files: Map<string, Uint8Array>;
}

/**
 * Newest run whose candidate is still stored and is not distributable. A
 * missing or expired artifact of the newest run fails (older ones are older
 * still): the recovery is a manual showcase.yml run on main.
 */
export async function findVerifyCandidate(options: {
  api: GitHubApi;
  repository: string;
  download?: (artifactId: number) => Promise<Map<string, Uint8Array>>;
}): Promise<FetchedCandidate> {
  const { api, repository } = options;
  if (!REPOSITORY_SLUG.test(repository))
    fail('config-invalid', 'repository owner/repo required');
  const download =
    options.download ??
    ((id: number) => downloadArtifact({ api, repository }, id));
  const listed = await api.get(
    `repos/${repository}/actions/workflows/showcase.yml/runs?branch=main&status=success&per_page=50`,
  );
  const runs = candidateRuns(isRecord(listed) ? listed.workflow_runs : null);
  if (runs.length === 0)
    fail(
      'candidate-unavailable',
      `no successful showcase.yml run on main. ${RECOVERY}`,
    );
  for (const run of runs.slice(0, MAX_RUNS)) {
    const body = await api.get(
      `repos/${repository}/actions/runs/${run.id}/artifacts?name=${CANDIDATE_ARTIFACT}`,
    );
    const artifacts =
      isRecord(body) && Array.isArray(body.artifacts) ? body.artifacts : [];
    const artifact = artifacts.find(
      (item) => isRecord(item) && item.name === CANDIDATE_ARTIFACT,
    ) as Json | undefined;
    const artifactId = artifact?.expired === false ? artifact.id : null;
    if (typeof artifactId !== 'number')
      fail(
        'candidate-unavailable',
        `run ${run.id} has no stored ${CANDIDATE_ARTIFACT} (missing or expired). ${RECOVERY}`,
      );
    const files = await download(artifactId);
    const manifest = files.get('manifest.json');
    if (!manifest)
      fail('candidate-unavailable', `run ${run.id}: manifest.json missing`);
    const parsed = parseUniqueJson(
      new TextDecoder('utf-8', { fatal: true }).decode(manifest),
    );
    // A distribute candidate is never a verify input (review-01 R-05).
    if (!isRecord(parsed) || parsed.distributable !== false) continue;
    return { run, files };
  }
  return fail(
    'candidate-unavailable',
    `no verify candidate in the newest ${MAX_RUNS} runs. ${RECOVERY}`,
  );
}

export async function fetchToLayout(
  fetched: FetchedCandidate,
  layout: SiteLayout = siteLayout(),
): Promise<void> {
  await rm(layout.candidate, { recursive: true, force: true });
  await writeTree(layout.candidate, fetched.files);
}

if (import.meta.main)
  await runCli('fetch-verify-candidate', async () => {
    const repository = process.env.GITHUB_REPOSITORY ?? '';
    try {
      const fetched = await findVerifyCandidate({
        api: createGitHubApi({ token: process.env.GITHUB_TOKEN }),
        repository,
      });
      await fetchToLayout(fetched);
      await summary([
        '### verify の候補',
        '',
        `- showcase.yml の run ${fetched.run.id}（${fetched.run.event}、${fetched.run.headSha}、${fetched.run.createdAt}）`,
      ]);
      console.log(
        `candidate from run ${fetched.run.id} (${fetched.run.headSha})`,
      );
    } catch (error) {
      await summary(['### verify の候補が取れない', '', `- ${RECOVERY}`]);
      throw error;
    }
  });
