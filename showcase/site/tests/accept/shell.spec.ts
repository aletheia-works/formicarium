import { expect } from '@playwright/test';
import type { PagesServer } from '../../scripts/serve-pages-like.ts';
import { test } from './site-page.ts';
import {
  ISOLATION_OVERLAY,
  run,
  segmentAfter,
  startServer,
  terminalText,
  waitState,
} from './support.ts';

// The terminal's own answers on the real site, with the real formicarium:
// help, and the mistakes it explains in place of the API's codes.
let server: PagesServer;
test.beforeAll(async () => {
  server = await startServer(test.info().project.name, ISOLATION_OVERLAY);
});
test.afterAll(async () => {
  await server?.close();
});

/** What `line` printed, once xterm has drawn it. */
async function printed(
  site: Parameters<typeof run>[0],
  line: string,
  expected: string,
) {
  await run(site, line);
  await expect
    .poll(async () => segmentAfter(await terminalText(site), line))
    .toContain(expected);
}

const CASES = [
  [
    '',
    [
      ['help', 'install <tool> adds:'],
      ['python3 --version', 'python3: command not found.'],
      ['install foo', 'install: no tool named foo.'],
      ['cd /nope', 'cd: /nope is outside /work'],
    ],
  ],
  [
    'ja/',
    [
      ['help', 'install <ツール> で導入できるもの：'],
      ['python3 --version', 'python3：command が見つかりません。'],
      ['install foo', 'install：foo という名前のツールはありません。'],
      ['cd /nope', 'cd：/nope は /work と'],
    ],
  ],
] as const;

for (const [prefix, lines] of CASES)
  test(`[shell] help and plain mistakes (${prefix || 'en/'})`, async ({
    site,
  }) => {
    await site.goto(`${server.origin}/formicarium/${prefix}terminal/`);
    await waitState(site, ['ready']);
    for (const [line, expected] of lines) await printed(site, line, expected);
  });
