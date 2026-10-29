import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  InputMessage,
  RunRequest,
  WorkerHandlers,
} from '../../runtime/contracts.js';
import { createLifecycle, MAX_INPUT_CHUNK } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import { SessionState } from '../../runtime/state.js';
import { validateRun } from '../../runtime/validation.js';
import { inputChannel } from '../../runtime/worker-execution.js';
import { elfHeader, fileEntry } from './fixtures.js';

interface InputWorker {
  request: RunRequest;
  handlers: WorkerHandlers;
  sent: InputMessage[];
}

/** A Session whose fake Worker records the input messages it is sent. */
function fixture() {
  const workers: InputWorker[] = [];
  const delays: number[] = [];
  const session = createLifecycle(
    new SessionState({ entries: [fileEntry()] }),
    {
      sessionId: 'input-session',
      clock: () => 0,
      timers: {
        setTimeout: ((callback: () => void, ms?: number) => {
          delays.push(ms ?? 0);
          return setTimeout(callback, ms);
        }) as typeof setTimeout,
        clearTimeout,
      },
      spawn(request, handlers) {
        const worker: InputWorker = { request, handlers, sent: [] };
        workers.push(worker);
        return {
          send(message) {
            worker.sent.push(message);
          },
          terminate() {},
        };
      },
    },
  );
  const done = (worker: InputWorker) =>
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
      snapshot: worker.request.entries,
    });
  return { session, workers, delays, done };
}
/** A stream the test feeds by hand, which records its cancellation. */
function source() {
  let controller!: ReadableStreamDefaultController<unknown>;
  const state = { cancelled: false };
  const stream = new ReadableStream<unknown>({
    start(value) {
      controller = value;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return {
    stream: stream as ReadableStream<Uint8Array>,
    controller,
    state,
  };
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const sentBytes = (worker: InputWorker): (number[] | 'end')[] =>
  worker.sent.map((message) =>
    message.type === 'input' ? [...message.bytes] : 'end',
  );

test('stdin is sent to the Worker in order, split at 64 KiB, then input-end', async (t) => {
  const { session, workers, done } = fixture();
  t.after(() => session.dispose());
  const input = source();
  const running = session.run({ guest: elfHeader(), stdin: input.stream });
  await turn();
  const [worker] = workers;
  assert.ok(worker);
  assert.equal(worker.request.interactive, true);
  input.controller.enqueue(Uint8Array.of(1, 2));
  input.controller.enqueue(new Uint8Array());
  const large = new Uint8Array(MAX_INPUT_CHUNK + 3).fill(7);
  input.controller.enqueue(large);
  input.controller.close();
  await turn();
  const sizes = worker.sent.map((message) =>
    message.type === 'input' ? message.bytes.length : 'end',
  );
  assert.deepEqual(sizes, [2, MAX_INPUT_CHUNK, 3, 'end']);
  for (const message of worker.sent) {
    assert.equal(message.runId, worker.request.runId);
    assert.equal(message.generation, worker.request.generation);
  }
  // The sent bytes are copies: changing the source afterwards changes nothing.
  large.fill(0);
  assert.equal(worker.sent[1]?.type === 'input' && worker.sent[1].bytes[0], 7);
  done(worker);
  assert.equal((await running).exitCode, 0);
});
test('an errored stdin ends the input like a closed one', async (t) => {
  const { session, workers, done } = fixture();
  t.after(() => session.dispose());
  const input = source();
  const running = session.run({ guest: elfHeader(), stdin: input.stream });
  await turn();
  input.controller.enqueue(Uint8Array.of(9));
  input.controller.error(new Error('keyboard went away'));
  await turn();
  assert.deepEqual(sentBytes(workers[0]!), [[9], 'end']);
  done(workers[0]!);
  assert.equal((await running).exitCode, 0);
});
test('a chunk that is not a Uint8Array ends the run with INVALID_INPUT and keeps state', async (t) => {
  const { session, workers } = fixture();
  t.after(() => session.dispose());
  const input = source();
  const running = session.run({ guest: elfHeader(), stdin: input.stream });
  await turn();
  input.controller.enqueue('text');
  await assert.rejects(running, { code: 'INVALID_INPUT' });
  assert.deepEqual(sentBytes(workers[0]!), []);
  assert.equal(input.state.cancelled, true);
  assert.equal((await session.readFile('/work/input'))[0], 1);
});
test('the run cancels stdin when it settles, and nothing is sent afterwards', async (t) => {
  const { session, workers, done } = fixture();
  t.after(() => session.dispose());
  const input = source();
  const running = session.run({ guest: elfHeader(), stdin: input.stream });
  await turn();
  done(workers[0]!);
  await running;
  await turn();
  assert.equal(input.state.cancelled, true);
  assert.deepEqual(sentBytes(workers[0]!), []);
  // A stream given to a run that cannot start is cancelled too.
  const failed = source();
  const controller = new AbortController();
  const aborted = session.run({
    guest: elfHeader(),
    stdin: failed.stream,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(aborted, { code: 'ABORTED' });
  await turn();
  assert.equal(failed.state.cancelled, true);
});
test('stdin lifts the default timeout, and an explicit timeoutMs still applies', async (t) => {
  const { session, workers, delays, done } = fixture();
  t.after(() => session.dispose());
  // The 1000 ms timers are the cleanup watchdogs, not run deadlines.
  const deadlines = () => delays.filter((ms) => ms !== 1000);
  const first = session.run({ guest: elfHeader(), stdin: source().stream });
  await turn();
  assert.deepEqual(deadlines(), []);
  done(workers[0]!);
  await first;
  const second = session.run({
    guest: elfHeader(),
    stdin: source().stream,
    timeoutMs: 5000,
  });
  await turn();
  assert.deepEqual(deadlines(), [5000]);
  done(workers[1]!);
  await second;
  const plain = session.run({ guest: elfHeader() });
  await turn();
  assert.deepEqual(deadlines(), [5000, 600_000]);
  assert.equal(workers[2]?.request.interactive, undefined);
  done(workers[2]!);
  await plain;
});
test('terminal is copied into the request and validated', async (t) => {
  const { session, workers, done } = fixture();
  t.after(() => session.dispose());
  const terminal = { columns: 80, rows: 24 };
  const running = session.run({ guest: elfHeader(), terminal });
  terminal.columns = 1;
  await turn();
  assert.deepEqual(workers[0]?.request.terminal, { columns: 80, rows: 24 });
  done(workers[0]!);
  await running;
  for (const value of [
    null,
    { columns: 0, rows: 24 },
    { columns: 80, rows: 65536 },
    { columns: 80.5, rows: 24 },
    { columns: '80', rows: 24 },
    { columns: 80 },
  ])
    assert.throws(
      () =>
        validateRun(
          {
            guest: elfHeader(),
            terminal: value as unknown as { columns: number; rows: number },
          },
          '/root',
        ),
      { code: 'INVALID_INPUT' },
      JSON.stringify(value),
    );
  assert.deepEqual(
    validateRun(
      { guest: elfHeader(), terminal: { columns: 65535, rows: 1 } },
      '/root',
    ).terminal,
    { columns: 65535, rows: 1 },
  );
});
test('network is copied into the request and validated', async (t) => {
  const { session, workers, done } = fixture();
  t.after(() => session.dispose());
  const allow = ['github.com:443'];
  const running = session.run({ guest: elfHeader(), network: { allow } });
  allow.push('example.com');
  await turn();
  assert.deepEqual(workers[0]?.request.network, { allow: ['github.com:443'] });
  done(workers[0]!);
  await running;
  const plain = session.run({ guest: elfHeader() });
  await turn();
  assert.equal(workers[1]?.request.network, undefined);
  done(workers[1]!);
  await plain;
  for (const value of [
    null,
    [],
    { allow: 'github.com' },
    { allow: [443] },
    { allow: [''] },
    { allow: ['github.com:65536'] },
    { allow: ['github.com:443/path'] },
    { allow: ['https://github.com'] },
    { allow: ['[::1]:99999'] },
    // Entries the core refuses: empty labels, port 0, an IPv4 address in brackets.
    { allow: ['...'] },
    { allow: ['a..b'] },
    { allow: ['.github.com'] },
    { allow: ['*.'] },
    { allow: ['github.com:0'] },
    { allow: ['[::1]:0'] },
    { allow: ['[1.2.3.4]'] },
    // IPv6 forms the core refuses.
    { allow: ['dead:beef'] },
    { allow: ['[dead:beef]'] },
    { allow: [':'] },
    { allow: ['1::2::3'] },
    { allow: ['12345::1'] },
    { allow: ['1:2:3:4:5:6:7:8:9'] },
    { allow: ['::1.2.3.999'] },
    { allow: ['a'.repeat(264)] },
    { allow: Array(257).fill('github.com') },
  ])
    assert.throws(
      () =>
        validateRun(
          {
            guest: elfHeader(),
            network: value as unknown as { allow: string[] },
          },
          '/root',
        ),
      { code: 'INVALID_INPUT' },
      JSON.stringify(value)?.slice(0, 60),
    );
  const accepted = [
    'github.com',
    'github.com:443',
    '*.githubusercontent.com:443',
    '127.0.0.1:65535',
    '[::1]:8080',
    // A bare IPv6 address is one address for every port.
    '::1',
    'fe80::1:443',
    '::',
    '::ffff:1.2.3.4',
    '[::ffff:1.2.3.4]:443',
    '1:2:3:4:5:6:7:8',
    '1:2:3:4:5:6:7::',
    '-',
    'github.com.',
    'a'.repeat(263),
  ];
  assert.deepEqual(
    validateRun({ guest: elfHeader(), network: { allow: accepted } }, '/root')
      .network,
    { allow: accepted },
  );
  assert.deepEqual(
    validateRun(
      { guest: elfHeader(), network: { allow: Array(256).fill('a') } },
      '/root',
    ).network?.allow.length,
    256,
  );
});
test('stdin must be an unlocked ReadableStream, and a refused run leaves it untouched', () => {
  const locked = source();
  locked.stream.getReader();
  for (const stdin of [
    'keys',
    new Uint8Array(1),
    { getReader() {} },
    locked.stream,
  ])
    assert.throws(
      () =>
        validateRun(
          {
            guest: elfHeader(),
            stdin: stdin as unknown as ReadableStream<Uint8Array>,
          },
          '/root',
        ),
      { code: 'INVALID_INPUT' },
    );
  const untouched = source();
  assert.throws(
    () =>
      validateRun(
        { guest: elfHeader(), stdin: untouched.stream, timeoutMs: 0 },
        '/root',
      ),
    { code: 'INVALID_INPUT' },
  );
  assert.equal(untouched.stream.locked, false);
});
test('the Worker input channel takes only this run input, in order, until its end', async () => {
  const request = {
    ...identity({ sessionId: 's', runId: 'r', generation: 2 }),
  } as RunRequest;
  const { stream, receive } = inputChannel(request);
  const input = (bytes: number[], extra: object = {}) => ({
    ...identity(request),
    type: 'input',
    bytes: Uint8Array.from(bytes),
    ...extra,
  });
  assert.equal(receive(input([1])), true);
  assert.equal(receive(input([2], { generation: 1 })), false);
  assert.equal(receive(input([3], { protocolVersion: 1 })), false);
  assert.equal(
    receive({ ...identity(request), type: 'resource-ready' }),
    false,
  );
  assert.equal(receive(null), false);
  assert.equal(receive(input([4])), true);
  assert.equal(receive({ ...identity(request), type: 'input-end' }), true);
  assert.equal(receive(input([5])), true);
  const read: number[] = [];
  for await (const chunk of stream) read.push(...chunk);
  assert.deepEqual(read, [1, 4]);
  // A malformed input message ends the input instead of failing the Worker.
  const other = inputChannel(request);
  other.receive(input([6]));
  other.receive({ ...identity(request), type: 'input', bytes: 'x' });
  const rest: number[] = [];
  for await (const chunk of other.stream) rest.push(...chunk);
  assert.deepEqual(rest, [6]);
});
