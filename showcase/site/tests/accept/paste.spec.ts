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
// copied with the platform's copy key from a field the test adds.
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
