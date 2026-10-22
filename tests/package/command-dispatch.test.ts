import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandSession } from '../../runtime/command.js';
import type { OutputChunk, Progress } from '../../types/index.js';
import { catalogFor, harness, mergeCatalogs, text } from './command-harness.js';

type Fixture = ReturnType<typeof harness>;
const code = (expected: string) => (error: { code?: string }) => {
  assert.equal(error.code, expected);
  return true;
};
function command(value: Fixture, catalog = catalogFor(value.bytes)) {
  return createCommandSession(value.session, { catalog });
}
/** Observable Session state: cwd plus a deep copy of the whole /work tree. */
async function observe(value: Fixture) {
  const tree: unknown[] = [];
  const walk = async (path: string) => {
    for (const entry of await value.session.listEntries(path)) {
      tree.push(
        entry.type === 'file' ? { ...entry, data: [...entry.data] } : entry,
      );
      if (entry.type === 'dir') await walk(entry.path);
    }
  };
  await walk('/work');
  return JSON.stringify({ cwd: value.state.cwd, tree });
}
function aborted() {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}
function mockFetch(
  t: import('node:test').TestContext,
  respond: () => Response | Promise<Response>,
) {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return respond();
  });
  return () => calls;
}

// CommandDispatcher
test('whitespace-only and empty input resolve empty without taking the reservation', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  await value.register();
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  await assert.rejects(shell.execute('ls'), code('BUSY'));
  for (const input of ['', ' ', '\t \t']) {
    const result = await shell.execute(input);
    assert.deepEqual(
      { ...result, stdout: [...result.stdout], stderr: [...result.stderr] },
      { kind: 'empty', exitCode: 0, stdout: [], stderr: [] },
    );
  }
  await value.finishPending();
  assert.equal((await running).kind, 'guest');
});
test('argv[0] routes ls/cat/rm/cd to builtins, install to the installer and anything else to a guest', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  mockFetch(t, () => new Response(value.bytes));
  const shell = command(value);
  assert.equal((await shell.execute('ls')).kind, 'builtin');
  assert.equal((await shell.execute('cat /work/a.txt')).kind, 'builtin');
  assert.equal(value.requests.length, 0);
  assert.equal((await shell.execute('install fixture')).kind, 'install');
  const run = await shell.execute('fixture --version');
  assert.equal(run.kind, 'guest');
  assert.deepEqual(value.requests.at(-1)?.args, ['--version']);
});
test('pwd is not a builtin: unregistered it is NOT_FOUND and releases the run reservation', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  await assert.rejects(shell.execute('pwd'), code('NOT_FOUND'));
  await assert.rejects(shell.execute("''"), code('NOT_FOUND'));
  assert.equal((await shell.execute('ls')).kind, 'builtin');
  assert.equal(value.requests.length, 0);
});
test('reserved names stay builtins even when a guest with that name is registered', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  for (const name of ['ls', 'cat', 'rm', 'cd', 'install'])
    await value.register(name);
  const shell = command(value);
  assert.equal(text((await shell.execute('cat /work/a.txt')).stdout), 'alpha');
  assert.equal((await shell.execute('ls')).kind, 'builtin');
  assert.equal((await shell.execute('cd /work/sub')).kind, 'builtin');
  assert.equal((await shell.execute('rm -rf /work/sub/b.txt')).kind, 'builtin');
  await assert.rejects(shell.execute('install'), code('INVALID_INPUT'));
  assert.equal(value.requests.length, 0);
});
test('install ls@x registers a tool named ls, yet ls keeps running the builtin', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  mockFetch(t, () => new Response(value.bytes));
  const shell = command(
    value,
    mergeCatalogs(catalogFor(value.bytes), catalogFor(value.bytes, 'ls', 'x')),
  );
  const installed = await shell.execute('install ls@x');
  assert.equal(installed.installation?.tool, 'ls');
  assert.equal(installed.installation?.versionOrName, 'x');
  const listing = await shell.execute('ls');
  assert.equal(listing.kind, 'builtin');
  assert.equal(text(listing.stdout), 'a.txt\nsub/\n');
  assert.equal(value.requests.length, 0);
});
test('INVALID_INPUT wins over an already aborted signal for input, shape and selection', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const calls = mockFetch(t, () => new Response(value.bytes));
  const shell = command(value);
  for (const input of [
    'ls *',
    'cat "open',
    'rm -r -f /work/a.txt',
    'ls -a',
    'install',
    'install a b',
    'install unknown',
  ])
    await assert.rejects(
      shell.execute(input, { signal: aborted() }),
      code('INVALID_INPUT'),
      input,
    );
  assert.equal(calls(), 0);
});
test('ABORTED wins over DISPOSED and BUSY, and a preabort takes no reservation', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const calls = mockFetch(t, () => new Response(value.bytes));
  await value.register();
  const shell = command(value);
  const before = await observe(value);
  for (const input of ['ls', 'cat /work/a.txt', 'fixture', 'install fixture'])
    await assert.rejects(
      shell.execute(input, { signal: aborted() }),
      code('ABORTED'),
    );
  assert.equal(calls(), 0);
  assert.equal(value.requests.length, 0);
  assert.equal(await observe(value), before);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  await assert.rejects(shell.execute('ls'), code('BUSY'));
  for (const input of ['ls', 'rm -rf /work/a.txt', 'fixture'])
    await assert.rejects(
      shell.execute(input, { signal: aborted() }),
      code('ABORTED'),
    );
  await value.finishPending();
  await running;
  await value.session.dispose();
  await assert.rejects(
    shell.execute('ls', { signal: aborted() }),
    code('ABORTED'),
  );
});
test('reservation conflicts are BUSY, dispose is DISPOSED, and malformed input stays INVALID_INPUT', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  for (const input of ['ls', 'cat /work/a.txt', 'cd /work/sub', 'fixture'])
    await assert.rejects(shell.execute(input), code('BUSY'), input);
  await value.finishPending();
  await running;
  await value.session.dispose();
  for (const input of ['ls', 'cat /work/a.txt', 'fixture', 'install fixture'])
    await assert.rejects(shell.execute(input), code('DISPOSED'), input);
  await assert.rejects(shell.execute('ls *'), code('INVALID_INPUT'));
});
test('options are validated before input: non-signal and non-function callbacks are INVALID_INPUT', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  for (const options of [
    null,
    'x',
    { signal: 'abort' },
    { signal: { aborted: true } },
    { onOutput: 1 },
    { onProgress: 'progress' },
  ])
    await assert.rejects(
      shell.execute('ls', options as never),
      code('INVALID_INPUT'),
    );
  await assert.rejects(shell.execute(1 as never), code('INVALID_INPUT'));
});

// BuiltinAdapter
test('ls without and with one path lists the cwd or that directory', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  assert.equal(text((await shell.execute('ls')).stdout), 'a.txt\nsub/\n');
  assert.equal(text((await shell.execute('ls /work/sub')).stdout), 'b.txt\n');
  // A regular file path is not a directory: the Session returns no entries.
  assert.equal((await shell.execute('ls /work/a.txt')).stdout.length, 0);
});
test('ls flags and extra arguments are INVALID_INPUT before the reservation', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  // BUSY would prove a reservation attempt; INVALID_INPUT proves none.
  for (const input of ['ls -a', 'ls -', 'ls --all /work', 'ls /work /work/sub'])
    await assert.rejects(shell.execute(input), code('INVALID_INPUT'), input);
  await assert.rejects(shell.execute('ls'), code('BUSY'));
  await value.finishPending();
  await running;
});
test('cat returns the original bytes, cd changes the cwd, rm -rf removes the tree', async (t) => {
  const binary = new Uint8Array([0, 0xff, 0xfe, 10, 13, 0x80]);
  const value = harness([
    {
      path: '/work/bin',
      type: 'file',
      mode: 0o644,
      inodeId: 'b',
      data: binary,
    },
    { path: '/work/sub', type: 'dir', mode: 0o755 },
    {
      path: '/work/sub/c',
      type: 'file',
      mode: 0o644,
      inodeId: 'c',
      data: new Uint8Array([1]),
    },
  ]);
  t.after(() => value.session.dispose());
  const shell = command(value);
  const cat = await shell.execute('cat /work/bin');
  assert.deepEqual([...cat.stdout], [...binary]);
  assert.equal(cat.stderr.length, 0);
  const cd = await shell.execute('cd /work/sub');
  assert.deepEqual([cd.exitCode, cd.stdout.length], [0, 0]);
  assert.equal(value.state.cwd, '/work/sub');
  assert.equal(text((await shell.execute('ls')).stdout), 'c\n');
  await shell.execute('cd /work');
  const rm = await shell.execute('rm -rf /work/sub');
  assert.deepEqual([rm.exitCode, rm.stdout.length], [0, 0]);
  assert.equal(text((await shell.execute('ls /work')).stdout), 'bin\n');
});
test('relative paths resolve against the current cwd for cat, ls, cd and rm', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  assert.equal(text((await shell.execute('cat a.txt')).stdout), 'alpha');
  assert.equal(text((await shell.execute('cat ./sub/b.txt')).stdout), 'beta');
  assert.equal(text((await shell.execute('ls sub')).stdout), 'b.txt\n');
  assert.equal(text((await shell.execute('ls .')).stdout), 'a.txt\nsub/\n');
  await shell.execute('cd sub');
  assert.equal(value.state.cwd, '/work/sub');
  assert.equal(text((await shell.execute('cat b.txt')).stdout), 'beta');
  await assert.rejects(shell.execute('cat a.txt'), code('NOT_FOUND'));
  await shell.execute('cd .');
  assert.equal(value.state.cwd, '/work/sub');
  await shell.execute('rm -rf b.txt');
  assert.equal((await shell.execute('ls .')).stdout.length, 0);
  await assert.rejects(
    value.session.readFile('/work/sub/b.txt'),
    code('NOT_FOUND'),
  );
  assert.equal(text(await value.session.readFile('/work/a.txt')), 'alpha');
});
test('"..", empty and root-removing relative paths are INVALID_INPUT and keep state', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  await shell.execute('cd sub');
  const before = await observe(value);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  // BUSY or ABORTED would prove the path was checked after the reservation.
  for (const input of [
    'cat ..',
    'cat ../a.txt',
    'cd ..',
    'ls ..',
    'ls ./../sub',
    "cat ''",
    'rm -rf ../sub',
  ])
    await assert.rejects(
      shell.execute(input, { signal: aborted() }),
      code('INVALID_INPUT'),
      input,
    );
  await value.finishPending();
  await running;
  await shell.execute('cd /work');
  await assert.rejects(shell.execute('rm -rf .'), code('INVALID_INPUT'));
  await shell.execute('cd sub');
  assert.equal(await observe(value), before);
});
test('unsupported builtin shapes are refused and leave cwd and filesystem unchanged', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const before = await observe(value);
  for (const input of [
    'rm -r -f /work/sub',
    'rm -fr /work/sub',
    'rm /work/sub',
    'rm -rf',
    'rm -rf /work/a.txt /work/sub',
    'rm -rf -- /work/sub',
    'cat',
    'cat /work/a.txt /work/sub/b.txt',
    'cd',
    'cd /work /work/sub',
  ])
    await assert.rejects(shell.execute(input), code('INVALID_INPUT'), input);
  assert.equal(await observe(value), before);
});
test('Session NOT_FOUND and NOT_FILE propagate unchanged and the fs reservation is released', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const before = await observe(value);
  await assert.rejects(shell.execute('cat /work/missing'), code('NOT_FOUND'));
  await assert.rejects(shell.execute('cat /work/sub'), code('NOT_FILE'));
  await assert.rejects(shell.execute('cd /work/a.txt'), code('NOT_FILE'));
  await assert.rejects(shell.execute('cd /work/none'), code('NOT_FOUND'));
  await assert.rejects(shell.execute('ls /work/none'), code('NOT_FOUND'));
  await assert.rejects(shell.execute('rm -rf /work'), code('INVALID_INPUT'));
  assert.equal(await observe(value), before);
  assert.equal((await shell.execute('ls')).kind, 'builtin');
});
test('an abort raised after a builtin started does not change its completed result', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  for (const input of ['cat /work/a.txt', 'ls', 'cd /work/sub']) {
    const controller = new AbortController();
    const pending = shell.execute(input, { signal: controller.signal });
    controller.abort();
    const result = await pending;
    assert.equal(result.exitCode, 0, input);
  }
  assert.equal(value.state.cwd, '/work/sub');
  const controller = new AbortController();
  const removal = shell.execute('rm -rf /work/a.txt', {
    signal: controller.signal,
  });
  controller.abort();
  await removal;
  await assert.rejects(
    value.session.readFile('/work/a.txt'),
    code('NOT_FOUND'),
  );
});

// InstallAdapter
test('install prints the fixed success line and returns the InstallResult', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  mockFetch(t, () => new Response(value.bytes));
  const shell = command(value);
  const result = await shell.execute('install fixture@1.0.0');
  const installation = result.installation!;
  assert.equal(result.kind, 'install');
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr.length, 0);
  assert.equal(
    text(result.stdout),
    `installed fixture@1.0.0 (sha256 ${installation.digest})\n`,
  );
  assert.deepEqual(Object.keys(installation).sort(), [
    'buildKey',
    'digest',
    'operationId',
    'tool',
    'versionOrName',
  ]);
  assert.equal('runId' in result, false);
});
test('install relays every Progress unchanged with the result operationId', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  mockFetch(t, () => new Response(value.bytes));
  const shell = command(value);
  const events: Progress[] = [];
  const result = await shell.execute('install fixture', {
    onProgress: (event) => events.push(event),
  });
  assert.ok(events.length >= 4);
  assert.deepEqual(
    [...new Set(events.map((event) => event.phase))],
    ['fetch', 'digest', 'validate', 'register'],
  );
  for (const [index, event] of events.entries()) {
    assert.equal(event.operationId, result.installation?.operationId);
    assert.equal(event.sequence, index);
  }
});
test('a failed reinstall rejects with the installer error and keeps the old registration', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  let bad = false;
  mockFetch(
    t,
    () => new Response(bad ? new Uint8Array(value.bytes.length) : value.bytes),
  );
  const shell = command(value);
  await shell.execute('install fixture');
  bad = true;
  await assert.rejects(shell.execute('install fixture'), code('INVALID_INPUT'));
  const run = await shell.execute('fixture');
  assert.equal(run.kind, 'guest');
  assert.equal(value.requests.at(-1)?.guest[0], 127);
});
test('install argument count and catalog selection fail before any transfer', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const calls = mockFetch(t, () => new Response(value.bytes));
  const shell = command(value);
  for (const input of [
    'install',
    'install fixture fixture',
    'install https://evil.test/x',
    'install fixture@9.9.9',
  ])
    await assert.rejects(shell.execute(input), code('INVALID_INPUT'), input);
  assert.equal(calls(), 0);
});
test('install propagates installer transfer failure and an already aborted signal', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const calls = mockFetch(t, () => new Response('missing', { status: 404 }));
  const shell = command(value);
  await assert.rejects(shell.execute('install fixture'), code('ASSET_LOAD'));
  assert.equal(calls(), 1);
  await assert.rejects(
    shell.execute('install fixture', { signal: aborted() }),
    code('ABORTED'),
  );
  assert.equal(calls(), 1);
  await assert.rejects(shell.execute('fixture'), code('NOT_FOUND'));
});

// GuestRunAdapter
test('guest run forwards argv and copies exitCode, stdout, stderr and runId', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  value.plans.push({ stdout: 'out', stderr: 'err' });
  const result = await command(value).execute('fixture a "b c" \'\'');
  assert.deepEqual(value.requests.at(-1)?.args, ['a', 'b c', '']);
  assert.equal(result.kind, 'guest');
  assert.equal(result.exitCode, 0);
  assert.equal(text(result.stdout), 'out');
  assert.equal(text(result.stderr), 'err');
  assert.match(result.runId ?? '', /^session-\d+:\d+$/);
  assert.equal('installation' in result, false);
});
test('a nonzero guest exit resolves instead of rejecting', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  value.plans.push({ exitCode: 3, stderr: 'failed' });
  const result = await command(value).execute('fixture');
  assert.equal(result.exitCode, 3);
  assert.equal(text(result.stderr), 'failed');
});
test('a host/core failure rejects with the ExecutionError and the session stays usable', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  value.plans.push({ error: 'EXECUTION' });
  await assert.rejects(shell.execute('fixture'), (error: Error) => {
    assert.equal(error.name, 'ExecutionError');
    assert.equal((error as { code?: string }).code, 'EXECUTION');
    return true;
  });
  assert.equal((await shell.execute('fixture')).exitCode, 0);
});
test('an unregistered tool is NOT_FOUND, releases its reservation and keeps state', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const before = await observe(value);
  await assert.rejects(shell.execute('aube --version'), code('NOT_FOUND'));
  assert.equal(await observe(value), before);
  await value.register();
  assert.equal((await shell.execute('fixture')).kind, 'guest');
});
test('onOutput receives the guest chunks and no timeoutMs is passed (600000 ms default)', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  value.plans.push({ stdout: 'one', stderr: 'two' });
  const chunks: OutputChunk[] = [];
  const result = await command(value).execute('fixture', {
    onOutput: (chunk) => chunks.push(chunk),
  });
  assert.deepEqual(
    chunks.map((chunk) => [chunk.stream, text(chunk.bytes), chunk.runId]),
    [
      ['stdout', 'one', result.runId],
      ['stderr', 'two', result.runId],
    ],
  );
  // With a fixed clock the first deadline timer equals the full default.
  assert.equal(value.delays[0], 600_000);
});
test('aborting a running guest rejects ABORTED, terminates the Worker and releases', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  const controller = new AbortController();
  value.plans.push({ pending: true });
  const running = shell.execute('fixture', { signal: controller.signal });
  await value.started();
  controller.abort();
  await assert.rejects(running, code('ABORTED'));
  assert.equal(value.terminated(), 1);
  assert.equal((await shell.execute('ls')).kind, 'builtin');
});

// ResultBuilder
test('cat bytes are a fresh copy per call and never alias the session file', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const first = await shell.execute('cat /work/a.txt');
  first.stdout.fill(0);
  const second = await shell.execute('cat /work/a.txt');
  assert.notEqual(first.stdout.buffer, second.stdout.buffer);
  assert.equal(text(second.stdout), 'alpha');
  assert.equal(text(await value.session.readFile('/work/a.txt')), 'alpha');
});
test('guest result bytes do not share buffers with the relayed output chunks', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  value.plans.push({ stdout: 'abc' });
  const chunks: OutputChunk[] = [];
  const result = await command(value).execute('fixture', {
    onOutput: (chunk) => chunks.push(chunk),
  });
  assert.notEqual(result.stdout.buffer, chunks[0]?.bytes.buffer);
  chunks[0]?.bytes.fill(0);
  assert.equal(text(result.stdout), 'abc');
});
test('empty and empty-output results still return distinct zero-length arrays', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const first = await shell.execute('');
  const second = await shell.execute(' ');
  const cd = await shell.execute('cd /work');
  for (const bytes of [first.stdout, first.stderr, cd.stdout, cd.stderr])
    assert.ok(bytes instanceof Uint8Array && bytes.length === 0);
  assert.notEqual(first.stdout, second.stdout);
  assert.notEqual(first.stdout, first.stderr);
});
