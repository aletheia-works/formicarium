import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandSession } from '../../runtime/command.js';
import type {
  CommandOptions,
  FsEntry,
  OutputChunk,
  Progress,
} from '../../types/index.js';
import {
  catalogFor,
  dir,
  file,
  harness,
  mergeCatalogs,
  text,
} from './command-harness.js';

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
  for (const name of ['ls', 'cat', 'rm', 'cd', 'cp', 'mv', 'install'])
    await value.register(name);
  const shell = command(value);
  assert.equal(text((await shell.execute('cat /work/a.txt')).stdout), 'alpha');
  assert.equal((await shell.execute('ls')).kind, 'builtin');
  assert.equal((await shell.execute('cd /work/sub')).kind, 'builtin');
  assert.equal((await shell.execute('cp b.txt c.txt')).kind, 'builtin');
  assert.equal((await shell.execute('mv c.txt d.txt')).kind, 'builtin');
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
    'cp',
    'cp /work/a.txt',
    'cp /work/a.txt /work/x /work/y',
    'cp -R /work/sub /work/x',
    'cp -rf /work/sub /work/x',
    'cp -r /work/sub',
    'cp -- /work/a.txt /work/x',
    'cp /work/a.txt -x',
    'mv',
    'mv /work/a.txt',
    'mv -r /work/sub /work/x',
    'mv -f /work/a.txt /work/x',
    'mv /work/a.txt /work/x /work/y',
  ])
    await assert.rejects(shell.execute(input), code('INVALID_INPUT'), input);
  assert.equal(await observe(value), before);
});
test('cp copies a file with a new inode and mv renames it keeping its inode', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  const shell = command(value);
  const inode = async (path: string) => {
    const entry = (
      await value.session.listEntries(path.slice(0, path.lastIndexOf('/')))
    ).find((candidate) => candidate.path === path);
    return entry?.type === 'file' ? entry.inodeId : undefined;
  };
  const cp = await shell.execute('cp a.txt copy.txt');
  assert.deepEqual([cp.kind, cp.exitCode, cp.stdout.length], ['builtin', 0, 0]);
  assert.equal(text(await value.session.readFile('/work/copy.txt')), 'alpha');
  const copied = await inode('/work/copy.txt');
  assert.ok(copied);
  assert.notEqual(copied, await inode('/work/a.txt'));
  await shell.execute('cp a.txt sub');
  assert.equal(text(await value.session.readFile('/work/sub/a.txt')), 'alpha');
  await shell.execute('mv copy.txt sub/moved.txt');
  await assert.rejects(
    value.session.readFile('/work/copy.txt'),
    code('NOT_FOUND'),
  );
  assert.equal(await inode('/work/sub/moved.txt'), copied);
  await shell.execute('mv sub/moved.txt .');
  assert.equal(text(await value.session.readFile('/work/moved.txt')), 'alpha');
});
test('cp onto an existing file keeps its mode and inode, so its hard links change too', async (t) => {
  const linked = (path: string): FsEntry => ({
    path,
    type: 'file',
    mode: 0o600,
    inodeId: 'shared',
    data: new TextEncoder().encode('stale'),
  });
  const value = harness([
    file('/work/new', 'fresh'),
    linked('/work/old'),
    linked('/work/link'),
  ]);
  t.after(() => value.session.dispose());
  const shell = command(value);
  await shell.execute('cp new old');
  assert.equal(text(await value.session.readFile('/work/link')), 'fresh');
  const old = (await value.session.listEntries('/work')).find(
    (entry) => entry.path === '/work/old',
  );
  assert.deepEqual(old?.type === 'file' && [old.mode, old.inodeId], [
    0o600,
    'shared',
  ]);
  await assert.rejects(shell.execute('cp old link'), code('INVALID_INPUT'));
  await assert.rejects(shell.execute('cp old old'), code('INVALID_INPUT'));
});
test('cp -r copies a tree with symlinks as they are, and mv moves a tree and the cwd with it', async (t) => {
  const value = harness([
    dir('/work/src'),
    file('/work/src/x', 'x'),
    dir('/work/src/deep'),
    file('/work/src/deep/y', 'y'),
    { path: '/work/src/link', type: 'symlink', target: 'x' },
  ]);
  t.after(() => value.session.dispose());
  const shell = command(value);
  const ls = async (path: string) =>
    text((await shell.execute(`ls ${path}`)).stdout);
  await assert.rejects(shell.execute('cp src dst'), code('NOT_FILE'));
  await assert.rejects(shell.execute('cp src/link dst'), code('NOT_FILE'));
  await shell.execute('cp -r src dst');
  assert.equal(await ls('dst'), 'deep/\nlink -> x\nx\n');
  assert.equal(await ls('src'), 'deep/\nlink -> x\nx\n');
  assert.equal(text(await value.session.readFile('/work/dst/deep/y')), 'y');
  await shell.execute('cp -r src/link dst/link2');
  assert.equal(await ls('dst'), 'deep/\nlink -> x\nlink2 -> x\nx\n');
  await shell.execute('cd src/deep');
  await shell.execute('mv /work/src /work/dst');
  assert.equal(value.state.cwd, '/work/dst/src/deep');
  assert.equal(text(await value.session.readFile('/work/dst/src/deep/y')), 'y');
  assert.equal(await ls('/work'), 'dst/\n');
});
test('cp and mv refuse to overwrite a directory, move into themselves or move a root, and keep state', async (t) => {
  const value = harness([
    file('/work/a', 'a'),
    { ...file('/work/a', 'a'), path: '/work/b' },
    dir('/work/d'),
    dir('/work/d/a'),
    dir('/work/d/e'),
    { path: '/work/d/tmp', type: 'symlink', target: '../tmp' },
    dir('/work/e'),
    file('/work/e/f', 'f'),
  ]);
  t.after(() => value.session.dispose());
  const shell = command(value);
  const before = await observe(value);
  for (const input of [
    'cp a d',
    'mv a d',
    'cp -r e d',
    'mv e d',
    'cp -r e e/inner',
    'mv e e/inner',
    'mv e e',
    'mv a b',
    'mv /work /work/d/w',
    'cp -r e a',
    'mv e a',
    'cp a e/f/g',
    'mv a /tmp/a',
    // At /work/tmp, the symlink's `../tmp` would point outside the roots.
    'cp -r d/tmp tmp',
    'mv d/tmp tmp',
  ])
    await assert.rejects(shell.execute(input), code('INVALID_INPUT'), input);
  await assert.rejects(shell.execute('cp a missing/a'), code('NOT_FOUND'));
  await assert.rejects(shell.execute('mv missing a'), code('NOT_FOUND'));
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
test('stdin and terminal reach guest runs only, and lift the default timeout', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  const stdin = new ReadableStream<Uint8Array>();
  await shell.execute('fixture', {
    stdin,
    terminal: { columns: 100, rows: 30 },
  });
  const request = value.requests.at(-1);
  assert.equal(request?.interactive, true);
  assert.deepEqual(request?.terminal, { columns: 100, rows: 30 });
  assert.equal(value.delays.includes(600_000), false);
  // Builtins and install never read the stream.
  const unread = new ReadableStream<Uint8Array>();
  await shell.execute('ls', {
    stdin: unread,
    terminal: { columns: 1, rows: 1 },
  });
  assert.equal(unread.locked, false);
  assert.equal(value.requests.length, 1);
});
test('network reaches guest runs only, as a copy', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  const allow = ['github.com:443'];
  await shell.execute('fixture', { network: { allow } });
  allow.push('example.com');
  assert.deepEqual(value.requests.at(-1)?.network, {
    allow: ['github.com:443'],
  });
  await shell.execute('fixture');
  assert.equal(value.requests.at(-1)?.network, undefined);
  // Builtins never start a run.
  await shell.execute('ls', { network: { allow } });
  assert.equal(value.requests.length, 2);
});
test('a guest run with a terminal gets TERM=xterm-256color; one without gets no TERM', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  await shell.execute('fixture', { terminal: { columns: 80, rows: 24 } });
  assert.equal(value.requests.at(-1)?.env?.TERM, 'xterm-256color');
  await shell.execute('fixture');
  assert.equal(value.requests.at(-1)?.env?.TERM, undefined);
});
test('a malformed stdin, terminal or network is INVALID_INPUT before the reservation', async (t) => {
  const value = harness();
  t.after(() => value.session.dispose());
  await value.register();
  const shell = command(value);
  value.plans.push({ pending: true });
  const running = shell.execute('fixture');
  await value.started();
  const locked = new ReadableStream<Uint8Array>();
  locked.getReader();
  for (const options of [
    { stdin: 'keys' },
    { stdin: locked },
    { terminal: { columns: 0, rows: 24 } },
    { terminal: { columns: 80 } },
    { terminal: null },
    { network: null },
    { network: { allow: 'github.com' } },
    { network: { allow: ['github.com:0'] } },
  ])
    await assert.rejects(
      shell.execute('fixture', options as unknown as CommandOptions),
      code('INVALID_INPUT'),
      JSON.stringify(options),
    );
  await value.finishPending();
  await running;
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
