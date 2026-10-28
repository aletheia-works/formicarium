import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { siteLayout } from '../../scripts/common.ts';
import type { PagesServer } from '../../scripts/serve-pages-like.ts';
import { test } from './site-page.ts';
import {
  cspViolations,
  focusTerminal,
  ISOLATION_OVERLAY,
  isolationOf,
  occurrences,
  poll,
  READY_MS,
  recordTiming,
  run,
  startServer,
  state,
  statusText,
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
/** nano's version: tools.json marks it for every page, so every page has it. */
const NANO = catalog.defaults.nano;
const LOCALES = [
  ['en', ''],
  ['ja', 'ja/'],
] as const;
/** A file of each demo fixture and a line of it that `cat` must show once. */
const FIXTURE_FILES: Record<string, [string, string]> = {
  aube: ['package.json', '"linked": "link:../outside/linked"'],
  biome: ['example.js', 'Hello, terrarium!'],
  jj: ['note.txt', 'with jj git init'],
  nano: ['note.txt', 'save it with Ctrl-O'],
  pitchfork: ['pitchfork.toml', '[daemons.api]'],
};

let server: PagesServer;
test.beforeAll(async () => {
  server = await startServer(test.info().project.name, ISOLATION_OVERLAY);
});
test.afterAll(async () => {
  await server?.close();
});
const url = (path: string) => `${server.origin}/formicarium/${path}`;

for (const [tool, version] of TOOLS)
  for (const [locale, prefix] of LOCALES)
    test(`[empty-terminal-install] ${tool} ${version} from the empty terminal (${locale})`, async ({
      site,
    }, info) => {
      const started = Date.now();
      await site.goto(url(`${prefix}terminal/`));
      const readyMs = await waitState(site, ['ready']);
      await poll(() => statusText(site)).toBe(
        locale === 'ja'
          ? '準備完了。install <ツール> でツールを導入できます。'
          : 'Ready. Type install <tool> to add a tool.',
      );
      const installStarted = Date.now();
      await run(site, `install ${tool}`);
      const installMs = Date.now() - installStarted;
      expect(await state(site)).toBe('ready');
      await poll(() => statusText(site)).toContain(`${tool} ${version}`);
      const output = await run(site, `${tool} --version`);
      expect(occurrences(output, version), output).toBe(1);
      expect(await cspViolations(site)).toEqual([]);
      await recordTiming(info, {
        readyMs,
        installMs,
        totalMs: Date.now() - started,
      });
    });

for (const [tool, version] of TOOLS)
  for (const [locale, prefix] of LOCALES)
    test(`[tool-page] ${tool} starts installed with its fixture, isolated on first and repeated visits (${locale})`, async ({
      site,
    }, info) => {
      const started = Date.now();
      await site.goto(url(`${prefix}tools/${tool}/`));
      const readyMs = await waitState(site, ['ready']);
      expect(readyMs).toBeLessThanOrEqual(READY_MS);
      expect(await isolationOf(site)).toEqual({
        page: true,
        worker: true,
        child: true,
      });
      const [file, line] = FIXTURE_FILES[tool]!;
      expect(occurrences(await run(site, 'ls'), file)).toBe(1);
      expect(occurrences(await run(site, `cat ${file}`), line)).toBe(1);
      expect(occurrences(await run(site, `${tool} --version`), version)).toBe(
        1,
      );
      // nano opens its editor on the fixture, which needs a terminal type it
      // knows, and quits on Ctrl-X. Every page installs it when it starts.
      if (NANO) {
        await focusTerminal(site);
        await site.type(`nano ${file}`);
        await site.press('Enter');
        await poll(() => terminalText(site)).toContain(`GNU nano ${NANO}`);
        // nano draws the file after its title, status and help rows.
        await poll(() => terminalText(site)).toContain(line);
        await site.press('Control+x');
        await waitState(site, ['ready']);
        expect(await terminalText(site)).not.toContain('cannot initialize');
      }
      // jj describe opens nano (installed in /usr/bin by the page) for the
      // message; the home config the page writes keeps jj from asking for a pager.
      if (tool === 'jj' && NANO) {
        await run(site, 'jj git init');
        await focusTerminal(site);
        await site.type('jj describe');
        await site.press('Enter');
        await poll(() => terminalText(site), READY_MS).toContain(
          `GNU nano ${NANO}`,
        );
        await site.type('Described in nano');
        await site.press('Control+x');
        await poll(() => terminalText(site)).toContain('Save modified buffer');
        await site.type('y');
        await poll(() => terminalText(site)).toContain('Write to File');
        await site.press('Enter');
        await waitState(site, ['ready']);
        const log = await run(site, 'jj log -r @ --no-graph -T description');
        expect(occurrences(log, 'Described in nano'), log).toBe(1);
        expect(log).not.toContain('pager');
      }
      // aube's link target lies beside app/ (paths with `..` are refused by the builtins).
      if (tool === 'aube')
        expect(
          await run(site, 'cat /work/outside/linked/package.json'),
        ).toContain('"name": "linked"');
      // Repeated visit: the service worker already controls the page.
      await site.reload();
      await waitState(site, ['ready']);
      expect(await isolationOf(site)).toEqual({
        page: true,
        worker: true,
        child: true,
      });
      expect(
        await site.evaluate(
          () => navigator.serviceWorker.controller?.scriptURL ?? null,
        ),
      ).toMatch(/\/formicarium\/coi-serviceworker\.js$/);
      expect(await cspViolations(site)).toEqual([]);
      await recordTiming(info, { readyMs, totalMs: Date.now() - started });
    });

for (const [locale, prefix] of LOCALES)
  test(`[ui-states-keyboard] states in text, keyboard only, Ctrl-C and limits at 390 px (${locale})`, async ({
    site,
  }) => {
    await site.setViewportSize(390, 844);
    await site.goto(url(`${prefix}terminal/`));
    await waitState(site, ['ready']);
    expect(
      await site.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      await site.evaluate(() =>
        [...document.querySelectorAll('[role="status"]')].map((status) =>
          status.getAttribute('aria-live'),
        ),
      ),
    ).toEqual(['polite']);
    // The page's content styles must not reach xterm: rows sit one row
    // height apart with no margin, and the input element (where typing and
    // IME composition appear) stays on the cursor row.
    await focusTerminal(site);
    const layout = await site.evaluate(() => {
      const host = document.querySelector('[data-terminal-host]')!;
      const rows = [...host.querySelectorAll('.xterm-rows > div')].slice(0, 4);
      const tops = rows.map((row) => row.getBoundingClientRect().top);
      // When ready, the cursor waits on the last prompt row.
      const prompt = [...host.querySelectorAll('.xterm-rows > div')]
        .filter((row) => /\$\s*$/.test(row.textContent ?? ''))
        .at(-1);
      const textarea = host.querySelector('textarea');
      return {
        margins: rows.map((row) => getComputedStyle(row).marginTop),
        steps: tops.slice(1).map((top, index) => top - tops[index]!),
        height: rows[0]!.getBoundingClientRect().height,
        offset:
          prompt && textarea
            ? Math.abs(
                textarea.getBoundingClientRect().top -
                  prompt.getBoundingClientRect().top,
              )
            : null,
      };
    });
    expect(layout.margins).toEqual(['0px', '0px', '0px', '0px']);
    for (const step of layout.steps) expect(step).toBeCloseTo(layout.height, 0);
    expect(layout.offset).not.toBeNull();
    expect(layout.offset!).toBeLessThan(2);
    // Tab leaves the terminal instead of being typed into it. Safari's Tab
    // moves only between form fields by default, and the terminal is the
    // only one; Option-Tab is Safari's key for every item.
    await site.press(site.project === 'safari' ? 'Alt+Tab' : 'Tab');
    expect(
      await site.evaluate(
        () => !!document.activeElement?.closest('[data-terminal-host]'),
      ),
    ).toBe(false);
    // Keys typed during an install are dropped; Ctrl-C cancels it.
    // Biome is the largest guest, so its install lasts long enough to cancel.
    const tool = TOOLS.some(([name]) => name === 'biome')
      ? 'biome'
      : TOOLS[0]![0];
    await focusTerminal(site);
    await site.type(`install ${tool}`);
    await site.press('Enter');
    await waitState(site, ['installing'], 30000);
    await site.press('q');
    await site.press('Control+c');
    await waitState(site, ['ready']);
    // xterm draws written text later, so the rows are read until they show it.
    await poll(() => terminalText(site)).toContain('ABORTED');
    expect(await terminalText(site)).not.toMatch(/\$ install \w+q/);
    await poll(() => statusText(site)).toBe(
      locale === 'ja' ? '取り消しました（ABORTED）。' : 'Cancelled (ABORTED).',
    );
    // An empty result and a line beyond 65536 bytes are reported in text.
    await run(site, 'cd /work');
    await poll(() => statusText(site)).toBe(
      locale === 'ja' ? '（出力なし）' : '(no output)',
    );
    // A paste of 65537 bytes on one line (xterm reads the clipboard event).
    // Firefox hides the data of a synthetic paste event, so there the same
    // line is inserted as text, which reaches the same limit.
    const pasted = await site.evaluate(() => {
      const textarea = document.querySelector('[data-terminal-host] textarea')!;
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
      expect(site.project).toBe('firefox');
      await focusTerminal(site);
      await site.insertText('a'.repeat(65537));
    }
    await poll(() => statusText(site)).toContain('65536');
    await site.press('Control+c');
    expect(await cspViolations(site)).toEqual([]);
  });

test('[documents-after-terminal] documentation and /tools/ keep working and fetch no guest after a terminal page', async ({
  site,
}) => {
  await site.goto(url('terminal/'));
  await waitState(site, ['ready']);
  // Every request reaches the server (no cache validators, and the service
  // worker passes each one on); the pages' resource entries add any
  // response a browser cache gave instead.
  const served = server.requests.length;
  const requested: string[] = [];
  const resources = () =>
    site.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname),
    );
  for (const path of [
    'guides/getting-started/',
    'ja/guides/maintenance/',
    'tools/',
    'ja/tools/',
    '',
  ]) {
    await site.goto(url(path));
    await poll(() =>
      site.evaluate(() => {
        const box = document.querySelector('h1')?.getBoundingClientRect();
        return !!box && box.width > 0 && box.height > 0;
      }),
    ).toBe(true);
    requested.push(...(await resources()));
  }
  expect(
    await site.evaluate(() => navigator.serviceWorker.controller !== null),
  ).toBe(true);
  await site.goto(url('tools/'));
  await poll(() =>
    site.evaluate(
      () => document.querySelectorAll('[data-testid="tool-card"]').length,
    ),
  ).toBe(TOOLS.length);
  requested.push(...(await resources()), ...server.requests.slice(served));
  expect(
    requested.filter((path) =>
      /\/_formicarium\/|\/guests\/|\/demo-fixtures\/|\/catalog\.json$/.test(
        path,
      ),
    ),
  ).toEqual([]);
  expect(
    await site.evaluate(
      () => document.querySelectorAll('[data-terminal-host]').length,
    ),
  ).toBe(0);
});
