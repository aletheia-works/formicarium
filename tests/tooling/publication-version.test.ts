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

const { gatePublication, publicationCli } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/publication-cli.js'))
    .href
)) as typeof import('../../scripts/release/publication-cli.js');
const { approval, check, coverageFixture, fixture } = (await import(
  pathToFileURL(resolve(process.cwd(), 'tests/release/fixtures.js')).href
)) as typeof import('../release/fixtures.js');
const { publicationBoundaryFixture } = (await import(
  pathToFileURL(
    resolve(process.cwd(), 'tests/release/publication-boundary-fixture.js'),
  ).href
)) as typeof import('../release/publication-boundary-fixture.js');

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
  const boundary = await publicationBoundaryFixture(root, request);
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
    boundary,
    setEnvironment,
  };
}

async function stableBundle(t: TestContext) {
  const f = await bundle(t, '1.2.3-rc.2'),
    rc = structuredClone(f.c);
  const rcEvidence = {
    schemaVersion: 1 as const,
    evidenceId: 'fixture-published-rc',
    candidate: rc,
    checks: ADOPTION_CHECKS.map((id) => check(id, rc)),
    coverage: null,
  };
  const rcEntry = await saveEvidence(f.root, rcEvidence);
  const stableIdentity: PublicationIdentity = {
    ...identity,
    version: '1.2.3',
    tag: 'v1.2.3',
    distTag: 'latest',
  };
  const manifestPath = join(f.root, 'package', 'package.json'),
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = stableIdentity.version;
  const manifestBytes = JSON.stringify(manifest);
  await writeFile(manifestPath, manifestBytes);
  f.candidate.files.find((row) => row.path === 'package.json')!.sha256 =
    sha256(manifestBytes);
  f.pack();
  f.candidate.tarball!.sha256 = sha256(await readFile(f.tarball));
  f.candidate.identity = stableIdentity;
  const c = {
    ...structuredClone(rc),
    candidateId: 'fixture-stable-candidate',
    version: '1.2.3',
    tarballSha256: f.candidate.tarball!.sha256,
  };
  const e = structuredClone(f.e);
  e.evidenceId = 'fixture-stable-evidence';
  e.candidate = c;
  e.checks = [...RC_CHECKS, ...REGRESSION_CHECKS, ...DIFF_CHECKS].map((id) =>
    check(id, c),
  );
  const coverage = coverageFixture(c),
    inventoryBytes = JSON.stringify(coverage.inventory),
    reportBytes = JSON.stringify(coverage.report);
  await writeFile(join(f.root, 'inventory.json'), inventoryBytes);
  await writeFile(join(f.root, 'report.json'), reportBytes);
  e.coverage = coverage.coverage;
  e.checks[0].artifactDigests = {
    ...e.checks[0].artifactDigests,
    'inventory.json': sha256(inventoryBytes),
    'report.json': sha256(reportBytes),
  };
  const diff = JSON.stringify({
    rcCandidateId: rc.candidateId,
    rcTarballSha256: rc.tarballSha256,
    stableCandidateId: c.candidateId,
    stableTarballSha256: c.tarballSha256,
    changed: ['package.json'],
    unchanged: PACKAGE_FILES.filter((path) => path !== 'package.json'),
  });
  await writeFile(join(f.root, 'stable.diff.json'), diff);
  const diffCheck = e.checks.find((row) => row.checkId === 'stable-diff')!;
  diffCheck.artifactDigests = {
    ...diffCheck.artifactDigests,
    'stable.diff.json': sha256(diff),
  };
  e.rcAdoption = {
    status: 'passed',
    rc: {
      evidenceId: rcEvidence.evidenceId,
      evidenceSha256: rcEntry.sha256,
      candidateId: rc.candidateId,
      version: '1.2.3-rc.2',
      tarballSha256: rc.tarballSha256,
      publishedPackage: {
        version: '1.2.3-rc.2',
        tarballSha256: rc.tarballSha256,
        registryIntegrity: 'sha512-Zml4dHVyZQ==',
      },
      requiredAcceptanceCheckIds: [...ADOPTION_CHECKS],
    },
    stable: {
      candidateId: c.candidateId,
      version: '1.2.3',
      tarballSha256: c.tarballSha256,
    },
    diff: {
      artifact: 'stable.diff.json',
      sha256: sha256(diff),
      validationCheckIds: [...DIFF_CHECKS],
    },
  };
  const entry = await saveEvidence(f.root, e);
  f.c = c;
  f.e = e;
  f.request.candidate = c;
  f.request.identity = stableIdentity;
  f.request.index = { version: 1, entries: [entry, rcEntry] };
  f.request.evidenceIds = [e.evidenceId];
  f.request.approvals = [
    {
      ...approval(c),
      operation: 'publish-stable',
      target: 'https://registry.npmjs.org/@aletheia-works/formicarium',
    },
  ];
  f.setEnvironment({ GITHUB_REF: `refs/tags/${stableIdentity.tag}` });
  await f.save();
  return f;
}

const { publicationChannel, validatePublicationIdentity } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/publication.js')).href
)) as typeof import('../../scripts/release/publication.js');
const { assertPublicationContext } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/workflow.js')).href
)) as typeof import('../../scripts/release/workflow.js');
function versionIdentity(version: string): PublicationIdentity {
  return {
    ...identity,
    version,
    tag: `v${version}`,
    distTag: publicationChannel(version) === 'stable' ? 'latest' : 'next',
  };
}
test('future stable versions use latest and exact source tag context', async (t) => {
  for (const version of ['0.0.0', '1.2.3', '12.34.56']) {
    const value = versionIdentity(version);
    assert.equal(publicationChannel(version), 'stable');
    assert.equal(validatePublicationIdentity(value).distTag, 'latest');
    assertPublicationContext(value, {
      event: 'push',
      repository: value.repository,
      ref: `refs/tags/v${version}`,
      sha: value.sourceCommit,
    });
  }
  const f = await stableBundle(t);
  assert.equal(
    (await gatePublication(f.root, f.boundary)).decision.allowed,
    true,
  );
});
test('future RC versions use next including multi-digit RC ordinals', async (t) => {
  for (const version of ['1.2.3-rc.1', '12.34.56-rc.12']) {
    assert.equal(publicationChannel(version), 'rc');
    assert.equal(
      validatePublicationIdentity(versionIdentity(version)).distTag,
      'next',
    );
  }
  const f = await bundle(t, '1.2.3-rc.12');
  assert.equal(
    (await gatePublication(f.root, f.boundary)).decision.allowed,
    true,
  );
});
test('historical RC identity and immutable approval fixtures retain their meaning', async (t) => {
  assert.deepEqual(validatePublicationIdentity(identity), identity);
  const f = await bundle(t);
  assert.equal(
    (await gatePublication(f.root, f.boundary)).decision.allowed,
    true,
  );
  assert.equal(f.calls.length, 0);
});
test('leading zeros ranges alternate prereleases metadata and malformed ordinals refuse', () => {
  for (const version of [
    '01.2.3',
    '1.02.3',
    '1.2.03',
    '1.2.3-rc.0',
    '1.2.3-rc.01',
    '1.2.3-beta.1',
    '1.2.3+build',
    '^1.2.3',
    'v1.2.3',
    '1.2',
    '1.2.3\n',
    '1.2.3-rc.-1',
  ])
    assert.throws(() => publicationChannel(version), /version/);
});
test('tag channel candidate and context must exactly match the strict version', () => {
  for (const value of [
    { ...versionIdentity('1.2.3'), tag: 'v1.2.4' },
    { ...versionIdentity('1.2.3'), distTag: 'next' as const },
    { ...versionIdentity('1.2.3-rc.2'), distTag: 'latest' as const },
    { ...versionIdentity('1.2.3'), tag: 'vv1.2.3' },
  ])
    assert.throws(() => validatePublicationIdentity(value));
  const value = versionIdentity('1.2.3');
  assert.throws(() =>
    assertPublicationContext(value, {
      event: 'push',
      repository: value.repository,
      ref: 'refs/tags/v1.2.4',
      sha: value.sourceCommit,
    }),
  );
});
test('missing or version-mismatched operation approval invokes zero publication executors', async (t) => {
  for (const missing of [true, false]) {
    const f = await bundle(t);
    if (missing) f.request.approvals = [];
    else f.request.approvals[0]!.version = '1.2.3';
    await f.save();
    await assert.rejects(
      publicationCli(['publish', f.root], f.executor, f.boundary),
      /blocked/,
    );
    assert.equal(f.calls.length, 0);
  }
});
