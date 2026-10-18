import { expect, test } from '@playwright/test';
import { serveDirectory } from '../package/fixtures.js';
import { consumerInput } from './consumer-input.js';

const input = await consumerInput();
let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(input.packageRoot, {
    extraFiles: { '/preflight/guest': input.bytes },
    csp: "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'",
  });
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
});
test('same installed U2 pack validates official guest and runs owned copy after mutation', async ({
  page,
}) => {
  const result = await page.evaluate(async (expected) => {
    const api = await import('/runtime/public.js');
    const { createSession } = await import('/runtime/web/api.js');
    const response = await fetch('/preflight/guest');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const handle = api.validateGuest(bytes, expected);
    bytes.fill(0);
    expected.identity.tool = 'changed';
    const data = new Uint8Array([7]);
    const entries = api.fixtureToFsEntries([
      { path: '/work/a', type: 'file', mode: 416, inodeId: 'same', data },
      { path: '/work/b', type: 'file', mode: 416, inodeId: 'same', data },
    ]);
    data[0] = 0;
    const session = await createSession({ entries });
    try {
      const run = await api.runValidatedGuest(session, handle, {
        args: ['--version'],
      });
      const files = await session.listEntries();
      return {
        coi: crossOriginIsolated,
        code: run.exitCode,
        text: api.decodeUtf8(run.stdout),
        data: (await session.readFile('/work/a'))[0],
        hardlinks:
          files[0].type === 'file' &&
          files[1].type === 'file' &&
          files[0].inodeId === files[1].inodeId,
      };
    } finally {
      await session.dispose();
    }
  }, structuredClone(input.expected));
  expect(result.coi).toBe(true);
  expect(result.code).toBe(0);
  expect(result.text).toMatch(/^2\.7\.0/);
  expect(result.data).toBe(7);
  expect(result.hardlinks).toBe(true);
});
test('browser guest, fixture and forged handle refusals preserve session state', async ({
  page,
}) => {
  const codes = await page.evaluate(async (expected) => {
    const api = await import('/runtime/public.js');
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession();
    const codes: string[] = [];
    const rejected = async (fn: () => unknown) => {
      try {
        await fn();
        codes.push('accepted');
      } catch (error) {
        codes.push((error as { code: string }).code);
      }
    };
    try {
      await rejected(() => api.validateGuest(new Uint8Array(120), expected));
      await rejected(() =>
        api.fixtureToFsEntries([
          { path: '/a', type: 'symlink', target: '/b' },
          { path: '/b', type: 'symlink', target: '/a' },
        ]),
      );
      await rejected(() =>
        api.runValidatedGuest(session, {
          digest: expected.elfSha256,
          buildInfo: expected.identity,
        }),
      );
      await rejected(() =>
        api.registerValidatedGuest(session, 'aube', {
          digest: expected.elfSha256,
          buildInfo: expected.identity,
        }),
      );
      codes.push(String((await session.listEntries()).length));
      return codes;
    } finally {
      await session.dispose();
    }
  }, input.expected);
  expect(codes).toEqual([
    'INVALID_INPUT',
    'INVALID_INPUT',
    'INVALID_INPUT',
    'INVALID_INPUT',
    '0',
  ]);
});
test('browser registration and direct run share BUSY, reset cancels and dispose is terminal', async ({
  page,
}) => {
  const result = await page.evaluate(async (expected) => {
    const api = await import('/runtime/public.js');
    const { createSession } = await import('/runtime/web/api.js');
    const bytes = new Uint8Array(
      await (await fetch('/preflight/guest')).arrayBuffer(),
    );
    const handle = api.validateGuest(bytes, expected);
    const session = await createSession();
    const codes: string[] = [];
    const code = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return 'accepted';
      } catch (error) {
        return (error as { code: string }).code;
      }
    };
    try {
      await api.registerValidatedGuest(session, 'aube', handle);
      const running = api
        .runValidatedGuest(session, handle, { args: ['--version'] })
        .then(
          () => 'accepted',
          (error) => (error as { code: string }).code,
        );
      codes.push(await code(() => session.listEntries()));
      codes.push(
        await code(() => api.registerValidatedGuest(session, 'aube', handle)),
      );
      await session.reset();
      codes.push(await running);
      const next = await api.runValidatedGuest(session, handle, {
        args: ['--version'],
      });
      await session.dispose();
      codes.push(
        await code(() => api.registerValidatedGuest(session, 'aube', handle)),
      );
      codes.push(await code(() => session.reset()));
      return { codes, exit: next.exitCode };
    } finally {
      await session.dispose();
    }
  }, input.expected);
  expect(result.codes).toEqual([
    'BUSY',
    'BUSY',
    'ABORTED',
    'DISPOSED',
    'DISPOSED',
  ]);
  expect(result.exit).toBe(0);
});
