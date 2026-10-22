import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RunRequest, WorkerHandlers } from '../../runtime/contracts.js';
import {
  type GuestHandle,
  validateGuest,
} from '../../runtime/guest-validation.js';
import { createLifecycle } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import { type Reservation, sessionPort } from '../../runtime/session-port.js';
import { SessionState } from '../../runtime/state.js';
import { elf, expectation } from './session-fixtures.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(controlled = false) {
  const cleanupStarted = deferred();
  const cleanup = deferred();
  const state = new SessionState({
    entries: [
      {
        path: '/work/seed',
        type: 'file',
        mode: 0o640,
        inodeId: 'seed',
        data: new Uint8Array([7]),
      },
      { path: '/work/sub', type: 'dir', mode: 0o700 },
    ],
  });
  const workers: { request: RunRequest; handlers: WorkerHandlers }[] = [];
  const session = createLifecycle(state, {
    spawn(request, handlers) {
      workers.push({ request, handlers });
      return {
        terminate() {
          cleanupStarted.resolve();
          return controlled ? cleanup.promise : Promise.resolve();
        },
      };
    },
  });
  const done = (
    index = workers.length - 1,
    snapshot: unknown = workers[index].request.entries,
  ) => {
    const worker = workers[index];
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
      snapshot,
    });
  };
  return {
    session,
    port: sessionPort(session),
    state,
    workers,
    done,
    cleanupStarted,
    cleanup,
  };
}
const guest = () => validateGuest(elf(), expectation());
test('install reservation blocks direct run, FS, register and other acquire without a queue', async () => {
  const { session, port, workers } = fixture();
  const r = await port.acquire('install');
  for (const pending of [
    session.run({ guest: elf() }),
    session.readFile('/work/seed'),
    session.remove('/work/seed'),
    session.listEntries(),
    session.setCwd('/work/sub'),
    port.acquire('run'),
  ])
    await assert.rejects(pending, { code: 'BUSY' });
  assert.equal(workers.length, 0);
  await port.release(r);
  assert.equal((await session.readFile('/work/seed'))[0], 7);
});
test('atomic guest replacement rejects forged handles and preserves previous registration', async () => {
  const { port, session, done } = fixture();
  const r = await port.acquire('install');
  await port.commitGuest(r, 'fixture', guest());
  await assert.rejects(port.commitGuest(r, 'fixture', {} as GuestHandle), {
    code: 'INVALID_INPUT',
  });
  await port.release(r);
  const run = await port.acquire('run');
  const result = port.runInstalled(run, 'fixture', [], {});
  done();
  await result;
  await port.release(run);
  assert.equal((await session.readFile('/work/seed'))[0], 7);
});
test('old release and commit cannot touch a newer reservation', async () => {
  const { port } = fixture();
  const first = await port.acquire('install');
  await port.release(first);
  const next = await port.acquire('install');
  await port.release(first);
  await assert.rejects(port.acquire('fs'), { code: 'BUSY' });
  await assert.rejects(port.commitGuest(first, 'fixture', guest()), {
    code: 'ABORTED',
  });
  await port.commitGuest(next, 'fixture', guest());
  await port.release(next);
});
test('token-shaped foreign reservation and forged Session do not convey authority', async () => {
  const { port } = fixture();
  const r = await port.acquire('install');
  const copied = { ...r } as Reservation;
  await assert.rejects(port.commitGuest(copied, 'fixture', guest()), {
    code: 'ABORTED',
  });
  await port.release(copied);
  await assert.rejects(port.acquire('run'), { code: 'BUSY' });
  await port.release(r);
  assert.throws(() => sessionPort({} as Parameters<typeof sessionPort>[0]), {
    code: 'INVALID_INPUT',
  });
});
test('reset cancels a late done commit and shares cleanup wait before restoring seed/cwd', async () => {
  const { session, state, port, done, cleanupStarted, cleanup } = fixture(true);
  await session.setCwd('/work/sub');
  await session.remove('/work/seed');
  const r = await port.acquire('install');
  await port.commitGuest(r, 'fixture', guest());
  await port.release(r);
  const result = session.run({ guest: elf() });
  const rejected = assert.rejects(result, { code: 'ABORTED' });
  done(0, []);
  await cleanupStarted.promise;
  const reset = session.reset();
  assert.equal(session.reset(), reset);
  await assert.rejects(session.listEntries(), { code: 'BUSY' });
  cleanup.resolve();
  await rejected;
  await reset;
  assert.equal(state.cwd, '/work');
  assert.equal((await session.readFile('/work/seed'))[0], 7);
  const current = await port.acquire('run');
  await assert.rejects(port.runInstalled(current, 'fixture', [], {}), {
    code: 'NOT_FOUND',
  });
  await port.release(current);
});
test('reset invalidates install commit while cleanup ownership must still release', async () => {
  const { session, port } = fixture();
  const r = await port.acquire('install');
  const reset = session.reset();
  assert.equal(r.signal.aborted, true);
  await assert.rejects(port.commitGuest(r, 'fixture', guest()), {
    code: 'ABORTED',
  });
  await assert.rejects(port.acquire('run'), { code: 'BUSY' });
  await port.release(r);
  await reset;
  const next = await port.acquire('fs');
  await port.release(r);
  await assert.rejects(port.acquire('fs'), { code: 'BUSY' });
  await port.release(next);
});
test('dispose wins overlapping reset and duplicate disposal waits the same cleanup', async () => {
  const { session, port, cleanupStarted, cleanup } = fixture(true);
  const result = session.run({ guest: elf() });
  const rejected = assert.rejects(result, { code: 'ABORTED' });
  const reset = session.reset();
  await cleanupStarted.promise;
  const disposed = session.dispose();
  assert.equal(session.dispose(), disposed);
  await assert.rejects(session.reset(), { code: 'DISPOSED' });
  await assert.rejects(port.acquire('install'), { code: 'DISPOSED' });
  cleanup.resolve();
  await rejected;
  await reset;
  await disposed;
  await assert.rejects(session.readFile('/work/seed'), { code: 'DISPOSED' });
});
test('internal run holds one reservation through cleanup and never reacquires', async () => {
  const { port, done, cleanupStarted, cleanup } = fixture(true);
  const register = await port.acquire('install');
  await port.commitGuest(register, 'fixture', guest());
  await port.release(register);
  const r = await port.acquire('run');
  const result = port.runInstalled(r, 'fixture', [], {});
  done();
  await cleanupStarted.promise;
  let released = false;
  const release = port.release(r).then(() => {
    released = true;
  });
  await Promise.resolve();
  assert.equal(released, false);
  await assert.rejects(port.acquire('run'), { code: 'BUSY' });
  cleanup.resolve();
  await result;
  await release;
  const next = await port.acquire('fs');
  await port.release(next);
});
test('reserved builtin failures preserve FS/cwd and successful operations use the existing token', async () => {
  const { port, state, session } = fixture();
  const r = await port.acquire('fs');
  await assert.rejects(port.builtin(r, ['cd', '/missing']), {
    code: 'INVALID_INPUT',
  });
  assert.equal(state.cwd, '/work');
  await assert.rejects(port.builtin(r, ['rm', '-rf', '/work']), {
    code: 'INVALID_INPUT',
  });
  assert.equal((await port.builtin(r, ['cat', '/work/seed'])).stdout[0], 7);
  await port.release(r);
  assert.equal((await session.readFile('/work/seed'))[0], 7);
});
test('resolvePath resolves relative, "." and absolute paths against the current cwd', async () => {
  const { port, session } = fixture();
  assert.equal(port.resolvePath('seed'), '/work/seed');
  assert.equal(port.resolvePath('./sub//x'), '/work/sub/x');
  assert.equal(port.resolvePath('.'), '/work');
  assert.equal(port.resolvePath('/root/./a'), '/root/a');
  assert.equal(port.resolvePath('/'), '/');
  await session.setCwd('/work/sub');
  assert.equal(port.resolvePath('x'), '/work/sub/x');
  assert.equal(port.resolvePath('.'), '/work/sub');
  assert.equal(port.resolvePath('/work/seed'), '/work/seed');
  await session.reset();
  assert.equal(port.resolvePath('x'), '/work/x');
});
test('resolvePath rejects empty, "..", NUL and non-string paths and leaves state unchanged', async () => {
  const { port, session, state } = fixture();
  await session.setCwd('/work/sub');
  for (const path of ['', '..', '../seed', 'a/../b', '/work/..', 'a\0b', 7])
    assert.throws(() => port.resolvePath(path as string), {
      code: 'INVALID_INPUT',
    });
  assert.equal(state.cwd, '/work/sub');
  assert.equal((await session.readFile('/work/seed'))[0], 7);
  // Resolution takes no reservation: a held one stays held and usable.
  const r = await port.acquire('fs');
  assert.equal(port.resolvePath('y'), '/work/sub/y');
  await assert.rejects(port.acquire('run'), { code: 'BUSY' });
  await port.builtin(r, ['cd', port.resolvePath('/work')]);
  const cat = await port.builtin(r, ['cat', port.resolvePath('seed')]);
  assert.equal(cat.stdout[0], 7);
  await port.release(r);
});
test('two sessions sharing a validated handle keep independent registrations and files', async () => {
  const first = fixture();
  const second = fixture();
  const handle = guest();
  for (const item of [first, second]) {
    const r = await item.port.acquire('install');
    await item.port.commitGuest(r, 'fixture', handle);
    await item.port.release(r);
  }
  await first.session.reset();
  await first.session.remove('/work/seed');
  assert.equal((await second.session.readFile('/work/seed'))[0], 7);
  const r = await second.port.acquire('run');
  const result = second.port.runInstalled(r, 'fixture', [], {});
  second.done();
  await result;
  await second.port.release(r);
  await first.session.dispose();
  await second.session.dispose();
});
