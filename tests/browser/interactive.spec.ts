// 対話的な実行（ADR 0013）：ゲストに端末の大きさと stdin が届くこと（Chromium・Firefox・WebKit）。
// ttyecho は probe と一緒にビルドするゲストで、release candidate の固定の入力には含まれないため、
// このファイルは product の CI（ゲストをソースからビルドする）でだけ実行する。
// 前提：bun run build、bash mise-tasks/build/guests.sh probe、
//       npx playwright install chromium firefox webkit
import { expect } from '@playwright/test';
import { captureDiagnostics, test } from './diagnostics.js';

test('対話的な実行で、ゲストに端末の大きさと stdin が届く', async ({
  page,
}) => {
  await page.goto(
    '/web/index.html?guest=ttyecho&terminal=100x30&stdin=a%1B%5BA%0D',
  );
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: 10 * 60 * 1000 },
  );
  const result = await page.evaluate(() => window.formicariumResult!);
  expect(result.error).toBeUndefined();
  expect(result.exitCode).toBe(0);
  expect((await captureDiagnostics(page)).streams.stdout).toBe(
    'tty in=1 out=1\nsize 100x30\ninput 61 1b 5b 41 0d\n',
  );
});
