// WebKit sometimes starts a Worker that the service worker does not control.
// The imports and child Worker scripts of such a Worker reach the server
// without COEP and are refused (runtime/core.ts, createBlobCoreResources).
// Only a page isolated by a service worker alone shows this, so this server
// sends no isolation headers. Starting several core Workers at once makes the
// failure happen on nearly every page in WebKit, so the page-wide start-up
// queue is taken out of the served api.js.
// Requires: bun run build, bash mise-tasks/build/guests.sh hello

import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const ROOT = resolve('.');
const QUEUE = 'await startup.turn;';
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};
const CSP = `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'`;
const isolatedPage = (
  head = '',
) => `<!doctype html><title>uncontrolled Worker</title>${head}
<script src="/coi-serviceworker.js"></script>`;

let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    try {
      let body: string | Uint8Array;
      if (path === '/page.html') body = isolatedPage();
      // The documented CSP in the page alone does not reach the package Worker.
      else if (path === '/csp.html')
        body = isolatedPage(
          `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
        );
      else {
        body = await readFile(join(ROOT, path));
        if (path === '/runtime/web/api.js') {
          const source = new TextDecoder().decode(body);
          // A renamed queue must fail here, not quietly test nothing.
          if (source.split(QUEUE).length !== 2)
            throw new Error('start-up queue not found');
          body = source.replace(QUEUE, '');
        }
      }
      response.writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise((done) => server.close(done));
});

for (const [name, path] of [
  ['without a CSP', '/page.html'],
  ['with the documented CSP in the page', '/csp.html'],
])
  test(`core Workers started at once survive a Worker the service worker does not control, ${name}`, async ({
    page,
  }) => {
    const refused: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes('Cross-Origin-Embedder-Policy'))
        refused.push(message.text());
    });
    await page.goto(`${origin}${path}`);
    await page.waitForFunction(() => globalThis.crossOriginIsolated === true);
    const outcomes = await page.evaluate(async () => {
      const [{ createSession }, { coreAssets }] = await Promise.all([
        import('/runtime/web/api.js' as string),
        import('/runtime/core.js' as string),
      ]);
      const assets = coreAssets(
        new URL('/dist/paludarium/', location.href),
        new URL('/runtime/web/package-worker.bundle.js', location.href),
      );
      const guest = new Uint8Array(
        await (await fetch('/dist/guests/hello')).arrayBuffer(),
      );
      const terminal = async () => {
        const session = await createSession({ assets });
        const runs: (number | string)[] = [];
        try {
          for (let step = 0; step < 4; step++)
            runs.push((await session.run({ guest })).exitCode);
        } catch (caught) {
          runs.push((caught as { code: string }).code);
        } finally {
          await session.dispose();
        }
        return runs;
      };
      return Promise.all([terminal(), terminal()]);
    });
    expect(refused).toEqual([]);
    expect(outcomes).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });
