import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { verifyRunnerBundle } from '../../scripts/maintenance/bundle.js';
import { GitHubApi } from '../../scripts/maintenance/github.js';
import {
  labelPullRequest,
  labelsForPaths,
} from '../../scripts/maintenance/metadata.js';
import { validateAcquisitionPolicy } from '../../scripts/maintenance/receipt.js';
import { executeCommand } from '../../scripts/maintenance/reproduce.js';
import { loadConfig } from '../../scripts/maintenance/runner.js';

const root = process.cwd();
const read = (path: string) => readFile(resolve(root, path), 'utf8');
async function bunPath(): Promise<string> {
  if (process.env.BUN_EXECUTABLE) return process.env.BUN_EXECUTABLE;
  for (const location of [
    join(homedir(), '.local/share/mise/installs/bun'),
    join(homedir(), 'AppData/Local/mise/installs/bun'),
  ]) {
    let versions: string[] = [];
    try {
      versions = await readdir(location);
    } catch {
      continue;
    }
    for (const version of versions)
      for (const path of [
        join(location, version, 'bin/bun'),
        join(location, version, 'bun'),
      ]) {
        try {
          await access(path);
          if (
            Buffer.from(
              await executeCommand({
                executable: path,
                args: ['--version'],
                cwd: root,
                env: { PATH: process.env.PATH ?? '' },
              }),
            )
              .toString()
              .trim() === '1.4.2'
          )
            return path;
        } catch {
          /* Try another installed executable; never use a shim. */
        }
      }
  }
  throw Error('fixed Bun1.4.2 unavailable');
}
test('registered policy loads while disabled or incomplete identities refuse writing', async (t) => {
  await t.test(
    'tracked acquisition policy is valid after only external IDs are supplied',
    async () => {
      const actual = JSON.parse(
        await read('.github/maintenance/policy.json'),
      ).acquisition;
      actual.workflowId = 11;
      actual.producerAppId = 22;
      actual.updateActorId = 33;
      assert.doesNotThrow(() => validateAcquisitionPolicy(actual));
    },
  );
  const tracked = await loadConfig(root);
  assert.equal(tracked.preparationWorkflowId, 380872201);
  assert.equal(tracked.preparationProducerAppId, 15368);
  const temporary = await mkdtemp(join(tmpdir(), 'maintenance-policy-'));
  try {
    await mkdir(join(temporary, '.github/maintenance'), { recursive: true });
    const policy = JSON.parse(await read('.github/maintenance/policy.json'));
    policy.writerEnabled = false;
    await writeFile(
      join(temporary, '.github/maintenance/policy.json'),
      JSON.stringify(policy),
    );
    await assert.rejects(loadConfig(temporary), /WRITER_DISABLED/);
    policy.writerEnabled = true;
    policy.preparationWorkflowId = null;
    await writeFile(
      join(temporary, '.github/maintenance/policy.json'),
      JSON.stringify(policy),
    );
    await assert.rejects(loadConfig(temporary), /INVALID_POLICY/);
    assert.deepEqual(
      policy.policy.requiredCheckProducers.map(
        (row: { name: string }) => row.name,
      ),
      ['quality', 'commit-format', 'ci-required'],
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
test('Dependabot keeps Bun updates independent and groups manual Actions updates', async () => {
  const config = JSON.parse(await read('.github/dependabot.yml'));
  assert.equal(config.version, 2);
  assert.deepEqual(
    config.updates.map(
      (update: { 'package-ecosystem': string }) => update['package-ecosystem'],
    ),
    ['bun', 'github-actions'],
  );
  const [bun, actions] = config.updates;
  assert.equal(bun.directory, '/');
  assert.equal(bun.groups, undefined);
  for (const update of config.updates) {
    assert.equal(update.schedule.interval, 'weekly');
    assert.equal(update.schedule.day, 'monday');
    assert.equal(update.schedule.timezone, 'Asia/Tokyo');
    assert.equal(update['commit-message'].prefix, 'chore(deps)');
  }
  assert.deepEqual(actions.groups['github-actions'].patterns, ['*']);
});
test('managed labels match path segments and deduplicate without prefix confusion', async () => {
  const rules = JSON.parse(
    await read('.github/maintenance/label-rules.json'),
  ).rules;
  assert.deepEqual(
    labelsForPaths(
      ['tests/a.ts', 'tests/b.ts', '.github/workflows/ci.yml', 'package.json'],
      rules,
    ),
    ['ci', 'dependencies', 'tests'],
  );
  assert.deepEqual(
    labelsForPaths(['teststuff/a.ts', 'package.json.backup'], rules),
    [],
  );
  assert.throws(() => labelsForPaths(['../tests/a.ts'], rules));
  assert.throws(
    () =>
      labelsForPaths(
        Array.from({ length: 501 }, () => 'tests/a.ts'),
        rules,
      ),
    /METADATA_LIMIT/,
  );
});
test('fork metadata and hostile titles stay data while labels are the sole write', async () => {
  const writes: unknown[] = [];
  const api = new GitHubApi('read-label-token', async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)));
      return new Response('[]');
    }
    if (path.endsWith('/files'))
      return Response.json([{ filename: 'tests/a.ts' }]);
    return Response.json({
      state: 'open',
      title: '$(steal-secret)',
      head: { repo: { fork: true } },
    });
  });
  assert.deepEqual(
    await labelPullRequest(api, 'owner/repo', 7, [
      { label: 'tests', paths: ['tests'] },
    ]),
    { status: 'success', labels: ['tests'] },
  );
  assert.deepEqual(writes, [{ labels: ['tests'] }]);
  const closed = new GitHubApi('token', async () =>
    Response.json({ state: 'closed' }),
  );
  assert.deepEqual(await labelPullRequest(closed, 'owner/repo', 7, []), {
    status: 'no-op',
    labels: [],
  });
});
test('privileged workflow reads a fixed trusted base and never installs in either writer', async (t) => {
  const workflow = await read('.github/workflows/maintenance.yml');
  await t.test(
    'existing repository credential is available only to trusted parent API steps',
    () => {
      const prepare = workflow
        .split('  prepare:\n')[1]
        ?.split('\n  format-write:\n')[0];
      assert.ok(prepare);
      assert.ok(
        prepare.indexOf('MAINTENANCE_TOKEN:') >
          prepare.indexOf('bun install --frozen-lockfile --ignore-scripts'),
      );
      assert.match(prepare, /ref: \$\{\{ github.sha \}\}/);
      assert.match(prepare, /persist-credentials: false/);
      assert.match(
        prepare,
        /MAINTENANCE_TOKEN: \$\{\{ secrets.TF_TOKEN_GITHUB \}\}/,
      );
      assert.doesNotMatch(
        workflow,
        /create-github-app-token|PRIVATE_KEY|APP_CLIENT_ID/,
      );
    },
  );
  assert.match(workflow, /workflow_run:/);
  assert.doesNotMatch(workflow, /id-token:|pull_request_target:/);
  for (const name of ['format-write', 'dependency-merge']) {
    const section = workflow
      .split(`  ${name}:\n`)[1]
      ?.split(/\n {2}[a-z][a-z-]+:\n/)[0];
    assert.ok(section);
    assert.match(section, /timeout-minutes: 10/);
    assert.match(section, /ref: \$\{\{ needs.prepare.outputs.base \}\}/);
    assert.match(
      section,
      /group: maintenance-\$\{\{ github.repository \}\}-\$\{\{ needs.prepare.outputs.pr \}\}/,
    );
    assert.match(
      section,
      /MAINTENANCE_TOKEN: \$\{\{ secrets.TF_TOKEN_GITHUB \}\}/,
    );
    assert.match(section, /persist-credentials: false/);
    assert.doesNotMatch(
      section,
      /bun install|setup-bun|npm |git push|head_ref/,
    );
  }
  const labels = await read('.github/workflows/pr-labels.yml');
  assert.match(labels, /pull_request_target:/);
  assert.match(labels, /github.event.pull_request.base.sha/);
  assert.doesNotMatch(
    labels,
    /pull_request.head.sha|npm |bun install|id-token:/,
  );
  for (const source of [workflow, labels])
    for (const reference of source.matchAll(/uses: ([^\s]+)/g))
      assert.match(reference[1] ?? '', /@[a-f0-9]{40}$/);
});
test('tracked Node bundle reproduces exactly with the fixed Bun toolchain', async () => {
  await verifyRunnerBundle(root, await bunPath());
  await assert.rejects(verifyRunnerBundle(root, 'bun'), /UNTRUSTED_EXECUTABLE/);
});
test('bundle mismatch is rejected without modifying tracked source or bundle', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'maintenance-bundle-tamper-'));
  try {
    await cp(resolve(root, 'scripts'), join(temporary, 'scripts'), {
      recursive: true,
    });
    await cp(resolve(root, 'biome.json'), join(temporary, 'biome.json'));
    await mkdir(join(temporary, '.github/maintenance'), { recursive: true });
    await writeFile(
      join(temporary, '.github/maintenance/runner.mjs'),
      'tampered',
    );
    await assert.rejects(
      verifyRunnerBundle(
        temporary,
        await bunPath(),
        resolve(root, 'node_modules/@biomejs/biome/bin/biome'),
      ),
      /BUNDLE_MISMATCH/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
test('Node starts the tracked bundle without dependency installation and refuses unknown operation', () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, '.github/maintenance/runner.mjs')],
    { cwd: tmpdir(), env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /INVALID_OPERATION/);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
});
