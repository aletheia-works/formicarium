import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';
import { elfHeader, serveDirectory } from './fixtures.js';
import { elf, expectation } from './session-fixtures.js';

let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(
    fileURLToPath(new URL('../../', import.meta.url)),
  );
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
});
test('browser missing Worker asset is ASSET_LOAD before guest starts', async ({
  page,
}) => {
  const code = await page.evaluate(
    async (guest) => {
      const { createSession } = await import('/runtime/web/api.js');
      const url = `${location.origin}/missing-worker.mjs`;
      const session = await createSession({
        assets: {
          loaderURL: url,
          wasmURL: url,
          buildInfoURL: url,
          workerURL: url,
        },
      });
      try {
        await session.run({ guest: Uint8Array.from(guest), timeoutMs: 5000 });
      } catch (caught) {
        const error = caught as ExecutionError;
        return error.code;
      } finally {
        await session.dispose();
      }
    },
    [...elfHeader()],
  );
  expect(code).toBe('ASSET_LOAD');
});
test('browser run with a network but no relay is UNSUPPORTED_ENV before any Worker starts', async ({
  page,
}) => {
  const result = await page.evaluate(
    async (guest) => {
      const { createSession } = await import('/runtime/web/api.js');
      const url = `${location.origin}/missing-worker.mjs`;
      const session = await createSession({
        assets: {
          loaderURL: url,
          wasmURL: url,
          buildInfoURL: url,
          workerURL: url,
        },
      });
      const fetched: string[] = [];
      const original = globalThis.fetch;
      globalThis.fetch = (input, init) => {
        fetched.push(String(input));
        return original(input, init);
      };
      try {
        await session.run({
          guest: Uint8Array.from(guest),
          network: { allow: ['github.com:443'] },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        return { code: error.code, fetched };
      } finally {
        globalThis.fetch = original;
        await session.dispose();
      }
    },
    [...elfHeader()],
  );
  expect(result).toEqual({ code: 'UNSUPPORTED_ENV', fetched: [] });
});
test('browser run with a network and a relay passes the network check', async ({
  page,
}) => {
  // The Worker asset is missing, so the run reaches the asset load and fails there.
  const code = await page.evaluate(
    async (guest) => {
      const { createSession } = await import('/runtime/web/api.js');
      const url = `${location.origin}/missing-worker.mjs`;
      const session = await createSession({
        assets: {
          loaderURL: url,
          wasmURL: url,
          buildInfoURL: url,
          workerURL: url,
        },
      });
      try {
        await session.run({
          guest: Uint8Array.from(guest),
          timeoutMs: 5000,
          network: {
            allow: ['github.com:443'],
            relay: { url: 'ws://127.0.0.1:9/' },
          },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        return error.code;
      } finally {
        await session.dispose();
      }
    },
    [...elfHeader()],
  );
  expect(code).toBe('ASSET_LOAD');
});
test('browser command with a network but no relay is UNSUPPORTED_ENV before any Worker starts', async ({
  page,
}) => {
  const bytes = elf();
  const result = await page.evaluate(
    async ({ guest, expected }) => {
      const { createSession } = await import('/runtime/web/api.js');
      const { createCommandSession, registerValidatedGuest, validateGuest } =
        await import('/runtime/public.js');
      const url = `${location.origin}/missing-worker.mjs`;
      const session = await createSession({
        assets: {
          loaderURL: url,
          wasmURL: url,
          buildInfoURL: url,
          workerURL: url,
        },
      });
      const bytes = Uint8Array.from(guest);
      await registerValidatedGuest(
        session,
        'fixture',
        validateGuest(bytes, expected),
      );
      const shell = createCommandSession(session, {
        catalog: {
          schemaVersion: 1,
          catalogId: 'none',
          defaults: {},
          entries: [],
        },
      });
      const fetched: string[] = [];
      const original = globalThis.fetch;
      globalThis.fetch = (input, init) => {
        fetched.push(String(input));
        return original(input, init);
      };
      try {
        await shell.execute('fixture', {
          network: { allow: ['github.com:443'] },
        });
      } catch (caught) {
        const error = caught as ExecutionError;
        return { code: error.code, fetched };
      } finally {
        globalThis.fetch = original;
        await session.dispose();
      }
    },
    { guest: [...bytes], expected: expectation(bytes) },
  );
  expect(result).toEqual({ code: 'UNSUPPORTED_ENV', fetched: [] });
});
for (const kind of ['abort', 'timeout', 'dispose'])
  test(`pending Worker preflight ${kind} cannot create a late Worker`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ guest, kind }) => {
        const { createSession } = await import('/runtime/web/api.js');
        const Original = Worker;
        const originalFetch = fetch;
        let starts = 0;
        let release!: (response: Response) => void;
        let fetchCancelled = false;
        globalThis.Worker = class extends Original {
          constructor(...args: ConstructorParameters<typeof Worker>) {
            starts++;
            super(...args);
          }
        };
        globalThis.fetch = (_, options) =>
          new Promise((resolve) => {
            release = resolve;
            options?.signal?.addEventListener('abort', () => {
              fetchCancelled = true;
            });
          });
        const url = `${location.origin}/tests/package/fixtures/quiet-worker.js`;
        const session = await createSession({
          assets: {
            loaderURL: url,
            wasmURL: url,
            buildInfoURL: url,
            workerURL: url,
          },
        });
        const controller = new AbortController();
        try {
          const running = session
            .run({
              guest: Uint8Array.from(guest),
              timeoutMs: kind === 'timeout' ? 30 : 5000,
              signal: controller.signal,
            })
            .catch((error: ExecutionError) => error.code);
          let busy: string | undefined;
          try {
            await session.listEntries();
          } catch (caught) {
            const error = caught as ExecutionError;
            busy = error.code;
          }
          if (kind === 'abort') controller.abort();
          if (kind === 'dispose') await session.dispose();
          const code = await running;
          release(new Response('// fixture', { status: 200 }));
          await new Promise((resolve) => setTimeout(resolve, 20));
          let state: string | number | undefined;
          try {
            state = (await session.listEntries()).length;
          } catch (caught) {
            const error = caught as ExecutionError;
            state = error.code;
          }
          return { busy, code, starts, fetchCancelled, state };
        } finally {
          globalThis.fetch = originalFetch;
          globalThis.Worker = Original;
          await session.dispose();
        }
      },
      { guest: [...elfHeader()], kind },
    );
    expect(result).toEqual({
      busy: 'BUSY',
      code: kind === 'timeout' ? 'TIMEOUT' : 'ABORTED',
      starts: 0,
      fetchCancelled: true,
      state: kind === 'dispose' ? 'DISPOSED' : 0,
    });
  });
