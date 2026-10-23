import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import type { ExecutionError } from '../../runtime/errors.js';
import { sha256 } from '../../scripts/package/stage-package.js';

const candidate = JSON.parse(
  await readFile(
    process.env.FORMICARIUM_CANDIDATE ??
      new URL('../../.artifacts/u1-package.manifest.json', import.meta.url),
    'utf8',
  ),
);
assert.equal(
  sha256(await readFile(candidate.tarball.path)),
  candidate.tarball.sha256,
  'exact verified tgz identity',
);
const consumer = process.env.FORMICARIUM_CONSUMER;
if (!consumer)
  throw new Error(
    'FORMICARIUM_CONSUMER must name an independently installed consumer outside the repository',
  );
const root = await realpath(consumer);
const repository = await realpath(new URL('../../', import.meta.url));
assert.ok(
  !root.startsWith(`${repository}/`),
  'consumer must be outside the repository',
);
const installed = resolve(root, 'node_modules/@aletheia-works/formicarium');
for (const entry of candidate.files)
  assert.equal(
    sha256(await readFile(resolve(installed, entry.path))),
    entry.sha256,
    `installed ${entry.path}`,
  );
const { createSession } = (await import(
  pathToFileURL(resolve(installed, 'runtime/node/api.js')).href
)) as typeof import('../../runtime/node/api.js');
const guest = new Uint8Array(
  await readFile(new URL('../../.artifacts/u1-fixture/guest', import.meta.url)),
);

test('installed real archive uses default assets and normal guest', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const result = await session.run({ guest });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
});
test('installed real archive preserves nonUTF8 stdout/stderr and nonzero exit', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const chunks: import('../../types/index.js').OutputChunk[] = [];
  const result = await session.run({
    guest,
    args: ['bytes'],
    onOutput: (chunk) => chunks.push(chunk),
  });
  assert.equal(result.exitCode, 3);
  assert.deepEqual([...result.stdout], [0, 255, 128, 65, 10]);
  assert.deepEqual([...result.stderr], [254, 0, 66, 10]);
  assert.ok(chunks.length > 0);
});
test('real snapshot preserves hardlink/symlink/modes/deletion into next fresh core', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  assert.equal((await session.run({ guest, args: ['seed'] })).exitCode, 0);
  const entries = await session.listEntries('/work/kept');
  const a = entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path === '/work/kept/a',
  )!;
  const b = entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path === '/work/kept/b',
  )!;
  assert.equal(a.inodeId, b.inodeId);
  assert.equal(a.mode & 0o777, 0o640);
  assert.equal(
    entries.find(
      (entry): entry is Extract<typeof entry, { type: 'symlink' }> =>
        entry.type === 'symlink' && entry.path === '/work/kept/link',
    )?.target,
    'a',
  );
  await assert.rejects(session.readFile('/work/deleted'), {
    code: 'NOT_FOUND',
  });
  assert.equal((await session.run({ guest, args: ['verify'] })).exitCode, 0);
  assert.deepEqual([...(await session.readFile('/work/kept/a'))], [9, 8]);
});
test('CPU-bound real guest timeout settles and immediately releases session', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  await assert.rejects(
    session.run({ guest, args: ['spin'], timeoutMs: 1500 }),
    (error: ExecutionError) => {
      assert.equal(error.code, 'TIMEOUT');
      assert.match(new TextDecoder().decode(error.stdout), /spin-started/);
      return true;
    },
  );
  assert.equal((await session.run({ guest })).exitCode, 0);
});
test('CPU-bound real guest abort rolls back and immediately permits next run', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const controller = new AbortController();
  const running = session.run({
    guest,
    args: ['spin'],
    signal: controller.signal,
    onOutput: (chunk) => {
      if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
        controller.abort();
    },
  });
  await assert.rejects(running, (error: ExecutionError) => {
    assert.equal(error.code, 'ABORTED');
    assert.match(new TextDecoder().decode(error.stdout), /spin-started/);
    return true;
  });
  assert.deepEqual(await session.listEntries(), []);
  assert.equal((await session.run({ guest })).exitCode, 0);
});
test('real guest thread normal exit permits another fresh Worker run', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  const result = await session.run({ guest, args: ['thread-exit'] });
  assert.equal(result.exitCode, 0);
  assert.match(new TextDecoder().decode(result.stdout), /child-finished/);
  assert.equal((await session.run({ guest })).exitCode, 0);
});

test('installed real loader mutation never executes unverified original URL bytes', async (t) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'formicarium-loader-red-'));
  const { mutatedLoaderFixture } = await import('./loader-mutation.js');
  const { loadPackageCore } = await import(
    pathToFileURL(resolve(installed, 'runtime/core.js')).href
  );
  const { runGuest } = await import(
    pathToFileURL(resolve(installed, 'runtime/guest-io.js')).href
  );
  const fixture = await mutatedLoaderFixture(
    directory,
    resolve(installed, 'assets/paludarium'),
  );
  const adapter = await loadPackageCore(fixture);
  t.after(async () => {
    await adapter.cleanup();
    await fixture.dispose();
    delete (globalThis as unknown as Record<string, unknown>)[fixture.marker];
    await rm(directory, { recursive: true, force: true });
  });
  const result = await runGuest({
    launcher: adapter.launcher,
    guestPath: '/guest/program',
    entries: [
      {
        path: '/guest/program',
        type: 'file' as const,
        data: guest,
        mode: 0o755,
      },
    ],
    snapshotRoots: ['/work'],
  });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
  assert.equal(
    (globalThis as unknown as Record<string, unknown>)[fixture.marker] ?? 0,
    0,
    'changed original URL marker executed despite digest verification',
  );
});

/** Each oracle owns a private temp root; other test processes keep their own environment. */
async function withCleanupOracle(
  callback: (oracle: {
    directory: string;
    assertEmpty(): Promise<void>;
    observeLoader(): void;
  }) => Promise<void>,
) {
  const { mkdtemp, readdir, rm } = await import('node:fs/promises');
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(
    join(tmpdir(), 'formicarium-cleanup-oracle-'),
  );
  const hadTmpdir = Object.hasOwn(process.env, 'TMPDIR');
  const previousTmpdir = process.env.TMPDIR;
  const expectedLoader = await readFile(
    resolve(installed, 'assets/paludarium/index.mjs'),
  );
  process.env.TMPDIR = directory;
  try {
    return await callback({
      directory,
      async assertEmpty() {
        assert.deepEqual(
          await readdir(directory),
          [],
          'owned temporary loader resources must be released before settlement',
        );
      },
      observeLoader() {
        const directories = readdirSync(directory);
        assert.equal(
          directories.length,
          1,
          'the active run must own one real loader directory',
        );
        const ownerPath = join(directory, directories[0]);
        const loaderPath = join(ownerPath, 'index.mjs');
        assert.equal(statSync(ownerPath).mode & 0o777, 0o700);
        assert.equal(statSync(loaderPath).mode & 0o777, 0o400);
        assert.equal(
          sha256(readFileSync(loaderPath)),
          sha256(expectedLoader),
          'the active loader contains the verified candidate bytes',
        );
      },
    });
  } finally {
    if (hadTmpdir) process.env.TMPDIR = previousTmpdir;
    else delete process.env.TMPDIR;
    await rm(directory, { recursive: true, force: true });
  }
}

test('Node host removes verified loader directories after normal abort timeout and disposal', async () => {
  await withCleanupOracle(async (oracle) => {
    const session = await createSession();
    try {
      let normalObserved = false;
      assert.equal(
        (
          await session.run({
            guest,
            onOutput: (chunk) => {
              if (
                new TextDecoder().decode(chunk.bytes).includes('fixture-ok')
              ) {
                oracle.observeLoader();
                normalObserved = true;
              }
            },
          })
        ).exitCode,
        0,
      );
      assert.equal(normalObserved, true);
      await oracle.assertEmpty();
      const controller = new AbortController();
      let abortObserved = false;
      await assert.rejects(
        session.run({
          guest,
          args: ['spin'],
          signal: controller.signal,
          onOutput: (chunk) => {
            if (
              new TextDecoder().decode(chunk.bytes).includes('spin-started')
            ) {
              oracle.observeLoader();
              abortObserved = true;
              controller.abort();
            }
          },
        }),
        { code: 'ABORTED' },
      );
      assert.equal(abortObserved, true);
      await oracle.assertEmpty();
      let timeoutObserved = false;
      await assert.rejects(
        session.run({
          guest,
          args: ['spin'],
          timeoutMs: 1500,
          onOutput: (chunk) => {
            if (
              new TextDecoder().decode(chunk.bytes).includes('spin-started')
            ) {
              oracle.observeLoader();
              timeoutObserved = true;
            }
          },
        }),
        { code: 'TIMEOUT' },
      );
      assert.equal(timeoutObserved, true);
      await oracle.assertEmpty();
      let disposeObserved = false;
      await assert.rejects(
        session.run({
          guest,
          args: ['spin'],
          onOutput: (chunk) => {
            if (
              new TextDecoder().decode(chunk.bytes).includes('spin-started')
            ) {
              oracle.observeLoader();
              disposeObserved = true;
              void session.dispose();
            }
          },
        }),
        { code: 'ABORTED' },
      );
      assert.equal(disposeObserved, true);
      await session.dispose();
      await oracle.assertEmpty();
    } finally {
      await session.dispose();
    }
  });
});

test('public removed nested cwd is recreated by real guest run', async (t) => {
  const session = await createSession({
    entries: [{ path: '/work/project/sub', type: 'dir', mode: 0o700 }],
  });
  t.after(() => session.dispose());
  await session.setCwd('/work/project/sub');
  await session.remove('/work/project');
  const result = await session.run({ guest });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
  const project = (await session.listEntries('/work')).find(
    (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
      entry.type === 'dir' && entry.path === '/work/project',
  )!;
  const sub = (await session.listEntries('/work/project')).find(
    (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
      entry.type === 'dir' && entry.path === '/work/project/sub',
  )!;
  assert.equal(project.mode & 0o777, 0o755);
  assert.equal(sub.mode & 0o777, 0o755);
});

test('removed cwd snapshot rollback next-run and reset preserve seed state', async (t) => {
  const session = await createSession({
    entries: [
      { path: '/work/project/sub', type: 'dir', mode: 0o700 },
      {
        path: '/work/project/sub/input',
        type: 'file',
        inodeId: 'seed-input',
        mode: 0o640,
        data: Uint8Array.of(7, 8),
      },
    ],
  });
  t.after(() => session.dispose());
  await session.setCwd('/work/project/sub');
  await session.remove('/work/project');
  const controller = new AbortController();
  await assert.rejects(
    session.run({
      guest,
      args: ['spin'],
      signal: controller.signal,
      onOutput: (chunk) => {
        if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
          controller.abort();
      },
    }),
    { code: 'ABORTED' },
  );
  assert.equal(
    (await session.listEntries('/work')).some(
      (entry) => entry.path === '/work/project',
    ),
    false,
  );
  assert.equal((await session.run({ guest })).exitCode, 0);
  assert.equal((await session.run({ guest })).exitCode, 0);
  assert.equal(
    (await session.listEntries('/work/project')).find(
      (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
        entry.type === 'dir' && entry.path === '/work/project/sub',
    )!.mode & 0o777,
    0o755,
  );
  await session.reset();
  assert.equal(
    (await session.listEntries('/work/project')).find(
      (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
        entry.type === 'dir' && entry.path === '/work/project/sub',
    )!.mode & 0o777,
    0o700,
  );
  assert.deepEqual(
    [...(await session.readFile('/work/project/sub/input'))],
    [7, 8],
  );
});

test('cleanup oracle ignores deletion by an unrelated temporary resource owner', async () => {
  const { createCoreResourceOwner } = await import(
    pathToFileURL(resolve(installed, 'runtime/core.js')).href
  );
  const { CORE_FILES } = await import(
    pathToFileURL(resolve(installed, 'runtime/core.js')).href
  );
  const unrelated = createCoreResourceOwner();
  const core: Record<string, Uint8Array> = {};
  for (const name of CORE_FILES as string[])
    core[name] = new Uint8Array(
      await readFile(resolve(installed, 'assets/paludarium', name)),
    );
  try {
    const descriptor = await unrelated.allocate(core);
    await withCleanupOracle(async (oracle) => {
      assert.equal(
        descriptor.moduleURL.startsWith(
          pathToFileURL(`${oracle.directory}/`).href,
        ),
        false,
      );
      await oracle.assertEmpty(); // A real other-owner resource exists outside our root.
      await unrelated.dispose();
      await oracle.assertEmpty(); // Its deletion has no influence.
      const leaked = createCoreResourceOwner();
      try {
        await leaked.allocate(core);
        oracle.observeLoader();
        await assert.rejects(
          oracle.assertEmpty(),
          { code: 'ERR_ASSERTION' },
          'a deliberately retained owned loader must fail the cleanup oracle',
        );
      } finally {
        await leaked.dispose();
      }
      await oracle.assertEmpty();
    });
  } finally {
    await unrelated.dispose();
  }
});
