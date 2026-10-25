import { createRequire } from 'node:module';
import { join } from 'node:path';
import { type BrowserContext, expect, test } from '@playwright/test';
import { loadSite } from '../scripts/accept-node.ts';
import {
  type AcceptServer,
  startAcceptServer,
} from '../scripts/accept-server.ts';
import type { AcceptanceRow, EnvironmentId } from '../scripts/acceptance.ts';
import { SHOWCASE_ROOT, workLayout, writeJson } from '../scripts/paths.ts';
import { tlsFromEnvironment } from '../scripts/tls.ts';
import { acceptInPage, rowFromPage } from './accept-page.ts';

const layout = workLayout();
const site = await loadSite(layout);
function observedPlaywright(): string {
  try {
    return (
      createRequire(import.meta.url)('@playwright/test/package.json') as {
        version: string;
      }
    ).version;
  } catch {
    return 'unknown';
  }
}
const playwrightVersion = observedPlaywright();
let server: AcceptServer;
const rows: AcceptanceRow[] = [];
let observedBrowser = 'unknown';
let environmentName: EnvironmentId | null = null;

test.beforeAll(async () => {
  // Browsers verify TLS normally; the job CA must already be trusted (CI step).
  const tls = await tlsFromEnvironment(process.env);
  if (!tls)
    throw Error(
      'SHOWCASE_TLS_* are required: the browser must trust the job CA',
    );
  server = await startAcceptServer({
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
});

test.afterAll(async () => {
  await server?.close();
  const environment = environmentName;
  // No test ran: nothing is written and the candidate refuses the missing rows.
  if (!environment) return;
  await writeJson(join(layout.acceptance, `${environment}.json`), {
    schemaVersion: 1,
    environment: {
      environment,
      observed: { browser: observedBrowser, playwright: playwrightVersion },
    },
    rows,
  });
});

for (const tool of site.tools)
  test(`${tool.tool} --version through the public browser API`, async ({
    browser,
    playwright,
  }, info) => {
    const environment = info.project.name as EnvironmentId;
    environmentName = environment;
    observedBrowser = `${environment} ${browser.version()}`;
    const profile = process.env.SHOWCASE_FIREFOX_PROFILE;
    let context: BrowserContext;
    if (environment === 'firefox' && profile)
      context = await playwright.firefox.launchPersistentContext(profile, {
        ignoreHTTPSErrors: false,
        firefoxUserPrefs: { 'security.enterprise_roots.enabled': true },
      });
    else context = await browser.newContext({ ignoreHTTPSErrors: false });
    try {
      const page = await context.newPage();
      await page.goto(`${server.origin}/`);
      const observed = await page.evaluate(acceptInPage, {
        catalog: site.catalog,
        name: tool.tool,
      });
      const row = rowFromPage(tool, environment, observed);
      rows.push(row);
      console.log(
        `${tool.tool}/${environment} ${row.status} install ${row.installMs} ms, --version ${row.versionMs} ms`,
      );
      expect(row.cause).toBeNull();
      expect(row.status).toBe('passed');
    } finally {
      await context.close();
    }
  });
