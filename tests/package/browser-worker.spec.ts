import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { serveDirectory } from './fixtures.js';

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
const envelope = {
  type: 'run',
  protocolVersion: 2,
  sessionId: 's',
  runId: 'r',
  generation: 1,
};

async function workerMessage(
  page: Page,
  request: object | null,
  { inspect = false, type = 'error' } = {},
) {
  return page.evaluate(
    ({ request, inspect, type }) =>
      new Promise<{
        code?: string;
        runId?: string;
        bytes: number[];
        failed?: boolean;
      }>((resolve, reject) => {
        const worker = new Worker(
          inspect
            ? '/tests/package/fixtures/inspect-worker.js'
            : '/runtime/web/package-worker.js',
          { type: 'module' },
        );
        const timer = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker test timed out'));
        }, 5000);
        worker.addEventListener('error', (event) => {
          clearTimeout(timer);
          worker.terminate();
          reject(new Error(event.message));
        });
        worker.addEventListener('message', ({ data }) => {
          if (data.type !== type) return;
          clearTimeout(timer);
          worker.terminate();
          resolve({ ...data, bytes: data.bytes ? [...data.bytes] : undefined });
        });
        if (request) worker.postMessage(request);
      }),
    { request, inspect, type },
  );
}

test('actual browser Worker rejects unsupported protocol major', async ({
  page,
}) => {
  const message = await workerMessage(page, {
    ...envelope,
    protocolVersion: 1,
  });
  expect(message.code).toBe('EXECUTION');
});
test('actual browser Worker rejects unknown request type', async ({ page }) => {
  const message = await workerMessage(page, { ...envelope, type: 'unknown' });
  expect(message.code).toBe('EXECUTION');
});
test('actual browser Worker classifies missing assets without serializing arbitrary diagnostics', async ({
  page,
}) => {
  const missing = `${server.url}/missing-secret`;
  const message = await workerMessage(page, {
    ...envelope,
    assets: { loaderURL: missing, wasmURL: missing, buildInfoURL: missing },
  });
  expect(message.code).toBe('ASSET_LOAD');
  expect(message.runId).toBe('r');
  expect(JSON.stringify(message)).not.toContain('secret');
});
test('browser asset reader returns exact fetched bytes in the Worker realm', async ({
  page,
}) => {
  const message = await workerMessage(
    page,
    {
      type: 'probe-fetch',
      url: `${server.url}/tests/package/fixtures/quiet-worker.js`,
    },
    { inspect: true, type: 'asset' },
  );
  expect(new TextDecoder().decode(Uint8Array.from(message.bytes))).toContain(
    'CPU-bound Worker',
  );
});
test('browser asset reader rejects HTTP404 instead of accepting its response body', async ({
  page,
}) => {
  const message = await workerMessage(
    page,
    { type: 'probe-fetch', url: `${server.url}/missing` },
    { inspect: true, type: 'asset' },
  );
  expect(message.failed).toBe(true);
});
