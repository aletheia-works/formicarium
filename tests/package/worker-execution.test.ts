import type {
  FsEntry,
  OutputChunk,
  RunRequest,
  RunResult,
} from '../../runtime/contracts.js';

interface TestMessage {
  type: string;
  result: RunResult;
  snapshot: FsEntry[];
  chunk: OutputChunk;
  code: string;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkerRequest } from '../../runtime/worker-execution.js';
import {
  elfHeader,
  type FakeBehaviour,
  type FakeRun,
  fakeLauncher,
  fileEntry,
} from './fixtures.js';

const request = (): RunRequest => ({
  type: 'run',
  protocolVersion: 2,
  sessionId: 's',
  runId: 'r',
  generation: 1,
  assets: {
    loaderURL: 'file:///loader',
    wasmURL: 'file:///wasm',
    workerURL: 'file:///worker',
    buildInfoURL: 'file:///info',
  },
  guest: elfHeader(),
  args: [],
  env: { HOME: '/root' },
  cwd: '/work',
  home: '/root',
  entries: [fileEntry()],
  snapshotRoots: ['/work', '/root'],
});
function adapter({
  exitCode = 0,
  run = () => ({}),
  cleanup = async () => {},
}: {
  exitCode?: number;
  run?: (run: FakeRun) => FakeBehaviour;
  cleanup?: () => Promise<void>;
} = {}) {
  return async () => ({
    launcher: fakeLauncher((guest) => ({
      exit: { kind: 'exited', code: exitCode },
      ...run(guest),
    })),
    cleanup,
  });
}
test('Worker execution sends normal nonzero result and complete preRun snapshot', async () => {
  const messages: TestMessage[] = [];
  let cleaned = 0;
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: adapter({
      exitCode: 3,
      async cleanup() {
        cleaned++;
      },
    }),
  });
  assert.equal(messages[0].type, 'done');
  assert.equal(messages[0].result.exitCode, 3);
  assert.ok(messages[0].snapshot.some(({ path }) => path === '/work/input'));
  assert.equal(cleaned, 1);
});
test('output messages flush all bytes in one run-wide sequence before done', async () => {
  const messages: TestMessage[] = [];
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: adapter({
      run: () => ({
        stdout: [Uint8Array.of(255), Uint8Array.of(10, 116, 101, 120, 116, 10)],
        stderr: [Uint8Array.of(128)],
      }),
    }),
  });
  const outputs = messages.filter(({ type }) => type === 'output');
  assert.deepEqual(
    outputs.map(({ chunk }) => chunk.sequence),
    [0, 1, 2],
  );
  assert.equal(messages.at(-1)?.type, 'done');
  assert.deepEqual(messages.at(-1)?.result.stderr, Uint8Array.of(128));
  assert.deepEqual(
    messages.at(-1)?.result.stdout,
    Uint8Array.of(255, 10, 116, 101, 120, 116, 10),
  );
});
test('asset failure does not start guest and diagnostics contain no arbitrary stack', async () => {
  const messages: TestMessage[] = [];
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: async () => {
      throw Object.assign(new Error('secret'), { code: 'ASSET_LOAD' });
    },
  });
  assert.equal(messages[0].code, 'ASSET_LOAD');
  assert.equal(JSON.stringify(messages).includes('secret'), false);
});
test('core initialization failure remains CORE_INIT', async () => {
  const messages: TestMessage[] = [];
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: async () => {
      throw Object.assign(new Error('secret'), { code: 'CORE_INIT' });
    },
  });
  assert.equal(messages[0].code, 'CORE_INIT');
});
test('special-file snapshot is rejected rather than posted as done', async () => {
  const messages: TestMessage[] = [];
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: adapter({
      run: ({ files }) => {
        files.set('/work/socket', { path: '/work/socket', mode: 0o140600 });
        return {};
      },
    }),
  });
  assert.equal(messages[0].type, 'error');
  assert.equal(messages[0].code, 'SNAPSHOT');
});
test('cleanup failure rejects candidate and separate runs use independent cores', async () => {
  const messages: TestMessage[] = [];
  let starts = 0;
  const loadCore = async () => {
    starts++;
    return await adapter({
      async cleanup() {
        throw new Error('secret');
      },
    })();
  };
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore,
  });
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore,
  });
  assert.equal(starts, 2);
  assert.ok(
    messages.every(
      ({ type, code }) => type === 'error' && code === 'EXECUTION',
    ),
  );
});
