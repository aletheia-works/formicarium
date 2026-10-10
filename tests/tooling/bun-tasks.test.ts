import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  runTask,
  TASKS,
  TOOLCHAIN,
  taskArguments,
} from '../../scripts/ci/tasks.js';

function executeTask(task: string, status: number | null = 0) {
  const calls: { executable: string; args: readonly string[] }[] = [];
  const code = runTask({
    task,
    nodeVersion: TOOLCHAIN.node,
    execute(executable, args) {
      calls.push({ executable, args });
      return args[0] === '--version'
        ? { status: 0, stdout: `${TOOLCHAIN.bun}\n` }
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
test('developer entry rejects either non-pinned runtime before executing work', () => {
  assert.throws(
    () =>
      runTask({
        task: 'build',
        nodeVersion: '26.0.0',
        execute: () => ({ status: 0 }),
      }),
    /Node 24.21.0/,
  );
  assert.throws(
    () =>
      runTask({
        task: 'build',
        nodeVersion: TOOLCHAIN.node,
        execute: () => ({ status: 0, stdout: '1.4.1' }),
      }),
    /Bun 1.4.2/,
  );
});
test('task failures and interrupted tasks propagate nonzero results', () => {
  assert.equal(executeTask('lint', 17).code, 17);
  assert.equal(executeTask('build', null).code, 1);
  assert.equal(
    runTask({
      task: 'build',
      nodeVersion: TOOLCHAIN.node,
      execute: (_executable, args) =>
        args[0] === '--version'
          ? { status: 0, stdout: TOOLCHAIN.bun }
          : { status: 0, signal: 'SIGTERM' },
    }),
    1,
  );
});
test('Node consumer and worker execution remain explicit Node scripts', async () => {
  const manifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  assert.match(
    manifest.scripts['test:unit'],
    /^node --test --test-concurrency=1/,
  );
  assert.match(
    manifest.scripts['test:integration'],
    /node --test --test-concurrency=1/,
  );
  assert.match(manifest.scripts.build, /node \.build\/scripts\/emit\.js$/);
  assert.equal(manifest.engines.node, '>=24');
});
test('all C1 logical task names have developer commands and unknown tasks fail', () => {
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
    args: ['run', 'build'],
  });
});
test('dependency install scripts are disabled rather than trusting Bun defaults', async () => {
  const manifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  assert.deepEqual(manifest.trustedDependencies, []);
  assert.equal(manifest.packageManager, 'bun@1.4.2');
  assert.ok(taskArguments('install-frozen').includes('--ignore-scripts'));
});
