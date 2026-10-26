// 対話的な実行（ADR 0013）：ゲストに端末の大きさと stdin が届くこと（Chromium・Firefox・WebKit）。
// ttyecho は probe と一緒にビルドするゲストで、release candidate の固定の入力には含まれないため、
// このファイルは product の CI（ゲストをソースからビルドする）でだけ実行する。
// nano も同じ理由で、このファイルでだけ動かす。
// 前提：bun run build、bash mise-tasks/build/guests.sh probe・nano、
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

test('nano が端末に画面を描き、打ったものを保存して終える', async ({
  page,
}) => {
  // 新しいファイルに XY と打ち、^O・Enter で保存して ^X で終える
  await page.goto(
    '/web/index.html?guest=nano&arg=note.txt&terminal=80x24&stdin=XY%0F%0D%18',
  );
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: 10 * 60 * 1000 },
  );
  const result = await page.evaluate(() => window.formicariumResult!);
  expect(result.error).toBeUndefined();
  expect(result.exitCode).toBe(0);
  const { stdout } = (await captureDiagnostics(page)).streams;
  // キーはまとめて届くので、打ちながらの描き直しは Node.js のテストで確かめる
  expect(stdout).toContain('GNU nano 9.3');
  expect(stdout).toContain('Wrote 1 line');
});
