import { readFile, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
// FR2.2・FR5.2：COOP/COEP 付きのページで crossOriginIsolated が真になり、
// blink の wasm 上で probe の全項目が PASS すること（Chromium・Firefox・WebKit）。
// 前提：bash mise-tasks/build/blink-wasm.sh、bash mise-tasks/build/guests.sh probe、
//       npx playwright install chromium firefox webkit
import { expect } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';
import { captureDiagnostics, probeUrl, test } from './diagnostics.js';

const CHECKS = [
  'tokio-timer',
  'unix-stream-pair',
  'rayon',
  'mutex-condvar',
  'fs-basic',
  'fs-hardlink',
  'fs-symlink',
  'fs-flock',
];

/** 実行が終わる（data-exit-code が付くか、エラーになる）まで待ち、結果を返す。 */
async function waitForResult(page: Page) {
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: 10 * 60 * 1000 },
  );
  return page.evaluate(() => window.formicariumResult!);
}

test('ページが crossOriginIsolated になる', async ({ page }) => {
  await page.goto('/runtime/web/index.html?guest=hello');
  await expect(page.getByTestId('isolated')).toHaveText('true');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});

test('hello ゲストが起動して終了コード 0 を返す', async ({ page }) => {
  await page.goto('/runtime/web/index.html?guest=hello&arg=from-browser');
  const result = await waitForResult(page);
  expect(result.error).toBeUndefined();
  expect(result.exitCode).toBe(0);
  await expect(page.getByTestId('output')).toHaveAttribute(
    'data-exit-code',
    '0',
  );
  await expect(page.getByTestId('output')).toContainText('arg: from-browser');
  expect((await captureDiagnostics(page)).streams.stdout).toContain(
    'arg: from-browser',
  );
});

test('終了コード 3 のゲストの終了コードが伝わる', async ({ page }) => {
  await page.goto('/runtime/web/index.html?guest=exit3');
  const result = await waitForResult(page);
  expect(result.exitCode).toBe(3);
  await expect(page.getByTestId('output')).toHaveAttribute(
    'data-exit-code',
    '3',
  );
  expect((await captureDiagnostics(page)).streams.stderr).toContain(
    'exiting with status 3',
  );
});

test('診断: ゲスト待機期限切れでも途中結果を保存できる', async ({
  page,
}, testInfo) => {
  await page.goto(probeUrl(['mutex-condvar']));
  // This short deadline exercises collection only; it does not replace the
  // acceptance deadline of the full probe test.
  let timeoutError: Error | undefined;
  try {
    await page.waitForFunction(
      () => window.formicariumResult !== undefined,
      null,
      { timeout: 1 },
    );
  } catch (caught) {
    const error = caught as ExecutionError;
    timeoutError = error as Error;
  }
  expect(timeoutError?.name).toBe('TimeoutError');
  const snapshot = await captureDiagnostics(page);
  expect(snapshot.result).toBeUndefined();
  expect(snapshot.pageStatus).toBe('running');
  expect(snapshot.streams).toEqual({
    stdout: expect.any(String),
    stderr: expect.any(String),
  });
  const file = testInfo.outputPath('timeout-snapshot.json');
  await writeFile(file, JSON.stringify(snapshot));
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(snapshot);
  await testInfo.attach('timeout-snapshot', {
    path: file,
    contentType: 'application/json',
  });
});

test('一覧にないゲストは実行せずにエラーを表示する', async ({ page }) => {
  await page.goto('/runtime/web/index.html?guest=../../etc/passwd');
  const result = await waitForResult(page);
  expect(result.error).toMatch(/unknown guest/);
  await expect(page.getByTestId('output')).not.toHaveAttribute(
    'data-exit-code',
    /.*/,
  );
});

test('probe の全項目が PASS する', async ({ page }) => {
  await page.goto(probeUrl());
  const result = await waitForResult(page);
  expect(result.error).toBeUndefined();
  const output = await page.getByTestId('output').textContent();
  for (const name of CHECKS) {
    expect(output, `項目 ${name}`).toContain(`PASS ${name}\n`);
  }
  expect(output).not.toContain('FAIL ');
  expect(result.exitCode).toBe(0);
});

test('loopback1: bitset 不一致 wake が絶対期限を短縮しない', async ({
  page,
}) => {
  await page.goto(probeUrl(['futex-deadline']));
  const result = await waitForResult(page);
  expect(result.error).toBeUndefined();
  expect(result.exitCode).toBe(0);
  const snapshot = await captureDiagnostics(page);
  expect(snapshot.streams.stdout.trim()).toBe('PASS futex-deadline');
  expect(snapshot.streams.stderr).toContain(
    'futex mismatch broadcasts=45 rc=-1 errno=110',
  );
  expect(snapshot.streams.stderr).toContain('futex no-wake rc=-1 errno=110');
});

test('madvise(MADV_DONTNEED) の後、匿名メモリがゼロで読める', async ({
  page,
}) => {
  await page.goto(probeUrl(['madvise-dontneed']));
  const result = await waitForResult(page);
  expect(result.error).toBeUndefined();
  const snapshot = await captureDiagnostics(page);
  expect(snapshot.streams.stdout.trim()).toBe('PASS madvise-dontneed');
  expect(result.exitCode).toBe(0);
});

test('loopback1: 同じ新規ページへの同時 fault でページが混線しない', async ({
  page,
}) => {
  await page.goto(probeUrl(['page-fault-race']));
  const result = await waitForResult(page);
  expect(result.error).toBeUndefined();
  const snapshot = await captureDiagnostics(page);
  expect(snapshot.streams.stdout.trim()).toBe('PASS page-fault-race');
  expect(result.exitCode).toBe(0);
});
