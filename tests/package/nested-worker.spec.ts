import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';
import { serveDirectory } from './fixtures.js';

if (!process.env.FORMICARIUM_CONSUMER)
  throw new Error('external consumer required');
const packageRoot = resolve(
  process.env.FORMICARIUM_CONSUMER,
  'node_modules/@aletheia-works/formicarium',
);
const guest = [
  ...(await readFile(
    new URL('../../.artifacts/u1-fixture/guest', import.meta.url),
  )),
];
const extraFiles: Record<string, Uint8Array | string> = {};
for (const [route, filename] of [
  ['parent', 'observer'],
  ['nested-child', 'child'],
]) {
  extraFiles[`/__observer/${route}.mjs`] = await readFile(
    new URL(`./fixtures/browser-nested-${filename}.js`, import.meta.url),
  );
}
let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(packageRoot, { extraFiles });
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
});
for (const mode of ['normal', 'abort', 'timeout'])
  test(`real browser descendant heartbeat stops after ${mode}`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ bytes, mode }) => {
        const counters = new SharedArrayBuffer(16);
        const view = new Int32Array(counters);
        const Original = Worker;
        globalThis.Worker = class extends Original {
          // The package Worker; the core starts its own Workers inside it.
          constructor(target: string | URL, options?: WorkerOptions) {
            super('/__observer/parent.mjs', options);
            super.postMessage({
              type: 'observer-bootstrap',
              counters,
              target: String(target),
            });
          }
        };
        const { createSession } = await import('/runtime/web/api.js');
        const session = await createSession();
        const controller = new AbortController();
        try {
          let code: number | string | undefined;
          let output: string | undefined;
          try {
            const result = await session.run({
              guest: new Uint8Array(bytes),
              args: [mode === 'normal' ? 'thread-exit' : 'thread-spin'],
              timeoutMs: 2500,
              signal: controller.signal,
              onOutput: (chunk) => {
                if (
                  mode === 'abort' &&
                  new TextDecoder()
                    .decode(chunk.bytes)
                    .includes('thread-started')
                )
                  controller.abort();
              },
            });
            code = result.exitCode;
            output = new TextDecoder().decode(result.stdout);
          } catch (caught) {
            const error = caught as ExecutionError;
            code = error.code;
            output = new TextDecoder().decode(error.stdout);
          }
          const before = [...view];
          await new Promise((resolve) => setTimeout(resolve, 150));
          const after = [...view];
          // Restore regular Worker for the reuse oracle; counters only describe the observed run.
          globalThis.Worker = Original;
          const next = (await session.run({ guest: new Uint8Array(bytes) }))
            .exitCode;
          return { code, output, before, after, next };
        } finally {
          globalThis.Worker = Original;
          await session.dispose();
        }
      },
      { bytes: guest, mode },
    );
    expect(result.code).toBe(
      mode === 'normal' ? 0 : mode === 'abort' ? 'ABORTED' : 'TIMEOUT',
    );
    expect(result.output).toContain(
      mode === 'normal' ? 'child-finished' : 'thread-started',
    );
    expect(result.before[0]).toBeGreaterThan(0);
    expect(result.before[1]).toBeGreaterThan(0);
    expect(result.before[2]).toBeGreaterThan(0);
    expect(result.after[2]).toBe(result.before[2]);
    expect(result.next).toBe(0);
  });
