import assert from 'node:assert/strict';
import test from 'node:test';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { evaluateMaintenance } from '../../scripts/maintenance/policy.js';

function fixture() {
  const head = 'a'.repeat(40),
    hash = 'b'.repeat(64);
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
  const context = {
    repository: policy.repository,
    prNumber: 1,
    headSha: head,
    currentHeadSha: head,
    sameRepository: true,
    prOpen: true,
    trustedWorkflow: true,
    evidence,
  };
  const request = {
    schemaVersion: 1 as const,
    operation: 'format-push' as const,
    context,
    changedPaths: ['scripts/example.ts'],
    proposedDiffDigest: hash,
    reproducedDiffDigest: hash,
    trustedFormatterRevision: policy.formatterRevision,
    trustedConfigDigest: hash,
    reproducible: true,
    formattingOnly: true,
    emptyDiff: false,
  };
  const dependency = {
    schemaVersion: 1 as const,
    operation: 'dependency-merge' as const,
    context,
    authenticatedUpdateBot: true,
    directUpdates: [
      {
        name: 'typescript',
        from: '1.2.3',
        to: '1.2.4',
        kind: 'patch' as const,
      },
    ],
    devDependenciesOnly: true,
    mixedOrProtectedChanges: false,
    expectedLockDigest: hash,
    reproducedLockDigest: hash,
    protectedMain: true,
    mergeable: true,
  };
  return { policy, request, dependency };
}
function reject(request: unknown, policy: unknown, code: string) {
  const result = evaluateMaintenance(request, policy);
  assert.equal(result.outcome, 'reject');
  assert.ok(result.reasons.includes(code), result.reasons.join(','));
}
test('shared context accepts valid operations and refuses every common boundary', () => {
  const f = fixture();
  for (const request of [f.request, f.dependency]) {
    assert.equal(evaluateMaintenance(request, f.policy).outcome, 'allow');
    for (const [delta, code] of [
      [{ repository: 'other/repo' }, 'REPOSITORY_MISMATCH'],
      [{ sameRepository: false }, 'FORK_REJECTED'],
      [{ prOpen: false }, 'PR_NOT_OPEN'],
      [{ currentHeadSha: 'c'.repeat(40) }, 'STALE_HEAD'],
      [{ trustedWorkflow: false }, 'UNTRUSTED_WORKFLOW'],
    ] as const)
      reject(
        { ...request, context: { ...request.context, ...delta } },
        f.policy,
        code,
      );
  }
});
test('both operations require all current successful checks including formatter lint', () => {
  const f = fixture();
  for (const request of [f.request, f.dependency]) {
    for (const delta of [
      { state: 'failure' },
      { state: 'pending' },
      { state: 'skipped' },
      { state: 'cancelled' },
      { producerIdentity: 'attacker/ci' },
      { sourceSha: 'c'.repeat(40) },
      { runId: '456' },
    ])
      reject(
        {
          ...request,
          context: {
            ...request.context,
            evidence: {
              ...request.context.evidence,
              checks: [{ ...request.context.evidence.checks[0], ...delta }],
            },
          },
        },
        f.policy,
        'CHECKS_UNSUCCESSFUL',
      );
    reject(
      {
        ...request,
        context: {
          ...request.context,
          evidence: { ...request.context.evidence, checks: [] },
        },
      },
      f.policy,
      'CHECKS_UNSUCCESSFUL',
    );
  }
});
test('format permits reproduced digest with segment-aware allowlist only', () => {
  const f = fixture();
  const result = evaluateMaintenance(f.request, f.policy);
  assert.equal(result.outcome, 'allow');
  assert.deepEqual(result.reasons, []);
  reject(
    { ...f.request, changedPaths: ['scripts-other/file.ts'] },
    f.policy,
    'PATH_NOT_ALLOWED',
  );
});
test('format no-op requires coherent empty paths and empty digest after common checks', () => {
  const f = fixture();
  const empty = {
    ...f.request,
    changedPaths: [],
    proposedDiffDigest: digest(''),
    reproducedDiffDigest: digest(''),
    emptyDiff: true,
  };
  assert.equal(evaluateMaintenance(empty, f.policy).outcome, 'no-op');
  for (const request of [
    { ...empty, changedPaths: ['scripts/a.ts'] },
    { ...empty, proposedDiffDigest: 'b'.repeat(64) },
    { ...f.request, emptyDiff: true },
    { ...f.request, changedPaths: [] },
  ])
    reject(request, f.policy, 'EMPTY_DIFF_CONTRADICTION');
  reject(
    { ...empty, context: { ...empty.context, prOpen: false } },
    f.policy,
    'PR_NOT_OPEN',
  );
});
test('format refuses altered formatter/config, non-format and unreproduced or unknown-classified changes', () => {
  const f = fixture();
  for (const [delta, code] of [
    [{ trustedFormatterRevision: 'other' }, 'FORMATTER_MISMATCH'],
    [{ trustedConfigDigest: 'c'.repeat(64) }, 'FORMATTER_MISMATCH'],
    [{ changedPaths: ['runtime/core.ts'] }, 'PATH_NOT_ALLOWED'],
    [{ reproducible: false }, 'FORMAT_NOT_REPRODUCIBLE'],
    [{ formattingOnly: false }, 'NOT_FORMATTING_ONLY'],
    [{ reproducedDiffDigest: 'c'.repeat(64) }, 'DIFF_MISMATCH'],
  ] as const)
    reject({ ...f.request, ...delta }, f.policy, code);
});
test('dependency permits one stable patch or minor and does not count transitive lock changes', () => {
  const f = fixture();
  assert.equal(evaluateMaintenance(f.dependency, f.policy).outcome, 'allow');
  const minor = {
    ...f.dependency,
    directUpdates: [
      {
        name: 'typescript',
        from: '1.2.3',
        to: '1.3.0',
        kind: 'minor' as const,
      },
    ],
  };
  assert.equal(evaluateMaintenance(minor, f.policy).outcome, 'allow');
  const reproducedTransitive = {
    ...minor,
    expectedLockDigest: 'c'.repeat(64),
    reproducedLockDigest: 'c'.repeat(64),
  };
  assert.equal(
    evaluateMaintenance(reproducedTransitive, f.policy).outcome,
    'allow',
  );
});
test('dependency refuses zero/two direct changes and unsafe versions, bot or allowlist', () => {
  const f = fixture();
  for (const directUpdates of [
    [],
    [
      ...f.dependency.directUpdates,
      { ...f.dependency.directUpdates[0], name: 'other' },
    ],
  ])
    reject({ ...f.dependency, directUpdates }, f.policy, 'DIRECT_UPDATE_COUNT');
  for (const to of [
    '1.2.3',
    '1.2.2',
    '1.1.9',
    '2.0.0',
    '1.3.0-rc.1',
    '^1.3.0',
    '',
    '01.3.0',
    '9007199254740992.0.0',
    '1.3.0+build',
  ]) {
    const request = {
      ...f.dependency,
      directUpdates: [{ ...f.dependency.directUpdates[0], to }],
    };
    reject(
      request,
      f.policy,
      to === '' ? 'INVALID_INPUT' : 'UNSAFE_DEPENDENCY_VERSION',
    );
  }
  reject(
    {
      ...f.dependency,
      directUpdates: [{ ...f.dependency.directUpdates[0], from: 'unknown' }],
    },
    f.policy,
    'UNSAFE_DEPENDENCY_VERSION',
  );
  reject(
    {
      ...f.dependency,
      directUpdates: [
        { ...f.dependency.directUpdates[0], to: '1.3.0', kind: 'patch' },
      ],
    },
    f.policy,
    'UNSAFE_DEPENDENCY_VERSION',
  );
  reject(
    { ...f.dependency, authenticatedUpdateBot: false },
    f.policy,
    'UNAUTHENTICATED_BOT',
  );
  reject(
    {
      ...f.dependency,
      directUpdates: [{ ...f.dependency.directUpdates[0], name: 'other' }],
    },
    f.policy,
    'DEPENDENCY_NOT_ALLOWED',
  );
});
test('dependency refuses lock mismatch, mixed/Action/publication changes and unprotected or unmergeable main', () => {
  const f = fixture();
  for (const [delta, code] of [
    [{ devDependenciesOnly: false }, 'NOT_DEV_DEPENDENCIES'],
    [{ mixedOrProtectedChanges: true }, 'MIXED_OR_PROTECTED_CHANGES'],
    [{ reproducedLockDigest: 'c'.repeat(64) }, 'LOCK_MISMATCH'],
    [{ protectedMain: false }, 'MAIN_NOT_PROTECTED'],
    [{ mergeable: false }, 'NOT_MERGEABLE'],
  ] as const)
    reject({ ...f.dependency, ...delta }, f.policy, code);
  for (const name of ['actions/checkout', 'publication-boundary'])
    reject(
      {
        ...f.dependency,
        directUpdates: [{ ...f.dependency.directUpdates[0], name }],
      },
      f.policy,
      'DEPENDENCY_NOT_ALLOWED',
    );
});
