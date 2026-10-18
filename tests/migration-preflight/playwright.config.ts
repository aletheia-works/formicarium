import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const origin =
  process.env.FORMICARIUM_PREFLIGHT_ORIGIN ?? 'http://127.0.0.1:4182';
if (!['http://127.0.0.1:4182', 'https://localhost:4182'].includes(origin))
  throw Error('explicit loopback trial origin required');
const artifactDirectory = process.env.FORMICARIUM_PREFLIGHT_ATTEMPT;
if (!artifactDirectory)
  throw Error('FORMICARIUM_PREFLIGHT_ATTEMPT new artifact directory required');

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  testDir: '.',
  testMatch: 'consumer.spec.ts',
  timeout: 840_000,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  outputDir: `${artifactDirectory}/playwright`,
  use: {
    baseURL: origin + '/',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  webServer: {
    command: `"${process.execPath}" "${fileURLToPath(new URL('./serve.js', import.meta.url))}"`,
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: origin + '/',
    ignoreHTTPSErrors: false,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: { 'security.enterprise_roots.enabled': true },
        },
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
