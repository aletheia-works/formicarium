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
  detail: unknown;
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
  tools: [],
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
test('Worker execution places each installed guest in /usr/bin and never snapshots it', async () => {
  const messages: TestMessage[] = [];
  const runs: FakeRun[] = [];
  const nano = new Uint8Array([1, 2, 3]);
  await executeWorkerRequest(
    { ...request(), tools: [{ tool: 'nano', bytes: nano }] },
    {
      post: (message) => messages.push(message as TestMessage),
      loadCore: adapter({
        run(run) {
          runs.push(run);
          return {};
        },
      }),
    },
  );
  const placed = runs[0]!.files.get('/usr/bin/nano')!;
  assert.equal(placed.mode, 0o100755);
  assert.deepEqual(placed.content, nano);
  assert.notEqual(placed.content, nano);
  assert.equal(messages[0]!.type, 'done');
  assert.ok(
    messages[0]!.snapshot.every(({ path }) => !path.startsWith('/usr')),
  );
});
test('Worker execution starts an installed guest from its /usr/bin path', async () => {
  const runs: FakeRun[] = [];
  const nano = elfHeader();
  await executeWorkerRequest(
    {
      ...request(),
      guest: nano,
      program: '/usr/bin/nano',
      args: ['-V'],
      tools: [{ tool: 'nano', bytes: nano }],
    },
    {
      post: () => {},
      loadCore: adapter({
        run(run) {
          runs.push(run);
          return {};
        },
      }),
    },
  );
  assert.equal(runs[0]!.program, '/usr/bin/nano');
  assert.deepEqual(runs[0]!.args, ['/usr/bin/nano', '-V']);
  assert.equal(runs[0]!.files.has('/guest/program'), false);
});
test('Worker execution gives the core the allowed destinations, and none without them', async () => {
  const runs: FakeRun[] = [];
  const loadCore = adapter({
    run(run) {
      runs.push(run);
      return {};
    },
  });
  const allow = ['github.com:443', '127.0.0.1:8080'];
  await executeWorkerRequest(
    { ...request(), network: { allow } },
    { post: () => {}, loadCore },
  );
  await executeWorkerRequest(request(), { post: () => {}, loadCore });
  assert.deepEqual(runs[0]!.network, { allow });
  assert.equal('network' in runs[1]!, false);
});
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
test('a core failure posts its kind and message but not the run data', async () => {
  const messages: TestMessage[] = [];
  await executeWorkerRequest(request(), {
    post: (message) => messages.push(message as TestMessage),
    loadCore: async () => {
      throw Object.assign(
        new Error('secret', {
          cause: Object.assign(new Error('Out of memory'), {
            name: 'PaludariumError',
            kind: 'host',
          }),
        }),
        { code: 'CORE_INIT' },
      );
    },
  });
  assert.equal(messages[0].code, 'CORE_INIT');
  assert.deepEqual(messages[0].detail, [
    { name: 'Error' },
    { name: 'PaludariumError', kind: 'host', message: 'Out of memory' },
  ]);
  assert.equal(JSON.stringify(messages).includes('secret'), false);
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
