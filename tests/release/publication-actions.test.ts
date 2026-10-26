import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { parse } from 'yaml';
import { preparePublicationArtifact } from '../../scripts/release/publication-cli.js';
import { approval } from './fixtures.js';
import { bundle, stableBundle } from './publication-alignment-fixture.js';

const workflow = parse(await readFile('.github/workflows/publish.yml', 'utf8'));
// Run the actual YAML shell steps. Only npm/GitHub network writes are replaced.
async function fixtureActions(
  t: TestContext,
  stable = true,
  existingRelease = false,
) {
  const f = stable ? await stableBundle(t) : await bundle(t);
  const bin = join(f.root, 'bin');
  await mkdir(bin);
  const log = join(f.root, 'calls.jsonl');
  for (const name of ['bunx', 'gh']) {
    await writeFile(
      join(bin, name),
      `#!${process.execPath}\nconst fs = require('node:fs');\nfs.appendFileSync(process.env.CALL_LOG, JSON.stringify({name:${JSON.stringify(name)}, args:process.argv.slice(2)})+'\\n');\nif (process.argv[2] === 'release' && process.argv[3] === 'view') process.exit(Number(process.env.RELEASE_VIEW_EXIT));\nprocess.exit(Number(process.env.WRITE_EXIT ?? 0));\n`,
      { mode: 0o755 },
    );
  }
  // macOS calls the same checksum implementation through shasum; CI uses sha256sum.
  if (
    process.platform === 'darwin' ||
    spawnSync('sha256sum', ['--version']).error
  )
    await writeFile(
      join(bin, 'sha256sum'),
      '#!/bin/sh\nexec shasum -a 256 "$@"\n',
      { mode: 0o755 },
    );
  const calls = async () =>
    (await readFile(log, 'utf8').catch(() => ''))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const run = async (
    mode: 'publish' | 'release',
    changed = false,
    exit = 0,
  ) => {
    const out = join(f.root, `out-${mode}`);
    const outputs = await preparePublicationArtifact(f.root, out, f.boundary);
    if (mode === 'release' && outputs['release-approved'] !== 'true')
      return 'skipped';
    const downloaded = join(f.root, `download-${mode}`);
    await mkdir(downloaded);
    await copyFile(
      join(out, 'candidate.tgz'),
      join(downloaded, 'candidate.tgz'),
    );
    if (changed) await writeFile(join(downloaded, 'candidate.tgz'), 'tampered');
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CALL_LOG: log,
      EXPECTED_SHA256: outputs.sha256,
      DIST_TAG: outputs['dist-tag'],
      VERSION: outputs.version,
      RELEASE_TAG: outputs.tag,
      GITHUB_REPOSITORY: f.request.identity.repository,
      WRITE_EXIT: String(exit),
      RELEASE_VIEW_EXIT: existingRelease ? '0' : '1',
    };
    for (const step of workflow.jobs[mode].steps.filter(
      (s: { run?: string; id?: string }) =>
        s.run &&
        s.id !== 'registry' &&
        !s.run.includes('cp .artifacts/downloaded-candidate/'),
    )) {
      const result = spawnSync('bash', ['-c', step.run], {
        cwd: downloaded,
        env,
        encoding: 'utf8',
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, result.stderr + result.stdout);
    }
    return 'completed';
  };
  return { ...f, calls, run };
}

test('actual YAML publishes the stable tarball under latest and refuses an RC', async (t) => {
  const f = await fixtureActions(t);
  await f.run('publish');
  const calls = await f.calls();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    name: 'bunx',
    args: [
      'npm@latest',
      'publish',
      './candidate.tgz',
      '--provenance',
      '--access',
      'public',
      '--registry',
      'https://registry.npmjs.org/',
      '--tag',
      'latest',
      '--ignore-scripts',
    ],
  });
  // The stored 0.1.0 evidence still describes an RC on next; no release is.
  const rc = await fixtureActions(t, false);
  await assert.rejects(rc.run('publish'), /dist-tag must be latest, got next/);
  assert.equal((await rc.calls()).length, 0);
});
test('actual YAML rejects modified downloads before either external writer', async (t) => {
  for (const mode of ['publish', 'release'] as const) {
    const f = await fixtureActions(t);
    f.request.approvals.push({
      ...approval(f.c),
      approvalId: 'release',
      operation: 'create-github-release',
      target: f.request.identity.repository,
    });
    await f.save();
    await assert.rejects(f.run(mode, true), /checksum|FAILED/);
    assert.equal((await f.calls()).length, 0);
  }
});
test('missing candidate approval and stable adoption emit no artifact and invoke no writer', async (t) => {
  for (const stable of [false, true]) {
    const f = await fixtureActions(t, stable);
    if (stable) f.e.rcAdoption = undefined;
    else f.request.approvals = [];
    if (stable) {
      const { saveEvidence } = await import(
        '../../scripts/release/evidence.js'
      );
      f.e.evidenceId += '-without-adoption';
      f.request.evidenceIds = [f.e.evidenceId];
      f.request.index.entries[0] = await saveEvidence(f.root, f.e);
    }
    await f.save();
    await assert.rejects(f.run('publish'), /blocked|adoption/);
    assert.equal((await f.calls()).length, 0);
    await assert.rejects(
      readFile(join(f.root, 'out-publish/candidate.tgz')),
      /ENOENT/,
    );
  }
});
test('Release YAML requires its approval, refuses an RC and never marks a prerelease', async (t) => {
  for (const stable of [false, true]) {
    const f = await fixtureActions(t, stable);
    assert.equal(await f.run('release'), 'skipped');
    assert.equal((await f.calls()).length, 0);
    f.request.approvals.push({
      ...approval(f.c),
      approvalId: 'release',
      operation: 'create-github-release',
      target: f.request.identity.repository,
    });
    await f.save();
    // A fresh simulated run has a fresh artifact directory, as in Actions.
    const { rm } = await import('node:fs/promises');
    await rm(join(f.root, 'out-release'), { recursive: true });
    if (!stable) {
      await assert.rejects(
        f.run('release'),
        /dist-tag must be latest, got next/,
      );
      assert.equal((await f.calls()).length, 0);
      continue;
    }
    await f.run('release');
    const [view, call] = await f.calls();
    assert.equal(view.args[1], 'view');
    assert.equal(call.name, 'gh');
    assert.deepEqual(call.args.slice(0, 6), [
      'release',
      'create',
      f.request.identity.tag,
      './candidate.tgz',
      '--repo',
      f.request.identity.repository,
    ]);
    assert.ok(call.args.includes('--verify-tag'));
    assert.ok(!call.args.includes('--prerelease'));
  }
});
test('unknown npm result fails once and cannot automatically resend', async (t) => {
  const f = await fixtureActions(t);
  await assert.rejects(f.run('publish', false, 23));
  assert.equal((await f.calls()).length, 1);
});

test('existing release-please release receives the verified asset without recreating notes', async (t) => {
  const f = await fixtureActions(t, true, true);
  f.request.approvals.push({
    ...approval(f.c),
    approvalId: 'release',
    operation: 'create-github-release',
    target: f.request.identity.repository,
  });
  await f.save();
  await f.run('release');
  const calls = await f.calls();
  assert.deepEqual(
    calls.map((c) => c.args[1]),
    ['view', 'upload'],
  );
  assert.equal(calls[1].args[2], f.request.identity.tag);
  assert.ok(!calls[1].args.includes('--clobber'));
});
