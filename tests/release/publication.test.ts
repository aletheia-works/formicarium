import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { PACKAGE_FILES, sha256 } from '../../scripts/package/stage-package.js';
import {
  RC_CHECKS,
  REGRESSION_CHECKS,
} from '../../scripts/release/decision.js';
import { saveEvidence } from '../../scripts/release/evidence.js';
import type {
  PublicationIdentity,
  PublicationRequest,
} from '../../scripts/release/publication.js';
import {
  planPublication,
  preparePublication,
  validatePublication,
  validatePublicationIdentity,
} from '../../scripts/release/publication.js';
import { approval, coverageFixture, fixture } from './fixtures.js';

const identity: PublicationIdentity = {
  repository: 'aletheia-works/formicarium',
  workflow: 'publish.yml',
  environment: 'release',
  sourceCommit: 'b'.repeat(40),
  version: '0.1.0-rc.1',
  tag: 'v0.1.0-rc.1',
  distTag: 'next',
};
async function archiveFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'publication-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = {
    name: '@aletheia-works/formicarium',
    version: '0.1.0-rc.1',
    private: true,
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
  };
  const files = [];
  for (const path of PACKAGE_FILES) {
    const bytes =
      path === 'package.json'
        ? JSON.stringify(manifest)
        : `fixture-only ${path}`;
    await mkdir(dirname(join(root, 'package', path)), { recursive: true });
    await writeFile(join(root, 'package', path), bytes);
    files.push({ path, sha256: sha256(bytes) });
  }
  const oldTar = join(root, 'old.tgz'),
    oldManifest = join(root, 'old.json'),
    out = join(root, 'prepared');
  execFileSync('tar', [
    '-czf',
    oldTar,
    '-C',
    root,
    ...PACKAGE_FILES.map((p) => `package/${p}`),
  ]);
  await writeFile(
    oldManifest,
    JSON.stringify({
      blinkSourceDirty: false,
      files,
      tarball: { sha256: sha256(await readFile(oldTar)) },
    }),
  );
  const args = {
    originalManifestPath: oldManifest,
    originalTarballPath: oldTar,
    out,
    identity,
  };
  const pack = (source: string, target: string) =>
    execFileSync('tar', [
      '-czf',
      target,
      '-C',
      source,
      ...PACKAGE_FILES.map((p) => `package/${p}`),
    ]);
  return { root, oldTar, oldManifest, out, args, pack };
}
async function packPrepared(f: Awaited<ReturnType<typeof archiveFixture>>) {
  // npm pack's package/ layout without invoking npm or the network.
  const container = join(f.root, 'new-container');
  await mkdir(container);
  await symlink(f.out, join(container, 'package'));
  const archive = join(f.root, 'new.tgz');
  execFileSync('tar', [
    '-czf',
    archive,
    '-C',
    container,
    ...PACKAGE_FILES.map((p) => `package/${p}`),
  ]);
  return archive;
}
test('prepare public manifest keeps all nonmanifest bytes and original archive immutable', async (t) => {
  const f = await archiveFixture(t),
    old = await readFile(f.oldTar),
    candidate = await preparePublication(f.args),
    tarball = await packPrepared(f);
  const result = await validatePublication(candidate, identity, tarball);
  assert.equal(result.tarball.sha256, sha256(await readFile(tarball)));
  assert.deepEqual(await readFile(f.oldTar), old);
  for (const path of PACKAGE_FILES.filter((p) => p !== 'package.json'))
    assert.deepEqual(
      await readFile(join(f.out, path)),
      await readFile(join(f.root, 'package', path)),
    );
  const manifest = JSON.parse(
    await readFile(join(f.out, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.private, false);
  assert.equal(
    manifest.repository.url,
    'git+https://github.com/aletheia-works/formicarium.git',
  );
});
test('reject private or wrong repository publication manifests', async (t) => {
  for (const change of [
    { private: true },
    {
      repository: { type: 'git', url: 'git+https://github.com/other/fork.git' },
    },
  ]) {
    const f = await archiveFixture(t),
      c = await preparePublication(f.args);
    const path = join(f.out, 'package.json'),
      value = { ...JSON.parse(await readFile(path, 'utf8')), ...change },
      bytes = JSON.stringify(value);
    await writeFile(path, bytes);
    c.files.find((row) => row.path === 'package.json')!.sha256 = sha256(bytes);
    await assert.rejects(
      validatePublication(c, identity, await packPrepared(f)),
      /private|repository/,
    );
  }
});
test('reject missing repository and wrong version tag or dist-tag', () => {
  for (const change of [
    { repository: '' },
    { version: '1.0.0' },
    { tag: 'v0.1.0' },
    { distTag: 'latest' },
  ])
    assert.throws(() =>
      validatePublicationIdentity({
        ...identity,
        ...change,
      } as PublicationIdentity),
    );
});
test('reject same-size archive mutation and a different identity', async (t) => {
  const f = await archiveFixture(t),
    c = await preparePublication(f.args),
    path = join(f.out, 'LICENSE'),
    bytes = await readFile(path);
  bytes[0] ^= 1;
  await writeFile(path, bytes);
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(f)),
    /archive digest/,
  );
  await assert.rejects(
    validatePublication(
      c,
      { ...identity, sourceCommit: 'c'.repeat(40) },
      f.oldTar,
    ),
    /identity/,
  );
});
test('reject original inventory deviation and symlink archive entry', async (t) => {
  const f = await archiveFixture(t),
    original = JSON.parse(await readFile(f.oldManifest, 'utf8'));
  original.files[0].path = 'unexpected.js';
  await writeFile(f.oldManifest, JSON.stringify(original));
  await assert.rejects(preparePublication(f.args), /digest/);
  const g = await archiveFixture(t),
    c = await preparePublication(g.args);
  await rm(join(g.out, 'LICENSE'));
  await symlink('/etc/passwd', join(g.out, 'LICENSE'));
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(g)),
    /links/,
  );
});
test('reject registry/access drift and refuse existing output including symlink', async (t) => {
  const f = await archiveFixture(t),
    c = await preparePublication(f.args);
  const path = join(f.out, 'package.json'),
    value = JSON.parse(await readFile(path, 'utf8'));
  value.publishConfig.registry = 'https://example.invalid/';
  const bytes = JSON.stringify(value);
  await writeFile(path, bytes);
  c.files.find((row) => row.path === 'package.json')!.sha256 = sha256(bytes);
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(f)),
    /registry/,
  );
  await assert.rejects(preparePublication(f.args), /EEXIST/);
  await symlink(f.out, join(f.root, 'link'));
  await assert.rejects(
    preparePublication({ ...f.args, out: join(f.root, 'link') }),
    /EEXIST/,
  );
});
async function requestFixture(t: TestContext, version = '0.1.0-rc.1') {
  const f = await fixture(t, [...RC_CHECKS, ...REGRESSION_CHECKS], version);
  f.c.sourceCommit = identity.sourceCommit;
  const coverage = coverageFixture(f.c);
  await writeFile(
    join(f.root, 'inventory.json'),
    JSON.stringify(coverage.inventory),
  );
  await writeFile(join(f.root, 'report.json'), JSON.stringify(coverage.report));
  f.e.coverage = coverage.coverage;
  const first = f.e.checks[0]!;
  first.artifactDigests = {
    ...first.artifactDigests,
    'inventory.json': sha256(JSON.stringify(coverage.inventory)),
    'report.json': sha256(JSON.stringify(coverage.report)),
  };
  const entry = await saveEvidence(f.root, f.e),
    i: PublicationIdentity = {
      ...identity,
      version: version as PublicationIdentity['version'],
      tag: `v${version}`,
      distTag: version === '0.1.0' ? 'latest' : 'next',
    };
  const observation = {
    kind: 'npm-settings-observation',
    package: '@aletheia-works/formicarium',
    repository: i.repository,
    workflow: i.workflow,
    environment: i.environment,
    allowedAction: 'publish',
    observedAt: '2026-10-10T00:00:00Z',
    simulated: false,
  };
  const bytes = JSON.stringify(observation);
  await writeFile(join(f.root, 'publisher.json'), bytes);
  const a = {
    ...approval(f.c),
    target: 'https://registry.npmjs.org/@aletheia-works/formicarium',
  };
  const request: PublicationRequest = {
    identity: i,
    candidate: f.c,
    index: { version: 1, entries: [entry] },
    evidenceIds: [f.e.evidenceId],
    approvals: [a],
    publisher: {
      ...observation,
      authentication: 'oidc',
      allowedAction: 'publish',
      status: 'observed',
      observationArtifact: 'publisher.json',
      observationSha256: sha256(bytes),
    },
  };
  return { ...f, request, observation };
}
test('RC plan requires observed tuple but not previously published RC adoption', async (t) => {
  const f = await requestFixture(t);
  assert.equal((await planPublication(f.root, f.request)).allowed, true);
  assert.equal(f.e.rcAdoption, undefined);
  for (const change of [
    { status: 'unverified' },
    { repository: 'other/fork' },
    { observationSha256: 'f'.repeat(64) },
  ])
    await assert.rejects(
      planPublication(f.root, {
        ...f.request,
        publisher: { ...f.request.publisher, ...change },
      } as PublicationRequest),
      /publisher/,
    );
  const bytes = JSON.stringify({ ...f.observation, simulated: true });
  await writeFile(join(f.root, 'publisher.json'), bytes);
  await assert.rejects(
    planPublication(f.root, {
      ...f.request,
      publisher: { ...f.request.publisher, observationSha256: sha256(bytes) },
    }),
    /content/,
  );
});
test('stable without RC adoption and RC without exact operation approval stay blocked', async (t) => {
  const stable = await requestFixture(t, '0.1.0');
  assert.equal(
    (await planPublication(stable.root, stable.request)).allowed,
    false,
  );
  const rc = await requestFixture(t);
  assert.equal(
    (
      await planPublication(rc.root, {
        ...rc.request,
        approvals: [
          { ...rc.request.approvals[0], sourceCommit: 'd'.repeat(40) },
        ],
      })
    ).allowed,
    false,
  );
});
test('RC actual publication blocks missing failed or timed-out required regression', async (t) => {
  for (const mode of ['missing', 'failed', 'timeout'] as const) {
    const f = await requestFixture(t),
      e = structuredClone(f.e);
    e.evidenceId += `-${mode}`;
    const id = REGRESSION_CHECKS[0]!;
    if (mode === 'missing') e.checks = e.checks.filter((c) => c.checkId !== id);
    else {
      const row = e.checks.find((c) => c.checkId === id)!;
      row.status = 'failed';
      row.exitCode = mode === 'failed' ? 1 : null;
      row.termination = mode === 'failed' ? 'exit' : 'timeout';
    }
    const entry = await saveEvidence(f.root, e);
    const decision = await planPublication(f.root, {
      ...f.request,
      index: { version: 1, entries: [entry] },
      evidenceIds: [e.evidenceId],
    });
    assert.equal(decision.allowed, false);
    assert.ok(decision.missing.includes(`publication-check:${id}`));
  }
});
test('RC actual publication blocks absent or below-80-percent coverage', async (t) => {
  for (const mode of ['absent', 'low'] as const) {
    const f = await requestFixture(t),
      e = structuredClone(f.e);
    e.evidenceId += `-${mode}`;
    if (mode === 'absent') e.coverage = null;
    else {
      const report = JSON.parse(
        await readFile(join(f.root, 'report.json'), 'utf8'),
      );
      for (const row of e.coverage!.files) {
        row.totalLines = 10;
        row.coveredLines = 7;
      }
      for (const row of report.files) row.lines = { total: 10, covered: 7 };
      const bytes = JSON.stringify(report);
      await writeFile(join(f.root, 'report.json'), bytes);
      e.checks[0].artifactDigests = {
        ...e.checks[0].artifactDigests,
        'report.json': sha256(bytes),
      };
    }
    const entry = await saveEvidence(f.root, e);
    const decision = await planPublication(f.root, {
      ...f.request,
      index: { version: 1, entries: [entry] },
      evidenceIds: [e.evidenceId],
    });
    assert.equal(decision.allowed, false);
    assert.ok(
      decision.missing.includes('publication-coverage:fixed-80%-realms'),
    );
  }
});
