import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateVersion,
  dispatchedCandidateContext,
  releaseCandidateContext,
  selectedCandidateVersion,
  taggedCandidateContext,
  validateReleaseCandidateContext,
} from '../../scripts/ci/release-candidate.js';
import type { InputManifest } from '../../scripts/ci/verification.js';

const sha = 'a'.repeat(40);
const event = {
  number: 22,
  pull_request: {
    head: { sha },
    base: { repo: { full_name: 'aletheia-works/formicarium' } },
  },
};

test('candidate uses the observed PR head instead of GitHub merge SHA', () => {
  assert.deepEqual(releaseCandidateContext(event), {
    repository: 'aletheia-works/formicarium',
    commit: sha,
    event: 'pull_request',
    ref: 'refs/pull/22/merge',
  });
});
for (const input of [
  {},
  { ...event, number: 0 },
  {
    ...event,
    pull_request: { ...event.pull_request, head: { sha: 'merge-ref' } },
  },
  {
    ...event,
    pull_request: {
      ...event.pull_request,
      base: { repo: { full_name: 'another/repo' } },
    },
  },
])
  test(`candidate rejects invalid event ${JSON.stringify(input)}`, () =>
    assert.throws(
      () => releaseCandidateContext(input),
      /observed pull request/,
    ));

test('stable and RC versions are read from package.json without a frozen baseline', () => {
  for (const version of ['0.1.0', '0.2.0', '1.0.0', '0.2.0-rc.1'])
    assert.equal(candidateVersion(version), version);
  for (const version of [
    'latest',
    'v0.2.0',
    '00.2.0',
    '0.2.0\n',
    '0.2.0-rc.0',
    '../package',
    undefined,
  ])
    assert.throws(() => candidateVersion(version), /version invalid/);
});

test('candidate execution rejects stale source, repository, event and ref', () => {
  const expected = releaseCandidateContext(event);
  const manifest = { sourceCommit: sha } as InputManifest;
  assert.equal(
    validateReleaseCandidateContext(manifest, expected, expected).commit,
    sha,
  );
  for (const difference of [
    { commit: 'b'.repeat(40) },
    { repository: 'another/repo' },
    { event: 'pull_request_target' },
    { ref: 'refs/heads/main' },
  ])
    assert.throws(
      () =>
        validateReleaseCandidateContext(
          manifest,
          { ...expected, ...difference },
          expected,
        ),
      /execution differs/,
    );
  assert.throws(
    () =>
      validateReleaseCandidateContext(
        { ...manifest, sourceCommit: 'b'.repeat(40) },
        expected,
        expected,
      ),
    /execution differs/,
  );
});

test('required CI passes each needed job and refuses a skipped needed or a run unneeded job', async () => {
  const { readFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const { parse } = await import('yaml');
  const workflow = parse(await readFile('.github/workflows/ci.yml', 'utf8'));
  const command = workflow.jobs['ci-required'].steps.at(-1).run as string;
  const base = {
    ...process.env,
    CHANGES_RESULT: 'success',
    QUALITY_NEEDED: 'true',
    QUALITY_RESULT: 'success',
    PRODUCT_NEEDED: 'true',
    PRODUCT_RESULT: 'success',
    COMMIT_RESULT: 'success',
    CANDIDATE_REQUIRED: 'true',
    CANDIDATE_RESULT: 'success',
  };
  const run = (changes: Record<string, string>) =>
    spawnSync('bash', ['-euo', 'pipefail', '-c', command], {
      env: { ...base, ...changes },
    }).status;
  assert.equal(run({}), 0);
  assert.equal(
    run({ CANDIDATE_REQUIRED: 'false', CANDIDATE_RESULT: 'skipped' }),
    0,
  );
  // A documentation-only pull request: nothing but the commit checks runs.
  assert.equal(
    run({
      QUALITY_NEEDED: 'false',
      QUALITY_RESULT: 'skipped',
      PRODUCT_NEEDED: 'false',
      PRODUCT_RESULT: 'skipped',
      CANDIDATE_REQUIRED: 'false',
      CANDIDATE_RESULT: 'skipped',
    }),
    0,
  );
  for (const result of ['failure', 'cancelled', 'skipped', ''])
    for (const name of ['QUALITY', 'PRODUCT', 'CANDIDATE'])
      assert.notEqual(run({ [`${name}_RESULT`]: result }), 0);
  assert.notEqual(run({ QUALITY_NEEDED: 'false' }), 0);
  assert.notEqual(run({ PRODUCT_NEEDED: '', PRODUCT_RESULT: 'skipped' }), 0);
  assert.notEqual(run({ CHANGES_RESULT: 'failure' }), 0);
  assert.notEqual(run({ COMMIT_RESULT: 'skipped' }), 0);
  assert.notEqual(run({ CANDIDATE_REQUIRED: '' }), 0);
});

test('release candidate workflow builds the pinned core itself and exports no writer permissions', async () => {
  const { readFile } = await import('node:fs/promises');
  const { parse } = await import('yaml');
  const { CANDIDATE_PARTS, partChecks, REQUIRED_CHECKS } = await import(
    '../../scripts/ci/verification.js'
  );
  const workflow = parse(
    await readFile('.github/workflows/release-candidate.yml', 'utf8'),
  );
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  type Step = {
    name?: string;
    run?: string;
    uses?: string;
    with?: Record<string, string>;
    env?: Record<string, string>;
  };
  const { prepare, check, verify } = workflow.jobs as Record<
    string,
    { needs?: unknown; steps: Step[]; strategy?: any }
  >;
  // The core comes from the pinned npm package through this run's own build.
  assert.ok(
    prepare!.steps.every(
      (s) => !s.uses?.startsWith('actions/download-artifact@'),
    ),
  );
  for (const job of [prepare!, check!, verify!])
    assert.ok(job.steps.some((s) => s.run === 'bun scripts/ci/tasks.ts build'));
  assert.ok(
    prepare!.steps.some((s) =>
      s.run?.includes('release-candidate.ts prepare-inputs'),
    ),
  );
  // The checking jobs take only this run's candidate and parts.
  for (const job of [check!, verify!])
    for (const step of job.steps.filter((s) =>
      s.uses?.startsWith('actions/download-artifact@'),
    ))
      assert.match(
        step.with!.name ?? step.with!.pattern ?? '',
        /-\$\{\{ inputs\.source-sha \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}$/,
      );
  assert.equal(check!.needs, 'prepare');
  assert.deepEqual(check!.strategy.matrix.part, [...CANDIDATE_PARTS]);
  // The parts together record exactly the mandatory checks.
  assert.deepEqual(
    CANDIDATE_PARTS.flatMap(partChecks).sort(),
    [...REQUIRED_CHECKS].sort(),
  );
  assert.ok(
    check!.steps.some((s) =>
      s.run?.includes('release-candidate.ts verify "$PART"'),
    ),
  );
  assert.deepEqual(verify!.needs, ['prepare', 'check']);
  assert.ok(
    verify!.steps.some((s) =>
      s.run?.includes('release-candidate.ts merge .artifacts/candidate-parts'),
    ),
  );
  for (const job of [prepare!, check!, verify!]) {
    assert.ok(
      job.steps.every((s) => !s.run?.match(/npm publish|gh release|git push/)),
    );
    assert.ok(job.steps.every((s) => !JSON.stringify(s).includes('secrets.')));
  }
});

test('main dispatch binds the actual source and rejects forks, tags and push events', () => {
  const context = {
    repository: 'aletheia-works/formicarium',
    commit: sha,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.deepEqual(dispatchedCandidateContext(context), context);
  for (const mutation of [
    { repository: 'Marukome0743/formicarium' },
    { ref: 'refs/tags/v0.2.0' },
    { event: 'push' },
    { commit: '' },
  ])
    assert.throws(
      () => dispatchedCandidateContext({ ...context, ...mutation }),
      /upstream main/,
    );
  const manifest = { sourceCommit: sha } as InputManifest;
  validateReleaseCandidateContext(manifest, context, context);
  assert.throws(
    () =>
      validateReleaseCandidateContext(
        manifest,
        { ...context, commit: 'b'.repeat(40) },
        context,
      ),
    /observed source/,
  );
});

test('RC override cannot replace the stable base or enter PR builds', () => {
  assert.equal(selectedCandidateVersion('0.2.0', '', 'pull_request'), '0.2.0');
  assert.equal(
    selectedCandidateVersion('0.2.0', '0.2.0-rc.1', 'workflow_dispatch'),
    '0.2.0-rc.1',
  );
  for (const [base, version, event] of [
    ['0.2.0', '0.3.0-rc.1', 'workflow_dispatch'],
    ['0.2.0', '0.2.0', 'workflow_dispatch'],
    ['0.2.0', '0.2.0-rc.1', 'pull_request'],
    ['0.2.0-rc.1', '0.2.0-rc.2', 'workflow_dispatch'],
  ])
    assert.throws(
      () => selectedCandidateVersion(base, version, event),
      /must match/,
    );
});

test('dispatch, tags and the release PR select candidate verification and forward only the observed source and RC input', async () => {
  const { readFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const { parse } = await import('yaml');
  const ci = parse(await readFile('.github/workflows/ci.yml', 'utf8'));
  const groups = ci.jobs.changes.steps.find((s: any) => s.id === 'groups');
  const {
    mkdtemp,
    readFile: readOutput,
    rm,
  } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'ci-changes-'));
  let count = 0;
  const outputs = async (env: Record<string, string>) => {
    const output = join(directory, `output-${++count}`);
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', groups.run], {
      env: { ...process.env, GITHUB_REF: '', ...env, GITHUB_OUTPUT: output },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return readOutput(output, 'utf8');
  };
  assert.match(
    await outputs({ EVENT_NAME: 'workflow_dispatch' }),
    /quality=true\nproduct=true\ncandidate=true/,
  );
  assert.match(
    await outputs({ EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v0.4.0' }),
    /candidate=true/,
  );
  assert.match(
    await outputs({
      EVENT_NAME: 'pull_request',
      HEAD_REF: 'release-please--branches--main--components--formicarium',
    }),
    /quality=true\nproduct=true\ncandidate=true/,
  );
  assert.match(
    await outputs({ EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main' }),
    /quality=true\nproduct=true\ncandidate=false/,
  );
  await rm(directory, { recursive: true });
  assert.equal(
    ci.on.workflow_dispatch.inputs['candidate-version'].required,
    false,
  );
  assert.equal(
    ci.jobs['release-candidate'].with['source-sha'],
    '${{ github.event.pull_request.head.sha || github.sha }}',
  );
  assert.equal(
    ci.jobs['release-candidate'].with['candidate-version'],
    "${{ github.event_name == 'workflow_dispatch' && inputs.candidate-version || '' }}",
  );
  const reusable = parse(
    await readFile('.github/workflows/release-candidate.yml', 'utf8'),
  );
  for (const job of ['prepare', 'check', 'verify'])
    assert.equal(
      reusable.jobs[job].env.CANDIDATE_VERSION,
      '${{ inputs.candidate-version }}',
    );
});

test('stable tag measurement rejects RC, mismatched version, forks and unbound source', () => {
  const context = {
    repository: 'aletheia-works/formicarium',
    commit: sha,
    event: 'push',
    ref: 'refs/tags/v0.2.1',
  };
  assert.deepEqual(taggedCandidateContext(context, '0.2.1'), context);
  for (const mutation of [
    { repository: 'Marukome0743/formicarium' },
    { event: 'workflow_dispatch' },
    { ref: 'refs/heads/main' },
    { commit: '' },
  ])
    assert.throws(
      () => taggedCandidateContext({ ...context, ...mutation }, '0.2.1'),
      /upstream stable/,
    );
  assert.throws(
    () => taggedCandidateContext(context, '0.2.0'),
    /upstream stable/,
  );
  assert.throws(
    () =>
      taggedCandidateContext(
        { ...context, ref: 'refs/tags/v0.2.1-rc.1' },
        '0.2.1-rc.1',
      ),
    /upstream stable/,
  );
});
