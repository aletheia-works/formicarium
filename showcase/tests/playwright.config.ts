import { defineConfig, devices } from '@playwright/test';

// Browser acceptance keeps the existing limits: 1 worker, no retry, 840 s.
export default defineConfig({
  testDir: '.',
  testMatch: ['accept.spec.ts'],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: 840000,
  forbidOnly: Boolean(process.env.CI),
  outputDir: '../.work/playwright-results',
  use: { trace: 'retain-on-failure', ignoreHTTPSErrors: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
