import { resolve } from 'node:path';
import {
  digest,
  type EvidenceEnvelope,
  type TrustedEvidenceObservation,
  validateEvidence,
} from '../ci/quality-evidence.ts';
import { validateChecks } from '../ci/verification.ts';
import {
  artifactBytes,
  requireCondition,
  resolveEvidence,
} from './evidence.ts';
import { type PublicationRequest, planPublication } from './publication.ts';
import {
  ASSET_LIMITS,
  fetchAsset,
  readBoundedFile,
  unpackZip,
} from './publication-assets.ts';

export interface PublicationEvidencePolicy {
  repository: string;
  workflowIdentity: string;
  workflowId: number | null;
  producerAppId: number | null;
  toolchainRevision: string;
  requiredChecks: string[];
  archiveRedirectHosts?: string[];
}
export async function readPublicationPolicy(
  root: string,
): Promise<PublicationEvidencePolicy> {
  const bytes = await readBoundedFile(
    resolve(root, '.github/publication/trusted-policy.json'),
    ASSET_LIMITS.metadataBytes,
  );
  requireCondition(
    bytes.length <= 8 * 1024 * 1024,
    'publication policy oversized',
  );
  return JSON.parse(bytes.toString()).evidence as PublicationEvidencePolicy;
}
export function publicationProducer(policy: PublicationEvidencePolicy) {
  requireCondition(
    policy &&
      Number.isSafeInteger(policy.workflowId) &&
      (policy.workflowId ?? 0) > 0 &&
      Number.isSafeInteger(policy.producerAppId) &&
      (policy.producerAppId ?? 0) > 0 &&
      policy.repository === 'aletheia-works/formicarium' &&
      policy.workflowIdentity === '.github/workflows/candidate-verify.yml' &&
      policy.toolchainRevision === 'bun1.4.2-node24.21.0' &&
      Array.isArray(policy.requiredChecks) &&
      policy.requiredChecks.length > 0 &&
      policy.requiredChecks.every(
        (name) =>
          typeof name === 'string' && name.trim() === name && name.length > 0,
      ) &&
      new Set(policy.requiredChecks).size === policy.requiredChecks.length,
    'publication trusted policy incomplete',
  );
  return `${policy.producerAppId}:${policy.workflowId}:${policy.workflowIdentity}`;
}
/** The API observation is a separate argument, never reconstructed from a submitted artifact. */
export async function verifyPublicationEvidence(
  root: string,
  request: PublicationRequest,
  envelope: EvidenceEnvelope,
  observation: TrustedEvidenceObservation,
  policy: PublicationEvidencePolicy,
) {
  const producerIdentity = publicationProducer(policy);
  requireCondition(
    envelope.purpose === 'publication-candidate' &&
      observation.purpose === 'publication-candidate',
    'publication candidate purpose required',
  );
  requireCondition(
    envelope.repository === policy.repository &&
      envelope.repository === request.identity.repository &&
      envelope.sourceSha === request.identity.sourceCommit &&
      envelope.sourceSha === request.candidate.sourceCommit &&
      envelope.workflowIdentity === policy.workflowIdentity &&
      envelope.toolchainRevision === policy.toolchainRevision,
    'publication candidate identity differs',
  );
  validateEvidence(envelope, {
    ...observation,
    requiredChecks: policy.requiredChecks.map((name) => ({
      name,
      producerIdentity,
    })),
  });
  requireCondition(
    request.evidenceIds.length > 0,
    'publication release evidence empty',
  );
  const rows = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  let matchingCoverage = false;
  for (const row of rows) {
    requireCondition(
      JSON.stringify(row.candidate) === JSON.stringify(request.candidate),
      'publication signed candidate differs',
    );
    const coverage = row.coverage;
    if (!coverage) continue;
    const report = JSON.parse(
      (
        await artifactBytes(
          root,
          coverage.reportArtifact,
          ASSET_LIMITS.metadataBytes,
        )
      ).toString(),
    );
    const totalLines = coverage.files.reduce(
      (sum, file) => sum + file.totalLines,
      0,
    );
    const coveredLines = coverage.files.reduce(
      (sum, file) => sum + file.coveredLines,
      0,
    );
    if (
      coverage.files.every(
        (file) =>
          file.collection !== 'missing' &&
          (file.collection !== 'measured' || file.realms.length > 0),
      ) &&
      envelope.coverage?.inventoryDigest === coverage.inventorySha256 &&
      envelope.coverage.receiptsDigest ===
        digest(JSON.stringify(report.freshReceipts)) &&
      envelope.coverage.totalLines === totalLines &&
      envelope.coverage.coveredLines === coveredLines
    )
      matchingCoverage = true;
  }
  requireCondition(
    matchingCoverage,
    'publication fixed inventory/realm coverage differs',
  );
  const decision = await planPublication(root, request);
  requireCondition(
    decision.allowed,
    `publication blocked: ${decision.missing.join(',')}`,
  );
  return { envelope, decision };
}
/** Convert U1's real acceptance/report artifact format only after independent API provenance checks. */
export async function acquirePublicationEvidence(
  root: string,
  request: PublicationRequest,
  policy: PublicationEvidencePolicy,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const producerIdentity = publicationProducer(policy),
    candidate = request.candidateRun;
  requireCondition(
    candidate &&
      [candidate.runId, candidate.runAttempt, candidate.artifactId].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
    'publication candidate API reference required',
  );
  const prefix = `https://api.github.com/repos/${policy.repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const json = async (path: string) =>
    JSON.parse(
      (
        await fetchAsset(
          prefix + path,
          ASSET_LIMITS.metadataBytes,
          fetcher,
          headers,
        )
      ).toString(),
    );
  const run = await json(`/actions/runs/${candidate.runId}`);
  requireCondition(
    run.id === candidate.runId &&
      run.run_attempt === candidate.runAttempt &&
      run.repository?.full_name === policy.repository &&
      run.head_sha === request.identity.sourceCommit &&
      run.workflow_id === policy.workflowId &&
      run.path === policy.workflowIdentity &&
      run.event === 'workflow_dispatch' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
    'publication candidate run differs',
  );
  const jobs = await json(
    `/actions/runs/${candidate.runId}/attempts/${candidate.runAttempt}/jobs?per_page=100`,
  );
  requireCondition(
    jobs.total_count <= 100 && Array.isArray(jobs.jobs),
    'publication candidate job pagination refused',
  );
  const checks = [];
  for (const name of policy.requiredChecks) {
    const matches = jobs.jobs.filter(
      (job: { name: string }) => job.name === name,
    );
    requireCondition(
      matches.length === 1 &&
        matches[0].conclusion === 'success' &&
        matches[0].run_attempt === candidate.runAttempt &&
        typeof matches[0].check_run_url === 'string' &&
        matches[0].check_run_url.startsWith(`${prefix}/check-runs/`),
      'publication candidate job differs',
    );
    const check = JSON.parse(
      (
        await fetchAsset(
          matches[0].check_run_url,
          ASSET_LIMITS.metadataBytes,
          fetcher,
          headers,
        )
      ).toString(),
    );
    requireCondition(
      check.name === name &&
        check.head_sha === request.identity.sourceCommit &&
        check.app?.id === policy.producerAppId &&
        check.check_suite?.id === run.check_suite_id &&
        check.status === 'completed' &&
        check.conclusion === 'success',
      'publication candidate producer differs',
    );
    checks.push({
      name,
      sourceSha: check.head_sha as string,
      state: 'success' as const,
      runId: String(candidate.runId),
      producerIdentity,
    });
  }
  const item = await json(`/actions/artifacts/${candidate.artifactId}`);
  requireCondition(
    item.id === candidate.artifactId &&
      item.expired === false &&
      item.name ===
        `modernization-${request.identity.sourceCommit}-${candidate.runId}-${candidate.runAttempt}` &&
      item.workflow_run?.id === candidate.runId &&
      item.workflow_run?.head_sha === request.identity.sourceCommit &&
      /^sha256:[a-f0-9]{64}$/.test(item.digest),
    'publication candidate artifact differs',
  );
  const bytes = await fetchAsset(
    `${prefix}/actions/artifacts/${candidate.artifactId}/zip`,
    ASSET_LIMITS.inputBytes,
    fetcher,
    headers,
    policy.archiveRedirectHosts ?? [],
  );
  requireCondition(
    item.digest === `sha256:${digest(bytes)}`,
    'publication candidate API digest differs',
  );
  const files = unpackZip(bytes);
  const acceptanceBytes = files.get('ci-results/acceptance.json'),
    reportBytes = files.get('ci-coverage-fixed24/report.json');
  requireCondition(
    acceptanceBytes &&
      reportBytes &&
      acceptanceBytes.length <= ASSET_LIMITS.metadataBytes &&
      reportBytes.length <= ASSET_LIMITS.metadataBytes,
    'publication candidate receipt missing',
  );
  const acceptance = JSON.parse(acceptanceBytes.toString()),
    report = JSON.parse(reportBytes.toString());
  validateChecks(acceptance.checks);
  requireCondition(
    acceptance.passed === true &&
      acceptance.context?.repository === policy.repository &&
      acceptance.context?.commit === request.identity.sourceCommit &&
      acceptance.context?.event === 'workflow_dispatch' &&
      JSON.stringify(acceptance.coverage) === JSON.stringify(report) &&
      report.passed === true &&
      report.candidateSha256 === request.candidate.tarballSha256 &&
      Array.isArray(report.files) &&
      Array.isArray(report.fixedInventory) &&
      Array.isArray(report.freshReceipts),
    'publication candidate receipt binding differs',
  );
  const releaseRows = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  let exactReport = false;
  for (const row of releaseRows) {
    if (
      row.coverage?.binding.candidateSha256 ===
        request.candidate.tarballSha256 &&
      digest(
        await artifactBytes(
          root,
          row.coverage.reportArtifact,
          ASSET_LIMITS.metadataBytes,
        ),
      ) === digest(reportBytes)
    )
      exactReport = true;
  }
  requireCondition(
    exactReport,
    'publication candidate coverage source differs',
  );
  const coverage = {
    inventoryDigest: digest(JSON.stringify(report.fixedInventory)),
    receiptsDigest: digest(JSON.stringify(report.freshReceipts)),
    totalLines: report.files.reduce(
      (sum: number, row: { lines: { total: number } }) => sum + row.lines.total,
      0,
    ),
    coveredLines: report.files.reduce(
      (sum: number, row: { lines: { covered: number } }) =>
        sum + row.lines.covered,
      0,
    ),
  };
  const observation: TrustedEvidenceObservation = {
    repository: policy.repository,
    sourceSha: request.identity.sourceCommit,
    runId: String(candidate.runId),
    runAttempt: candidate.runAttempt,
    workflowIdentity: policy.workflowIdentity,
    purpose: 'publication-candidate',
    toolchainRevision: policy.toolchainRevision,
    checks,
    requiredChecks: policy.requiredChecks.map((name) => ({
      name,
      producerIdentity,
    })),
    artifactBytes: bytes,
    coverage,
  };
  const envelope: EvidenceEnvelope = {
    ...observation,
    schemaVersion: 1,
    artifactDigest: digest(bytes),
  };
  return { envelope, observation };
}
