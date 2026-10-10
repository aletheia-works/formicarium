import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitRange,
  validateCommitSubject,
} from '../../scripts/ci/commit-format.js';
import {
  digest,
  type EvidenceEnvelope,
  requireSuccessfulJobs,
  type TrustedEvidenceObservation,
  validateEvidence,
} from '../../scripts/ci/quality-evidence.js';

function fixture() {
  const sourceSha = 'a'.repeat(40);
  const checks = ['quality', 'commit-format', 'ci-required'].map((name) => ({
    name,
    sourceSha,
    state: 'success' as const,
    runId: '42',
    producerIdentity: `ci.yml:${name}`,
  }));
  const bytes = Buffer.from('independently downloaded artifact');
  const evidence: EvidenceEnvelope = {
    schemaVersion: 1,
    repository: 'aletheia-works/formicarium',
    sourceSha,
    runId: '42',
    runAttempt: 1,
    workflowIdentity: '.github/workflows/ci.yml',
    purpose: 'ordinary-ci',
    checks,
    artifactDigest: digest(bytes),
    toolchainRevision: 'bun1.4.2-node24.21.0-lockdigest',
  };
  const observed: TrustedEvidenceObservation = {
    ...structuredClone(evidence),
    artifactBytes: bytes,
    requiredChecks: checks.map(({ name, producerIdentity }) => ({
      name,
      producerIdentity,
    })),
  };
  return { evidence, observed };
}
test('all independently bound check evidence is accepted', () => {
  const { evidence, observed } = fixture();
  assert.equal(validateEvidence(evidence, observed), evidence);
  requireSuccessfulJobs({ quality: 'success', 'commit-format': 'success' }, [
    'quality',
    'commit-format',
  ]);
});
test('same-name check by a fake producer is rejected on either side', () => {
  for (const target of ['evidence', 'observed'] as const) {
    const data = fixture();
    data[target].checks[0].producerIdentity = 'attacker';
    assert.throws(
      () => validateEvidence(data.evidence, data.observed),
      /untrusted/,
    );
  }
});
test('missing duplicate and empty check inventories fail closed', () => {
  const missing = fixture();
  missing.evidence.checks.pop();
  assert.throws(
    () => validateEvidence(missing.evidence, missing.observed),
    /inventory/,
  );
  const duplicate = fixture();
  duplicate.evidence.checks[1] = duplicate.evidence.checks[0];
  assert.throws(
    () => validateEvidence(duplicate.evidence, duplicate.observed),
    /duplicate/,
  );
  const empty = fixture();
  empty.observed.requiredChecks = [];
  assert.throws(
    () => validateEvidence(empty.evidence, empty.observed),
    /empty/,
  );
  const blank = fixture();
  blank.observed.requiredChecks[0].name = '';
  blank.observed.requiredChecks[0].producerIdentity = '';
  blank.observed.checks[0].name = blank.evidence.checks[0].name = '';
  blank.observed.checks[0].producerIdentity =
    blank.evidence.checks[0].producerIdentity = '';
  assert.throws(
    () => validateEvidence(blank.evidence, blank.observed),
    /invalid required/,
  );
  const malformed = fixture();
  Reflect.deleteProperty(malformed.evidence, 'checks');
  assert.throws(
    () => validateEvidence(malformed.evidence, malformed.observed),
    /missing or duplicate/,
  );
});
test('stale source run attempt workflow and toolchain cannot reuse evidence', () => {
  for (const key of [
    'sourceSha',
    'runId',
    'workflowIdentity',
    'toolchainRevision',
  ] as const) {
    const { evidence, observed } = fixture();
    observed[key] = key === 'sourceSha' ? 'b'.repeat(40) : 'different';
    assert.throws(
      () => validateEvidence(evidence, observed),
      /identity differs/,
    );
  }
  const { evidence, observed } = fixture();
  observed.runAttempt = 2;
  assert.throws(() => validateEvidence(evidence, observed), /runAttempt/);
});
test('modified artifact and absent or insufficient candidate coverage are rejected', () => {
  const data = fixture();
  data.observed.artifactBytes = Buffer.from('tampered');
  assert.throws(() => validateEvidence(data.evidence, data.observed), /digest/);
  const { evidence, observed } = fixture();
  evidence.purpose = observed.purpose = 'publication-candidate';
  assert.throws(() => validateEvidence(evidence, observed), /coverage missing/);
  evidence.coverage = observed.coverage = {
    inventoryDigest: 'c'.repeat(64),
    receiptsDigest: 'd'.repeat(64),
    coveredLines: 79,
    totalLines: 100,
  };
  assert.throws(() => validateEvidence(evidence, observed), /80%/);
  evidence.coverage.coveredLines = 80;
  assert.doesNotThrow(() => validateEvidence(evidence, observed));
});
test('skip pending failure cancellation and missing job results are non-success', () => {
  for (const state of ['skipped', 'pending', 'failure', 'cancelled'] as const) {
    const { evidence, observed } = fixture();
    evidence.checks[0].state = state;
    assert.throws(() => validateEvidence(evidence, observed), /unsuccessful/);
    assert.throws(
      () => requireSuccessfulJobs({ quality: state }, ['quality']),
      /unsuccessful/,
    );
  }
  assert.throws(() => requireSuccessfulJobs({}, ['quality']), /unsuccessful/);
});
test('trusted Conventional Commit validation accepts syntax and rejects malformed subjects', () => {
  for (const subject of [
    'feat: add CI',
    'fix(worker)!: retain Node flags',
    'chore(deps): update types',
  ])
    assert.doesNotThrow(() => validateCommitSubject(subject));
  for (const subject of [
    'fix:',
    'anything goes',
    'feat: \nscript',
    'unknown: subject',
  ])
    assert.throws(() => validateCommitSubject(subject), /Conventional/);
  assert.equal(
    commitRange('0'.repeat(40), 'a'.repeat(40)),
    `${'a'.repeat(40)}^!`,
  );
  assert.throws(() => commitRange('main; injected', 'a'.repeat(40)), /SHA/);
});
