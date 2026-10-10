import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const { PACKAGE_FILES, sha256 } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/package/stage-package.js')).href
)) as typeof import('../../scripts/package/stage-package.js');
const { ADOPTION_CHECKS, DIFF_CHECKS, RC_CHECKS, REGRESSION_CHECKS } =
  (await import(
    pathToFileURL(resolve(process.cwd(), 'scripts/release/decision.js')).href
  )) as typeof import('../../scripts/release/decision.js');
const { saveEvidence } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/evidence.js')).href
)) as typeof import('../../scripts/release/evidence.js');

import type {
  PublicationCandidate,
  PublicationIdentity,
  PublicationRequest,
} from '../../scripts/release/publication.js';
import type { PublicationExecutor } from '../../scripts/release/publication-cli.js';

const { approval, coverageFixture, fixture } = (await import(
  pathToFileURL(resolve(process.cwd(), 'tests/release/fixtures.js')).href
)) as typeof import('../release/fixtures.js');

const identity: PublicationIdentity = {
  repository: 'aletheia-works/formicarium',
  workflow: 'publish.yml',
  environment: 'release',
  sourceCommit: 'b'.repeat(40),
  version: '0.1.0-rc.1',
  tag: 'v0.1.0-rc.1',
  distTag: 'next',
};
async function bundle(t: TestContext, version = '0.1.0-rc.1') {
  const identity = versionIdentity(version);
  const f = await fixture(t, [...RC_CHECKS, ...REGRESSION_CHECKS], version);
  const root = f.root;
  t.after(() => rm(`${root}.empty-npmrc`, { force: true }));
  const env = {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REPOSITORY: identity.repository,
    GITHUB_REF: `refs/tags/${identity.tag}`,
    GITHUB_SHA: identity.sourceCommit,
    AIDLC_RELEASE_OPERATION: 'publish',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://fixture.invalid/oidc',
    NODE_AUTH_TOKEN: undefined,
    NPM_TOKEN: undefined,
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  const setEnvironment = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  setEnvironment(env);
  t.after(() => setEnvironment(previous));
  const core = { blinkCommit: 'c'.repeat(40), blinkSourceDirty: false };
  const files: { path: string; sha256: string }[] = [];
  for (const path of PACKAGE_FILES) {
    const manifest = {
      name: '@aletheia-works/formicarium',
      version: identity.version,
      private: false,
      type: 'module',
      exports: Object.fromEntries(
        [
          '.',
          './node',
          './browser',
          './assets/blink.mjs',
          './assets/blink.wasm',
          './assets/build-info.json',
        ].map((key) => [key, './fixture.js']),
      ),
      repository: {
        type: 'git',
        url: `git+https://github.com/${identity.repository}.git`,
      },
      publishConfig: {
        access: 'public',
        registry: 'https://registry.npmjs.org/',
      },
    };
    const bytes =
      path === 'package.json'
        ? JSON.stringify(manifest)
        : path === 'assets/build-info.json'
          ? JSON.stringify(core)
          : `fixture-only archive ${path}`;
    await mkdir(dirname(join(root, 'package', path)), { recursive: true });
    await writeFile(join(root, 'package', path), bytes);
    files.push({ path, sha256: sha256(bytes) });
  }
  const tarball = join(root, 'candidate.tgz');
  const pack = () =>
    execFileSync('tar', [
      '-czf',
      tarball,
      '-C',
      root,
      ...PACKAGE_FILES.map((path) => `package/${path}`),
    ]);
  pack();
  const digest = sha256(await readFile(tarball));
  f.c.sourceCommit = identity.sourceCommit;
  f.c.tarballSha256 = digest;
  f.c.core = {
    sourceCommit: core.blinkCommit,
    dirty: false,
    buildInfoSha256: files.find((row) => row.path === 'assets/build-info.json')!
      .sha256,
  };
  f.c.firstPartyJs = await Promise.all(
    f.c.firstPartyJs.map(async (row) => {
      const packed = files.find((file) => file.path === row.path);
      if (packed) return { path: row.path, sha256: packed.sha256 };
      const bytes = `fixture-only source ${row.path}`;
      await mkdir(dirname(join(root, 'sources', row.path)), {
        recursive: true,
      });
      await writeFile(join(root, 'sources', row.path), bytes);
      return { path: row.path, sha256: sha256(bytes) };
    }),
  );
  f.e.checks = f.e.checks.map((row) => ({
    ...row,
    candidateId: f.c.candidateId,
    tarballSha256: digest,
  }));
  const coverage = coverageFixture(f.c);
  const report = JSON.stringify(coverage.report),
    inventory = JSON.stringify(coverage.inventory);
  await writeFile(join(root, 'report.json'), report);
  await writeFile(join(root, 'inventory.json'), inventory);
  f.e.coverage = coverage.coverage;
  f.e.checks[0].artifactDigests = {
    ...f.e.checks[0].artifactDigests,
    'report.json': sha256(report),
    'inventory.json': sha256(inventory),
  };
  const entry = await saveEvidence(root, f.e);
  const observation = {
    kind: 'npm-settings-observation',
    package: '@aletheia-works/formicarium',
    repository: identity.repository,
    workflow: identity.workflow,
    environment: identity.environment,
    allowedAction: 'publish',
    observedAt: '2026-10-10T00:00:00Z',
    simulated: false,
  };
  // This is a synthetic oracle, never an actual npm setting observation.
  const observed = JSON.stringify(observation);
  await writeFile(join(root, 'publisher.json'), observed);
  const request: PublicationRequest = {
    identity: { ...identity },
    candidate: f.c,
    index: { version: 1, entries: [entry] },
    evidenceIds: [f.e.evidenceId],
    approvals: [
      {
        ...approval(f.c),
        target: 'https://registry.npmjs.org/@aletheia-works/formicarium',
      },
    ],
    publisher: {
      ...observation,
      authentication: 'oidc',
      allowedAction: 'publish',
      status: 'observed',
      observationArtifact: 'publisher.json',
      observationSha256: sha256(observed),
    },
  };
  const candidate: PublicationCandidate = {
    schemaVersion: 1,
    identity: { ...identity },
    package: '@aletheia-works/formicarium',
    originalTarballSha256: 'a'.repeat(64),
    files,
    tarball: { path: 'candidate.tgz', sha256: digest },
  };
  const save = async () => {
    await writeFile(join(root, 'request.json'), JSON.stringify(request));
    await writeFile(join(root, 'publication.json'), JSON.stringify(candidate));
  };
  await save();
  const calls: {
    executable: string;
    args: string[];
    options: Parameters<PublicationExecutor>[2];
  }[] = [];
  const executor: PublicationExecutor = (executable, args, options) => {
    calls.push({ executable, args: [...args], options });
  };
  return {
    ...f,
    request,
    candidate,
    root,
    tarball,
    pack,
    save,
    core,
    calls,
    executor,
    setEnvironment,
  };
}

const { publicationChannel } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/publication.js')).href
)) as typeof import('../../scripts/release/publication.js');
function versionIdentity(version: string): PublicationIdentity {
  return {
    ...identity,
    version,
    tag: `v${version}`,
    distTag: publicationChannel(version) === 'stable' ? 'latest' : 'next',
  };
}

const {
  readPublicationPolicy,
  verifyPublicationEvidence,
  publicationProducer,
} = (await import(
  pathToFileURL(
    resolve(process.cwd(), 'scripts/release/publication-evidence.js'),
  ).href
)) as typeof import('../../scripts/release/publication-evidence.js');

import { createHash } from 'node:crypto';
import type {
  EvidenceEnvelope,
  TrustedEvidenceObservation,
} from '../../scripts/ci/quality-evidence.js';

const hash = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
async function evidenceFixture(t: TestContext) {
  const f = await bundle(t);
  const tracked = await readPublicationPolicy(process.cwd());
  // IDs are independently fixed fake API identities, not claims of external configuration.
  const policy = { ...tracked, workflowId: 11, producerAppId: 22 };
  const producerIdentity = publicationProducer(policy);
  const bytes = new TextEncoder().encode(
    'API-observed candidate artifact bytes',
  );
  const report = JSON.parse(
    await readFile(join(f.root, 'report.json'), 'utf8'),
  );
  const coverage = f.e.coverage!;
  const counts = {
    inventoryDigest: coverage.inventorySha256,
    receiptsDigest: hash(JSON.stringify(report.freshReceipts)),
    totalLines: coverage.files.reduce((sum, file) => sum + file.totalLines, 0),
    coveredLines: coverage.files.reduce(
      (sum, file) => sum + file.coveredLines,
      0,
    ),
  };
  const checks = policy.requiredChecks.map((name) => ({
    name,
    sourceSha: identity.sourceCommit,
    state: 'success' as const,
    runId: '123',
    producerIdentity,
  }));
  const envelope: EvidenceEnvelope = {
    schemaVersion: 1,
    repository: policy.repository,
    sourceSha: identity.sourceCommit,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: policy.workflowIdentity,
    purpose: 'publication-candidate',
    toolchainRevision: policy.toolchainRevision,
    checks,
    artifactDigest: hash(bytes),
    coverage: counts,
  };
  const observation: TrustedEvidenceObservation = {
    repository: policy.repository,
    sourceSha: identity.sourceCommit,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: policy.workflowIdentity,
    purpose: 'publication-candidate',
    toolchainRevision: policy.toolchainRevision,
    checks: structuredClone(checks),
    artifactBytes: bytes,
    requiredChecks: policy.requiredChecks.map((name) => ({
      name,
      producerIdentity,
    })),
    coverage: structuredClone(counts),
  };
  return { ...f, tracked, policy, envelope, observation };
}
test('actual tracked policy supplies successful candidate checks while unset external IDs fail closed', async (t) => {
  const f = await evidenceFixture(t);
  assert.throws(() => publicationProducer(f.tracked), /incomplete/);
  assert.equal(
    (
      await verifyPublicationEvidence(
        f.root,
        f.request,
        f.envelope,
        f.observation,
        f.policy,
      )
    ).decision.allowed,
    true,
  );
  assert.equal(f.calls.length, 0);
});
test('ordinary CI cannot substitute for publication candidate evidence', async (t) => {
  const f = await evidenceFixture(t);
  f.envelope.purpose = 'ordinary-ci';
  f.observation.purpose = 'ordinary-ci';
  await assert.rejects(
    verifyPublicationEvidence(
      f.root,
      f.request,
      f.envelope,
      f.observation,
      f.policy,
    ),
    /purpose/,
  );
});
test('empty missing duplicate and unsuccessful check inventories refuse', async (t) => {
  for (const mode of [
    'policy-empty',
    'missing',
    'duplicate',
    'failed',
    'skip',
    'pending',
    'cancelled',
  ])
    await t.test(mode, async () => {
      const f = await evidenceFixture(t);
      if (mode === 'policy-empty') f.policy.requiredChecks = [];
      else if (mode === 'missing') f.envelope.checks = [];
      else if (mode === 'duplicate')
        f.envelope.checks.push({ ...f.envelope.checks[0]! });
      else
        f.envelope.checks[0]!.state =
          mode === 'failed'
            ? 'failure'
            : mode === 'skip'
              ? 'skipped'
              : (mode as 'pending' | 'cancelled');
      await assert.rejects(
        verifyPublicationEvidence(
          f.root,
          f.request,
          f.envelope,
          f.observation,
          f.policy,
        ),
      );
      assert.equal(f.calls.length, 0);
    });
});
test('independent fake producer and stale run attempt reject matching submitted declarations', async (t) => {
  for (const mode of ['producer', 'attempt', 'source', 'workflow'])
    await t.test(mode, async () => {
      const f = await evidenceFixture(t);
      if (mode === 'producer') {
        f.envelope.checks[0]!.producerIdentity = 'forged';
        f.observation.checks[0]!.producerIdentity = 'forged';
      } else if (mode === 'attempt') f.observation.runAttempt = 2;
      else if (mode === 'source') f.observation.sourceSha = 'd'.repeat(40);
      else f.observation.workflowIdentity = '.github/workflows/ci.yml';
      await assert.rejects(
        verifyPublicationEvidence(
          f.root,
          f.request,
          f.envelope,
          f.observation,
          f.policy,
        ),
      );
    });
});
test('actual artifact bytes digest mutation is refused', async (t) => {
  const f = await evidenceFixture(t);
  f.observation.artifactBytes = new TextEncoder().encode('modified bytes');
  await assert.rejects(
    verifyPublicationEvidence(
      f.root,
      f.request,
      f.envelope,
      f.observation,
      f.policy,
    ),
    /digest/,
  );
});
test('coverage below eighty percent or zero denominator refuses before publication', async (t) => {
  for (const coverage of [
    { coveredLines: 79, totalLines: 100 },
    { coveredLines: 0, totalLines: 0 },
  ]) {
    const f = await evidenceFixture(t);
    Object.assign(f.envelope.coverage!, coverage);
    Object.assign(f.observation.coverage!, coverage);
    await assert.rejects(
      verifyPublicationEvidence(
        f.root,
        f.request,
        f.envelope,
        f.observation,
        f.policy,
      ),
      /coverage/,
    );
    assert.equal(f.calls.length, 0);
  }
});
test('fixed inventory or realm receipts cannot be discarded or replaced', async (t) => {
  for (const field of ['inventoryDigest', 'receiptsDigest'] as const) {
    const f = await evidenceFixture(t);
    f.envelope.coverage![field] = 'f'.repeat(64);
    f.observation.coverage![field] = 'f'.repeat(64);
    await assert.rejects(
      verifyPublicationEvidence(
        f.root,
        f.request,
        f.envelope,
        f.observation,
        f.policy,
      ),
      /inventory\/realm/,
    );
    assert.equal(f.calls.length, 0);
  }
});
