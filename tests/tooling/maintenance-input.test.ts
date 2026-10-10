import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMaintenanceInputs } from '../../scripts/maintenance/input.js';

export function fixture() {
  const head = 'a'.repeat(40);
  const digest = 'b'.repeat(64);
  const policy = {
    revision: 'policy-1',
    repository: 'owner/repo',
    allowedFormatPaths: ['scripts', 'tests'],
    allowedDevDependencies: ['typescript'],
    requiredCheckProducers: [{ name: 'lint', producerIdentity: 'trusted/ci' }],
    formatterRevision: 'biome-fixed',
    formatterConfigDigest: digest,
  };
  const evidence = {
    schemaVersion: 1 as const,
    repository: policy.repository,
    sourceSha: head,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: 'trusted/ci',
    purpose: 'ordinary-ci' as const,
    artifactDigest: digest,
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
    proposedDiffDigest: digest,
    reproducedDiffDigest: digest,
    trustedFormatterRevision: policy.formatterRevision,
    trustedConfigDigest: digest,
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
    expectedLockDigest: digest,
    reproducedLockDigest: digest,
    protectedMain: true,
    mergeable: true,
  };
  return { request, dependency, policy };
}
function rejected(request: unknown, policy: unknown, reason = 'INVALID_INPUT') {
  const result = parseMaintenanceInputs(request, policy);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.failure.reasons, [reason]);
}

test('raw inputs accept both C3 operations and produce separate snapshots', () => {
  const f = fixture();
  for (const request of [f.request, f.dependency]) {
    const result = parseMaintenanceInputs(request, f.policy);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.request.operation, request.operation);
      assert.notEqual(result.value.request, request);
    }
  }
});
test('raw inputs reject missing fields, invalid types and unknown schema/operation', () => {
  const f = fixture();
  for (const update of [
    { schemaVersion: 2 },
    { operation: 'shell' },
    { context: null },
    { reproducible: 'true' },
    { changedPaths: undefined },
    { trustedFormatterRevision: '' },
  ])
    rejected({ ...f.request, ...update }, f.policy);
  rejected(null, f.policy);
  rejected(f.request, { ...f.policy, revision: '' }, 'INVALID_POLICY');
});
test('identity boundaries reject malformed SHA, digest and run identifiers', () => {
  const f = fixture();
  for (const headSha of ['a'.repeat(39), 'A'.repeat(40), 'g'.repeat(40)])
    rejected(
      { ...f.request, context: { ...f.request.context, headSha } },
      f.policy,
    );
  for (const proposedDiffDigest of ['', 'B'.repeat(64), 'b'.repeat(63)])
    rejected({ ...f.request, proposedDiffDigest }, f.policy);
  for (const runId of ['0', '-1', '1e2', '1.5', '01', 'NaN'])
    rejected(
      {
        ...f.request,
        context: {
          ...f.request.context,
          evidence: { ...f.request.context.evidence, runId },
        },
      },
      f.policy,
    );
  for (const runAttempt of [0, -1, 1.5])
    rejected(
      {
        ...f.request,
        context: {
          ...f.request.context,
          evidence: { ...f.request.context.evidence, runAttempt },
        },
      },
      f.policy,
    );
});
test('collection limits and uniqueness preserve the direct zero/two policy boundary', () => {
  const f = fixture();
  for (const length of [499, 500])
    assert.equal(
      parseMaintenanceInputs(
        {
          ...f.request,
          changedPaths: Array.from({ length }, (_, i) => `scripts/f${i}.ts`),
        },
        f.policy,
      ).ok,
      true,
    );
  rejected(
    {
      ...f.request,
      changedPaths: Array.from({ length: 501 }, (_, i) => `scripts/f${i}.ts`),
    },
    f.policy,
  );
  rejected(
    { ...f.request, changedPaths: ['scripts/a.ts', 'scripts/a.ts'] },
    f.policy,
  );
  for (const length of [0, 2])
    assert.equal(
      parseMaintenanceInputs(
        {
          ...f.dependency,
          directUpdates: Array.from({ length }, (_, i) => ({
            ...f.dependency.directUpdates[0],
            name: `dep${i}`,
          })),
        },
        f.policy,
      ).ok,
      true,
    );
  rejected(
    {
      ...f.dependency,
      directUpdates: Array.from({ length: 3 }, (_, i) => ({
        ...f.dependency.directUpdates[0],
        name: `dep${i}`,
      })),
    },
    f.policy,
  );
  for (const length of [99, 100])
    assert.equal(
      parseMaintenanceInputs(f.request, {
        ...f.policy,
        allowedDevDependencies: Array.from({ length }, (_, i) => `dep${i}`),
      }).ok,
      true,
    );
  rejected(
    f.request,
    {
      ...f.policy,
      allowedDevDependencies: Array.from({ length: 101 }, (_, i) => `dep${i}`),
    },
    'INVALID_POLICY',
  );
  rejected(
    f.request,
    { ...f.policy, requiredCheckProducers: [] },
    'INVALID_POLICY',
  );
  rejected(
    f.request,
    {
      ...f.policy,
      requiredCheckProducers: [
        ...f.policy.requiredCheckProducers,
        ...f.policy.requiredCheckProducers,
      ],
    },
    'INVALID_POLICY',
  );
  for (const length of [99, 100]) {
    const checks = Array.from({ length }, (_, i) => ({
      ...f.request.context.evidence.checks[0],
      name: `check${i}`,
    }));
    assert.equal(
      parseMaintenanceInputs(
        {
          ...f.request,
          context: {
            ...f.request.context,
            evidence: { ...f.request.context.evidence, checks },
          },
        },
        f.policy,
      ).ok,
      true,
    );
  }
  const checks = Array.from({ length: 101 }, (_, i) => ({
    ...f.request.context.evidence.checks[0],
    name: `check${i}`,
  }));
  rejected(
    {
      ...f.request,
      context: {
        ...f.request.context,
        evidence: { ...f.request.context.evidence, checks },
      },
    },
    f.policy,
  );
});
test('paths and strings reject aliases, control text and overlong values without repair', () => {
  const f = fixture();
  for (const path of [
    '/scripts/a',
    '../a',
    'scripts/../a',
    'scripts/./a',
    'scripts//a',
    'scripts\\a',
    'C:/a',
    'scripts/a\n',
    'a'.repeat(1025),
  ])
    rejected({ ...f.request, changedPaths: [path] }, f.policy);
  assert.equal(
    parseMaintenanceInputs(
      { ...f.request, changedPaths: ['a'.repeat(1024)] },
      f.policy,
    ).ok,
    true,
  );
  for (const revision of [' ', ' x', 'x\u0000', 'x'.repeat(257)])
    rejected(f.request, { ...f.policy, revision }, 'INVALID_POLICY');
  for (const length of [213, 214])
    assert.equal(
      parseMaintenanceInputs(f.request, {
        ...f.policy,
        allowedDevDependencies: ['x'.repeat(length)],
      }).ok,
      true,
    );
  rejected(
    f.request,
    { ...f.policy, allowedDevDependencies: ['x'.repeat(215)] },
    'INVALID_POLICY',
  );
});
test('hostile getters, prototypes, cycles and sparse arrays fail closed without getter execution', () => {
  const f = fixture();
  let calls = 0;
  const getter = { ...f.request };
  Object.defineProperty(getter, 'emptyDiff', {
    enumerable: true,
    get() {
      calls++;
      throw Error('secret');
    },
  });
  rejected(getter, f.policy);
  assert.equal(calls, 0);
  rejected(
    Object.assign(Object.create({ inherited: true }), f.request),
    f.policy,
  );
  const cycle = { ...f.request, metadata: {} };
  cycle.metadata = cycle;
  rejected(cycle, f.policy);
  rejected({ ...f.request, changedPaths: new Array(1) }, f.policy);
});
test('raw failure keeps invalid metadata null and valid input immutable and normalized', () => {
  const f = fixture();
  const before = JSON.stringify(f);
  Object.freeze(f.request.changedPaths);
  Object.freeze(f.request);
  const result = parseMaintenanceInputs(f.request, f.policy);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(f), before);
  const invalid = parseMaintenanceInputs({ operation: 'unknown' }, f.policy);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.failure.operation, null);
    assert.equal(invalid.failure.repository, null);
    assert.equal(invalid.failure.headSha, null);
    assert.equal(invalid.failure.decisionId, null);
  }
});
