import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { runTask, TASKS, taskArguments } from '../../scripts/ci/tasks.js';

function executeTask(task: string, status: number | null = 0) {
  const calls: { executable: string; args: readonly string[] }[] = [];
  const code = runTask({
    task,
    nodeVersion: '26.11.1',
    execute(executable, args) {
      calls.push({ executable, args });
      return args[0] === '--version'
        ? { status: 0, stdout: '1.4.3\n' }
        : { status };
    },
  });
  return { code, calls };
}

test('cacheless frozen installation keeps the lock contract', () => {
  assert.deepEqual(taskArguments('install-frozen', true), [
    'install',
    '--frozen-lockfile',
    '--ignore-scripts',
    '--no-cache',
  ]);
  assert.throws(() => taskArguments('build', true), /install only/);
});
test('frozen lock mismatch failure reaches the caller', () => {
  const result = executeTask('install-frozen', 1);
  assert.equal(result.code, 1);
  assert.ok(result.calls[1].args.includes('--frozen-lockfile'));
});
test('developer entry rejects unsupported Node and invalid Bun versions before executing work', () => {
  assert.throws(
    () =>
      runTask({
        task: 'build',
        nodeVersion: '23.0.0',
        execute: () => ({ status: 0 }),
      }),
    /Node 24 or newer/,
  );
  assert.throws(
    () =>
      runTask({
        task: 'build',
        nodeVersion: '26.11.1',
        execute: () => ({ status: 0, stdout: 'not-a-version' }),
      }),
    /Bun stable version/,
  );
});
test('task failures and interrupted tasks propagate nonzero results', () => {
  assert.equal(executeTask('lint', 17).code, 17);
  assert.equal(executeTask('build', null).code, 1);
  assert.equal(
    runTask({
      task: 'build',
      nodeVersion: '26.11.1',
      execute: (_executable, args) =>
        args[0] === '--version'
          ? { status: 0, stdout: '1.4.3' }
          : { status: 0, signal: 'SIGTERM' },
    }),
    1,
  );
});
test('Node consumer and worker execution remain explicit Node scripts', async () => {
  const manifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  assert.match(
    manifest.scripts['test:node-unit'],
    /^node --test --test-concurrency=1/,
  );
  assert.match(
    manifest.scripts['test:integration'],
    /node --test --test-concurrency=1/,
  );
  assert.match(manifest.scripts.build, /bun \.build\/scripts\/emit\.js$/);
  assert.equal(manifest.engines.node, '>=24');
});
test('all logical task names have developer commands and unknown tasks fail', () => {
  assert.deepEqual(Object.keys(TASKS), [
    'install-frozen',
    'lint',
    'typecheck',
    'build',
    'test-light',
    'test-consumer',
    'verify-candidate',
  ]);
  assert.throws(
    () => executeTask('build; echo injected'),
    /unknown developer task/,
  );
  assert.deepEqual(executeTask('build').calls[1], {
    executable: 'bun',
    args: ['run', '--bun', 'build'],
  });
});
test('dependency install scripts are disabled rather than trusting Bun defaults', async () => {
  const manifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  assert.deepEqual(manifest.trustedDependencies, []);
  assert.match(manifest.packageManager, /^bun@\d+\.\d+\.\d+$/);
  assert.ok(taskArguments('install-frozen').includes('--ignore-scripts'));
});

test('CI file-task execution and cache references point to real files', async () => {
  const workflow = await readFile(resolve('.github/workflows/ci.yml'), 'utf8');
  const paths = [...new Set(workflow.match(/mise-tasks\/[a-zA-Z0-9_./-]+/g))];
  assert.ok(paths.length >= 2);
  for (const path of paths) await access(resolve(path));
});
