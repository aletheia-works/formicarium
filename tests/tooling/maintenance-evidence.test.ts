import assert from 'node:assert/strict';
import test from 'node:test';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { adaptMaintenanceEvidence } from '../../scripts/maintenance/evidence.js';

export function evidenceFixture() {
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
function refused(
  request: unknown,
  policy: unknown,
  observation: unknown,
  code = 'INVALID_EVIDENCE',
) {
  const result = adaptMaintenanceEvidence(request, policy, observation);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.failure.reasons, [code]);
}
test('C2 adapter compares independently supplied data and constructs trusted workflow state', () => {
  const f = evidenceFixture();
  f.request.context.trustedWorkflow = false;
  const result = adaptMaintenanceEvidence(f.request, f.policy, f.observation);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.request.context.trustedWorkflow, true);
    assert.equal(f.request.context.trustedWorkflow, false);
    assert.notEqual(
      result.value.request.context.evidence,
      f.request.context.evidence,
    );
  }
});
test('C2 adapter rejects each independent identity discrepancy', () => {
  const f = evidenceFixture();
  for (const delta of [
    { repository: 'other/repo' },
    { sourceSha: 'c'.repeat(40) },
    { runId: '456' },
    { runAttempt: 2 },
    { workflowIdentity: 'other/ci' },
    { purpose: 'publication-candidate' },
    { toolchainRevision: 'other-toolchain' },
  ])
    refused(f.request, f.policy, { ...f.observation, ...delta });
});
test('C2 adapter rejects artifact changes and malformed byte containers', () => {
  const f = evidenceFixture();
  refused(f.request, f.policy, {
    ...f.observation,
    artifactBytes: new TextEncoder().encode('changed'),
  });
  refused(f.request, f.policy, { ...f.observation, artifactBytes: [1, 2] });
  refused(
    {
      ...f.request,
      context: {
        ...f.request.context,
        evidence: {
          ...f.request.context.evidence,
          artifactDigest: 'c'.repeat(64),
        },
      },
    },
    f.policy,
    f.observation,
  );
});
test('C2 adapter rejects forged producers, missing and duplicate checks', () => {
  const f = evidenceFixture();
  const forged = [
    { ...f.observation.checks[0], producerIdentity: 'attacker/ci' },
  ];
  refused(f.request, f.policy, { ...f.observation, checks: forged });
  refused(
    {
      ...f.request,
      context: {
        ...f.request.context,
        evidence: { ...f.request.context.evidence, checks: forged },
      },
    },
    f.policy,
    f.observation,
  );
  refused(f.request, f.policy, { ...f.observation, checks: [] });
  refused(f.request, f.policy, {
    ...f.observation,
    checks: [...f.observation.checks, ...f.observation.checks],
  });
});
test('C2 adapter rejects every non-success state and stale check source/run', () => {
  const f = evidenceFixture();
  for (const state of ['failure', 'pending', 'skipped', 'cancelled']) {
    const checks = [{ ...f.observation.checks[0], state }];
    refused(f.request, f.policy, { ...f.observation, checks });
    refused(
      {
        ...f.request,
        context: {
          ...f.request.context,
          evidence: { ...f.request.context.evidence, checks },
        },
      },
      f.policy,
      f.observation,
    );
  }
  for (const delta of [{ sourceSha: 'c'.repeat(40) }, { runId: '456' }])
    refused(f.request, f.policy, {
      ...f.observation,
      checks: [{ ...f.observation.checks[0], ...delta }],
    });
});
test('C2 adapter cannot shrink trusted required check inventory', () => {
  const f = evidenceFixture();
  refused(f.request, f.policy, { ...f.observation, requiredChecks: [] });
  refused(
    f.request,
    {
      ...f.policy,
      requiredCheckProducers: [
        ...f.policy.requiredCheckProducers,
        { name: 'typecheck', producerIdentity: 'trusted/ci' },
      ],
    },
    f.observation,
  );
  refused(f.request, f.policy, {
    ...f.observation,
    requiredChecks: [{ name: 'lint', producerIdentity: 'attacker/ci' }],
  });
});
test('raw and hostile observation failure never supplies a C3 request', () => {
  const f = evidenceFixture();
  refused(null, f.policy, f.observation, 'INVALID_INPUT');
  let calls = 0;
  const hostile = { ...f.observation };
  Object.defineProperty(hostile, 'artifactBytes', {
    enumerable: true,
    get() {
      calls++;
      throw Error('secret');
    },
  });
  refused(f.request, f.policy, hostile);
  assert.equal(calls, 0);
  const result = adaptMaintenanceEvidence(f.request, f.policy, null);
  assert.equal(result.ok, false);
  assert.equal('value' in result, false);
  if (!result.ok) assert.equal(result.failure.decisionId, null);
});
