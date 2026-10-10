import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { PACKAGE_FILES, sha256 } from '../../scripts/package/stage-package.js';
import {
  ADOPTION_CHECKS,
  DIFF_CHECKS,
  RC_CHECKS,
  REGRESSION_CHECKS,
} from '../../scripts/release/decision.js';
import { saveEvidence } from '../../scripts/release/evidence.js';
import type {
  PublicationCandidate,
  PublicationIdentity,
  PublicationRequest,
} from '../../scripts/release/publication.js';
import type { PublicationExecutor } from '../../scripts/release/publication-cli.js';
import {
  gatePublication,
  publicationCli,
} from '../../scripts/release/publication-cli.js';
import { approval, check, coverageFixture, fixture } from './fixtures.js';
import { publicationBoundaryFixture } from './publication-boundary-fixture.js';

const identity: PublicationIdentity = {
  repository: 'aletheia-works/formicarium',
  workflow: 'publish.yml',
  environment: 'release',
  sourceCommit: 'b'.repeat(40),
  version: '0.1.0-rc.1',
  tag: 'v0.1.0-rc.1',
  distTag: 'next',
};
async function bundle(t: TestContext) {
  const f = await fixture(t, [...RC_CHECKS, ...REGRESSION_CHECKS]);
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
  const npmCli = join(root, 'npm/package/bin/npm-cli.js');
  await mkdir(dirname(npmCli), { recursive: true });
  await writeFile(
    join(root, 'npm/package/package.json'),
    JSON.stringify({ version: '11.19.0' }),
  );
  await writeFile(npmCli, '// passive fake executor fixture');
  const previousNpmCli = process.env.FORMICARIUM_NPM_CLI;
  setEnvironment({ FORMICARIUM_NPM_CLI: npmCli });
  t.after(() => setEnvironment({ FORMICARIUM_NPM_CLI: previousNpmCli }));
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
    npmCli,
    setEnvironment,
  };
}
async function stableBundle(t: TestContext) {
  const f = await bundle(t),
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
    version: '0.1.0',
    tag: 'v0.1.0',
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
    version: '0.1.0',
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
      version: '0.1.0-rc.1',
      tarballSha256: rc.tarballSha256,
      publishedPackage: {
        version: '0.1.0-rc.1',
        tarballSha256: rc.tarballSha256,
        registryIntegrity: 'sha512-Zml4dHVyZQ==',
      },
      requiredAcceptanceCheckIds: [...ADOPTION_CHECKS],
    },
    stable: {
      candidateId: c.candidateId,
      version: '0.1.0',
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
      target: 'https://registry.npmjs.org/@aletheia-works/formicarium',
    },
  ];
  f.setEnvironment({ GITHUB_REF: `refs/tags/${stableIdentity.tag}` });
  await f.save();
  return f;
}
test('gate accepts complete fixture with exact archive source core and actual context', async (t) => {
  const f = await bundle(t),
    result = await gatePublication(f.root, f.boundary);
  assert.equal(result.decision.allowed, true);
  assert.equal(
    result.archive.tarball.sha256,
    sha256(await readFile(f.tarball)),
  );
  assert.equal(f.calls.length, 0);
});
test('gate rejects separate request tarball and packed archive digest mutations', async (t) => {
  const f = await bundle(t);
  f.request.candidate.tarballSha256 = 'f'.repeat(64);
  await f.save();
  await assert.rejects(
    gatePublication(f.root, f.boundary),
    /request tarball differs/,
  );
  const g = await bundle(t);
  await writeFile(
    join(g.root, 'package', 'LICENSE'),
    'altered fixture license',
  );
  g.pack();
  await assert.rejects(gatePublication(g.root, g.boundary), /archive digest/);
});
test('gate rejects packed and pack-external source digest changes', async (t) => {
  const f = await bundle(t);
  f.request.candidate.firstPartyJs[0].sha256 = 'd'.repeat(64);
  await f.save();
  await assert.rejects(
    gatePublication(f.root, f.boundary),
    /first-party source/,
  );
  const g = await bundle(t),
    row = g.request.candidate.firstPartyJs.find(
      (row) => !g.candidate.files.some((file) => file.path === row.path),
    )!;
  await writeFile(join(g.root, 'sources', row.path), 'altered fixture source');
  await assert.rejects(
    gatePublication(g.root, g.boundary),
    /first-party source/,
  );
});
test('gate independently rejects core commit dirty status and build-info digest', async (t) => {
  for (const mode of ['commit', 'dirty', 'digest']) {
    const f = await bundle(t);
    if (mode === 'digest')
      f.request.candidate.core.buildInfoSha256 = 'e'.repeat(64);
    else {
      const bytes = JSON.stringify({
        ...f.core,
        ...(mode === 'dirty'
          ? { blinkSourceDirty: true }
          : { blinkCommit: 'd'.repeat(40) }),
      });
      await writeFile(join(f.root, 'package', 'assets/build-info.json'), bytes);
      f.candidate.files.find(
        (row) => row.path === 'assets/build-info.json',
      )!.sha256 = sha256(bytes);
      f.request.candidate.core.buildInfoSha256 = sha256(bytes);
      f.pack();
      f.candidate.tarball!.sha256 = sha256(await readFile(f.tarball));
      f.request.candidate.tarballSha256 = f.candidate.tarball!.sha256;
    }
    await f.save();
    await assert.rejects(
      gatePublication(f.root, f.boundary),
      /core provenance/,
    );
  }
});
test('gate rejects repository tag source and event context independently', async (t) => {
  for (const change of [
    { GITHUB_REPOSITORY: 'fork/formicarium' },
    { GITHUB_REF: 'refs/tags/v0.1.0' },
    { GITHUB_SHA: 'd'.repeat(40) },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' },
  ]) {
    const f = await bundle(t);
    f.setEnvironment(change);
    await assert.rejects(
      gatePublication(f.root, f.boundary),
      /untrusted publication context/,
    );
  }
});
test('publish uses fake executor zero times for failed gate approval or OIDC', async (t) => {
  for (const mode of ['digest', 'approval', 'oidc']) {
    const f = await bundle(t);
    if (mode === 'digest') {
      f.request.candidate.tarballSha256 = 'f'.repeat(64);
      await f.save();
    }
    if (mode === 'approval') {
      f.request.approvals = [];
      await f.save();
    }
    if (mode === 'oidc')
      f.setEnvironment({ ACTIONS_ID_TOKEN_REQUEST_URL: undefined });
    await assert.rejects(
      publicationCli(['publish', f.root], f.executor, f.boundary),
      mode === 'oidc' ? /OIDC/ : mode === 'approval' ? /blocked/ : /tarball/,
    );
    assert.equal(f.calls.length, 0);
  }
});
test('publish captures same tarball next public registry provenance isolated config and clean env', async (t) => {
  for (const channel of ['rc', 'stable']) {
    const f = channel === 'rc' ? await bundle(t) : await stableBundle(t),
      old = {
        npm_config__authToken: process.env.npm_config__authToken,
        npm_config_registry: process.env.npm_config_registry,
      };
    f.setEnvironment({
      npm_config__authToken: 'fixture-never-real',
      npm_config_registry: 'https://fixture.invalid/',
    });
    t.after(() => f.setEnvironment(old));
    await publicationCli(['publish', f.root], f.executor, f.boundary);
    assert.equal(f.calls.length, 1);
    const call = f.calls[0];
    assert.equal(call.executable, process.execPath);
    assert.deepEqual(call.args, [
      f.npmCli,
      'publish',
      f.tarball,
      '--access',
      'public',
      '--registry',
      'https://registry.npmjs.org/',
      '--tag',
      channel === 'rc' ? 'next' : 'latest',
      '--ignore-scripts',
    ]);
    assert.equal(call.options.cwd, f.root);
    assert.equal(call.options.env!.NPM_CONFIG_PROVENANCE, 'true');
    assert.equal(call.options.env!.NPM_CONFIG_GLOBALCONFIG, '/dev/null');
    assert.equal(
      await readFile(call.options.env!.NPM_CONFIG_USERCONFIG!, 'utf8'),
      '',
    );
    assert.equal(call.options.env!.npm_config__authToken, undefined);
    assert.equal(call.options.env!.npm_config_registry, undefined);
  }
});
test('release uses fake executor only after independent approval and captures tag repo source asset', async (t) => {
  const f = await bundle(t);
  f.setEnvironment({ AIDLC_RELEASE_OPERATION: 'release' });
  await assert.rejects(
    publicationCli(['release', f.root], f.executor, f.boundary),
    /Release approval/,
  );
  assert.equal(f.calls.length, 0);
  f.request.approvals.push({
    ...approval(f.c),
    approvalId: 'fixture-release-approval',
    operation: 'create-github-release',
    target: identity.repository,
    sourceCommit: 'e'.repeat(40),
  });
  await f.save();
  await assert.rejects(
    publicationCli(['release', f.root], f.executor, f.boundary),
    /Release approval/,
  );
  assert.equal(f.calls.length, 0);
  f.request.approvals.at(-1)!.sourceCommit = identity.sourceCommit;
  await f.save();
  await publicationCli(['release', f.root], f.executor, f.boundary);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].executable, 'gh');
  assert.deepEqual(f.calls[0].args.slice(0, 7), [
    'release',
    'create',
    identity.tag,
    f.tarball,
    '--repo',
    identity.repository,
    '--verify-tag',
  ]);
  assert.ok(f.calls[0].args.includes('--prerelease'));
  assert.ok(
    f.calls[0].args.includes(
      `Reviewed package SHA256: ${f.candidate.tarball!.sha256}`,
    ),
  );
});
