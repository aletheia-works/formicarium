import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(await readFile('.github/workflows/publish.yml', 'utf8'));
const TAG = 'v0.2.0';
const REPOSITORY = 'aletheia-works/formicarium';

/**
 * Run the actual YAML shell steps of a writer job on a downloaded tarball, as
 * Actions would after ci.yml exported its digest. Only npm and GitHub writes
 * are replaced, by fakes that log their arguments.
 */
async function fixtureActions(
  t: TestContext,
  { distTag = 'latest', existingRelease = false } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'formicarium-publish-yaml-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  await mkdir(bin);
  const log = join(root, 'calls.jsonl');
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
  const bytes = 'verified candidate bytes';
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
    const downloaded = join(root, `download-${mode}`);
    await mkdir(downloaded);
    await writeFile(
      join(downloaded, 'candidate.tgz'),
      changed ? 'tampered' : bytes,
    );
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CALL_LOG: log,
      EXPECTED_SHA256: createHash('sha256').update(bytes).digest('hex'),
      DIST_TAG: distTag,
      VERSION: TAG.slice(1),
      RELEASE_TAG: TAG,
      GITHUB_REPOSITORY: REPOSITORY,
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
  };
  return { calls, run };
}

test('actual YAML publishes the verified tarball under latest and refuses another dist-tag', async (t) => {
  const f = await fixtureActions(t);
  await f.run('publish');
  assert.deepEqual(await f.calls(), [
    {
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
    },
  ]);
  const next = await fixtureActions(t, { distTag: 'next' });
  await assert.rejects(
    next.run('publish'),
    /dist-tag must be latest, got next/,
  );
  assert.equal((await next.calls()).length, 0);
});

test('actual YAML rejects modified downloads before either external writer', async (t) => {
  for (const mode of ['publish', 'release'] as const) {
    const f = await fixtureActions(t);
    await assert.rejects(f.run(mode, true), /checksum|FAILED/);
    assert.equal((await f.calls()).length, 0);
  }
});

test('Release YAML creates a release on the verified tag, never a prerelease, and refuses another dist-tag', async (t) => {
  const f = await fixtureActions(t);
  await f.run('release');
  const [view, call] = await f.calls();
  assert.equal(view.args[1], 'view');
  assert.equal(call.name, 'gh');
  assert.deepEqual(call.args.slice(0, 6), [
    'release',
    'create',
    TAG,
    './candidate.tgz',
    '--repo',
    REPOSITORY,
  ]);
  assert.ok(call.args.includes('--verify-tag'));
  assert.ok(!call.args.includes('--prerelease'));
  const next = await fixtureActions(t, { distTag: 'next' });
  await assert.rejects(
    next.run('release'),
    /dist-tag must be latest, got next/,
  );
  assert.equal((await next.calls()).length, 0);
});

test('unknown npm result fails once and cannot automatically resend', async (t) => {
  const f = await fixtureActions(t);
  await assert.rejects(f.run('publish', false, 23));
  assert.equal((await f.calls()).length, 1);
});

test('existing release-please release receives the verified asset without recreating notes', async (t) => {
  const f = await fixtureActions(t, { existingRelease: true });
  await f.run('release');
  const calls = await f.calls();
  assert.deepEqual(
    calls.map((c) => c.args[1]),
    ['view', 'upload'],
  );
  assert.equal(calls[1].args[2], TAG);
  assert.ok(!calls[1].args.includes('--clobber'));
});
