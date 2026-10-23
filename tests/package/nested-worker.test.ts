import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Worker } from 'node:worker_threads';

const root = process.env.FORMICARIUM_CONSUMER;
if (!root) throw new Error('external FORMICARIUM_CONSUMER is required');
const base = pathToFileURL(
  `${resolve(root, 'node_modules/@aletheia-works/formicarium')}/`,
);
process.env.FORMICARIUM_OBSERVED_WORKER = new URL(
  'runtime/node/package-worker.js',
  base,
).href;
const threads = createRequire(import.meta.url)('node:worker_threads');
const OriginalWorker = threads.Worker;
let bridge: Int32Array | undefined;
threads.Worker = class extends OriginalWorker {
  constructor(...args: ConstructorParameters<typeof Worker>) {
    super(...args);
    this.on(
      'message',
      (message: { type: string; counters: SharedArrayBuffer }) => {
        if (message.type === 'nested-inspection')
          bridge = new Int32Array(message.counters);
      },
    );
  }
};
syncBuiltinESMExports();
const { createSession } = (await import(
  new URL('runtime/node/api.js', base).href
)) as typeof import('../../runtime/node/api.js');
const guest = new Uint8Array(
  await readFile(new URL('../../.artifacts/u1-fixture/guest', import.meta.url)),
);
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const assets = {
  loaderURL: new URL('assets/paludarium/index.mjs', base),
  wasmURL: new URL('assets/paludarium/paludarium.wasm', base),
  buildInfoURL: new URL('assets/paludarium/build-info.json', base),
  workerURL: new URL('./fixtures/node-nested-observer.js', import.meta.url),
};

for (const mode of ['normal', 'abort', 'timeout'])
  test(`real nested core Worker ${mode} termination stops observed descendant heartbeat`, async (t) => {
    bridge = undefined;
    const session = await createSession({ assets });
    t.after(() => session.dispose());
    const controller = new AbortController();
    const run = session.run({
      guest,
      args: [mode === 'normal' ? 'thread-exit' : 'thread-spin'],
      timeoutMs: 2500,
      signal: controller.signal,
      onOutput: (chunk) => {
        if (
          mode === 'abort' &&
          new TextDecoder().decode(chunk.bytes).includes('thread-started')
        )
          controller.abort();
      },
    });
    if (mode === 'normal') assert.equal((await run).exitCode, 0);
    else
      await assert.rejects(
        run,
        (error: import('../../runtime/errors.js').ExecutionError) => {
          assert.equal(error.code, mode === 'abort' ? 'ABORTED' : 'TIMEOUT');
          assert.match(
            new TextDecoder().decode(error.stdout),
            /thread-started/,
          );
          return true;
        },
      );
    assert.ok(bridge, 'observer realm registered');
    assert.ok(Atomics.load(bridge, 0) > 0, 'real core created nested Worker');
    assert.ok(Atomics.load(bridge, 1) > 0, 'real descendant initialized');
    const ticks = Atomics.load(bridge, 2);
    assert.ok(ticks > 0, 'heartbeat inside real descendant started');
    await pause(150);
    assert.equal(
      Atomics.load(bridge, 2),
      ticks,
      'descendant heartbeat stopped after outer promise settled',
    );
    assert.equal((await session.run({ guest })).exitCode, 0);
  });
