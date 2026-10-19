import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
  TestInfo,
} from '@playwright/test';
import { expect } from '@playwright/test';
import { SITE_ROOT } from '../../scripts/common.ts';

/** performance-design P1: goto -> ready within 120 s (the test itself has 180 s). */
export const READY_MS = 120000;
export const COVERAGE_DIR = join(SITE_ROOT, '.work', 'coverage', 'v8');
const COLLECT_COVERAGE = process.env.SHOWCASE_SITE_COVERAGE === '1';

/**
 * A fresh context per test (first visit registers the service worker). In CI
 * Firefox uses the profile that trusts the job CA, as in U7's acceptance.
 */
export async function openContext(
  browser: Browser,
  playwright: { firefox: BrowserType },
  project: string,
): Promise<BrowserContext> {
  const profile = process.env.SHOWCASE_FIREFOX_PROFILE;
  const context =
    project === 'firefox' && profile
      ? await playwright.firefox.launchPersistentContext(profile, {
          ignoreHTTPSErrors: false,
          firefoxUserPrefs: { 'security.enterprise_roots.enabled': true },
        })
      : await browser.newContext({ ignoreHTTPSErrors: false });
  // Every CSP violation of every page is collected and must stay at zero.
  await context.addInitScript(() => {
    const violations: string[] = [];
    (globalThis as unknown as { __cspViolations: string[] }).__cspViolations =
      violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  return context;
}

export async function newPage(
  context: BrowserContext,
  project: string,
): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage());
  if (COLLECT_COVERAGE && project === 'chromium')
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  return page;
}

/** Saves Chromium V8 coverage of the site scripts for merge-coverage.ts. */
export async function finishPage(page: Page, info: TestInfo): Promise<void> {
  if (COLLECT_COVERAGE && info.project.name === 'chromium') {
    const entries = (await page.coverage.stopJSCoverage()).filter((entry) =>
      entry.url.includes('/_astro/'),
    );
    await mkdir(COVERAGE_DIR, { recursive: true });
    await writeFile(
      join(COVERAGE_DIR, `${info.testId}.json`),
      JSON.stringify(entries),
    );
  }
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (globalThis as unknown as { __cspViolations?: string[] })
        .__cspViolations ?? [],
  );
}

/** Visible terminal rows as text (xterm's DOM renderer), NBSP as space. */
export async function terminalText(page: Page): Promise<string> {
  return page
    .locator('[data-terminal-host] .xterm-rows')
    .evaluate((rows) =>
      [...rows.children]
        .map((row) => (row.textContent ?? '').replace(/ /g, ' ').trimEnd())
        .join('\n'),
    );
}

export const state = (page: Page) =>
  page.locator('[data-terminal-host]').getAttribute('data-state');

/** Waits for one of the terminal states; returns the elapsed ms. */
export async function waitState(
  page: Page,
  states: string[],
  timeout = READY_MS,
): Promise<number> {
  const started = Date.now();
  await expect(page.locator('[data-terminal-host]')).toHaveAttribute(
    'data-state',
    new RegExp(`^(?:${states.join('|')})$`),
    { timeout },
  );
  return Date.now() - started;
}

/** Types a command and Enter, then waits until the terminal is ready again. */
export async function run(
  page: Page,
  line: string,
  timeout = READY_MS,
): Promise<string> {
  await page.locator('[data-terminal-host] textarea').focus();
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-terminal-host]'))
    .not.toHaveAttribute('data-state', /^(?:ready|ready_failed_install)$/, {
      timeout: 5000,
    })
    .catch(() => undefined);
  await waitState(page, ['ready', 'ready_failed_install'], timeout);
  return segmentAfter(await terminalText(page), line);
}

/** Lines printed by `line`: after its prompt row, before the new prompt row. */
export function segmentAfter(text: string, line: string): string {
  const rows = text.replace(/\n+$/, '').split('\n');
  let start = -1;
  for (let index = rows.length - 1; index >= 0; index--)
    if (rows[index]!.endsWith(`$ ${line}`)) {
      start = index;
      break;
    }
  if (start === -1) return '';
  const end = rows.findLastIndex((row) => /\$ ?$/.test(row));
  return rows.slice(start + 1, end > start ? end : undefined).join('\n');
}

export const occurrences = (text: string, part: string) =>
  text.split(part).length - 1;

/** Records the timing of a test (offset ISO time and ms) as an attachment. */
export async function recordTiming(
  info: TestInfo,
  timing: Record<string, number | string>,
): Promise<void> {
  await info.attach('timing', {
    contentType: 'application/json',
    body: JSON.stringify({ recordedAt: new Date().toISOString(), ...timing }),
  });
}

/** Page, Worker and child Worker are all cross-origin isolated with SharedArrayBuffer. */
export async function isolationOf(
  page: Page,
): Promise<{ page: boolean; worker: boolean; child: boolean }> {
  return page.evaluate(async () => {
    const child =
      'postMessage([self.crossOriginIsolated, typeof SharedArrayBuffer === "function"])';
    const parent = `const c = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(child)}], { type: 'text/javascript' })));
      c.onmessage = (e) => postMessage({ worker: self.crossOriginIsolated && typeof SharedArrayBuffer === 'function', child: e.data[0] && e.data[1] });`;
    const worker = new Worker(
      URL.createObjectURL(new Blob([parent], { type: 'text/javascript' })),
    );
    const result = await new Promise<{ worker: boolean; child: boolean }>(
      (done) => {
        worker.onmessage = (event) => done(event.data);
      },
    );
    worker.terminate();
    return {
      page: crossOriginIsolated && typeof SharedArrayBuffer === 'function',
      ...result,
    };
  });
}
