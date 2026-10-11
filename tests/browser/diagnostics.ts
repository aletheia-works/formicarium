import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test as base } from '@playwright/test';
import type { ExecutionError } from '../../runtime/errors.js';

export async function captureDiagnostics(page: Page) {
  return page.evaluate(() => ({
    streams: window.formicariumDiagnostics,
    result: window.formicariumResult,
    output: document.getElementById('output')?.textContent,
    pageStatus: document.getElementById('status')?.textContent,
    visibility: document.visibilityState,
    userAgent: navigator.userAgent,
    isolated: globalThis.crossOriginIsolated,
  }));
}

// Auto fixture runs before the test and captures partial output in teardown,
// including when the guest has not produced a final result.
export const test = base.extend<{ diagnostics: undefined }>({
  diagnostics: [
    async ({ page, browser }, use, testInfo) => {
      const consoleMessages: { type: string; text: string }[] = [];
      const pageErrors: string[] = [];
      page.on('console', (message) =>
        consoleMessages.push({ type: message.type(), text: message.text() }),
      );
      page.on('pageerror', (error: Error) => pageErrors.push(String(error)));
      await use(undefined);
      let snapshot:
        | Awaited<ReturnType<typeof captureDiagnostics>>
        | { captureError: string };
      try {
        snapshot = await captureDiagnostics(page);
      } catch (caught) {
        const error = caught as ExecutionError;
        snapshot = { captureError: String(error) };
      }
      const evidence = {
        title: testInfo.title,
        project: testInfo.project.name,
        repeatIndex: testInfo.repeatEachIndex,
        retry: testInfo.retry,
        status: testInfo.status,
        expectedStatus: testInfo.expectedStatus,
        browserVersion: browser.version(),
        platform: process.platform,
        url: page.url(),
        console: consoleMessages,
        pageErrors,
        ...snapshot,
      };
      const file = testInfo.outputPath('diagnostics.json');
      await writeFile(file, JSON.stringify(evidence, null, 2));
      await testInfo.attach('diagnostics', {
        path: file,
        contentType: 'application/json',
      });
    },
    { auto: true },
  ],
});

export function probeUrl(args: string[] = []) {
  const query = new URLSearchParams({ guest: 'probe' });
  for (const arg of args) query.append('arg', arg);
  if (process.env.FORMICARIUM_DIAGNOSTIC === '1') {
    query.append('core-flag', '-s');
    query.append('arg', '--diagnostic');
  }
  return `/web/index.html?${query}`;
}
