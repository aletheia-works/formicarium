// Observes one finished run of the manual migration acceptance workflow through
// the GitHub REST API and writes the `observed-ci-summary` record the U4
// completion accepts as its CI evidence. The run, its jobs, the signed commit
// and both artifacts are checked independently; the record names the pack and
// source that the run's own candidate manifest carries. The token is read from
// the environment only and is never written to a file or a log.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../package/stage-package.js';
import {
  ASSET_LIMITS,
  fetchAsset,
  unpackZip,
} from '../release/publication-assets.js';
import { readPreflightEvidenceId, validateB1 } from './b1.js';
import { COMMAND_UNIT } from './stage.js';

export const ACCEPTANCE_REPOSITORY = 'aletheia-works/formicarium';
export const ACCEPTANCE_WORKFLOW = '.github/workflows/migration-acceptance.yml';
export const ACCEPTANCE_JOB = 'accept';
export const GITHUB_API = 'https://api.github.com';
export const candidateArtifactName = (runId: number, attempt: number) =>
  `migration-acceptance-candidate-${runId}-${attempt}`;
export const completionArtifactName = (runId: number, attempt: number) =>
  `migration-acceptance-completion-${runId}-${attempt}`;

export interface ObservedCISummary {
  recordKind: 'observed-ci-summary';
  schemaVersion: 1;
  unit: typeof COMMAND_UNIT;
  conclusion: 'success';
  sourceCommit: string;
  sourceIdentity: string;
  candidateSha256: string;
  runURL: string;
  runID: number;
  attempt: number;
  repository: string;
  workflowPath: string;
  event: 'workflow_dispatch';
  headBranch: 'main';
  commitVerified: true;
  jobs: { id: number; name: string; conclusion: 'success' }[];
  artifacts: {
    id: number;
    name: string;
    digest: string;
    sizeInBytes: number;
  }[];
  candidateManifestSha256: string;
  completionReportSha256: string;
  b1Sha256: string;
  preflightEvidenceId: string;
  observedAt: string;
}
export interface ObserveOptions {
  runId: number;
  commit: string;
  token: string;
  root?: string;
  /** New directory for the REST bodies, both ZIPs and the record. */
  out?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(`U4 CI observation ${message}`);
}
const SHA256 = /^[a-f0-9]{64}$/;
type Json = Record<string, unknown>;
const object = (value: unknown, what: string): Json => {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${what} object required`,
  );
  return value as Json;
};
const positive = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** The run must be a completed, successful manual run of main's workflow at the commit. */
export function checkRun(run: Json, runId: number, commit: string) {
  ensure(run.id === runId, 'run id differs');
  ensure(positive(run.run_attempt), 'run attempt missing');
  ensure(
    object(run.repository, 'run repository').full_name ===
      ACCEPTANCE_REPOSITORY &&
      object(run.head_repository, 'run head repository').full_name ===
        ACCEPTANCE_REPOSITORY,
    'run repository differs',
  );
  ensure(run.path === ACCEPTANCE_WORKFLOW, 'run workflow path differs');
  ensure(run.event === 'workflow_dispatch', 'run event differs');
  ensure(run.head_branch === 'main', 'run branch differs');
  ensure(run.head_sha === commit, 'run head differs');
  ensure(
    run.status === 'completed' && run.conclusion === 'success',
    'run not completed successfully',
  );
  return run.run_attempt as number;
}
/** Every job of the attempt completed successfully, including the acceptance job. */
export function checkJobs(
  jobs: Json,
  attempt: number,
  commit: string,
): ObservedCISummary['jobs'] {
  ensure(
    Array.isArray(jobs.jobs) &&
      positive(jobs.total_count) &&
      (jobs.total_count as number) <= 100 &&
      jobs.jobs.length === jobs.total_count,
    'job list incomplete/paginated',
  );
  const rows = (jobs.jobs as unknown[]).map((raw) => object(raw, 'job'));
  ensure(
    rows.every(
      (job) =>
        job.status === 'completed' &&
        job.conclusion === 'success' &&
        job.run_attempt === attempt &&
        job.head_sha === commit &&
        positive(job.id) &&
        typeof job.name === 'string',
    ),
    'job not successful or from another attempt/head',
  );
  ensure(
    rows.filter((job) => job.name === ACCEPTANCE_JOB).length === 1,
    'acceptance job missing',
  );
  return rows.map((job) => ({
    id: job.id as number,
    name: job.name as string,
    conclusion: 'success' as const,
  }));
}
/** The commit is the expected one and GitHub verified its signature. */
export function checkCommit(value: Json, commit: string) {
  ensure(value.sha === commit, 'commit differs');
  const verification = object(
    object(value.commit, 'commit body').verification,
    'commit verification',
  );
  ensure(verification.verified === true, 'commit signature not verified');
}
/** Exactly the run's two artifacts, unexpired, bound to the run and head. */
export function checkArtifacts(
  list: Json,
  runId: number,
  attempt: number,
  commit: string,
) {
  ensure(
    Array.isArray(list.artifacts) &&
      list.total_count === list.artifacts.length &&
      list.artifacts.length <= 100,
    'artifact list incomplete/paginated',
  );
  const rows = (list.artifacts as unknown[]).map((raw) =>
    object(raw, 'artifact'),
  );
  const names = [
    candidateArtifactName(runId, attempt),
    completionArtifactName(runId, attempt),
  ];
  ensure(
    JSON.stringify(rows.map((row) => row.name).sort()) ===
      JSON.stringify([...names].sort()),
    'artifact set differs',
  );
  return names.map((name) => {
    const row = rows.find((item) => item.name === name)!;
    const run = object(row.workflow_run, 'artifact run');
    ensure(
      positive(row.id) &&
        row.expired === false &&
        typeof row.digest === 'string' &&
        /^sha256:[a-f0-9]{64}$/.test(row.digest) &&
        positive(row.size_in_bytes) &&
        (row.size_in_bytes as number) <= ASSET_LIMITS.inputBytes &&
        run.id === runId &&
        run.head_sha === commit,
      `artifact ${name} differs/expired`,
    );
    return {
      id: row.id as number,
      name,
      digest: row.digest as string,
      sizeInBytes: row.size_in_bytes as number,
    };
  });
}

/** One ZIP entry matching the pattern; none or several are refused. */
function single(files: Map<string, Buffer>, pattern: RegExp, what: string) {
  const matches = [...files.keys()].filter((path) => pattern.test(path));
  ensure(matches.length === 1, `${what} missing/duplicate in artifact`);
  return { path: matches[0]!, bytes: files.get(matches[0]!)! };
}
const CANDIDATE_MANIFEST = /^candidate-[0-9a-f-]{36}\/package\.manifest\.json$/;
const CANDIDATE_TARBALL =
  /^candidate-[0-9a-f-]{36}\/package\/aletheia-works-formicarium-0\.3\.0\.tgz$/;
const COMPLETION_REPORT =
  /^(?:migration-command\/)?completion-[0-9a-f-]{36}\/local-provisional-report\.json$/;
const COMPLETION_B1 =
  /^(?:migration-command\/)?completion-[0-9a-f-]{36}\/b1-acceptance\.json$/;
const INCOMPLETE = /(?:^|\/)incomplete\.json$/;

/**
 * The candidate artifact carries the run's own candidate, its pack, and the
 * local-provisional completion report and B1 rows assembled from that pack.
 */
export function checkCandidateArtifact(
  bytes: Uint8Array,
  commit: string,
  preflightEvidenceId: string,
) {
  const files = unpackZip(bytes);
  ensure(
    ![...files.keys()].some((path) => INCOMPLETE.test(path)),
    'incomplete completion in artifact',
  );
  const manifestEntry = single(files, CANDIDATE_MANIFEST, 'candidate manifest');
  const tarball = single(files, CANDIDATE_TARBALL, 'candidate tarball');
  ensure(
    manifestEntry.path.split('/')[0] === tarball.path.split('/')[0],
    'manifest and tarball from different candidates',
  );
  const report = single(files, COMPLETION_REPORT, 'completion report');
  const b1 = single(files, COMPLETION_B1, 'B1 rows');
  ensure(
    report.path.replace(/[^/]+$/, '') === b1.path.replace(/[^/]+$/, ''),
    'report and B1 rows from different completions',
  );
  const manifest = JSON.parse(manifestEntry.bytes.toString('utf8'));
  const packSha256 = sha256(tarball.bytes);
  ensure(
    manifest.unit === COMMAND_UNIT &&
      manifest.version === '0.3.0' &&
      manifest.provisional === true &&
      manifest.sourceCommit === commit &&
      Array.isArray(manifest.sourceFiles) &&
      Array.isArray(manifest.files) &&
      typeof manifest.sourceIdentity === 'string' &&
      SHA256.test(manifest.sourceIdentity) &&
      manifest.sourceIdentity === sha256(JSON.stringify(manifest.sourceFiles)),
    'candidate manifest identity differs',
  );
  ensure(
    manifest.tarball?.sha256 === packSha256,
    'candidate tarball digest differs from its manifest',
  );
  const completion = JSON.parse(report.bytes.toString('utf8'));
  ensure(
    completion.unit === COMMAND_UNIT &&
      completion.status === 'local-provisional' &&
      completion.localPassed === true &&
      completion.acceptancePassed === false &&
      completion.candidateSha256 === packSha256 &&
      completion.sourceCommit === commit &&
      completion.sourceIdentity === manifest.sourceIdentity &&
      completion.b1?.formal === false &&
      completion.b1?.sha256 === sha256(b1.bytes) &&
      completion.preflightEvidence?.evidenceId === preflightEvidenceId,
    'completion report does not bind this candidate',
  );
  validateB1(JSON.parse(b1.bytes.toString('utf8')), {
    sourceCommit: commit,
    packSha256,
    inventorySha256: sha256(JSON.stringify(manifest.files)),
    preflightEvidenceId,
  });
  return {
    manifest,
    packSha256,
    manifestSha256: sha256(manifestEntry.bytes),
    reportSha256: sha256(report.bytes),
    b1Sha256: sha256(b1.bytes),
  };
}
/** The completion artifact holds the same report and B1 rows, and no failure. */
export function checkCompletionArtifact(
  bytes: Uint8Array,
  reportSha256: string,
  b1Sha256: string,
) {
  const files = unpackZip(bytes);
  ensure(
    ![...files.keys()].some((path) => INCOMPLETE.test(path)),
    'incomplete completion in artifact',
  );
  ensure(
    sha256(single(files, COMPLETION_REPORT, 'completion report').bytes) ===
      reportSha256 &&
      sha256(single(files, COMPLETION_B1, 'B1 rows').bytes) === b1Sha256,
    'completion artifact differs from the candidate artifact',
  );
}

/** Observes the run, keeps every REST body and ZIP, and writes the record once. */
export async function observeAcceptanceRun(options: ObserveOptions) {
  const { runId, commit, token } = options;
  ensure(positive(runId), 'run id must be a positive integer');
  ensure(/^[a-f0-9]{40}$/.test(commit), 'expected 40-hex commit required');
  ensure(
    typeof token === 'string' && token.length > 0,
    'GitHub token required',
  );
  const root = resolve(options.root ?? process.cwd());
  const fetcher = options.fetcher ?? fetch;
  const out = resolve(
    options.out ?? resolve(root, `.artifacts/migration-command/ci-${runId}`),
  );
  const preflight = await readPreflightEvidenceId(root);
  const prefix = `${GITHUB_API}/repos/${ACCEPTANCE_REPOSITORY}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const kept = new Map<string, Buffer>();
  const json = async (name: string, path: string): Promise<Json> => {
    const bytes = await fetchAsset(
      prefix + path,
      ASSET_LIMITS.metadataBytes,
      fetcher,
      headers,
    );
    kept.set(name, bytes);
    return object(JSON.parse(bytes.toString('utf8')), name);
  };
  const attempt = checkRun(
    await json('run.json', `/actions/runs/${runId}`),
    runId,
    commit,
  );
  const jobs = checkJobs(
    await json(
      'jobs.json',
      `/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    ),
    attempt,
    commit,
  );
  checkCommit(await json('commit.json', `/commits/${commit}`), commit);
  const artifacts = checkArtifacts(
    await json(
      'artifacts.json',
      `/actions/runs/${runId}/artifacts?per_page=100`,
    ),
    runId,
    attempt,
    commit,
  );
  const zips: Buffer[] = [];
  for (const artifact of artifacts) {
    const bytes = await fetchAsset(
      `${prefix}/actions/artifacts/${artifact.id}/zip`,
      ASSET_LIMITS.inputBytes,
      fetcher,
      headers,
      [],
      120_000,
      true,
    );
    ensure(
      artifact.digest === `sha256:${sha256(bytes)}` &&
        bytes.length === artifact.sizeInBytes,
      `artifact ${artifact.name} digest/size differs`,
    );
    kept.set(`${artifact.name}.zip`, bytes);
    zips.push(bytes);
  }
  const candidate = checkCandidateArtifact(
    zips[0]!,
    commit,
    preflight.evidenceId,
  );
  checkCompletionArtifact(zips[1]!, candidate.reportSha256, candidate.b1Sha256);
  const summary: ObservedCISummary = {
    recordKind: 'observed-ci-summary',
    schemaVersion: 1,
    unit: COMMAND_UNIT,
    conclusion: 'success',
    sourceCommit: commit,
    sourceIdentity: candidate.manifest.sourceIdentity,
    candidateSha256: candidate.packSha256,
    runURL: `https://github.com/${ACCEPTANCE_REPOSITORY}/actions/runs/${runId}`,
    runID: runId,
    attempt,
    repository: ACCEPTANCE_REPOSITORY,
    workflowPath: ACCEPTANCE_WORKFLOW,
    event: 'workflow_dispatch',
    headBranch: 'main',
    commitVerified: true,
    jobs,
    artifacts,
    candidateManifestSha256: candidate.manifestSha256,
    completionReportSha256: candidate.reportSha256,
    b1Sha256: candidate.b1Sha256,
    preflightEvidenceId: preflight.evidenceId,
    observedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
  await mkdir(resolve(out, '..'), { recursive: true });
  await mkdir(out);
  for (const [name, bytes] of kept)
    await writeFile(resolve(out, name), bytes, { flag: 'wx' });
  const recordBytes = Buffer.from(`${JSON.stringify(summary, null, 2)}\n`);
  const recordPath = resolve(out, 'observed-ci-summary.json');
  await writeFile(recordPath, recordBytes, { flag: 'wx' });
  return { recordPath, recordSha256: sha256(recordBytes), summary };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [run, commit, ...extra] = process.argv.slice(2);
  if (!run || !commit || extra.length || !/^[1-9][0-9]*$/.test(run))
    throw Error('usage: U4 observe-ci.js <run-id> <expected-40-hex-commit>');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token)
    throw Error('U4 CI observation GITHUB_TOKEN or GH_TOKEN required');
  const observed = await observeAcceptanceRun({
    runId: Number(run),
    commit,
    token,
  });
  // Paths and digests only; the token never reaches the output.
  console.log(
    JSON.stringify(
      { recordPath: observed.recordPath, sha256: observed.recordSha256 },
      null,
      2,
    ),
  );
}
