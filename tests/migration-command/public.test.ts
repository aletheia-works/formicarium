import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { blinkCore } from '../../runtime/core.js';
import { createSession } from '../../runtime/node/api.js';
import * as api from '../../runtime/public.js';
import type { OutputChunk, Progress, Session } from '../../types/index.js';
import { expectation } from '../migration-session/fixtures.js';
import { developmentAssets } from '../package/fixtures.js';
import { catalogFor, harness, text } from './harness.js';

const code = (expected: string) => (error: { code?: string }) => {
  assert.equal(error.code, expected);
  return true;
};
function fetchServing(
  t: import('node:test').TestContext,
  bytes: () => Uint8Array,
) {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(new Uint8Array(bytes())),
  );
}

test('root export adds createCommandSession and keeps the internal port and modules private', () => {
  assert.equal(typeof api.createCommandSession, 'function');
  for (const name of [
    'sessionPort',
    'bindSessionPort',
    'tokenizeCommand',
    'guardCommandInput',
    'formatListing',
    'RESERVED_COMMANDS',
    'installationTiming',
  ])
    assert.equal(name in api, false, name);
  const value = harness();
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  assert.deepEqual(Object.keys(shell), ['execute']);
  assert.ok(Object.isFrozen(shell));
  return value.session.dispose();
});
test('forged sessions, a missing options object and an invalid catalog are INVALID_INPUT', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const catalog = catalogFor(value.bytes);
  const forged: Session = { ...value.session };
  const lookalike = Object.create(Object.getPrototypeOf(value.session));
  for (const session of [{} as Session, forged, lookalike as Session, null])
    assert.throws(
      () => api.createCommandSession(session as Session, { catalog }),
      code('INVALID_INPUT'),
    );
  for (const options of [null, undefined, 'catalog'])
    assert.throws(
      () => api.createCommandSession(value.session, options as never),
      code('INVALID_INPUT'),
    );
  for (const bad of [
    {},
    { ...catalog, schemaVersion: 2 },
    { ...catalog, defaults: { fixture: 'missing' } },
  ])
    assert.throws(
      () => api.createCommandSession(value.session, { catalog: bad as never }),
      code('INVALID_INPUT'),
    );
  // A rejected factory leaves the session idle and unchanged.
  assert.equal(text(await value.session.readFile('/work/a.txt')), 'alpha');
});
test('two command sessions on one Session share its single reservation (BUSY)', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const first = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  const second = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  value.plans.push({ pending: true });
  const running = first.execute('fixture');
  await value.started();
  for (const input of ['ls', 'cat /work/a.txt', 'fixture', 'install fixture'])
    await assert.rejects(second.execute(input), code('BUSY'), input);
  await value.finishPending();
  await running;
  assert.equal((await second.execute('ls')).kind, 'builtin');
});
test('a running command makes direct run, install, registration and FS calls BUSY', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  fetchServing(t, () => value.bytes);
  await value.register();
  const catalog = catalogFor(value.bytes);
  const shell = api.createCommandSession(value.session, { catalog });
  const installer = api.createInstaller(value.session, catalog);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  const handle = api.validateGuest(
    new Uint8Array(value.bytes),
    expectation(value.bytes),
  );
  await assert.rejects(value.session.run({ guest: value.bytes }), code('BUSY'));
  await assert.rejects(installer.install('fixture'), code('BUSY'));
  await assert.rejects(
    api.registerValidatedGuest(value.session, 'other', handle),
    code('BUSY'),
  );
  await assert.rejects(value.session.listEntries(), code('BUSY'));
  await assert.rejects(value.session.setCwd('/work/sub'), code('BUSY'));
  await value.finishPending();
  await running;
  assert.equal(value.state.cwd, '/work');
});
test('a direct install or run in progress makes every command route BUSY', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  let release!: (response: Response) => void;
  let began!: () => void;
  const fetching = new Promise<void>((done) => {
    began = done;
  });
  t.mock.method(globalThis, 'fetch', () => {
    began();
    return new Promise<Response>((done) => {
      release = done;
    });
  });
  const catalog = catalogFor(value.bytes);
  const shell = api.createCommandSession(value.session, { catalog });
  const direct = api.createInstaller(value.session, catalog).install('fixture');
  await fetching;
  for (const input of [
    'ls',
    'cat /work/a.txt',
    'cd /work/sub',
    'rm -rf /work/a.txt',
    'install fixture',
    'fixture',
  ])
    await assert.rejects(shell.execute(input), code('BUSY'), input);
  release(new Response(new Uint8Array(value.bytes)));
  await direct;
  value.plans.push({ pending: true });
  const run = value.session.run({ guest: value.bytes });
  await value.started();
  await assert.rejects(shell.execute('ls'), code('BUSY'));
  await value.finishPending();
  await run;
  assert.equal((await shell.execute('fixture')).kind, 'guest');
});
test('reset aborts a running command and clears guests; dispose is terminal DISPOSED', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  await shell.execute('cd /work/sub');
  await shell.execute('rm -rf /work/a.txt');
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  const reset = value.session.reset();
  await assert.rejects(running, code('ABORTED'));
  await reset;
  // Seed FS and initial cwd are restored, registered guests are gone.
  assert.equal(text((await shell.execute('ls')).stdout), 'a.txt\nsub/\n');
  await assert.rejects(shell.execute('fixture'), code('NOT_FOUND'));
  await value.session.dispose();
  for (const input of ['ls', 'cat /work/a.txt', 'fixture', 'install fixture'])
    await assert.rejects(shell.execute(input), code('DISPOSED'), input);
  assert.equal((await shell.execute('  ')).kind, 'empty');
});
test('cd -> ls -> cat -> rm -> ls keeps cwd and filesystem in the one Session', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  const steps: string[] = [];
  for (const input of [
    'cd /work/sub',
    'ls',
    'cat /work/sub/b.txt',
    'rm -rf /work/sub/b.txt',
    'ls',
  ]) {
    const result = await shell.execute(input);
    assert.equal(result.exitCode, 0, input);
    steps.push(text(result.stdout));
  }
  assert.deepEqual(steps, ['', 'b.txt\n', 'beta', '', '']);
  assert.equal(value.state.cwd, '/work/sub');
  // The direct API observes exactly the same state.
  assert.deepEqual(await value.session.listEntries(), []);
  await assert.rejects(
    value.session.readFile('/work/sub/b.txt'),
    code('NOT_FOUND'),
  );
});
test('relative cd -> ls -> cat -> rm -> ls follows the Session cwd, and reset restores it', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  const steps: string[] = [];
  for (const input of ['cd sub', 'ls', 'cat b.txt', 'rm -rf ./b.txt', 'ls .'])
    steps.push(text((await shell.execute(input)).stdout));
  assert.deepEqual(steps, ['', 'b.txt\n', 'beta', '', '']);
  assert.equal(value.state.cwd, '/work/sub');
  // A cwd set through the direct API is the one the command resolves against.
  await value.session.setCwd('/work');
  assert.equal(text((await shell.execute('cat a.txt')).stdout), 'alpha');
  await shell.execute('cd sub');
  await value.session.reset();
  assert.equal(text((await shell.execute('cat sub/b.txt')).stdout), 'beta');
  await assert.rejects(shell.execute('cd ../work'), code('INVALID_INPUT'));
  assert.equal(value.state.cwd, '/work');
});
test('install through the command keeps the old guest after a failed reinstall', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  let bad = false;
  fetchServing(t, () =>
    bad ? new Uint8Array(value.bytes.length) : value.bytes,
  );
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  const first = await shell.execute('install fixture');
  bad = true;
  await assert.rejects(shell.execute('install fixture'), code('INVALID_INPUT'));
  value.plans.push({ stdout: 'still' });
  const run = await shell.execute('fixture');
  assert.equal(text(run.stdout), 'still');
  assert.equal(value.requests.at(-1)?.guest[0], 127);
  bad = false;
  const second = await shell.execute('install fixture');
  assert.notEqual(
    second.installation?.operationId,
    first.installation?.operationId,
  );
  assert.equal(second.installation?.digest, first.installation?.digest);
});
test('command and direct install return the same InstallResult identity fields', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  fetchServing(t, () => value.bytes);
  const catalog = catalogFor(value.bytes);
  const viaCommand = (
    await api
      .createCommandSession(value.session, { catalog })
      .execute('install fixture')
  ).installation!;
  const direct = await api
    .createInstaller(value.session, catalog)
    .install('fixture');
  for (const field of ['tool', 'versionOrName', 'digest', 'buildKey'] as const)
    assert.equal(viaCommand[field], direct[field], field);
  assert.ok(Object.isFrozen(viaCommand));
});
test('Progress and OutputChunk are relayed through the public command API', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  fetchServing(t, () => value.bytes);
  const shell = api.createCommandSession(value.session, {
    catalog: catalogFor(value.bytes),
  });
  const progress: Progress[] = [];
  const installed = await shell.execute('install fixture', {
    onProgress: (event) => progress.push(event),
  });
  assert.ok(progress.length > 0);
  assert.ok(
    progress.every(
      (event) => event.operationId === installed.installation?.operationId,
    ),
  );
  const chunks: OutputChunk[] = [];
  value.plans.push({ stdout: 'x', exitCode: 2 });
  const run = await shell.execute('fixture', {
    onOutput: (chunk) => chunks.push(chunk),
  });
  assert.equal(run.exitCode, 2);
  assert.deepEqual(
    chunks.map((chunk) => text(chunk.bytes)),
    ['x'],
  );
});
test('the core argv always sends blink logs to /dev/null first, and diagnostic -L flags come after it', () => {
  assert.deepEqual(blinkCore.argv('/g', ['a', 'b c']), [
    '-L',
    '/dev/null',
    '/g',
    'a',
    'b c',
  ]);
  assert.deepEqual(blinkCore.argv('/g', [], ['-s', '-L', '/work/trace.log']), [
    '-L',
    '/dev/null',
    '-s',
    '-L',
    '/work/trace.log',
    '/g',
  ]);
});
test('a real guest run through the command leaves no blink.log in the cwd or anywhere in the Session FS', async (t) => {
  const session = await createSession({
    assets: await developmentAssets(t),
    entries: [
      {
        path: '/work/note.txt',
        type: 'file',
        mode: 0o644,
        inodeId: 'n',
        data: new TextEncoder().encode('n'),
      },
    ],
  });
  t.after(() => session.dispose());
  const guest = new Uint8Array(
    await readFile(new URL('../../dist/guests/aube', import.meta.url)),
  );
  const run = await session.run({ guest, args: ['--version'] });
  assert.equal(run.exitCode, 0, text(run.stderr));
  assert.match(text(run.stdout), /^\d+\.\d+\.\d+/);
  const paths = (await session.listEntries()).map((entry) => entry.path);
  assert.equal(
    paths.some((path) => path.endsWith('/blink.log')),
    false,
    paths.join('\n'),
  );
  assert.deepEqual(
    (await session.listEntries('/work')).map((entry) => entry.path),
    ['/work/note.txt'],
  );
});
