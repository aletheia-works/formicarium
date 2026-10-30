import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { siteLayout } from '../../scripts/common.ts';
import type { PagesServer } from '../../scripts/serve-pages-like.ts';
import { type Key, test } from './site-page.ts';
import {
  focusTerminal,
  startServer,
  terminalText,
  waitState,
} from './support.ts';

// The platform's paste key reaches the terminal as the pasted text: Cmd+V
// on macOS (Safari included), Ctrl+V and Ctrl+Shift+V elsewhere, where
// xterm alone would send ^V. The text goes through the system clipboard,
// copied with the platform's copy key from a field the test adds. The copy
// keys copy the terminal's selection the same way: Cmd+C on macOS, Ctrl+C
// and Ctrl+Shift+C elsewhere, where Ctrl+C alone would drop the line.
const siteDir = process.env.SHOWCASE_SITE_DIR ?? siteLayout().dist;
const [version] = readdirSync(join(siteDir, '_formicarium'));
const HARNESS = join(import.meta.dirname, 'harness');
const mac = process.platform === 'darwin';
const PASTE_KEYS: readonly Key[] = mac
  ? ['Meta+v']
  : ['Control+v', 'Control+Shift+v'];

let server: PagesServer;
test.beforeAll(async () => {
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

for (const key of PASTE_KEYS)
  test(`[paste] ${key} pastes into the terminal line`, async ({ site }) => {
    await site.goto(`${server.origin}/formicarium/terminal/`);
    await waitState(site, ['ready']);
    const text = `pasted-${key.toLowerCase().replaceAll('+', '-')}`;
    await site.evaluate((value) => {
      const field = document.createElement('textarea');
      field.id = 'paste-source';
      field.value = value;
      document.body.append(field);
      field.focus();
      field.select();
    }, text);
    await site.press(mac ? 'Meta+c' : 'Control+c');
    await site.evaluate(() =>
      document.getElementById('paste-source')?.remove(),
    );
    await focusTerminal(site);
    await site.press(key);
    await expect
      .poll(async () => (await terminalText(site)).trimEnd().split('\n').at(-1))
      .toBe(`/work/app$ ${text}`);
  });

const COPY_KEYS: readonly Key[] = mac
  ? ['Meta+c']
  : ['Control+c', 'Control+Shift+c'];

for (const key of COPY_KEYS)
  test(`[paste] ${key} copies the terminal's selection`, async ({ site }) => {
    await site.goto(`${server.origin}/formicarium/terminal/`);
    await waitState(site, ['ready']);
    const text = `copied-${key.toLowerCase().replaceAll('+', '-')}`;
    await focusTerminal(site);
    await site.type(text);
    await expect
      .poll(async () => (await terminalText(site)).trimEnd().split('\n').at(-1))
      .toBe(`/work/app$ ${text}`);
    // Select the whole prompt row by dragging across it.
    const row = await site.evaluate(() => {
      const rows = document.querySelector('[data-terminal-host] .xterm-rows');
      const last = [...(rows?.children ?? [])]
        .filter((item) => (item.textContent ?? '').trim())
        .at(-1)!
        .getBoundingClientRect();
      return {
        left: last.left,
        right: last.right,
        y: last.top + last.height / 2,
      };
    });
    await site.drag(
      { x: row.left + 2, y: row.y },
      { x: row.right - 2, y: row.y },
    );
    await site.press(key);
    // The line is still there: with a selection, Ctrl+C copied instead of
    // dropping it.
    expect((await terminalText(site)).trimEnd().split('\n').at(-1)).toBe(
      `/work/app$ ${text}`,
    );
    await site.evaluate(() => {
      const field = document.createElement('textarea');
      field.id = 'copy-sink';
      document.body.append(field);
      field.focus();
    });
    await site.press(mac ? 'Meta+v' : 'Control+v');
    await expect
      .poll(() =>
        site.evaluate(
          () =>
            (document.getElementById('copy-sink') as HTMLTextAreaElement | null)
              ?.value ?? '',
        ),
      )
      .toContain(`/work/app$ ${text}`);
    if (mac) return;
    // The copy cleared the selection, as Windows Terminal and VS Code do, so
    // the next Ctrl+C is ^C again and drops the line.
    await focusTerminal(site);
    await site.press('Control+c');
    await expect
      .poll(async () => (await terminalText(site)).trimEnd().split('\n').at(-1))
      .toBe('/work/app$');
  });
