import assert from 'node:assert/strict';
import test from 'node:test';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { adaptMaintenanceEvidence } from '../../scripts/maintenance/evidence.js';
import { evaluateMaintenance } from '../../scripts/maintenance/policy.js';

function evidenceFixture() {
  const head = 'a'.repeat(40);
  const hash = 'b'.repeat(64);
  const policy = {
    revision: 'policy-1',
    repository: 'owner/repo',
    allowedFormatPaths: ['scripts', 'tests'],
    allowedDevDependencies: ['typescript'],
    requiredCheckProducers: [{ name: 'lint', producerIdentity: 'trusted/ci' }],
    formatterRevision: 'biome-fixed',
    formatterConfigDigest: hash,
  };
  const evidence = {
    schemaVersion: 1 as const,
    repository: policy.repository,
    sourceSha: head,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: 'trusted/ci',
    purpose: 'ordinary-ci' as const,
    artifactDigest: hash,
    toolchainRevision: 'bun-fixed',
    checks: [
      {
        name: 'lint',
        sourceSha: head,
        state: 'success' as const,
        runId: '123',
        producerIdentity: 'trusted/ci',
      },
    ],
  };
  const request = {
    schemaVersion: 1 as const,
    operation: 'format-push' as const,
    context: {
      repository: policy.repository,
      prNumber: 1,
      headSha: head,
      currentHeadSha: head,
      sameRepository: true,
      prOpen: true,
      trustedWorkflow: true,
      evidence,
    },
    changedPaths: ['scripts/example.ts'],
    proposedDiffDigest: hash,
    reproducedDiffDigest: hash,
    trustedFormatterRevision: policy.formatterRevision,
    trustedConfigDigest: hash,
    reproducible: true,
    formattingOnly: true,
    emptyDiff: false,
  };
  const f = { request, policy };
  const artifactBytes = new TextEncoder().encode('independent artifact bytes');
  f.request.context.evidence.artifactDigest = digest(artifactBytes);
  const observation = {
    repository: f.request.context.evidence.repository,
    sourceSha: f.request.context.evidence.sourceSha,
    runId: f.request.context.evidence.runId,
    runAttempt: f.request.context.evidence.runAttempt,
    workflowIdentity: f.request.context.evidence.workflowIdentity,
    purpose: f.request.context.evidence.purpose,
    toolchainRevision: f.request.context.evidence.toolchainRevision,
    checks: structuredClone(f.request.context.evidence.checks),
    requiredChecks: structuredClone(f.policy.requiredCheckProducers),
    artifactBytes,
  };
  return { ...f, observation };
}
function pipeline(request: unknown, policy: unknown, observed: unknown) {
  const adapted = adaptMaintenanceEvidence(request, policy, observed);
  return adapted.ok
    ? evaluateMaintenance(adapted.value.request, adapted.value.policy)
    : adapted.failure;
}
function freezeData(value: unknown): void {
  if (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Uint8Array)
  ) {
    for (const nested of Object.values(value)) freezeData(nested);
    Object.freeze(value);
  }
}
test('raw parse and real C2 adapter feed the two-argument C3 contract', () => {
  const f = evidenceFixture();
  f.request.context.trustedWorkflow = false;
  const result = pipeline(f.request, f.policy, f.observation);
  assert.equal(evaluateMaintenance.length, 2);
  assert.equal(result.outcome, 'allow');
  assert.equal(result.headSha, f.request.context.headSha);
  assert.ok(result.decisionId);
  assert.equal(f.request.context.trustedWorkflow, false);
});
test('altered or stale independent evidence stops the pipeline before any Decision', () => {
  const f = evidenceFixture();
  for (const observed of [
    { ...f.observation, artifactBytes: new TextEncoder().encode('tampered') },
    { ...f.observation, sourceSha: 'c'.repeat(40) },
    { ...f.observation, runAttempt: 2 },
  ]) {
    const result = pipeline(f.request, f.policy, observed);
    assert.equal(result.outcome, 'reject');
    assert.equal(result.decisionId, null);
    assert.equal(result.headSha, null);
    assert.deepEqual(result.reasons, ['INVALID_EVIDENCE']);
  }
  const invalid = pipeline({ operation: 'unknown' }, f.policy, f.observation);
  assert.equal(invalid.operation, null);
  assert.equal(invalid.decisionId, null);
});
test('set permutations preserve deterministic identity and ordered unique fixed reasons', () => {
  const f = evidenceFixture();
  f.request.changedPaths = ['scripts/b.ts', 'tests/a.ts'];
  const secondCheck = { ...f.observation.checks[0], name: 'typecheck' };
  f.request.context.evidence.checks.push(secondCheck);
  f.observation.checks.push({ ...secondCheck });
  f.policy.requiredCheckProducers.push({
    name: 'typecheck',
    producerIdentity: 'trusted/ci',
  });
  f.observation.requiredChecks.push({
    name: 'typecheck',
    producerIdentity: 'trusted/ci',
  });
  const first = pipeline(f.request, f.policy, f.observation);
  const reversed = pipeline(
    {
      ...f.request,
      changedPaths: [...f.request.changedPaths].reverse(),
      context: {
        ...f.request.context,
        evidence: {
          ...f.request.context.evidence,
          checks: [...f.request.context.evidence.checks].reverse(),
        },
      },
    },
    {
      ...f.policy,
      allowedFormatPaths: [...f.policy.allowedFormatPaths].reverse(),
      requiredCheckProducers: [...f.policy.requiredCheckProducers].reverse(),
    },
    {
      ...f.observation,
      checks: [...f.observation.checks].reverse(),
      requiredChecks: [...f.observation.requiredChecks].reverse(),
    },
  );
  assert.deepEqual(reversed, first);
  const failing = {
    ...f.request,
    formattingOnly: false,
    reproducible: false,
    context: { ...f.request.context, prOpen: false, sameRepository: false },
  };
  const result = pipeline(failing, f.policy, f.observation);
  assert.deepEqual(result.reasons, [
    'FORK_REJECTED',
    'PR_NOT_OPEN',
    'FORMAT_NOT_REPRODUCIBLE',
    'NOT_FORMATTING_ONLY',
  ]);
  assert.equal(new Set(result.reasons).size, result.reasons.length);
});
test('deep-frozen input remains unchanged and metadata cannot enter IDs or reasons', () => {
  const f = evidenceFixture();
  freezeData(f);
  const before = JSON.stringify(f);
  const first = pipeline(f.request, f.policy, f.observation);
  const second = pipeline(f.request, f.policy, f.observation);
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(f), before);
  const annotated = pipeline(
    { ...f.request, prBody: 'hostile secret text' },
    f.policy,
    f.observation,
  );
  assert.deepEqual(annotated, first);
  assert.ok(!JSON.stringify(annotated).includes('hostile secret text'));
});
test('caller boundary invokes fake executor zero times for every reject and no-op fixture', () => {
  const f = evidenceFixture();
  let calls = 0;
  const executor = () => {
    calls++;
  };
  const attempt = (request: unknown, observation: unknown) => {
    const result = pipeline(request, f.policy, observation);
    if (result.outcome === 'allow') executor();
    assert.notEqual(result.outcome, 'allow');
  };
  for (const request of [
    null,
    { ...f.request, context: { ...f.request.context, sameRepository: false } },
    { ...f.request, formattingOnly: false },
    { ...f.request, reproducible: false },
    { ...f.request, changedPaths: ['runtime/core.ts'] },
    { ...f.request, emptyDiff: true },
    {
      ...f.request,
      changedPaths: [],
      proposedDiffDigest: digest(''),
      reproducedDiffDigest: digest(''),
      emptyDiff: true,
    },
    { ...f.request, operation: 'dependency-merge' },
  ])
    attempt(request, f.observation);
  attempt(f.request, { ...f.observation, runAttempt: 2 });
  assert.equal(calls, 0);
});
test('valid allow requests exactly one fake operation with expected head', () => {
  const f = evidenceFixture();
  const calls: { operation: string; expectedHead: string }[] = [];
  const executor = (operation: string, expectedHead: string) => {
    calls.push({ operation, expectedHead });
  };
  const result = pipeline(f.request, f.policy, f.observation);
  assert.equal(result.outcome, 'allow');
  if (result.outcome === 'allow' && result.headSha && result.operation)
    executor(result.operation, result.headSha);
  assert.deepEqual(calls, [
    { operation: 'format-push', expectedHead: f.request.context.headSha },
  ]);
  // This fixture verifies only consumer gating, not U3's atomic API/write behavior.
});
