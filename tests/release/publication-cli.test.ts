import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../scripts/package/stage-package.js';
import {
  gatePublication,
  preparePublicationArtifact,
  publicationCli,
} from '../../scripts/release/publication-cli.js';
import { approval } from './fixtures.js';
import { bundle, stableBundle } from './publication-alignment-fixture.js';

test('gate accepts complete fixture with exact archive source core and actual context', async (t) => {
  const f = await bundle(t),
    result = await gatePublication(f.root, f.boundary);
  assert.equal(result.decision.allowed, true);
  assert.equal(
    result.archive.tarball.sha256,
    sha256(await readFile(f.tarball)),
  );
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
test('gate independently rejects another core and a build-info digest mismatch', async (t) => {
  for (const mode of ['core', 'digest']) {
    const f = await bundle(t);
    if (mode === 'digest')
      f.request.candidate.core.buildInfoSha256 = 'e'.repeat(64);
    else {
      const bytes = JSON.stringify({
        ...f.core,
        core: 'other-core',
      });
      await writeFile(
        join(f.root, 'package', 'assets/paludarium/build-info.json'),
        bytes,
      );
      f.candidate.files.find(
        (row) => row.path === 'assets/paludarium/build-info.json',
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
test('complete RC and stable export only the verified tarball and safe workflow outputs', async (t) => {
  for (const channel of ['rc', 'stable']) {
    const f = channel === 'rc' ? await bundle(t) : await stableBundle(t);
    const output = await preparePublicationArtifact(
      f.root,
      join(f.root, 'out'),
      f.boundary,
    );
    assert.equal(output['dist-tag'], channel === 'rc' ? 'next' : 'latest');
    assert.equal(output.sha256, sha256(await readFile(f.tarball)));
    assert.equal(
      sha256(await readFile(join(f.root, 'out/candidate.tgz'))),
      output.sha256,
    );
    assert.equal(output['release-approved'], 'false');
  }
});
test('writer disabled blocks artifact export; read-only gate remains available', async (t) => {
  const f = await bundle(t),
    path = join(f.root, 'scripts/release/publication-policy.json');
  const policy = JSON.parse(await readFile(path, 'utf8'));
  policy.writerEnabled = false;
  await writeFile(path, JSON.stringify(policy));
  await assert.rejects(
    preparePublicationArtifact(f.root, join(f.root, 'out'), f.boundary),
    /writer disabled/,
  );
  assert.equal(
    (await gatePublication(f.root, f.boundary)).decision.allowed,
    true,
  );
});
test('Release approval must bind the current candidate source and version', async (t) => {
  const f = await bundle(t);
  f.request.approvals.push({
    ...approval(f.c),
    approvalId: 'fixture-release-approval',
    operation: 'create-github-release',
    target: f.request.identity.repository,
    sourceCommit: 'e'.repeat(40),
  });
  await f.save();
  const first = await preparePublicationArtifact(
    f.root,
    join(f.root, 'out1'),
    f.boundary,
  );
  assert.equal(first['release-approved'], 'false');
  f.request.approvals.at(-1)!.sourceCommit = f.request.identity.sourceCommit;
  await f.save();
  const second = await preparePublicationArtifact(
    f.root,
    join(f.root, 'out2'),
    f.boundary,
  );
  assert.equal(second['release-approved'], 'true');
});
test('removed writer commands cannot invoke external publication', async (t) => {
  const f = await bundle(t);
  for (const command of ['publish', 'release', 'prepare-assets'])
    await assert.rejects(
      publicationCli([command, f.root], f.boundary),
      /usage/,
    );
});

test('workflow outputs are emitted only after successful artifact validation', async (t) => {
  const f = await bundle(t),
    outputFile = join(f.root, 'outputs.txt');
  const previous = process.env.GITHUB_OUTPUT;
  f.setEnvironment({ GITHUB_OUTPUT: outputFile });
  t.after(() => f.setEnvironment({ GITHUB_OUTPUT: previous }));
  await writeFile(outputFile, '');
  const values = await publicationCli(
    ['prepare-artifact', f.root, join(f.root, 'out')],
    f.boundary,
  );
  assert.equal(
    await readFile(outputFile, 'utf8'),
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
  f.request.approvals = [];
  await f.save();
  const before = await readFile(outputFile);
  await assert.rejects(
    publicationCli(
      ['prepare-artifact', f.root, join(f.root, 'blocked')],
      f.boundary,
    ),
    /blocked/,
  );
  assert.deepEqual(await readFile(outputFile), before);
  await assert.rejects(
    readFile(join(f.root, 'blocked/candidate.tgz')),
    /ENOENT/,
  );
});

test('read-only preflight runs the real evidence gate but cannot export a publication artifact', async (t) => {
  const f = await stableBundle(t);
  await writeFile(
    join(f.boundary.policyRoot, 'package.json'),
    JSON.stringify({ version: f.request.identity.version }),
  );
  process.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  process.env.GITHUB_REF = 'refs/heads/main';
  const result = await publicationCli(['preflight', f.root], f.boundary);
  assert.ok('allowed' in result);
  assert.equal(result.allowed, true);
  await assert.rejects(
    preparePublicationArtifact(
      f.root,
      join(f.root, 'not-exported'),
      f.boundary,
    ),
    /untrusted publication context/,
  );
  f.request.candidate.version = '0.2.0';
  await f.save();
  await assert.rejects(publicationCli(['preflight', f.root], f.boundary));
});
