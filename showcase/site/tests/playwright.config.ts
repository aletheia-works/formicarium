import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WORK = join(import.meta.dirname, '..', '.work');

// Site acceptance: 1 worker, no retry, 180 s per
// test; each test waits at most 120 s from goto until the terminal is ready.
// One browser per run: the JSON report goes to accept/<browser>/results.json.
export default defineConfig({
  testDir: './accept',
  testMatch: ['*.spec.ts'],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: 180000,
  forbidOnly: Boolean(process.env.CI),
  outputDir: join(WORK, 'playwright-results'),
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.SHOWCASE_ACCEPT_RESULTS ??
          join(WORK, 'accept', 'results.json'),
      },
    ],
  ],
  use: { trace: 'retain-on-failure', ignoreHTTPSErrors: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
