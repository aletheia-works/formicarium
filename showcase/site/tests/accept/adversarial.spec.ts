import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { siteLayout } from '../../scripts/common.ts';
import type { PagesServer } from '../../scripts/serve-pages-like.ts';
import { test } from './site-page.ts';
import { cspViolations, run, startServer, waitState } from './support.ts';

const siteDir = process.env.SHOWCASE_SITE_DIR ?? siteLayout().dist;
const [version] = readdirSync(join(siteDir, '_formicarium'));
const HARNESS = join(import.meta.dirname, 'harness');

let server: PagesServer;
test.beforeAll(async () => {
  // The harness replaces only the two public entries; the site stays as built.
  server = await startServer(
    test.info().project.name,
    new Map([
      [
        `/formicarium/_formicarium/${version}/runtime/public.js`,
        join(HARNESS, 'fake-public.js'),
      ],
      [
        `/formicarium/_formicarium/${version}/runtime/web/api.js`,
        join(HARNESS, 'fake-browser.js'),
      ],
    ]),
  );
});
test.afterAll(async () => {
  await server?.close();
});

test('[adversarial-output] hostile output and errors stay text, and terminal answers never become input', async ({
  site,
}) => {
  await site.goto(`${server.origin}/formicarium/terminal/`);
  await waitState(site, ['ready']);
  const elements = await site.evaluate(
    () => document.querySelectorAll('*').length,
  );
  const title = await site.title();
  await run(site, 'show');
  await run(site, 'next');
  await run(site, 'fail');
  const observed = await site.evaluate(() => ({
    pwned: (globalThis as unknown as { __pwned?: unknown }).__pwned ?? null,
    lines: (globalThis as unknown as { __harnessLines: string[] })
      .__harnessLines,
    images: document.querySelectorAll(
      '[data-terminal-host] img, [data-testid="terminal-status"] img, [data-testid="terminal-omitted"] img',
    ).length,
    links: document.querySelectorAll('[data-terminal-host] a').length,
    status:
      document.querySelector('[data-testid="terminal-status"]')?.textContent ??
      '',
  }));
  expect(observed.pwned).toBeNull();
  // The answer xterm sends to `ESC [6n` is not typed into the next command.
  // Before them the page only installs the tools every page gets, through
  // the installer rather than as commands.
  expect(observed.lines.slice(-3)).toEqual(['show', 'next', 'fail']);
  for (const line of observed.lines.slice(0, -3))
    expect(line).toMatch(/^installer [a-z][a-z0-9-]*$/);
  expect(observed.images).toBe(0);
  expect(observed.links).toBe(0);
  expect(observed.status).toContain('<img src=x onerror=');
  expect(await site.title()).toBe(title);
  // No popup: the test's own tab is the only one.
  expect(await site.windowCount()).toBe(1);
  // xterm adds rows, but no element appears outside the terminal widget.
  const outside = await site.evaluate(
    () =>
      [...document.querySelectorAll('*')].filter(
        (node) => !node.closest('[data-terminal-host]'),
      ).length,
  );
  expect(outside).toBeLessThanOrEqual(elements);
  expect(await cspViolations(site)).toEqual([]);
});
