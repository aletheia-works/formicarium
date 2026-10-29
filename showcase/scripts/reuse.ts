import {
  type AcquiredTool,
  fetchBounded,
  loadAcquired,
  storeAcquired,
  type ValidateGuest,
  validateWithPublicApi,
} from './acquire.ts';
import { readZip } from './archive.ts';
import {
  type BuildPlan,
  loadPlans,
  planGuests,
  sourceBuildInfo,
  sourceRecord,
} from './build.ts';
import { canonicalSha256, parseUniqueJson, sha256 } from './build-key.ts';
import {
  readConfigFile,
  type TrustedCallers,
  validateTrustedCallers,
} from './config.ts';
import { causeOf, fail, runCli } from './errors.ts';
import { createGitHubApi, type FetchLike, type GitHubApi } from './github.ts';
import { ARTIFACT_LIMITS } from './limits.ts';
import { type WorkLayout, workLayout } from './paths.ts';
import { loadVerifiedTools } from './resolve.ts';

export const CANDIDATE_ARTIFACT = 'showcase-candidate';
/** pull_request runs execute PR-controlled definitions and never seed reuse. */
export const REUSE_EVENTS = Object.freeze([
  'push',
  'schedule',
  'workflow_dispatch',
]);

export interface WorkflowRun {
  id: number;
  path: string;
  head_branch: string;
  event: string;
  conclusion: string;
  run_attempt: number;
  created_at: string;
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Runs defined on main by a trusted workflow file, newest first. */
export function eligibleRuns(
  runs: unknown,
  trusted: TrustedCallers,
): WorkflowRun[] {
  if (!Array.isArray(runs)) fail('bad-body', 'workflow_runs is not an array');
  return runs
    .filter(isRecord)
    .filter(
      (run): run is Json & WorkflowRun =>
        typeof run.id === 'number' &&
        typeof run.path === 'string' &&
        trusted.reuseWorkflows.includes(run.path.replace(/@.*$/, '')) &&
        run.head_branch === 'main' &&
        typeof run.event === 'string' &&
        REUSE_EVENTS.includes(run.event) &&
        run.conclusion === 'success' &&
        typeof run.run_attempt === 'number' &&
        typeof run.created_at === 'string',
    )
    .sort((a, b) =>
      a.created_at === b.created_at
        ? b.id - a.id
        : a.created_at < b.created_at
          ? 1
          : -1,
    );
}

export interface ReuseOptions {
  api: GitHubApi;
  /** owner/repo of this repository. */
  repository: string;
  trusted: TrustedCallers;
  validate: ValidateGuest;
  fetchImpl?: FetchLike;
}

/** Newest eligible run that still holds an unexpired candidate artifact. */
export async function latestCandidateArtifact(
  options: Pick<ReuseOptions, 'api' | 'repository' | 'trusted'>,
): Promise<{ run: WorkflowRun; artifactId: number } | null> {
  const listed = await options.api.get(
    `repos/${options.repository}/actions/runs?branch=main&status=success&per_page=50`,
  );
  const runs = eligibleRuns(
    isRecord(listed) ? listed.workflow_runs : null,
    options.trusted,
  );
  for (const run of runs) {
    const body = await options.api.get(
      `repos/${options.repository}/actions/runs/${run.id}/artifacts?name=${CANDIDATE_ARTIFACT}`,
    );
    const artifacts =
      isRecord(body) && Array.isArray(body.artifacts) ? body.artifacts : [];
    const artifact = artifacts.find(
      (item) =>
        isRecord(item) &&
        item.name === CANDIDATE_ARTIFACT &&
        item.expired === false &&
        typeof item.id === 'number',
    ) as Json | undefined;
    if (artifact) return { run, artifactId: artifact.id as number };
  }
  return null;
}

/** Downloads an artifact zip; the signed redirect target gets no credentials. */
export async function downloadArtifact(
  options: Pick<ReuseOptions, 'api' | 'repository' | 'fetchImpl'>,
  artifactId: number,
): Promise<Map<string, Uint8Array>> {
  const location = await options.api.redirectLocation(
    `repos/${options.repository}/actions/artifacts/${artifactId}/zip`,
  );
  const fetched = await fetchBounded(location, {
    maxBytes: ARTIFACT_LIMITS.maxDownloadBytes,
    fetchImpl: options.fetchImpl,
  });
  return readZip(fetched.bytes, ARTIFACT_LIMITS);
}

/**
 * Checks a reused ELF/build-info against the buildKey computed here: the
 * whole canonical metadata must equal what this plan would produce, the ELF
 * digest must match, and the public validateGuest must accept it.
 */
export function checkReused(
  plan: BuildPlan,
  files: Map<string, Uint8Array>,
  validate: ValidateGuest,
): {
  elf: Uint8Array;
  buildInfoSha256: string;
  info: ReturnType<typeof sourceBuildInfo>;
} | null {
  const prefix = `site/guests/${plan.tool}/${plan.version}/`;
  const elf = files.get(`${prefix}${plan.binary}`);
  const raw = files.get(`${prefix}build-info.json`);
  if (!elf || !raw) return null;
  let info: Json;
  try {
    const parsed = parseUniqueJson(
      new TextDecoder('utf-8', { fatal: true }).decode(raw),
    );
    if (!isRecord(parsed)) return null;
    info = parsed;
  } catch {
    return null;
  }
  const expected = sourceBuildInfo(plan, sha256(elf));
  if (
    info.buildKey !== plan.buildKey ||
    info.elfSha256 !== sha256(elf) ||
    canonicalSha256(info) !== canonicalSha256(expected)
  )
    return null;
  try {
    return {
      elf,
      buildInfoSha256: validateWithPublicApi(validate, elf, expected),
      info: expected,
    };
  } catch {
    return null;
  }
}

/**
 * Returns a reused record, or null when the plan must be compiled. A plan
 * with companions is reused only when every one of its guests matches.
 */
export async function findReusable(
  plan: BuildPlan,
  options: ReuseOptions,
): Promise<{
  record: AcquiredTool;
  elf: Uint8Array;
  companions: { record: AcquiredTool; elf: Uint8Array }[];
} | null> {
  const latest = await latestCandidateArtifact(options);
  if (!latest) return null;
  let files: Map<string, Uint8Array>;
  try {
    files = await downloadArtifact(options, latest.artifactId);
  } catch (error) {
    console.log(`reuse unavailable (${causeOf(error)}); building ${plan.tool}`);
    return null;
  }
  const found: { record: AcquiredTool; elf: Uint8Array }[] = [];
  for (const guest of planGuests(plan)) {
    const checked = checkReused(guest.plan, files, options.validate);
    if (!checked) return null;
    const record = sourceRecord(
      guest.plan,
      checked.elf,
      checked.info,
      checked.buildInfoSha256,
      {
        runId: latest.run.id,
        runAttempt: latest.run.run_attempt,
        workflow: latest.run.path,
      },
      guest.companionOf,
    );
    found.push({ record, elf: checked.elf });
  }
  const [own, ...companions] = found;
  return { ...own!, companions };
}

export async function runReuseJob(options: {
  api: GitHubApi;
  repository: string;
  validate: ValidateGuest;
  layout?: WorkLayout;
  fetchImpl?: FetchLike;
  readMain?: (path: string) => string;
}): Promise<string[]> {
  const layout = options.layout ?? workLayout();
  const tools = await loadVerifiedTools(options.readMain);
  const trusted = validateTrustedCallers(
    await readConfigFile('trusted-callers.json'),
  );
  const present = new Set(
    (await loadAcquired(layout)).map((item) => item.tool),
  );
  const reused: string[] = [];
  for (const plan of await loadPlans(layout, tools.tools)) {
    if (present.has(plan.tool)) continue;
    const found = await findReusable(plan, { ...options, trusted });
    if (!found) continue;
    for (const guest of [found, ...found.companions])
      await storeAcquired(layout, guest.record, guest.elf, guest.elf);
    reused.push(plan.tool);
  }
  return reused;
}

if (import.meta.main)
  await runCli('reuse lookup', async () => {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository))
      fail('config-invalid', 'GITHUB_REPOSITORY owner/repo required');
    const { validateGuest } = await import('@aletheia-works/formicarium');
    const reused = await runReuseJob({
      api: createGitHubApi({ token: process.env.GITHUB_TOKEN }),
      repository,
      validate: validateGuest,
    });
    console.log(
      reused.length ? `reused: ${reused.join(', ')}` : 'reused: none',
    );
  });
