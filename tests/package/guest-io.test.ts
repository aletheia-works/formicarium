import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromCoreSnapshot,
  runGuest,
  runSession,
  toCoreEntries,
} from '../../runtime/guest-io.js';
import { entryAt } from '../shared/assertions.js';
import { fakeLauncher, fileEntry } from './fixtures.js';

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;
const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

test('core entries keep modes, link shared inodes and add missing parents', () => {
  const file = fileEntry('/work/a');
  const rows = toCoreEntries(
    [
      file,
      { ...file, path: '/work/b' },
      { path: '/work/c', data: 'other' },
      { path: '/work/dir', type: 'dir', mode: 0o700 },
      { path: '/work/link', type: 'symlink', target: './missing' },
    ],
    ['/work/project/sub'],
  );
  const at = (path: string) => rows.find((row) => row.path === path);
  assert.deepEqual(
    rows.map((row) => row.path),
    [
      '/work',
      '/work/a',
      '/work/b',
      '/work/c',
      '/work/dir',
      '/work/link',
      '/work/project',
      '/work/project/sub',
    ],
  );
  assert.equal(at('/work')?.mode, S_IFDIR | 0o755);
  assert.equal(at('/work/dir')?.mode, S_IFDIR | 0o700);
  assert.equal(at('/work/a')?.mode, S_IFREG | 0o644);
  assert.equal(at('/work/a')?.inode, at('/work/b')?.inode);
  assert.equal(at('/work/c')?.inode, undefined);
  assert.equal(at('/work/link')?.mode, S_IFLNK | 0o777);
  assert.equal(text(at('/work/link')?.content), './missing');
});

test('core entries refuse invalid paths and file or symlink parents', () => {
  assert.throws(() => toCoreEntries([{ path: 'relative' }]), /absolute/);
  assert.throws(() => toCoreEntries([{ path: '/work/../x' }]), /\.\./);
  assert.throws(
    () => toCoreEntries([fileEntry('/work/project')], ['/work/project/sub']),
    /non-directory/,
  );
  assert.throws(
    () =>
      toCoreEntries([
        { path: '/work/project', type: 'symlink', target: 'target' },
        fileEntry('/work/project/input'),
      ]),
    /non-directory/,
  );
});

test('snapshot keeps entries in the roots, hard links and symlinks', () => {
  const entries = fromCoreSnapshot(
    [
      { path: '/root', mode: S_IFDIR | 0o700 },
      { path: '/tmp/x', mode: S_IFREG | 0o644, content: Uint8Array.of(1) },
      { path: '/work', mode: S_IFDIR | 0o755 },
      {
        path: '/work/a',
        mode: S_IFREG | 0o600,
        content: Uint8Array.of(7),
        inode: 9n,
      },
      {
        path: '/work/b',
        mode: S_IFREG | 0o600,
        content: Uint8Array.of(7),
        inode: 9n,
      },
      {
        path: '/work/link',
        mode: S_IFLNK | 0o777,
        content: new TextEncoder().encode('a'),
      },
    ],
    ['/work'],
  );
  assert.deepEqual(
    entries.map((entry) => entry.path),
    ['/work', '/work/a', '/work/b', '/work/link'],
  );
  const a = entryAt(entries, '/work/a', 'file');
  assert.equal(a.mode, 0o600);
  assert.equal(a.inodeId, entryAt(entries, '/work/b', 'file').inodeId);
  assert.equal(entryAt(entries, '/work/link', 'symlink').target, 'a');
});

test('snapshot refuses special files rather than silently omitting them', () => {
  assert.throws(
    () => fromCoreSnapshot([{ path: '/work/fifo', mode: 0o010644 }], ['/work']),
    /special/,
  );
});

test('a guest run places the guest, passes argv0 and env, and streams output', async () => {
  const launcher = fakeLauncher(() => ({
    stdout: [Uint8Array.of(1), Uint8Array.of(2)],
    stderr: [Uint8Array.of(3)],
    exit: { kind: 'exited', code: 3 },
  }));
  const seen: number[] = [];
  const result = await runGuest({
    launcher,
    guestPath: '/guest/program',
    args: ['--flag'],
    entries: [fileEntry('/guest/program', Uint8Array.of(0x7f), 0o755)],
    env: { HOME: '/home/user' },
    cwd: '/work/project/sub',
    onStdout: (bytes) => seen.push(...bytes),
  });
  assert.equal(result.exitCode, 3);
  assert.deepEqual(result.stdout, Uint8Array.of(1, 2));
  assert.deepEqual(result.stderr, Uint8Array.of(3));
  assert.deepEqual(seen, [1, 2]);
  assert.equal(result.snapshot, undefined);
  const [run] = launcher.runs;
  assert.equal(run?.program, '/guest/program');
  assert.deepEqual(run?.args, ['/guest/program', '--flag']);
  assert.deepEqual(run?.env, { HOME: '/home/user', PATH: '/usr/bin:/bin' });
  assert.equal(run?.files.get('/work/project/sub')?.mode, S_IFDIR | 0o755);
  assert.equal(run?.files.get('/guest/program')?.mode, S_IFREG | 0o755);
  assert.equal(launcher.state.disposedFilesystems, 1);
});

test('a signalled guest exits with 128 plus the signal and a core failure throws', async () => {
  const signalled = await runGuest({
    launcher: fakeLauncher(() => ({ exit: { kind: 'signaled', signal: 9 } })),
    guestPath: '/guest/program',
  });
  assert.equal(signalled.exitCode, 137);
  const failing = fakeLauncher(() => ({ fail: new Error('trap') }));
  await assert.rejects(
    runGuest({ launcher: failing, guestPath: '/guest/program' }),
    { name: 'GuestRunError', message: /core failed/ },
  );
  assert.equal(failing.state.disposedFilesystems, 1);
  await assert.rejects(
    runGuest({ launcher: undefined as never, guestPath: '/guest/program' }),
    /launcher/,
  );
  await assert.rejects(
    runGuest({ launcher: failing, guestPath: 'program' }),
    /absolute/,
  );
});

test('a snapshot failure is reported with the SNAPSHOT code', async () => {
  const launcher = fakeLauncher(({ files }) => {
    files.set('/work/fifo', { path: '/work/fifo', mode: 0o010644 });
    return {};
  });
  await assert.rejects(
    runGuest({
      launcher,
      guestPath: '/guest/program',
      snapshotRoots: ['/work'],
    }),
    { code: 'SNAPSHOT' },
  );
});

test('a session carries persisted roots between steps and runs host steps without the core', async () => {
  const scratchCarried: boolean[] = [];
  const launcher = fakeLauncher(({ args, files }) => {
    scratchCarried.push(files.has('/tmp/scratch'));
    if (args[1] === 'write')
      files.set('/work/out', {
        path: '/work/out',
        mode: S_IFREG | 0o644,
        content: new TextEncoder().encode('kept'),
      });
    files.set('/tmp/scratch', { path: '/tmp/scratch', mode: S_IFREG | 0o644 });
    return {};
  });
  const results = await runSession({
    launcher,
    guestPath: '/guest/program',
    guestEntry: fileEntry('/guest/program', Uint8Array.of(0x7f), 0o755),
    steps: [
      { args: ['write'] },
      { catFile: '/work/out' },
      { args: ['read'] },
      { removeTree: '/work/out' },
      { args: ['read'] },
    ],
  });
  assert.deepEqual(
    results.map((result) => result.exitCode),
    [0, 0, 0, 0, 0],
  );
  assert.equal(text(results[1]?.stdout), 'kept');
  assert.equal(launcher.runs.length, 3);
  assert.equal(text(launcher.runs[1]?.files.get('/work/out')?.content), 'kept');
  assert.deepEqual(scratchCarried, [false, false, false]);
  assert.equal(launcher.runs[2]?.files.has('/work/out'), false);
  await assert.rejects(
    runSession({
      launcher,
      guestPath: '/guest/program',
      guestEntry: fileEntry('/guest/program'),
      steps: [{ removeTree: '/work' }],
    }),
    /removeTree must be inside/,
  );
});

/** A core whose guest records its stdin and exits when the test says so. */
function stdinLauncher() {
  const seen = {
    tty: undefined as unknown,
    network: undefined as unknown,
    written: [] as number[],
    closed: false,
    exit: () => {},
  };
  const base = fakeLauncher();
  const launcher = {
    ...base,
    run(options: Parameters<typeof base.run>[0]) {
      seen.tty = options.tty;
      seen.network = options.network;
      const exited = new Promise<{ kind: 'exited'; code: number }>(
        (resolve) => {
          seen.exit = () => resolve({ kind: 'exited', code: 0 });
        },
      );
      const empty = () =>
        new ReadableStream<Uint8Array>({ start: (c) => c.close() });
      return {
        stdin: new WritableStream<Uint8Array>({
          write(chunk) {
            seen.written.push(...chunk);
          },
          close() {
            seen.closed = true;
          },
        }),
        stdout: empty(),
        stderr: empty(),
        exited,
        kill() {},
      };
    },
  };
  return { launcher, seen };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('runGuest pipes stdin and the terminal size to the core guest', async () => {
  const { launcher, seen } = stdinLauncher();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stdin = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  const running = runGuest({
    launcher,
    guestPath: '/guest/program',
    stdin,
    terminal: { columns: 80, rows: 24 },
  });
  await settle();
  assert.deepEqual(seen.tty, { columns: 80, rows: 24 });
  controller.enqueue(Uint8Array.of(0x61, 0x0d));
  controller.close();
  await settle();
  assert.deepEqual(seen.written, [0x61, 0x0d]);
  assert.equal(seen.closed, true);
  seen.exit();
  assert.equal((await running).exitCode, 0);
});
test('runGuest gives the core a copy of the allowed destinations', async () => {
  const { launcher, seen } = stdinLauncher();
  const allow = ['github.com:443'];
  const running = runGuest({
    launcher,
    guestPath: '/guest/program',
    network: { allow },
  });
  await settle();
  assert.deepEqual(seen.network, { allow: ['github.com:443'] });
  assert.notEqual((seen.network as { allow: string[] }).allow, allow);
  seen.exit();
  await running;
});
test('runGuest gives the core a copy of the relay', async () => {
  const { launcher, seen } = stdinLauncher();
  const relay = { url: 'wss://relay.example/', protocols: ['lambda-microvms'] };
  const running = runGuest({
    launcher,
    guestPath: '/guest/program',
    network: { allow: ['github.com:443'], relay },
  });
  await settle();
  assert.deepEqual(seen.network, {
    allow: ['github.com:443'],
    relay: { url: 'wss://relay.example/', protocols: ['lambda-microvms'] },
  });
  assert.notEqual(
    (seen.network as { relay: { protocols: string[] } }).relay.protocols,
    relay.protocols,
  );
  seen.exit();
  await running;
});
test('runGuest stops reading stdin when the guest exits, and an errored stdin is end of file', async () => {
  const { launcher, seen } = stdinLauncher();
  let cancelled = false;
  const open = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const running = runGuest({
    launcher,
    guestPath: '/guest/program',
    stdin: open,
  });
  await settle();
  assert.equal(seen.tty, undefined);
  seen.exit();
  await running;
  assert.equal(cancelled, true);
  const failing = stdinLauncher();
  const broken = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error('gone'));
    },
  });
  const second = runGuest({
    launcher: failing.launcher,
    guestPath: '/guest/program',
    stdin: broken,
  });
  await settle();
  assert.equal(failing.seen.closed, true);
  failing.seen.exit();
  await second;
  // Without stdin the guest reads end of file at once.
  const plain = stdinLauncher();
  const third = runGuest({
    launcher: plain.launcher,
    guestPath: '/guest/program',
  });
  await settle();
  assert.equal(plain.seen.closed, true);
  plain.seen.exit();
  await third;
});
