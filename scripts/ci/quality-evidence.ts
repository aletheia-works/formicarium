import { createHash } from 'node:crypto';

export interface CheckEvidence {
  name: string;
  sourceSha: string;
  state: 'success' | 'failure' | 'pending' | 'skipped' | 'cancelled';
  runId: string;
  producerIdentity: string;
}
export interface EvidenceEnvelope {
  schemaVersion: 1;
  repository: string;
  sourceSha: string;
  runId: string;
  runAttempt: number;
  workflowIdentity: string;
  purpose: 'ordinary-ci' | 'publication-candidate';
  checks: CheckEvidence[];
  artifactDigest: string;
  toolchainRevision: string;
  coverage?: {
    inventoryDigest: string;
    coveredLines: number;
    totalLines: number;
    receiptsDigest: string;
  };
}
// The consumer supplies API observations and trusted base policy separately
// from the submitted artifact. Never derive this object from that artifact.
export interface TrustedEvidenceObservation {
  repository: string;
  sourceSha: string;
  runId: string;
  runAttempt: number;
  workflowIdentity: string;
  purpose: EvidenceEnvelope['purpose'];
  toolchainRevision: string;
  checks: CheckEvidence[];
  requiredChecks: { name: string; producerIdentity: string }[];
  artifactBytes: Uint8Array;
  coverage?: {
    inventoryDigest: string;
    receiptsDigest: string;
    coveredLines: number;
    totalLines: number;
  };
}
export const digest = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

function validateIdentity(
  evidence: EvidenceEnvelope,
  observed: TrustedEvidenceObservation,
) {
  if (
    evidence.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(evidence.sourceSha)
  )
    throw Error('invalid evidence schema or source SHA');
  if (!Number.isSafeInteger(evidence.runAttempt) || evidence.runAttempt < 1)
    throw Error('invalid run attempt');
  for (const key of [
    'repository',
    'sourceSha',
    'runId',
    'runAttempt',
    'workflowIdentity',
    'purpose',
    'toolchainRevision',
  ] as const)
    if (!evidence[key] || evidence[key] !== observed[key])
      throw Error(`evidence identity differs: ${key}`);
  if (!['ordinary-ci', 'publication-candidate'].includes(evidence.purpose))
    throw Error('unknown evidence purpose');
  if (evidence.artifactDigest !== digest(observed.artifactBytes))
    throw Error('artifact digest differs');
}
function validateCheckSet(
  checks: CheckEvidence[],
  observed: TrustedEvidenceObservation,
) {
  const required = observed.requiredChecks;
  if (
    !Array.isArray(required) ||
    required.some(
      (row) =>
        !row ||
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        typeof row.producerIdentity !== 'string' ||
        !row.producerIdentity.trim(),
    )
  )
    throw Error('invalid required check name or producer');
  if (
    !required.length ||
    new Set(required.map((row) => row.name)).size !== required.length
  )
    throw Error('required check policy empty or duplicated');
  for (const rows of [checks, observed.checks])
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !row ||
          typeof row.name !== 'string' ||
          typeof row.producerIdentity !== 'string' ||
          typeof row.sourceSha !== 'string' ||
          typeof row.runId !== 'string' ||
          typeof row.state !== 'string',
      ) ||
      new Set(rows.map((row) => row.name)).size !== rows.length
    )
      throw Error('missing or duplicate check evidence');
  if (
    checks.length !== required.length ||
    observed.checks.length !== required.length
  )
    throw Error('mandatory check inventory differs');
  for (const rule of required) {
    const submitted = checks.find((row) => row.name === rule.name);
    const actual = observed.checks.find((row) => row.name === rule.name);
    for (const row of [submitted, actual])
      if (
        !row ||
        row.producerIdentity !== rule.producerIdentity ||
        row.sourceSha !== observed.sourceSha ||
        row.runId !== observed.runId ||
        row.state !== 'success'
      )
        throw Error(
          `check missing, stale, untrusted or unsuccessful: ${rule.name}`,
        );
  }
}
function validateCoverage(
  evidence: EvidenceEnvelope,
  observed: TrustedEvidenceObservation,
) {
  if (evidence.purpose !== 'publication-candidate') return;
  const actual = observed.coverage;
  const claimed = evidence.coverage;
  if (!actual || !claimed) throw Error('candidate coverage missing');
  for (const key of [
    'inventoryDigest',
    'receiptsDigest',
    'coveredLines',
    'totalLines',
  ] as const)
    if (claimed[key] !== actual[key])
      throw Error(`candidate coverage differs: ${key}`);
  if (
    ![claimed.inventoryDigest, claimed.receiptsDigest].every((value) =>
      /^[a-f0-9]{64}$/.test(value),
    ) ||
    !Number.isSafeInteger(claimed.totalLines) ||
    claimed.totalLines < 1 ||
    !Number.isSafeInteger(claimed.coveredLines) ||
    claimed.coveredLines < 0 ||
    claimed.coveredLines > claimed.totalLines ||
    claimed.coveredLines / claimed.totalLines < 0.8
  )
    throw Error('fixed inventory coverage below 80% or invalid');
}
export function validateEvidence(
  evidence: EvidenceEnvelope,
  observed: TrustedEvidenceObservation,
) {
  if (
    !evidence ||
    !observed ||
    typeof evidence !== 'object' ||
    typeof observed !== 'object'
  )
    throw Error('evidence and trusted observation objects required');
  validateIdentity(evidence, observed);
  validateCheckSet(evidence.checks, observed);
  validateCoverage(evidence, observed);
  return evidence;
}

export function requireSuccessfulJobs(
  results: Record<string, string>,
  required: readonly string[],
) {
  if (!required.length || new Set(required).size !== required.length)
    throw Error('required jobs empty or duplicated');
  for (const name of required)
    if (results[name] !== 'success')
      throw Error(`required job unsuccessful: ${name}`);
}
