import {
  digest,
  type EvidenceEnvelope,
  type TrustedEvidenceObservation,
} from '../ci/quality-evidence.ts';
import {
  BoundaryError,
  decodeJson,
  limitBytes,
  unpackArchive,
} from './archive.ts';
import { type GitHubApi, validArchiveHostRule } from './github.ts';
import { snapshot } from './input.ts';

export const REQUIRED_JOBS = [
  'quality',
  'commit-format',
  'ci-required',
] as const;
export interface AcquisitionPolicy {
  repository: string;
  workflowId: number;
  workflowPath: string;
  workflowDigest: string;
  producerAppId: number;
  toolchainRevision: string;
  protectedPaths: string[];
  archiveRedirectHosts: string[];
  updateActorId: number;
  updateActorType: 'Bot';
}
export interface Acquisition {
  repository: string;
  prNumber: number;
  headSha: string;
  branch: string;
  baseSha: string;
  runId: string;
  runAttempt: number;
  authenticatedUpdateBot: boolean;
  protectedMain?: boolean;
  mergeable?: boolean;
  files: { path: string; status: string; sha: string }[];
  evidence: EvidenceEnvelope;
  observation: TrustedEvidenceObservation;
  receiptLockDigest: string;
  artifactId: number;
}
function fail(condition: unknown, code: string): asserts condition {
  if (!condition) throw new BoundaryError(code);
}
function row(value: unknown): Record<string, unknown> {
  fail(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  fail(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 256 &&
      value.trim() === value,
    'INVALID_API',
  );
  return value;
}
function positive(value: unknown): number {
  fail(Number.isSafeInteger(value) && (value as number) > 0, 'INVALID_API');
  return value as number;
}
function fullSha(value: unknown): string {
  fail(
    typeof value === 'string' && /^[a-f0-9]{40}$/.test(value),
    'INVALID_API',
  );
  return value;
}
export function producerIdentity(policy: AcquisitionPolicy): string {
  return `${policy.producerAppId}:${policy.workflowId}:${policy.workflowPath}`;
}
export function validateAcquisitionPolicy(raw: unknown): AcquisitionPolicy {
  const source = row(snapshot(raw));
  const repository = text(source.repository);
  fail(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'INVALID_POLICY');
  const workflowPath = text(source.workflowPath);
  fail(workflowPath === '.github/workflows/ci.yml', 'INVALID_POLICY');
  fail(
    typeof source.workflowDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(source.workflowDigest),
    'INVALID_POLICY',
  );
  fail(
    Array.isArray(source.protectedPaths) && source.protectedPaths.length <= 100,
    'INVALID_POLICY',
  );
  fail(
    Array.isArray(source.archiveRedirectHosts) &&
      source.archiveRedirectHosts.length <= 16,
    'INVALID_POLICY',
  );
  const protectedPaths = source.protectedPaths.map(text);
  const archiveRedirectHosts = source.archiveRedirectHosts.map(text);
  fail(
    protectedPaths.includes(workflowPath) &&
      new Set(protectedPaths).size === protectedPaths.length,
    'INVALID_POLICY',
  );
  for (const host of archiveRedirectHosts)
    fail(validArchiveHostRule(host), 'INVALID_POLICY');
  fail(source.updateActorType === 'Bot', 'INVALID_POLICY');
  return {
    repository,
    workflowPath,
    workflowDigest: source.workflowDigest,
    workflowId: positive(source.workflowId),
    producerAppId: positive(source.producerAppId),
    toolchainRevision: text(source.toolchainRevision),
    protectedPaths,
    archiveRedirectHosts,
    updateActorId: positive(source.updateActorId),
    updateActorType: 'Bot',
  };
}
export async function contentAt(
  api: GitHubApi,
  repository: string,
  path: string,
  sha: string,
): Promise<Uint8Array> {
  fail(
    path.length <= 1024 &&
      !path.includes('\\') &&
      !path.startsWith('/') &&
      path
        .split('/')
        .every((segment) => segment && segment !== '.' && segment !== '..'),
    'UNSAFE_PATH',
  );
  fullSha(sha);
  const response = row(
    await api.json(
      `/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`,
    ),
  );
  fail(
    response.type === 'file' && response.encoding === 'base64',
    'UNKNOWN_FILE',
  );
  const content = response.content;
  fail(
    typeof content === 'string' &&
      content.length <= Math.ceil((8 * 1024 * 1024 * 4) / 3) + 1024,
    'BYTE_LIMIT',
  );
  const normalized = content.replace(/\n/g, '');
  fail(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    ),
    'INVALID_API',
  );
  const bytes = limitBytes(Buffer.from(normalized, 'base64'));
  fail(response.size === bytes.length, 'INVALID_API');
  return bytes;
}
export function normalizeReceipt(
  raw: unknown,
  archiveBytes: Uint8Array,
  run: Record<string, unknown>,
  pr: Record<string, unknown>,
  jobs: unknown[],
  checks: unknown[],
  policy: AcquisitionPolicy,
): {
  evidence: EvidenceEnvelope;
  observation: TrustedEvidenceObservation;
  lockDigest: string;
} {
  limitBytes(archiveBytes);
  const receipt = row(snapshot(raw));
  const head = fullSha(row(pr.head).sha),
    runId = String(positive(run.id)),
    attempt = positive(run.run_attempt);
  fail(
    receipt.schemaVersion === 1 &&
      receipt.repository === policy.repository &&
      receipt.sourceSha === head &&
      receipt.runId === runId &&
      receipt.runAttempt === attempt &&
      receipt.workflowIdentity === policy.workflowPath &&
      receipt.purpose === 'ordinary-ci',
    'RECEIPT_IDENTITY',
  );
  const workflowRef = text(receipt.workflowRef);
  fail(
    workflowRef.startsWith(`${policy.repository}/${policy.workflowPath}@refs/`),
    'RECEIPT_IDENTITY',
  );
  const tools = row(receipt.expectedToolchain);
  fail(
    tools.node === '24.21.0' &&
      tools.bun === '1.4.2' &&
      receipt.receiptNodeVersion === '24.21.0' &&
      typeof tools.lockDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(tools.lockDigest),
    'TOOLCHAIN_MISMATCH',
  );
  const observedJobs = receipt.observedJobs;
  fail(
    Array.isArray(observedJobs) && observedJobs.length === 2,
    'RECEIPT_JOBS',
  );
  const producer = producerIdentity(policy);
  const suiteId = positive(run.check_suite_id);
  const normalized = REQUIRED_JOBS.map((name) => {
    const selectedJobs = jobs.map(row).filter((job) => job.name === name);
    fail(selectedJobs.length === 1, 'JOB_IDENTITY');
    const job = selectedJobs[0];
    fail(
      job &&
        job.status === 'completed' &&
        job.conclusion === 'success' &&
        job.run_id === run.id &&
        job.run_attempt === attempt,
      'JOB_UNSUCCESSFUL',
    );
    const checkUrl = text(job.check_run_url);
    const checkAddress = new URL(checkUrl);
    const checkPrefix = `/repos/${policy.repository}/check-runs/`;
    const checkId = checkAddress.pathname.slice(checkPrefix.length);
    fail(
      checkAddress.origin === 'https://api.github.com' &&
        checkAddress.pathname.startsWith(checkPrefix) &&
        /^[1-9][0-9]*$/.test(checkId) &&
        !checkAddress.search &&
        !checkAddress.hash,
      'JOB_IDENTITY',
    );
    const selectedChecks = checks
      .map(row)
      .filter((check) => String(check.id) === checkId);
    fail(selectedChecks.length === 1, 'CHECK_IDENTITY');
    const check = selectedChecks[0];
    fail(
      check &&
        check.name === name &&
        check.head_sha === head &&
        check.status === 'completed' &&
        check.conclusion === 'success' &&
        row(check.app).id === policy.producerAppId &&
        row(check.check_suite).id === suiteId,
      'CHECK_UNSUCCESSFUL',
    );
    if (name !== 'ci-required') {
      const matches = observedJobs
        .map(row)
        .filter((claimed) => claimed.name === name);
      fail(
        matches.length === 1 &&
          matches[0]?.state === 'success' &&
          matches[0]?.sourceSha === head &&
          matches[0]?.runId === runId,
        'RECEIPT_JOBS',
      );
    }
    return {
      name,
      sourceSha: head,
      state: 'success' as const,
      runId,
      producerIdentity: producer,
    };
  });
  fail(
    new Set(observedJobs.map((claimed) => row(claimed).name)).size === 2,
    'RECEIPT_JOBS',
  );
  const evidence: EvidenceEnvelope = {
    schemaVersion: 1,
    repository: policy.repository,
    sourceSha: head,
    runId,
    runAttempt: attempt,
    workflowIdentity: policy.workflowPath,
    purpose: 'ordinary-ci',
    checks: normalized,
    artifactDigest: digest(archiveBytes),
    toolchainRevision: policy.toolchainRevision,
  };
  const observation: TrustedEvidenceObservation = {
    repository: policy.repository,
    sourceSha: head,
    runId,
    runAttempt: attempt,
    workflowIdentity: policy.workflowPath,
    purpose: 'ordinary-ci',
    checks: normalized.map((check) => ({ ...check })),
    toolchainRevision: policy.toolchainRevision,
    artifactBytes: archiveBytes,
    requiredChecks: REQUIRED_JOBS.map((name) => ({
      name,
      producerIdentity: producer,
    })),
  };
  return { evidence, observation, lockDigest: tools.lockDigest as string };
}
export async function acquireMaintenance(
  api: GitHubApi,
  runId: number,
  rawPolicy: unknown,
): Promise<Acquisition> {
  const policy = validateAcquisitionPolicy(rawPolicy);
  positive(runId);
  const prefix = `/repos/${policy.repository}`;
  const run = row(await api.json(`${prefix}/actions/runs/${runId}`));
  fail(
    run.id === runId &&
      row(run.repository).full_name === policy.repository &&
      run.workflow_id === policy.workflowId &&
      run.path === policy.workflowPath &&
      run.event === 'pull_request' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
    'RUN_IDENTITY',
  );
  const attempt = positive(run.run_attempt);
  const linkedPrs = run.pull_requests;
  fail(Array.isArray(linkedPrs) && linkedPrs.length === 1, 'AMBIGUOUS_PR');
  const prNumber = positive(row(linkedPrs[0]).number);
  const pr = row(await api.json(`${prefix}/pulls/${prNumber}`));
  fail(
    pr.number === prNumber &&
      pr.state === 'open' &&
      !pr.merged &&
      row(row(pr.head).repo).full_name === policy.repository &&
      row(row(pr.base).repo).full_name === policy.repository,
    'PR_REJECTED',
  );
  const head = fullSha(row(pr.head).sha),
    baseSha = fullSha(row(pr.base).sha),
    executionSha = fullSha(run.head_sha);
  if (executionSha !== head) {
    const commit = row(await api.json(`${prefix}/git/commits/${executionSha}`));
    fail(
      Array.isArray(commit.parents) &&
        commit.parents.length === 2 &&
        row(commit.parents[0]).sha === baseSha &&
        row(commit.parents[1]).sha === head,
      'SOURCE_BINDING',
    );
  }
  const workflowBytes = await contentAt(
    api,
    policy.repository,
    policy.workflowPath,
    head,
  );
  fail(digest(workflowBytes) === policy.workflowDigest, 'UNTRUSTED_CI');
  const files = (
    await api.pages(`${prefix}/pulls/${prNumber}/files?per_page=100`, '')
  ).map((file) => {
    const value = row(file),
      path = value.filename;
    fail(typeof path === 'string' && path.length <= 1024, 'INVALID_API');
    return { path, status: text(value.status), sha: fullSha(value.sha) };
  });
  fail(
    files.length <= 500 &&
      new Set(files.map((file) => file.path)).size === files.length,
    'FILE_LIMIT',
  );
  fail(
    !files.some((file) =>
      policy.protectedPaths.some(
        (path) => file.path === path || file.path.startsWith(`${path}/`),
      ),
    ),
    'PROTECTED_CHANGE',
  );
  const jobs = await api.pages(
    `${prefix}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    'jobs',
  );
  const checks = await api.pages(
    `${prefix}/commits/${head}/check-runs?per_page=100`,
    'check_runs',
  );
  const artifacts = await api.pages(
    `${prefix}/actions/runs/${runId}/artifacts?per_page=100`,
    'artifacts',
  );
  const name = `ordinary-ci-${head}-${runId}-${attempt}`;
  const selected = artifacts
    .map(row)
    .filter((artifact) => artifact.name === name && artifact.expired === false);
  fail(selected.length === 1, 'ARTIFACT_IDENTITY');
  const artifactId = positive(selected[0]?.id);
  const artifactRun = row(selected[0]?.workflow_run);
  fail(
    artifactRun.id === runId &&
      artifactRun.repository_id === row(run.repository).id &&
      artifactRun.head_sha === executionSha,
    'ARTIFACT_IDENTITY',
  );
  const archiveBytes = await api.bytes(
    `${prefix}/actions/artifacts/${artifactId}/zip`,
    policy.archiveRedirectHosts,
  );
  const members = await unpackArchive(archiveBytes);
  const receiptBytes = members.get('receipt.json');
  fail(receiptBytes, 'RECEIPT_MISSING');
  const normalized = normalizeReceipt(
    decodeJson(receiptBytes),
    archiveBytes,
    run,
    pr,
    jobs,
    checks,
    policy,
  );
  const user = row(pr.user);
  return {
    repository: policy.repository,
    prNumber,
    headSha: head,
    branch: text(row(pr.head).ref),
    baseSha,
    runId: String(runId),
    runAttempt: attempt,
    authenticatedUpdateBot:
      user.id === policy.updateActorId && user.type === policy.updateActorType,
    files,
    evidence: normalized.evidence,
    observation: normalized.observation,
    receiptLockDigest: normalized.lockDigest,
    artifactId,
  };
}
