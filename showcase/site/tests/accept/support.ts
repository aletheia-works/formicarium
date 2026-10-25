import { join } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  type PagesServer,
  serverFromEnvironment,
} from '../../scripts/serve-pages-like.ts';
import { CSP_LISTENER, type SitePage } from './site-page.ts';

/** goto -> ready within 120 s (the test itself has 180 s). */
export const READY_MS = 120000;

/** URL path of the CSP listener that the Safari pages load first. */
const CSP_PATH = '/formicarium/__acceptance/csp.js';

/**
 * The Pages-like server of a spec. Safari has no init script, so its pages
 * load the CSP listener first in <head>; the other browsers get the site's
 * bytes unchanged.
 */
export function startServer(
  project: string,
  overlay: ReadonlyMap<string, string> = new Map(),
): Promise<PagesServer> {
  if (project !== 'safari') return serverFromEnvironment(process.env, overlay);
  return serverFromEnvironment(
    process.env,
    new Map([...overlay, [CSP_PATH, CSP_LISTENER]]),
    CSP_PATH,
  );
}

export async function cspViolations(site: SitePage): Promise<string[]> {
  return site.evaluate(
    () =>
      (globalThis as unknown as { __cspViolations?: string[] })
        .__cspViolations ?? ['the CSP listener did not run'],
  );
}

/** Visible terminal rows as text (xterm's DOM renderer), NBSP as space. */
export async function terminalText(site: SitePage): Promise<string> {
  return site.evaluate(() =>
    [
      ...(document.querySelector('[data-terminal-host] .xterm-rows')
        ?.children ?? []),
    ]
      .map((row) => (row.textContent ?? '').replace(/\u00a0/g, ' ').trimEnd())
      .join('\n'),
  );
}

export const state = (site: SitePage) =>
  site.evaluate(
    () =>
      document
        .querySelector('[data-terminal-host]')
        ?.getAttribute('data-state') ?? null,
  );

/** The status line's text, whitespace collapsed. */
export const statusText = (site: SitePage) =>
  site.evaluate(() =>
    (
      document.querySelector('[data-testid="terminal-status"]')?.textContent ??
      ''
    )
      .replace(/\s+/g, ' ')
      .trim(),
  );

/**
 * Polls `read` until it passes. A read that throws (the page is navigating,
 * for example after the service worker's first reload) counts as null and is
 * retried.
 */
export const poll = <T>(read: () => Promise<T>, timeout = 5000) =>
  expect.poll(() => read().catch(() => null), { timeout, intervals: [100] });

/** Waits for one of the terminal states; returns the elapsed ms. */
export async function waitState(
  site: SitePage,
  states: string[],
  timeout = READY_MS,
): Promise<number> {
  const started = Date.now();
  await poll(() => state(site), timeout).toMatch(
    new RegExp(`^(?:${states.join('|')})$`),
  );
  return Date.now() - started;
}

export const focusTerminal = (site: SitePage) =>
  site.evaluate(() =>
    document
      .querySelector<HTMLTextAreaElement>('[data-terminal-host] textarea')
      ?.focus(),
  );

/** Types a command and Enter, then waits until the terminal is ready again. */
export async function run(
  site: SitePage,
  line: string,
  timeout = READY_MS,
): Promise<string> {
  await focusTerminal(site);
  await site.type(line);
  await site.press('Enter');
  await poll(() => state(site))
    .not.toMatch(/^(?:ready|ready_failed_install)$/)
    .catch(() => undefined);
  await waitState(site, ['ready', 'ready_failed_install'], timeout);
  return segmentAfter(await terminalText(site), line);
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

/** URL paths of the test-only isolation probe Workers (served by ISOLATION_OVERLAY). */
const ISOLATION_DIR = '/formicarium/__isolation';
/**
 * The probe Workers as test server overlay files. They are same-origin
 * scripts, because the terminal pages' CSP allows no blob: Workers.
 */
export const ISOLATION_OVERLAY: ReadonlyMap<string, string> = new Map([
  [
    `${ISOLATION_DIR}/isolation-worker.js`,
    join(import.meta.dirname, 'harness', 'isolation-worker.js'),
  ],
  [
    `${ISOLATION_DIR}/isolation-child.js`,
    join(import.meta.dirname, 'harness', 'isolation-child.js'),
  ],
]);

/** Page, Worker and child Worker are all cross-origin isolated with SharedArrayBuffer. */
export async function isolationOf(
  site: SitePage,
): Promise<{ page: boolean; worker: boolean; child: boolean }> {
  return site.evaluate(async (directory) => {
    const worker = new Worker(`${directory}/isolation-worker.js`);
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
  }, ISOLATION_DIR);
}
