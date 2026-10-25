// Real Safari acceptance: safaridriver drives the Safari that ships with macOS
// through the same page function as the Playwright projects. Safari verifies
// TLS normally, so the job CA must already be trusted in the keychain (CI step).
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
import { createSession, webdriver } from './webdriver.ts';

/** The same per-tool limit as the Playwright acceptance. */
const TOOL_TIMEOUT_MS = 840000;

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
    const created = await createSession();
    const session = created.id;
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
          TOOL_TIMEOUT_MS + 60000,
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
          browser: `safari ${created.browserVersion}`,
          platform: created.platformName,
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
