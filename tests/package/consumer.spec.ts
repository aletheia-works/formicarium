import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';
import { sha256 } from '../../scripts/package/stage-package.js';
import { serveDirectory } from './fixtures.js';

let server: Awaited<ReturnType<typeof serveDirectory>>;
const candidate = JSON.parse(
  await readFile(
    process.env.FORMICARIUM_CANDIDATE ??
      new URL('../../.artifacts/u1-package.manifest.json', import.meta.url),
    'utf8',
  ),
);
if (!process.env.FORMICARIUM_CONSUMER)
  throw new Error('FORMICARIUM_CONSUMER outside repository is required');
const root = await realpath(process.env.FORMICARIUM_CONSUMER);
const repository = await realpath(new URL('../../', import.meta.url));
if (root.startsWith(`${repository}/`))
  throw new Error('consumer is inside repository');
if (sha256(await readFile(candidate.tarball.path)) !== candidate.tarball.sha256)
  throw new Error('tarball identity differs');
const packageRoot = resolve(root, 'node_modules/@aletheia-works/formicarium');
for (const entry of candidate.files)
  if (sha256(await readFile(resolve(packageRoot, entry.path))) !== entry.sha256)
    throw new Error(`installed digest differs: ${entry.path}`);
const guest = [
  ...(await readFile(
    new URL('../../.artifacts/u1-fixture/guest', import.meta.url),
  )),
];
test.beforeAll(async () => {
  server = await serveDirectory(packageRoot);
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
});

test('real installed browser archive normal and nonzero byte guest', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const normal = await session.run({ guest: new Uint8Array(bytes) });
      const binary = await session.run({
        guest: new Uint8Array(bytes),
        args: ['bytes'],
      });
      return {
        normal: normal.exitCode,
        text: new TextDecoder().decode(normal.stdout),
        code: binary.exitCode,
        out: [...binary.stdout],
        err: [...binary.stderr],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    normal: 0,
    text: 'fixture-ok\n',
    code: 3,
    out: [0, 255, 128, 65, 10],
    err: [254, 0, 66, 10],
  });
});
test('real browser snapshot restores links/modes/deletion to next fresh core', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const seed = await session.run({
        guest: new Uint8Array(bytes),
        args: ['seed'],
      });
      const entries = await session.listEntries('/work/kept');
      const verify = await session.run({
        guest: new Uint8Array(bytes),
        args: ['verify'],
      });
      return {
        seed: seed.exitCode,
        verify: verify.exitCode,
        entries: entries.map((entry) => ({
          ...entry,
          data: entry.type === 'file' ? [...entry.data] : undefined,
        })),
        data: [...(await session.readFile('/work/kept/a'))],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result.seed).toBe(0);
  expect(result.verify).toBe(0);
  expect(result.data).toEqual([9, 8]);
  const a = result.entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path.endsWith('/a'),
  )!;
  const b = result.entries.find(
    (entry): entry is Extract<typeof entry, { type: 'file' }> =>
      entry.type === 'file' && entry.path.endsWith('/b'),
  )!;
  expect(a.inodeId).toBe(b.inodeId);
  expect(a.mode & 0o777).toBe(0o640);
  expect(result.entries.find((entry) => entry.type === 'symlink')?.target).toBe(
    'a',
  );
});
for (const kind of ['timeout', 'abort'])
  test(`real browser CPU-bound ${kind} releases session for immediate run`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ bytes, kind }) => {
        const { createSession } = await import('/runtime/web/api.js');
        const session = await createSession();
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const running = session.run({
            guest: new Uint8Array(bytes),
            args: ['spin'],
            timeoutMs: kind === 'timeout' ? 1500 : 600000,
            signal: controller.signal,
            onOutput: (chunk) => {
              if (
                kind === 'abort' &&
                new TextDecoder().decode(chunk.bytes).includes('spin-started')
              )
                controller.abort();
            },
          });
          let code: string | undefined;
          let started: boolean | undefined;
          try {
            await running;
          } catch (caught) {
            const error = caught as ExecutionError;
            code = error.code;
            started = new TextDecoder()
              .decode(error.stdout)
              .includes('spin-started');
          }
          return {
            code,
            started,
            next: (await session.run({ guest: new Uint8Array(bytes) }))
              .exitCode,
            entries: (await session.listEntries()).length,
          };
        } finally {
          clearTimeout(timer);
          await session.dispose();
        }
      },
      { bytes: guest, kind },
    );
    expect(result).toEqual({
      code: kind === 'timeout' ? 'TIMEOUT' : 'ABORTED',
      started: true,
      next: 0,
      entries: 0,
    });
  });
test('real browser thread guest exits normally before next fresh run', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    try {
      const first = await session.run({
        guest: new Uint8Array(bytes),
        args: ['thread-exit'],
      });
      return {
        first: first.exitCode,
        out: new TextDecoder().decode(first.stdout),
        next: (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result.first).toBe(0);
  expect(result.out).toContain('child-finished');
  expect(result.next).toBe(0);
});

test('installed changed loader is refused before the core is imported', async ({
  page,
}) => {
  // The loader's directory holds the real core files; only index.mjs changes.
  const core = resolve(packageRoot, 'assets/paludarium');
  const extraFiles: Record<string, Uint8Array> = {};
  for (const name of [
    'coordinator.mjs',
    'execution.mjs',
    'worker-support.mjs',
    'jit-support.mjs',
    'filesystem-snapshot.mjs',
    'relay-protocol.mjs',
  ])
    extraFiles[`/mutation/${name}`] = await readFile(resolve(core, name));
  extraFiles['/mutation/index.mjs'] = Buffer.concat([
    Buffer.from(
      'globalThis.__unverifiedLoaderMarker = (globalThis.__unverifiedLoaderMarker ?? 0) + 1;\n',
    ),
    await readFile(resolve(core, 'index.mjs')),
  ]);
  const mutationServer = await serveDirectory(packageRoot, { extraFiles });
  try {
    await page.goto(mutationServer.url);
    const result = await page.evaluate(async (bytes) => {
      const { createSession } = await import('/runtime/web/api.js');
      const at = (path: string) => new URL(path, location.href).href;
      const session = await createSession({
        assets: {
          loaderURL: at('/mutation/index.mjs'),
          wasmURL: at('/assets/paludarium/paludarium.wasm'),
          buildInfoURL: at('/assets/paludarium/build-info.json'),
          workerURL: at('/runtime/web/package-worker.bundle.js'),
        },
      });
      try {
        await session.run({ guest: new Uint8Array(bytes) });
        return { code: 'completed' };
      } catch (caught) {
        return { code: (caught as ExecutionError).code };
      } finally {
        await session.dispose();
      }
    }, guest);
    expect(result.code).toBe('ASSET_LOAD');
  } finally {
    await mutationServer.close();
  }
});

test('verified browser core runs under a CSP without blob: permissions', async ({
  page,
}) => {
  const cspServer = await serveDirectory(packageRoot, {
    csp: "script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'",
  });
  try {
    await page.goto(cspServer.url);
    const result = await page.evaluate(async (bytes) => {
      const { createSession } = await import('/runtime/web/api.js');
      const session = await createSession();
      try {
        const run = await session.run({ guest: new Uint8Array(bytes) });
        return {
          exit: run.exitCode,
          text: new TextDecoder().decode(run.stdout),
        };
      } catch (caught) {
        return { error: (caught as ExecutionError).code };
      } finally {
        await session.dispose();
      }
    }, guest);
    expect(result).toEqual({ exit: 0, text: 'fixture-ok\n' });
  } finally {
    await cspServer.close();
  }
});

test('browser runs settle after normal, abort, timeout and disposal', async ({
  page,
}) => {
  const codes = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    const codes = [];
    try {
      codes.push(
        (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      );
      for (const kind of ['abort', 'timeout']) {
        const controller = new AbortController();
        try {
          await session.run({
            guest: new Uint8Array(bytes),
            args: ['spin'],
            timeoutMs: kind === 'timeout' ? 1500 : 600000,
            signal: controller.signal,
            onOutput: (chunk) => {
              if (
                kind === 'abort' &&
                new TextDecoder().decode(chunk.bytes).includes('spin-started')
              )
                controller.abort();
            },
          });
        } catch (caught) {
          const error = caught as ExecutionError;
          codes.push(error.code);
        }
      }
      codes.push(
        (await session.run({ guest: new Uint8Array(bytes) })).exitCode,
      );
      try {
        await session.run({
          guest: new Uint8Array(bytes),
          args: ['spin'],
          onOutput: (chunk) => {
            if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
              void session.dispose();
          },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        codes.push(error.code);
      }
    } finally {
      await session.dispose();
    }
    return codes;
  }, guest);
  expect(codes).toEqual([0, 'ABORTED', 'TIMEOUT', 0, 'ABORTED']);
});

test('public removed nested cwd is recreated by real guest run', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession({
      entries: [{ path: '/work/project/sub', type: 'dir', mode: 448 }],
    });
    try {
      await session.setCwd('/work/project/sub');
      await session.remove('/work/project');
      const run = await session.run({ guest: new Uint8Array(bytes) });
      const project = (await session.listEntries('/work')).find(
        (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
          entry.type === 'dir' && entry.path === '/work/project',
      )!;
      const sub = (await session.listEntries('/work/project')).find(
        (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
          entry.type === 'dir' && entry.path === '/work/project/sub',
      )!;
      return {
        exit: run.exitCode,
        text: new TextDecoder().decode(run.stdout),
        project: project.mode & 511,
        sub: sub.mode & 511,
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    exit: 0,
    text: 'fixture-ok\n',
    project: 493,
    sub: 493,
  });
});

test('removed cwd snapshot rollback next-run and reset preserve seed state', async ({
  page,
}) => {
  const result = await page.evaluate(async (bytes) => {
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession({
      entries: [
        { path: '/work/project/sub', type: 'dir', mode: 448 },
        {
          path: '/work/project/sub/input',
          type: 'file',
          inodeId: 'seed-input',
          mode: 416,
          data: Uint8Array.of(7, 8),
        },
      ],
    });
    try {
      await session.setCwd('/work/project/sub');
      await session.remove('/work/project');
      const controller = new AbortController();
      let aborted: string | undefined;
      try {
        await session.run({
          guest: new Uint8Array(bytes),
          args: ['spin'],
          signal: controller.signal,
          onOutput: (chunk) => {
            if (new TextDecoder().decode(chunk.bytes).includes('spin-started'))
              controller.abort();
          },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        aborted = error.code;
      }
      const uncommitted = !(await session.listEntries('/work')).some(
        (entry) => entry.path === '/work/project',
      );
      const first = (await session.run({ guest: new Uint8Array(bytes) }))
        .exitCode;
      const next = (await session.run({ guest: new Uint8Array(bytes) }))
        .exitCode;
      const restored =
        (await session.listEntries('/work/project')).find(
          (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
            entry.type === 'dir' && entry.path === '/work/project/sub',
        )!.mode & 511;
      await session.reset();
      const reset =
        (await session.listEntries('/work/project')).find(
          (entry): entry is Extract<typeof entry, { type: 'dir' }> =>
            entry.type === 'dir' && entry.path === '/work/project/sub',
        )!.mode & 511;
      return {
        aborted,
        uncommitted,
        first,
        next,
        restored,
        reset,
        input: [...(await session.readFile('/work/project/sub/input'))],
      };
    } finally {
      await session.dispose();
    }
  }, guest);
  expect(result).toEqual({
    aborted: 'ABORTED',
    uncommitted: true,
    first: 0,
    next: 0,
    restored: 493,
    reset: 448,
    input: [7, 8],
  });
});
