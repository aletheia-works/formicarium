import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLifecycle } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import * as api from '../../runtime/public.js';
import { sessionPort } from '../../runtime/session-port.js';
import { SessionState } from '../../runtime/state.js';
import { elf, expectation } from './session-fixtures.js';

function session() {
  let count = 0;
  let firstByte = 0;
  const value = createLifecycle(new SessionState(), {
    spawn(request, handlers) {
      count++;
      firstByte = request.guest[0];
      handlers.message({
        ...identity(request),
        type: 'done',
        result: {
          runId: request.runId,
          exitCode: 3,
          elapsedMs: 0,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
        },
        snapshot: request.entries,
      });
      return { terminate() {} };
    },
  });
  return { value, count: () => count, firstByte: () => firstByte };
}
test('root adds exactly C03 while internal session port stays unexported', async () => {
  for (const name of [
    'validateGuest',
    'fixtureToFsEntries',
    'runValidatedGuest',
    'registerValidatedGuest',
  ])
    assert.equal(typeof api[name as keyof typeof api], 'function');
  assert.equal('sessionPort' in api, false);
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    Object.keys(manifest.exports).some((path) => path.includes('session-port')),
    false,
  );
});
test('validated run uses private owned copy and preserves raw nonzero result semantics', async () => {
  const fixture = session();
  const bytes = elf();
  const expected = expectation(bytes);
  const handle = api.validateGuest(bytes, expected);
  bytes[0] = 0;
  expected.identity.tool = 'changed';
  assert.equal(
    (await api.runValidatedGuest(fixture.value, handle)).exitCode,
    3,
  );
  assert.equal(fixture.firstByte(), 127);
  await fixture.value.dispose();
});
test('forged session and handle refuse before any Worker starts', async () => {
  const fixture = session();
  const handle = api.validateGuest(elf(), expectation());
  await assert.rejects(
    api.runValidatedGuest({} as typeof fixture.value, handle),
    { code: 'INVALID_INPUT' },
  );
  await assert.rejects(
    api.runValidatedGuest(fixture.value, {} as typeof handle),
    { code: 'INVALID_INPUT' },
  );
  await assert.rejects(
    api.registerValidatedGuest(fixture.value, 'fixture', {} as typeof handle),
    { code: 'INVALID_INPUT' },
  );
  assert.equal(fixture.count(), 0);
  await fixture.value.dispose();
});
test('register then reserved run consumes same handle without another reservation', async () => {
  const fixture = session();
  const handle = api.validateGuest(elf(), expectation());
  await api.registerValidatedGuest(fixture.value, 'fixture', handle);
  const port = sessionPort(fixture.value);
  const r = await port.acquire('run');
  assert.equal((await port.runInstalled(r, 'fixture', [], {})).exitCode, 3);
  await port.release(r);
  await fixture.value.dispose();
});
test('BUSY registration does not disturb an active install reservation', async () => {
  const fixture = session();
  const handle = api.validateGuest(elf(), expectation());
  const port = sessionPort(fixture.value);
  const r = await port.acquire('install');
  await assert.rejects(
    api.registerValidatedGuest(fixture.value, 'fixture', handle),
    { code: 'BUSY' },
  );
  await port.release(r);
  await api.registerValidatedGuest(fixture.value, 'fixture', handle);
  await fixture.value.dispose();
});
test('preabort and abort between acquisition and commit reject then release cleanly', async () => {
  const fixture = session();
  const handle = api.validateGuest(elf(), expectation());
  for (const pre of [true, false]) {
    const controller = new AbortController();
    if (pre) controller.abort();
    const register = api.registerValidatedGuest(
      fixture.value,
      'fixture',
      handle,
      { signal: controller.signal },
    );
    controller.abort();
    await assert.rejects(register, { code: 'ABORTED' });
    await fixture.value.listEntries();
  }
  await fixture.value.dispose();
});
test('reset clears registration and disposed session rejects new public operations', async () => {
  const fixture = session();
  const handle = api.validateGuest(elf(), expectation());
  await api.registerValidatedGuest(fixture.value, 'fixture', handle);
  await fixture.value.reset();
  const port = sessionPort(fixture.value);
  const r = await port.acquire('run');
  await assert.rejects(port.runInstalled(r, 'fixture', [], {}), {
    code: 'NOT_FOUND',
  });
  await port.release(r);
  await fixture.value.dispose();
  await assert.rejects(
    api.registerValidatedGuest(fixture.value, 'fixture', handle),
    { code: 'DISPOSED' },
  );
  await assert.rejects(api.runValidatedGuest(fixture.value, handle), {
    code: 'DISPOSED',
  });
});
test('strict type fixtures accept C03 and reject invalid byte, expectation and result shapes', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../node_modules/typescript/bin/tsc', import.meta.url),
      ),
      '--project',
      'tests/package/tsconfig.json',
    ],
    { stdio: 'inherit' },
  );
  assert.equal(result.status, 0);
});
