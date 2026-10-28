import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detailCause,
  failureDetail,
  identity,
  inspectMessage,
  joinBytes,
  workerErrorMessage,
} from '../../runtime/protocol.js';

const run = { sessionId: 's', runId: 'r', generation: 1, sequence: 0 };
const streams = () => ({ stdout: [], stderr: [] });
const output = () => ({
  ...identity(run),
  type: 'output',
  chunk: {
    runId: 'r',
    sequence: 0,
    stream: 'stdout',
    bytes: Uint8Array.of(255),
  },
});
test('protocol binds version/session/run/generation and ignores previous runs', () => {
  assert.deepEqual(identity(run), {
    protocolVersion: 2,
    sessionId: 's',
    runId: 'r',
    generation: 1,
  });
  for (const field of ['sessionId', 'runId', 'generation'])
    assert.equal(
      inspectMessage({ ...output(), [field]: 'stale' }, run, streams()),
      null,
    );
});
test('output validation copies bytes and enforces stream and sequence', () => {
  const message = output();
  const parsed = inspectMessage(message, run, streams());
  assert.ok(parsed?.type === 'output');
  message.chunk.bytes[0] = 0;
  assert.equal(parsed.chunk.bytes[0], 255);
  for (const extra of [
    { sequence: 1 },
    { stream: 'mixed' },
    { runId: 'old' },
    { bytes: [1] },
  ])
    assert.throws(
      () =>
        inspectMessage(
          { ...output(), chunk: { ...output().chunk, ...extra } },
          run,
          streams(),
        ),
      { code: 'EXECUTION' },
    );
});
test('current invalid major, unknown type and malformed message are rejected', () => {
  for (const message of [
    null,
    { ...identity(run), type: 'other' },
    { ...output(), protocolVersion: 1 },
  ])
    assert.throws(() => inspectMessage(message, run, streams()), {
      code: 'EXECUTION',
    });
});
test('done requires flushed stream aggregate equality and complete snapshot', () => {
  const message = {
    ...identity(run),
    type: 'done',
    result: {
      runId: 'r',
      exitCode: 3,
      elapsedMs: 1,
      stdout: Uint8Array.of(255),
      stderr: new Uint8Array(),
    },
    snapshot: [],
  };
  const received = { stdout: [Uint8Array.of(255)], stderr: [] };
  const parsed = inspectMessage(message, run, received);
  assert.ok(parsed?.type === 'done');
  assert.equal(parsed.result.exitCode, 3);
  assert.throws(() => inspectMessage(message, run, streams()), {
    code: 'EXECUTION',
  });
  assert.throws(
    () => inspectMessage({ ...message, snapshot: undefined }, run, received),
    { code: 'SNAPSHOT' },
  );
  for (const result of [
    { ...message.result, exitCode: -1 },
    { ...message.result, elapsedMs: NaN },
    { ...message.result, runId: 'old' },
  ])
    assert.throws(() => inspectMessage({ ...message, result }, run, received), {
      code: 'EXECUTION',
    });
});
test('Worker errors discard arbitrary diagnostics and unknown code is rejected', () => {
  const message = workerErrorMessage(run, 'CORE_INIT', streams());
  message.message = 'secret';
  assert.deepEqual(inspectMessage(message, run, streams()), {
    type: 'error',
    code: 'CORE_INIT',
    detail: [],
  });
  assert.equal(workerErrorMessage(run, 'secret', streams()).code, 'EXECUTION');
  assert.throws(
    () => inspectMessage({ ...message, code: 'other' }, run, streams()),
    { code: 'EXECUTION' },
  );
});
test('stream joins preserve all nonUTF8 bytes and do not alias inputs', () => {
  const input = Uint8Array.of(0, 255);
  const result = joinBytes([input, Uint8Array.of(128)]);
  input[0] = 9;
  assert.deepEqual(result, Uint8Array.of(0, 255, 128));
  assert.deepEqual(joinBytes([]), new Uint8Array());
});

test('failure detail keeps names, and messages only of engine and core errors', () => {
  const core = Object.assign(new Error('RuntimeError: unreachable\nat x'), {
    name: 'PaludariumError',
    kind: 'internal',
  });
  const error = new Error('secret path /work/token', {
    cause: Object.assign(new Error('secret env value', { cause: core }), {
      name: 'GuestRunError',
    }),
  });
  assert.deepEqual(failureDetail(error), [
    { name: 'Error' },
    { name: 'GuestRunError' },
    {
      name: 'PaludariumError',
      kind: 'internal',
      message: 'RuntimeError: unreachable at x',
    },
  ]);
  const trap = new WebAssembly.RuntimeError('unreachable');
  assert.deepEqual(failureDetail(trap), [
    { name: 'RuntimeError', message: 'unreachable' },
  ]);
  assert.deepEqual(
    failureDetail(new RangeError('x'.repeat(400)))[0].message,
    'x'.repeat(300),
  );
  assert.deepEqual(failureDetail('secret'), []);
  // Node's RangeError quotes the value it received; only its name crosses.
  assert.deepEqual(
    failureDetail(
      Object.assign(new RangeError('Received "secret env value"'), {
        code: 'ERR_OUT_OF_RANGE',
      }),
    ),
    [{ name: 'RangeError' }],
  );
  assert.deepEqual(
    failureDetail(Object.assign(new TypeError('secret'), { name: 'a b' })),
    [{ name: 'Error' }],
  );
  // A cycle stops at the depth limit.
  const loop: Error & { cause?: unknown } = new Error('secret');
  loop.cause = loop;
  assert.equal(failureDetail(loop).length, 4);
  assert.equal(JSON.stringify(failureDetail(error)).includes('secret'), false);
});
test('the host restores a valid detail as the cause chain and rejects a malformed one', () => {
  const core = Object.assign(new Error('memory'), {
    name: 'PaludariumError',
    kind: 'host',
  });
  const message = workerErrorMessage(
    run,
    'EXECUTION',
    streams(),
    new Error('outer', { cause: core }),
  );
  const parsed = inspectMessage(message, run, streams());
  assert.ok(parsed?.type === 'error');
  const cause = detailCause(parsed.detail);
  assert.equal(cause?.name, 'Error');
  assert.equal(cause?.message, 'Error');
  const inner = cause?.cause as Error & { kind?: string };
  assert.deepEqual(
    [inner.name, inner.kind, inner.message],
    ['PaludariumError', 'host', 'memory'],
  );
  assert.equal(detailCause([]), undefined);
  for (const detail of [
    'Error',
    [{ name: 'a b' }],
    [{ name: 'Error', kind: 'Bad Kind' }],
    [{ name: 'Error', message: 'x'.repeat(301) }],
    Array.from({ length: 5 }, () => ({ name: 'Error' })),
  ])
    assert.throws(
      () => inspectMessage({ ...message, detail }, run, streams()),
      {
        code: 'EXECUTION',
      },
    );
});
