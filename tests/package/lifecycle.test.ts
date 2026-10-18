import type {
  RunOptions,
  RunRequest,
  WorkerHandlers,
} from '../../runtime/contracts.js';

interface TestWorker {
  request: RunRequest;
  handlers: WorkerHandlers;
  detached: number;
  terminations: number;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionError } from '../../runtime/errors.js';
import { createLifecycle } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import { SessionState } from '../../runtime/state.js';
import { elfHeader, fileEntry } from './fixtures.js';

function fixture({
  cleanup = () => Promise.resolve(),
  cleanupTimeoutMs = 1000,
  clock,
}: {
  cleanup?: (worker: TestWorker) => Promise<void>;
  cleanupTimeoutMs?: number;
  clock?: () => number;
} = {}) {
  const workers: TestWorker[] = [];
  const session = createLifecycle(
    new SessionState({ entries: [fileEntry()] }),
    {
      sessionId: 'test-session',
      clock,
      cleanupTimeoutMs,
      spawn(request, handlers) {
        const worker = { request, handlers, detached: 0, terminations: 0 };
        workers.push(worker);
        return {
          detach() {
            worker.detached++;
          },
          terminate() {
            worker.terminations++;
            return cleanup(worker);
          },
        };
      },
    },
  );
  const done = (
    worker: TestWorker,
    snapshot: unknown = worker.request.entries,
    exitCode = 0,
  ) =>
    worker.handlers.message({
      ...identity(worker.request),
      type: 'done',
      result: {
        runId: worker.request.runId,
        exitCode,
        elapsedMs: 1,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      },
      snapshot,
    });
  return { session, workers, done };
}
const request = (extra: Partial<RunOptions> = {}) => ({
  guest: elfHeader(),
  ...extra,
});
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test('normal nonzero done commits after cleanup and releases reservation before resolve', async () => {
  let release!: () => void;
  const { session, workers, done } = fixture({
    cleanup: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  });
  const result = session.run(request());
  done(
    workers[0],
    [
      { path: '/work', type: 'dir' as const, mode: 0o755 },
      fileEntry('/work/new'),
    ],
    3,
  );
  await turn();
  await assert.rejects(session.readFile('/work/input'), { code: 'BUSY' });
  release();
  assert.equal((await result).exitCode, 3);
  assert.equal((await session.readFile('/work/new'))[0], 1);
  const next = session.run(request());
  done(workers[1]);
  await turn();
  release();
  await next;
});
test('run reservation is synchronous and all public operations reject BUSY', async () => {
  const { session, workers, done } = fixture();
  const result = session.run(request());
  for (const promise of [
    session.run(request()),
    session.readFile('/work/input'),
    session.remove('/work/input'),
    session.listEntries(),
    session.setCwd('/work'),
  ])
    await assert.rejects(promise, { code: 'BUSY' });
  done(workers[0]);
  await result;
});
test('invalid input and already aborted signal never create a worker', async () => {
  const { session, workers } = fixture();
  await assert.rejects(session.run({ guest: new Uint8Array() }), {
    code: 'INVALID_INPUT',
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(session.run(request({ signal: controller.signal })), {
    code: 'ABORTED',
  });
  assert.equal(workers.length, 0);
  assert.equal((await session.readFile('/work/input'))[0], 1);
});
test('received bytes are copied and callback throw rolls back with partial streams', async () => {
  const { session, workers } = fixture();
  const result = session.run(
    request({
      onOutput(chunk) {
        chunk.bytes[0] = 0;
        throw new Error('secret');
      },
    }),
  );
  workers[0].handlers.message({
    ...identity(workers[0].request),
    type: 'output',
    chunk: {
      runId: workers[0].request.runId,
      sequence: 0,
      stream: 'stderr',
      bytes: Uint8Array.of(255),
    },
  });
  await assert.rejects(
    result,
    (error: ExecutionError) =>
      error.code === 'EXECUTION' &&
      error.stderr[0] === 255 &&
      !error.message.includes('secret'),
  );
  assert.equal((await session.readFile('/work/input'))[0], 1);
});
test('old messages and duplicate terminal notifications cannot overwrite current result', async () => {
  const { session, workers, done } = fixture();
  const first = session.run(request());
  done(workers[0]);
  await first;
  const second = session.run(request());
  workers[1].handlers.message({
    ...identity(workers[0].request),
    type: 'unknown',
  });
  done(workers[1], workers[1].request.entries, 3);
  workers[1].handlers.error(new Error('late'));
  workers[1].handlers.exit(1);
  assert.equal((await second).exitCode, 3);
  assert.equal(workers[1].terminations, 1);
});
test('current unknown message and unexpected Worker exit both rollback', async () => {
  for (const mode of ['message', 'exit', 'error'] as const) {
    const { session, workers } = fixture();
    const result = session.run(request());
    if (mode === 'message')
      workers[0].handlers.message({
        ...identity(workers[0].request),
        type: 'unknown',
      });
    else if (mode === 'exit') workers[0].handlers.exit();
    else workers[0].handlers.error(new Error('secret'));
    await assert.rejects(result, { code: 'EXECUTION' });
    assert.equal((await session.readFile('/work/input'))[0], 1);
  }
});
test('done beyond the reception deadline cannot commit and later run remains possible', async () => {
  let now = 0;
  const { session, workers, done } = fixture({ clock: () => now });
  const result = session.run(request({ timeoutMs: 20 }));
  now = 21;
  done(workers[0], []);
  await assert.rejects(result, { code: 'TIMEOUT' });
  assert.equal((await session.readFile('/work/input'))[0], 1);
  const next = session.run(request());
  done(workers[1]);
  await next;
});
test('abort during pending cleanup invalidates done candidate but permits reuse', async () => {
  let release!: () => void;
  const { session, workers, done } = fixture({
    cleanup: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  });
  const controller = new AbortController();
  const result = session.run(request({ signal: controller.signal }));
  done(workers[0], []);
  await turn();
  controller.abort();
  release();
  await assert.rejects(result, { code: 'ABORTED' });
  assert.equal((await session.readFile('/work/input'))[0], 1);
});
test('dispose during cleanup invalidates candidate and shares one cleanup promise', async () => {
  let release!: () => void;
  const { session, workers, done } = fixture({
    cleanup: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  });
  const result = session.run(request());
  const rejection = assert.rejects(result, { code: 'ABORTED' });
  done(workers[0], []);
  await turn();
  const dispose = session.dispose();
  assert.equal(session.dispose(), dispose);
  await assert.rejects(session.readFile('/work/input'), { code: 'DISPOSED' });
  release();
  await rejection;
  await dispose;
  await session.dispose();
  assert.equal(workers[0].terminations, 1);
});
test('cleanup rejection takes precedence over abort and permanently disposes session', async () => {
  const { session, workers } = fixture({
    cleanup: () => Promise.reject(new Error('secret cleanup')),
  });
  const controller = new AbortController();
  const result = session.run(request({ signal: controller.signal }));
  controller.abort();
  await assert.rejects(
    result,
    (error: ExecutionError) =>
      error.code === 'EXECUTION' &&
      (error.cause as ExecutionError).code === 'ABORTED' &&
      !JSON.stringify(error.cause).includes('secret'),
  );
  await assert.rejects(session.run(request()), { code: 'DISPOSED' });
  await session.dispose();
  assert.equal(workers[0].terminations, 1);
});
test('cleanup watchdog rejects a hung termination and disposal observes the same failure', async () => {
  const { session } = fixture({
    cleanup: () => new Promise(() => {}),
    cleanupTimeoutMs: 20,
  });
  const result = session.run(request());
  const rejected = assert.rejects(result, { code: 'EXECUTION' });
  const disposal = session.dispose();
  await assert.rejects(disposal, { code: 'EXECUTION' });
  await rejected;
  await session.dispose();
  await assert.rejects(session.reset(), { code: 'DISPOSED' });
});
test('bad snapshot rejects atomically and real short timeout settles once without unhandled rejection', async () => {
  const { session, workers, done } = fixture();
  const result = session.run(request());
  done(workers[0], [fileEntry('/outside')]);
  await assert.rejects(result, { code: 'SNAPSHOT' });
  const started = performance.now();
  const timeout = session.run(request({ timeoutMs: 20 }));
  await assert.rejects(timeout, { code: 'TIMEOUT' });
  assert.ok(performance.now() - started < 5000);
  assert.equal((await session.readFile('/work/input'))[0], 1);
  assert.equal(workers[1].terminations, 1);
});

test('removed cwd snapshot commits only after cleanup and reset restores seed modes and links', async () => {
  const original = fileEntry('/work/keep', Uint8Array.of(9), 0o640);
  const state = new SessionState({
    entries: [
      { path: '/work/project/sub', type: 'dir', mode: 0o700 },
      original,
      { ...original, path: '/work/peer' },
    ],
  });
  const workers: Pick<TestWorker, 'request' | 'handlers'>[] = [];
  let release!: () => void;
  const session = createLifecycle(state, {
    spawn(request, handlers) {
      workers.push({ request, handlers });
      return {
        terminate: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      };
    },
  });
  await session.setCwd('/work/project/sub');
  await session.remove('/work/project');
  const recreated = () => [
    ...workers.at(-1)!.request.entries,
    { path: '/work/project', type: 'dir', mode: 0o755 },
    { path: '/work/project/sub', type: 'dir', mode: 0o755 },
  ];
  const doneCurrent = () => {
    const worker = workers.at(-1)!;
    worker.handlers.message({
      ...identity(worker.request),
      type: 'done',
      result: {
        runId: worker.request.runId,
        exitCode: 0,
        elapsedMs: 1,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      },
      snapshot: recreated(),
    });
  };
  const controller = new AbortController();
  const aborted = session.run(request({ signal: controller.signal }));
  doneCurrent();
  await turn();
  controller.abort();
  release();
  await assert.rejects(aborted, { code: 'ABORTED' });
  assert.equal(
    (await session.listEntries('/work')).some(
      (entry) => entry.path === '/work/project',
    ),
    false,
  );
  const normal = session.run(request());
  doneCurrent();
  await turn();
  release();
  await normal;
  assert.equal(
    (await session.listEntries('/work/project')).find(
      (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
        entry.type === 'dir' && entry.path.endsWith('/sub'),
    )?.mode,
    0o755,
  );
  await session.reset();
  assert.equal(state.cwd, '/work');
  assert.equal(
    (await session.listEntries('/work/project')).find(
      (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
        entry.type === 'dir' && entry.path.endsWith('/sub'),
    )?.mode,
    0o700,
  );
  const entries = await session.listEntries('/work');
  assert.equal(
    entries.find(
      (entry): entry is Extract<typeof entry, { type: 'file' }> =>
        entry.type === 'file' && entry.path === '/work/keep',
    )?.inodeId,
    entries.find(
      (entry): entry is Extract<typeof entry, { type: 'file' }> =>
        entry.type === 'file' && entry.path === '/work/peer',
    )?.inodeId,
  );
  assert.deepEqual(await session.readFile('/work/peer'), Uint8Array.of(9));
  await session.dispose();
});
