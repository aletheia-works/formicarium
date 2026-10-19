import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { siteLayout } from '../../scripts/common.ts';
import {
  type PagesServer,
  serverFromEnvironment,
} from '../../scripts/serve-pages-like.ts';
import {
  cspViolations,
  finishPage,
  newPage,
  openContext,
  run,
  waitState,
} from './support.ts';

const siteDir = process.env.SHOWCASE_SITE_DIR ?? siteLayout().dist;
const [version] = readdirSync(join(siteDir, '_formicarium'));
const HARNESS = join(import.meta.dirname, 'harness');

let server: PagesServer;
test.beforeAll(async () => {
  // The harness replaces only the two public entries; the site stays as built.
  server = await serverFromEnvironment(
    process.env,
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
  browser,
  playwright,
}, info) => {
  const context = await openContext(browser, playwright, info.project.name);
  try {
    const page = await newPage(context, info.project.name);
    const popups: string[] = [];
    context.on('page', (opened) => popups.push(opened.url()));
    await page.goto(`${server.origin}/formicarium/terminal/`);
    await waitState(page, ['ready']);
    const elements = await page.evaluate(
      () => document.querySelectorAll('*').length,
    );
    const title = await page.title();
    await run(page, 'show');
    await run(page, 'next');
    await run(page, 'fail');
    const observed = await page.evaluate(() => ({
      pwned: (globalThis as unknown as { __pwned?: unknown }).__pwned ?? null,
      lines: (globalThis as unknown as { __harnessLines: string[] })
        .__harnessLines,
      images: document.querySelectorAll(
        '[data-terminal-host] img, [data-testid="terminal-status"] img, [data-testid="terminal-omitted"] img',
      ).length,
      links: document.querySelectorAll('[data-terminal-host] a').length,
      status:
        document.querySelector('[data-testid="terminal-status"]')
          ?.textContent ?? '',
    }));
    expect(observed.pwned).toBeNull();
    // The answer xterm sends to `ESC [6n` is not typed into the next command.
    expect(observed.lines).toEqual(['show', 'next', 'fail']);
    expect(observed.images).toBe(0);
    expect(observed.links).toBe(0);
    expect(observed.status).toContain('<img src=x onerror=');
    expect(await page.title()).toBe(title);
    expect(popups).toEqual([]);
    // xterm adds rows, but no element appears outside the terminal widget.
    const outside = await page.evaluate(
      () =>
        [...document.querySelectorAll('*')].filter(
          (node) => !node.closest('[data-terminal-host]'),
        ).length,
    );
    expect(outside).toBeLessThanOrEqual(elements);
    expect(await cspViolations(page)).toEqual([]);
    await finishPage(page, info);
  } finally {
    await context.close();
  }
});
