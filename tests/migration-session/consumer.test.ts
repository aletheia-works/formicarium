import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { consumerInput } from './consumer-input.js';

const input = await consumerInput();
const api = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/public.js')).href
)) as typeof import('../../runtime/public.js');
const { createSession } = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/node/api.js')).href
)) as typeof import('../../runtime/node/api.js');
const handle = api.validateGuest(input.bytes, input.expected);
test('fresh installed U2 pack exposes C03 while internal C02 imports are forbidden', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(input.packageRoot, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.version, '0.3.0');
  for (const name of [
    'validateGuest',
    'fixtureToFsEntries',
    'runValidatedGuest',
    'registerValidatedGuest',
  ])
    assert.equal(typeof api[name as keyof typeof api], 'function');
  const require = createRequire(resolve(input.consumerRoot, 'package.json'));
  assert.throws(
    () =>
      require.resolve('@aletheia-works/formicarium/runtime/session-port.js'),
    { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
  );
});
test('installed private handle runs fixed official aube after original input mutation', async (t) => {
  const bytes = new Uint8Array(input.bytes);
  const expected = structuredClone(input.expected);
  const owned = api.validateGuest(bytes, expected);
  bytes.fill(0);
  expected.identity.tool = 'changed';
  const session = await createSession();
  t.after(() => session.dispose());
  const result = await api.runValidatedGuest(session, owned, {
    args: ['--version'],
  });
  assert.equal(result.exitCode, 0);
  assert.match(api.decodeUtf8(result.stdout), /^2\.7\.0/);
});
test('installed fixture converter copies bytes and preserves hardlink identity', async (t) => {
  const data = new Uint8Array([7]);
  const entries = api.fixtureToFsEntries([
    { path: '/work/a', type: 'file', mode: 0o640, inodeId: 'same', data },
    { path: '/work/b', type: 'file', mode: 0o640, inodeId: 'same', data },
  ]);
  data[0] = 0;
  const session = await createSession({ entries });
  t.after(() => session.dispose());
  assert.equal((await session.readFile('/work/a'))[0], 7);
  const files = await session.listEntries();
  assert.equal(
    files[0].type === 'file' && files[0].inodeId,
    files[1].type === 'file' && files[1].inodeId,
  );
});
test('installed forged handle rejects before execution without changing FS', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  await assert.rejects(api.runValidatedGuest(session, { ...handle }), {
    code: 'INVALID_INPUT',
  });
  assert.deepEqual(await session.listEntries(), []);
});
test('installed registration preabort refuses, healthy registration then reset stays usable', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.registerValidatedGuest(session, 'aube', handle, {
      signal: controller.signal,
    }),
    { code: 'ABORTED' },
  );
  await api.registerValidatedGuest(session, 'aube', handle);
  await session.reset();
  assert.equal(
    (await api.runValidatedGuest(session, handle, { args: ['--version'] }))
      .exitCode,
    0,
  );
});
test('installed active run rejects competing FS and register using the same BUSY reservation', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const running = api.runValidatedGuest(session, handle, {
    args: ['--version'],
  });
  await assert.rejects(session.listEntries(), { code: 'BUSY' });
  await assert.rejects(api.registerValidatedGuest(session, 'aube', handle), {
    code: 'BUSY',
  });
  assert.equal((await running).exitCode, 0);
});
test('installed reset cancels an executing Worker after real byte output and restores a reusable session', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  let outputObserved!: () => void;
  const firstOutput = new Promise<void>((resolve) => {
    outputObserved = resolve;
  });
  const running = api.runValidatedGuest(session, handle, {
    args: ['--version'],
    onOutput(chunk) {
      if (chunk.bytes.length > 0) outputObserved();
    },
  });
  // A real output message proves the Worker entered its instrumented module.
  // Immediate cancellation is separately exercised by reservation.test.ts;
  // this boundary must retain the fifth actually entered Worker realm.
  await Promise.race([
    firstOutput,
    running.then(
      () => {
        throw Error('guest completed before output barrier');
      },
      (error) => {
        throw error;
      },
    ),
  ]);
  const rejected = assert.rejects(running, { code: 'ABORTED' });
  await session.reset();
  await rejected;
  assert.equal(
    (await api.runValidatedGuest(session, handle, { args: ['--version'] }))
      .exitCode,
    0,
  );
});
test('a handle from workspace package instance cannot be used by installed package', async (t) => {
  const source = await import('../../runtime/public.js');
  const foreign = source.validateGuest(input.bytes, input.expected);
  const session = await createSession();
  t.after(() => session.dispose());
  await assert.rejects(api.runValidatedGuest(session, foreign), {
    code: 'INVALID_INPUT',
  });
  await assert.rejects(api.registerValidatedGuest(session, 'aube', foreign), {
    code: 'INVALID_INPUT',
  });
});
