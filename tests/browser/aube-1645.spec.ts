// FR7.1（ブラウザ）：aube #1645 の手順をブラウザ上の blink で実行し、書き起こしが
// native（x86-64 Linux）の基準値 fixtures/baseline/aube-1645.native.txt と一致すること。
// 前提：bash .mise/tasks/build-guests aube と bash .mise/tasks/native-baseline を実行済み。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';
import { normalizeTranscript } from '../../runtime/session.js';
import { test } from './diagnostics.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const baseline = normalizeTranscript(
  readFileSync(
    path.join(root, 'fixtures/baseline/aube-1645.native.txt'),
    'utf8',
  ),
);

test('aube #1645 の書き起こしが native と一致する', async ({ page }) => {
  await page.goto('/runtime/web/index.html?session=aube-1645');
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: 14 * 60 * 1000 },
  );
  const result = await page.evaluate(() => window.formicariumResult!);
  expect(result.error).toBeUndefined();
  expect(result.steps?.map((step) => step.command)).toEqual([
    'aube install',
    'rm -rf node_modules',
    'aube install --frozen-lockfile',
    'aube list',
  ]);
  expect(result.steps?.map((step) => step.exitCode)).toEqual([0, 0, 0, 0]);
  expect(normalizeTranscript(result.transcript!)).toBe(baseline);
  // 修正済み v2.7.0 の native と同じ file:/link: 依存の版を検査する。
  expect(result.transcript!).toContain('├── filedep 1.0.0\n└── linked 2.0.0\n');
});

test('一覧にない手順は実行しない', async ({ page }) => {
  await page.goto('/runtime/web/index.html?session=no-such-session');
  await page.waitForFunction(() => window.formicariumResult !== undefined);
  const result = await page.evaluate(() => window.formicariumResult!);
  expect(result.error).toMatch(/unknown session/);
  expect(result.transcript!).toBeUndefined();
});
