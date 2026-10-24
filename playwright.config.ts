// Playwright の設定。scripts/serve.js（COOP/COEP 付きの開発用サーバー）を起動し、
// Chromium・Firefox・WebKit の 3 つでブラウザのテストを実行する。
// WebKit は Safari の代わり（実機の Safari では tests/browser/safari-probe.test.ts が probe と install・command を確かめる）。
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.FORMICARIUM_PORT ?? 8787);

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '**/*.spec.ts',
  // コアのインタプリタは遅いので、1 件あたりの上限を長めに取る。
  timeout: 15 * 60 * 1000,
  expect: { timeout: 10 * 60 * 1000 },
  // 計測と判定の再現性のため、ブラウザは 1 つずつ順に動かす。
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: `"${process.execPath}" scripts/serve.js --port ${port}`,
    url: `http://127.0.0.1:${port}/web/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
