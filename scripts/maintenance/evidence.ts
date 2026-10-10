import {
  digest,
  type TrustedEvidenceObservation,
  validateEvidence,
} from '../ci/quality-evidence.js';
import {
  type CommonContext,
  failure,
  type MaintenanceRequest,
  type ParseResult,
  parseChecks,
  parseEvidence,
  parseMaintenanceInputs,
  parseProducers,
  record,
  snapshot,
  type TrustedPolicy,
} from './input.js';

/** U3 must fetch this observation independently; comparison cannot authenticate its source. */
function observation(
  raw: unknown,
  policy: TrustedPolicy,
): TrustedEvidenceObservation {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Object.getPrototypeOf(raw) !== Object.prototype
  )
    throw Error('invalid observation');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const artifact = descriptors.artifactBytes;
  if (
    !artifact ||
    !('value' in artifact) ||
    !(artifact.value instanceof Uint8Array) ||
    Object.getPrototypeOf(artifact.value) !== Uint8Array.prototype
  )
    throw Error('invalid artifact');
  const plain: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== 'string' ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    )
      throw Error('invalid observation');
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      throw Error('invalid observation');
    if (key !== 'artifactBytes') plain[key] = descriptor.value;
  }
  const row = record(snapshot(plain));
  const bytes = new Uint8Array(artifact.value);
  // Parse the same bounded C2 identity schema without trusting a claimed digest.
  const parsed = parseEvidence({
    ...row,
    schemaVersion: 1,
    artifactDigest: digest(bytes),
  });
  const declaredRequired = parseProducers(row.requiredChecks);
  if (
    JSON.stringify(declaredRequired) !==
    JSON.stringify(policy.requiredCheckProducers)
  )
    throw Error('required inventory differs');
  return {
    repository: parsed.repository,
    sourceSha: parsed.sourceSha,
    runId: parsed.runId,
    runAttempt: parsed.runAttempt,
    workflowIdentity: parsed.workflowIdentity,
    purpose: parsed.purpose,
    toolchainRevision: parsed.toolchainRevision,
    checks: parseChecks(row.checks),
    requiredChecks: policy.requiredCheckProducers.map((check) => ({
      ...check,
    })),
    artifactBytes: bytes,
    ...(parsed.coverage ? { coverage: { ...parsed.coverage } } : {}),
  };
}

export function adaptMaintenanceEvidence(
  rawRequest: unknown,
  rawPolicy: unknown,
  independentObservation: unknown,
): ParseResult<{ request: MaintenanceRequest; policy: TrustedPolicy }> {
  const parsed = parseMaintenanceInputs(rawRequest, rawPolicy);
  if (!parsed.ok) return parsed;
  try {
    const observed = observation(independentObservation, parsed.value.policy);
    const context = parsed.value.request.context;
    if (
      observed.repository !== context.repository ||
      observed.sourceSha !== context.headSha
    )
      throw Error('context differs');
    validateEvidence(context.evidence, observed);
    const trustedContext: CommonContext = { ...context, trustedWorkflow: true };
    return {
      ok: true,
      value: {
        request: { ...parsed.value.request, context: trustedContext },
        policy: parsed.value.policy,
      },
    };
  } catch {
    return { ok: false, failure: failure('INVALID_EVIDENCE') };
  }
}
