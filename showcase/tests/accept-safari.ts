// Real Safari acceptance: safaridriver drives the Safari that ships with macOS
// through the same page function as the Playwright projects. Safari verifies
// TLS normally, so the job CA must already be trusted in the keychain (CI step).
import { request } from 'node:http';
import { join } from 'node:path';
import { loadSite } from '../scripts/accept-node.ts';
import { startAcceptServer } from '../scripts/accept-server.ts';
import type { AcceptancePart, AcceptanceRow } from '../scripts/acceptance.ts';
import { fail, runCli } from '../scripts/errors.ts';
import { SHOWCASE_ROOT, workLayout, writeJson } from '../scripts/paths.ts';
import { tlsFromEnvironment } from '../scripts/tls.ts';
import {
  acceptInPage,
  type PageObservation,
  rowFromPage,
} from './accept-page.ts';

const driver = process.env.SHOWCASE_SAFARIDRIVER ?? 'http://127.0.0.1:4444';
/** The same per-tool limit as the Playwright acceptance. */
const TOOL_TIMEOUT_MS = 840000;

/**
 * node:http, not fetch: fetch gives up after 300 s without response headers,
 * and execute/async answers only when the page script ends, up to the limit.
 */
function webdriver(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const call = request(
      `${driver}${path}`,
      {
        method,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }
          : {},
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          try {
            const reply = JSON.parse(Buffer.concat(chunks).toString()) as {
              value: unknown;
            };
            if ((response.statusCode ?? 500) >= 400)
              throw Error(
                `WebDriver ${method} ${path}: ${JSON.stringify(reply)}`,
              );
            resolve(reply.value);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    // Safari's own script timeout answers first; this only catches a hung driver.
    call.setTimeout(TOOL_TIMEOUT_MS + 60000, () =>
      call.destroy(Error(`WebDriver ${method} ${path}: no answer`)),
    );
    call.on('error', reject);
    call.end(payload);
  });
}

/** safaridriver may still be starting when this script does. */
async function waitForDriver() {
  for (let attempt = 0; attempt <= 100; attempt++) {
    try {
      const status = (await (await fetch(`${driver}/status`)).json()) as {
        value?: { ready?: boolean };
      };
      if (status.value?.ready) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail('config-invalid', `safaridriver is not ready: ${driver}`);
}

const PAGE_SCRIPT = `const [arg, done] = arguments;
(${acceptInPage.toString()})(arg).then(done, (error) => done({
  coi: crossOriginIsolated, installed: false, exitCode: null, stdout: '',
  installMs: null, versionMs: null, error: String(error?.code ?? error),
}));`;

await runCli('Safari acceptance', async () => {
  const layout = workLayout();
  const site = await loadSite(layout);
  const tls = await tlsFromEnvironment(process.env);
  if (!tls)
    fail(
      'config-invalid',
      'SHOWCASE_TLS_* are required: Safari must trust the job CA',
    );
  const server = await startAcceptServer({
    siteRoot: layout.site,
    packageRoot: join(
      SHOWCASE_ROOT,
      'node_modules',
      '@aletheia-works',
      'formicarium',
    ),
    cert: tls.cert,
    key: tls.key,
  });
  const rows: AcceptanceRow[] = [];
  try {
    await waitForDriver();
    const created = (await webdriver('POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    })) as {
      sessionId: string;
      capabilities: { browserVersion?: string; platformName?: string };
    };
    const session = created.sessionId;
    try {
      await webdriver('POST', `/session/${session}/timeouts`, {
        script: TOOL_TIMEOUT_MS,
        pageLoad: 60000,
      });
      // One tool at a time, each on a fresh page, as in the Playwright run.
      for (const tool of site.tools) {
        await webdriver('POST', `/session/${session}/url`, {
          url: `${server.origin}/`,
        });
        const observed = (await webdriver(
          'POST',
          `/session/${session}/execute/async`,
          {
            script: PAGE_SCRIPT,
            args: [{ catalog: site.catalog, name: tool.tool }],
          },
        )) as PageObservation;
        const row = rowFromPage(tool, 'safari', observed);
        rows.push(row);
        console.log(
          `${tool.tool}/safari ${row.status} install ${row.installMs} ms, --version ${row.versionMs} ms`,
        );
      }
    } finally {
      await webdriver('DELETE', `/session/${session}`);
    }
    const part: AcceptancePart = {
      schemaVersion: 1,
      environment: {
        environment: 'safari',
        observed: {
          browser: `safari ${created.capabilities.browserVersion ?? 'unknown'}`,
          platform: created.capabilities.platformName ?? 'unknown',
        },
      },
      rows,
    };
    await writeJson(join(layout.acceptance, 'safari.json'), part);
  } finally {
    await server.close();
  }
  const failed = rows.filter((row) => row.status !== 'passed');
  if (failed.length)
    fail(
      'acceptance-row-missing',
      failed.map((row) => `${row.tool}/safari ${row.cause}`).join(', '),
    );
});
