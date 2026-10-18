import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['consumer.spec.ts', 'hash-regression.spec.ts'],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: 840000,
  forbidOnly: Boolean(process.env.CI),
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
