import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInstaller,
  installationGuest,
  installationTiming,
} from '../../runtime/install.js';
import type { GuestCatalog } from '../../runtime/install-catalog.js';
import { createLifecycle } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import { sessionPort } from '../../runtime/session-port.js';
import { SessionState } from '../../runtime/state.js';
import { elf, expectation } from './session-fixtures.js';

function fixture() {
  let executed: Uint8Array | undefined;
  let program: string | undefined;
  const state = new SessionState();
  const session = createLifecycle(state, {
    spawn(request, handlers) {
      executed = request.guest;
      program = request.program;
      handlers.message({
        ...identity(request),
        type: 'done',
        result: {
          runId: request.runId,
          exitCode: 0,
          elapsedMs: 0,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
        },
        snapshot: request.entries,
      });
      return { terminate() {} };
    },
  });
  const bytes = elf();
  const expected = expectation(bytes);
  const info = expected.identity;
  const catalog: GuestCatalog = {
    schemaVersion: 1,
    catalogId: 'test',
    defaults: { [info.tool]: info.versionOrName },
    entries: [
      {
        tool: info.tool,
        versionOrName: info.versionOrName,
        url: 'https://example.test/guest',
        format: 'elf',
        downloadSha256: info.elfSha256,
        downloadBytes: bytes.length,
        elfBytes: bytes.length,
        buildInfo: info,
        buildInfoSha256: expected.buildInfoSha256,
      },
    ],
  };
  return {
    session,
    state,
    bytes,
    catalog,
    selection: info.tool,
    port: sessionPort(session),
    executed: () => executed,
    program: () => program,
  };
}
test('installer uses public-shape result and commits owned bytes while preserving catalog snapshot', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  t.mock.method(globalThis, 'fetch', async () => new Response(value.bytes));
  const installer = createInstaller(value.session, value.catalog);
  const name = value.selection;
  value.catalog.entries[0]!.url = 'https://changed.test/guest';
  value.catalog.defaults = {};
  const result = await installer.install(name);
  assert.equal(result.tool, name);
  assert.equal(result.digest, value.catalog.entries[0]!.buildInfo.elfSha256);
  assert.deepEqual(Object.keys(result).sort(), [
    'buildKey',
    'digest',
    'operationId',
    'tool',
    'versionOrName',
  ]);
  const timings = installationTiming(result)!;
  assert.ok(timings.phasesMs.digest >= 0);
  assert.equal(timings.finalURL, 'https://example.test/guest');
  assert.equal(installationGuest(result)?.digest, result.digest);
  assert.equal(installationGuest({ ...result }), undefined);
  value.bytes[0] = 0;
  const r = await value.port.acquire('run');
  await value.port.runInstalled(r, name, [], {});
  await value.port.release(r);
  assert.equal(value.executed()![0], 127);
});
test('an installed guest runs from its /usr/bin path, as when another guest runs it', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  t.mock.method(globalThis, 'fetch', async () => new Response(value.bytes));
  await createInstaller(value.session, value.catalog).install(value.selection);
  const r = await value.port.acquire('run');
  await value.port.runInstalled(r, value.selection, [], {});
  await value.port.release(r);
  assert.equal(value.program(), `/usr/bin/${value.selection}`);
  await value.session.run({ guest: value.bytes });
  assert.equal(value.program(), undefined);
  const run = value.session.run as (...args: unknown[]) => Promise<unknown>;
  await run({ guest: value.bytes }, undefined, '/usr/bin/other');
  assert.equal(value.program(), undefined);
});
test('fake Session, unknown selection and preabort reject before network starts', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(value.bytes);
  });
  assert.throws(
    () => createInstaller({} as typeof value.session, value.catalog),
    { code: 'INVALID_INPUT' },
  );
  const installer = createInstaller(value.session, value.catalog);
  await assert.rejects(installer.install('unknown'), { code: 'INVALID_INPUT' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    installer.install(value.selection, { signal: controller.signal }),
    { code: 'ABORTED' },
  );
  assert.equal(calls, 0);
});
test('same session concurrent installer, run and FS reject BUSY while fetch is pending', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  let resolve!: (response: Response) => void;
  let began!: () => void;
  const started = new Promise<void>((done) => {
    began = done;
  });
  t.mock.method(globalThis, 'fetch', () => {
    began();
    return new Promise<Response>((done) => {
      resolve = done;
    });
  });
  const installer = createInstaller(value.session, value.catalog);
  const pending = installer.install(value.selection);
  await started;
  await assert.rejects(installer.install(value.selection), { code: 'BUSY' });
  await assert.rejects(value.session.listEntries(), { code: 'BUSY' });
  await assert.rejects(value.session.run({ guest: value.bytes }), {
    code: 'BUSY',
  });
  resolve(new Response(value.bytes));
  await pending;
  await value.session.listEntries();
});
test('failed reinstall keeps old guest and valid successful reinstall atomically replaces it', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  let bad = false;
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(bad ? new Uint8Array(value.bytes.length) : value.bytes),
  );
  const installer = createInstaller(value.session, value.catalog);
  await installer.install(value.selection);
  bad = true;
  await assert.rejects(installer.install(value.selection), {
    code: 'INVALID_INPUT',
  });
  const r = await value.port.acquire('run');
  await value.port.runInstalled(r, value.selection, [], {});
  await value.port.release(r);
  assert.equal(value.executed()![0], 127);
  bad = false;
  await installer.install(value.selection);
});
test('caller abort during body cancels stream and releases reservation without late notification', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  let cancelled = 0;
  const caller = new AbortController();
  let notices = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelled++;
          },
        }),
      ),
  );
  const pending = createInstaller(value.session, value.catalog).install(
    value.selection,
    {
      signal: caller.signal,
      onProgress() {
        notices++;
        caller.abort();
      },
    },
  );
  await assert.rejects(pending, { code: 'ABORTED' });
  assert.equal(cancelled, 1);
  assert.equal(notices, 1);
  await value.session.listEntries();
});
test('real Session reset/dispose classify owner reason and await cancelled fetch cleanup', async (t) => {
  for (const code of ['ABORTED', 'DISPOSED'] as const) {
    const value = fixture();
    let resolve!: (response: Response) => void;
    let began!: () => void;
    const started = new Promise<void>((done) => {
      began = done;
    });
    let cancelled = 0;
    const mock = t.mock.method(globalThis, 'fetch', () => {
      began();
      return new Promise<Response>((done) => {
        resolve = done;
      });
    });
    const pending = createInstaller(value.session, value.catalog).install(
      value.selection,
    );
    const rejected = assert.rejects(pending, { code });
    await started;
    const cleanup =
      code === 'ABORTED' ? value.session.reset() : value.session.dispose();
    resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelled++;
          },
        }),
      ),
    );
    await rejected;
    await cleanup;
    assert.equal(cancelled, 1);
    if (code === 'ABORTED') {
      const r = await value.port.acquire('run');
      await assert.rejects(
        value.port.runInstalled(r, value.selection, [], {}),
        { code: 'NOT_FOUND' },
      );
      await value.port.release(r);
      await value.session.dispose();
    } else
      await assert.rejects(value.session.listEntries(), { code: 'DISPOSED' });
    mock.mock.restore();
  }
});
test('progress callback errors and BUSY reentry cannot change successful install outcome', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  t.mock.method(globalThis, 'fetch', async () => new Response(value.bytes));
  const installer = createInstaller(value.session, value.catalog);
  const reentries: Promise<unknown>[] = [];
  const phases: string[] = [];
  const result = await installer.install(value.selection, {
    onProgress(event) {
      phases.push(event.phase);
      reentries.push(
        assert.rejects(installer.install(value.selection), { code: 'BUSY' }),
      );
      throw Error('callback');
    },
  });
  await Promise.all(reentries);
  assert.equal(result.tool, value.selection);
  assert.deepEqual(
    [...new Set(phases)],
    ['fetch', 'digest', 'validate', 'register'],
  );
});
test('cancel from register progress never commits candidate and does not disturb FS', async (t) => {
  const value = fixture();
  t.after(() => value.session.dispose());
  t.mock.method(globalThis, 'fetch', async () => new Response(value.bytes));
  const caller = new AbortController();
  await assert.rejects(
    createInstaller(value.session, value.catalog).install(value.selection, {
      signal: caller.signal,
      onProgress(event) {
        if (event.phase === 'register') caller.abort();
      },
    }),
    { code: 'ABORTED' },
  );
  const r = await value.port.acquire('run');
  await assert.rejects(value.port.runInstalled(r, value.selection, [], {}), {
    code: 'NOT_FOUND',
  });
  await value.port.release(r);
  await value.session.listEntries();
});
