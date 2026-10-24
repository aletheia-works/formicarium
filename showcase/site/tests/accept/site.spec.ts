import { readFileSync } from 'node:fs';
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
  ISOLATION_OVERLAY,
  isolationOf,
  newPage,
  occurrences,
  openContext,
  READY_MS,
  recordTiming,
  run,
  state,
  terminalText,
  waitState,
} from './support.ts';

const siteDir = process.env.SHOWCASE_SITE_DIR ?? siteLayout().dist;
const catalog = JSON.parse(
  readFileSync(join(siteDir, 'catalog.json'), 'utf8'),
) as { defaults: Record<string, string> };
const TOOLS = Object.entries(catalog.defaults).sort(([a], [b]) =>
  a < b ? -1 : 1,
);
const LOCALES = [
  ['en', ''],
  ['ja', 'ja/'],
] as const;
/** A file of each demo fixture and a line of it that `cat` must show once. */
const FIXTURE_FILES: Record<string, [string, string]> = {
  aube: ['package.json', '"linked": "link:../outside/linked"'],
  biome: ['example.js', 'Hello, terrarium!'],
  pitchfork: ['pitchfork.toml', '[daemons.api]'],
};

let server: PagesServer;
test.beforeAll(async () => {
  server = await serverFromEnvironment(process.env, ISOLATION_OVERLAY);
});
test.afterAll(async () => {
  await server?.close();
});
const url = (path: string) => `${server.origin}/formicarium/${path}`;

for (const [tool, version] of TOOLS)
  for (const [locale, prefix] of LOCALES)
    test(`[empty-terminal-install] ${tool} ${version} from the empty terminal (${locale})`, async ({
      browser,
      playwright,
    }, info) => {
      const context = await openContext(browser, playwright, info.project.name);
      try {
        const page = await newPage(context, info.project.name);
        const started = Date.now();
        await page.goto(url(`${prefix}terminal/`));
        const readyMs = await waitState(page, ['ready']);
        await expect(page.getByTestId('terminal-status')).toHaveText(
          locale === 'ja'
            ? '準備完了（ツールは未導入）。'
            : 'Ready. No tool is installed yet.',
        );
        const installStarted = Date.now();
        await run(page, `install ${tool}`);
        const installMs = Date.now() - installStarted;
        expect(await state(page)).toBe('ready');
        await expect(page.getByTestId('terminal-status')).toContainText(
          `${tool} ${version}`,
        );
        const output = await run(page, `${tool} --version`);
        expect(occurrences(output, version), output).toBe(1);
        expect(await cspViolations(page)).toEqual([]);
        await recordTiming(info, {
          readyMs,
          installMs,
          totalMs: Date.now() - started,
        });
        await finishPage(page, info);
      } finally {
        await context.close();
      }
    });

for (const [tool, version] of TOOLS)
  for (const [locale, prefix] of LOCALES)
    test(`[tool-page] ${tool} starts installed with its fixture, isolated on first and repeated visits (${locale})`, async ({
      browser,
      playwright,
    }, info) => {
      const context = await openContext(browser, playwright, info.project.name);
      try {
        const page = await newPage(context, info.project.name);
        const started = Date.now();
        await page.goto(url(`${prefix}tools/${tool}/`));
        const readyMs = await waitState(page, ['ready']);
        expect(readyMs).toBeLessThanOrEqual(READY_MS);
        expect(await isolationOf(page)).toEqual({
          page: true,
          worker: true,
          child: true,
        });
        const [file, line] = FIXTURE_FILES[tool]!;
        expect(occurrences(await run(page, 'ls'), file)).toBe(1);
        expect(occurrences(await run(page, `cat ${file}`), line)).toBe(1);
        expect(occurrences(await run(page, `${tool} --version`), version)).toBe(
          1,
        );
        // aube's link target lies beside app/ (paths with `..` are refused by the builtins).
        if (tool === 'aube')
          expect(
            await run(page, 'cat /work/outside/linked/package.json'),
          ).toContain('"name": "linked"');
        // Repeated visit: the service worker already controls the page.
        await page.reload();
        await waitState(page, ['ready']);
        expect(await isolationOf(page)).toEqual({
          page: true,
          worker: true,
          child: true,
        });
        expect(
          await page.evaluate(
            () => navigator.serviceWorker.controller?.scriptURL ?? null,
          ),
        ).toMatch(/\/formicarium\/coi-serviceworker\.js$/);
        expect(await cspViolations(page)).toEqual([]);
        await recordTiming(info, { readyMs, totalMs: Date.now() - started });
        await finishPage(page, info);
      } finally {
        await context.close();
      }
    });

for (const [locale, prefix] of LOCALES)
  test(`[ui-states-keyboard] states in text, keyboard only, Ctrl-C and limits at 390 px (${locale})`, async ({
    browser,
    playwright,
  }, info) => {
    const context = await openContext(browser, playwright, info.project.name);
    try {
      const page = await newPage(context, info.project.name);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url(`${prefix}terminal/`));
      await waitState(page, ['ready']);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await expect(page.getByRole('status')).toHaveAttribute(
        'aria-live',
        'polite',
      );
      // Tab leaves the terminal instead of being typed into it.
      await page.locator('[data-terminal-host] textarea').focus();
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('[data-terminal-host]'),
        ),
      ).toBe(false);
      // Keys typed during an install are dropped; Ctrl-C cancels it.
      // Biome is the largest guest, so its install lasts long enough to cancel.
      const tool = TOOLS.some(([name]) => name === 'biome')
        ? 'biome'
        : TOOLS[0]![0];
      await page.locator('[data-terminal-host] textarea').focus();
      await page.keyboard.type(`install ${tool}`);
      await page.keyboard.press('Enter');
      await waitState(page, ['installing'], 30000);
      await page.keyboard.press('q');
      await page.keyboard.press('Control+c');
      await waitState(page, ['ready']);
      // xterm draws written text later, so the rows are read until they show it.
      await expect.poll(() => terminalText(page)).toContain('ABORTED');
      expect(await terminalText(page)).not.toMatch(/\$ install \w+q/);
      await expect(page.getByTestId('terminal-status')).toHaveText(
        locale === 'ja'
          ? '取り消しました（ABORTED）。'
          : 'Cancelled (ABORTED).',
      );
      // An empty result and a line beyond 65536 bytes are reported in text.
      await run(page, 'cd /work');
      await expect(page.getByTestId('terminal-status')).toHaveText(
        locale === 'ja' ? '（出力なし）' : '(no output)',
      );
      // A paste of 65537 bytes on one line (xterm reads the clipboard event).
      // Firefox hides the data of a synthetic paste event, so there the same
      // line is inserted as text, which reaches the same limit.
      const pasted = await page
        .locator('[data-terminal-host] textarea')
        .evaluate((textarea) => {
          const data = new DataTransfer();
          data.setData('text/plain', 'a'.repeat(65537));
          const event = new ClipboardEvent('paste', {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          });
          if (event.clipboardData?.getData('text/plain').length !== 65537)
            return false;
          textarea.dispatchEvent(event);
          return true;
        });
      if (!pasted) {
        expect(info.project.name).toBe('firefox');
        await page.locator('[data-terminal-host] textarea').focus();
        await page.keyboard.insertText('a'.repeat(65537));
      }
      await expect(page.getByTestId('terminal-status')).toContainText('65536');
      await page.keyboard.press('Control+c');
      expect(await cspViolations(page)).toEqual([]);
      await finishPage(page, info);
    } finally {
      await context.close();
    }
  });

test('[documents-after-terminal] documentation and /tools/ keep working and fetch no guest after a terminal page', async ({
  browser,
  playwright,
}, info) => {
  const context = await openContext(browser, playwright, info.project.name);
  try {
    const page = await newPage(context, info.project.name);
    await page.goto(url('terminal/'));
    await waitState(page, ['ready']);
    const requested: string[] = [];
    page.on('request', (request) =>
      requested.push(new URL(request.url()).pathname),
    );
    for (const path of [
      'guides/getting-started/',
      'ja/guides/maintenance/',
      'tools/',
      'ja/tools/',
      '',
    ]) {
      await page.goto(url(path));
      await expect(page.locator('h1').first()).toBeVisible();
    }
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller !== null),
    ).toBe(true);
    await page.goto(url('tools/'));
    await expect(page.getByTestId('tool-card')).toHaveCount(TOOLS.length);
    expect(
      requested.filter((path) =>
        /\/_formicarium\/|\/guests\/|\/demo-fixtures\/|\/catalog\.json$/.test(
          path,
        ),
      ),
    ).toEqual([]);
    expect(await page.locator('[data-terminal-host]').count()).toBe(0);
    await finishPage(page, info);
  } finally {
    await context.close();
  }
});
