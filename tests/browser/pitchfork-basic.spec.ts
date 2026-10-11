// FR6.1〜FR6.4（ブラウザ）：pitchfork-basic の 8 コマンドをブラウザ上の blink で順に実行し、
// 書き起こしが native（x86-64 Linux）の基準値 fixtures/baseline/pitchfork-basic.native.txt と一致すること
// （FR6.2）、手順の間で状態が引き継がれること（FR6.3）を、Chromium・Firefox・WebKit で確かめる。
// 前提：bash mise-tasks/build/blink-wasm.sh、bash mise-tasks/build/guests.sh pitchfork、
//       bash mise-tasks/build/native-baseline.sh pitchfork-basic を実行済み。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';
import { lookupSession } from '../../runtime/registry.js';
import {
  normalizeTranscript,
  parseSessionScript,
} from '../../runtime/session.js';
import {
  daemonSection,
  outputOf,
  BROWSER_TIMEOUT_MS as TIMEOUT_MS,
  transcriptOutputs,
} from '../shared/pitchfork-basic.js';
import { test } from './diagnostics.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const session = lookupSession('pitchfork-basic');
const commands = parseSessionScript(
  readFileSync(path.join(root, session.script), 'utf8'),
  { tool: session.guest },
);
const baseline = normalizeTranscript(
  readFileSync(path.join(root, session.baseline), 'utf8'),
);

test('pitchfork-basic の書き起こしが native と一致し、状態が引き継がれる', async ({
  page,
}) => {
  // 1 回の実行に、読み込みと判定の余裕を足した値をこのテストの上限にする（TIMEOUT_MS は tests/shared/pitchfork-basic.js の BROWSER_TIMEOUT_MS）
  test.setTimeout(TIMEOUT_MS + 60 * 1000);
  await page.goto('/runtime/web/index.html?session=pitchfork-basic');
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: TIMEOUT_MS },
  );
  const result = await page.evaluate(() => window.formicariumResult!);
  expect(result.error).toBeUndefined();
  // 時間の上限を実測から決めるための記録（NFR2。計画の Step 12）
  test.info().annotations.push({
    type: 'elapsed',
    description: `elapsedMs=${Math.round(result.elapsedMs!)} stepMs=${result.steps?.map((s) => Math.round(s.elapsedMs)).join(',')}`,
  });

  await test.step('書き起こしが native の基準値と一致する（FR6.2）', async () => {
    expect(normalizeTranscript(result.transcript!)).toBe(baseline);
  });

  const outputs = transcriptOutputs(result.transcript!, commands);
  await test.step('daemons add と remove の結果が cat pitchfork.toml に表れる（FR6.3）', async () => {
    const cat = outputOf(outputs, 'cat pitchfork.toml');
    expect(cat.exitCode).toBe(0);
    expect(daemonSection(cat.stdout, 'api')).not.toBeNull();
    expect(daemonSection(cat.stdout, 'worker')).toBeNull();
    expect(daemonSection(cat.stdout, 'db')).toMatch(
      /^run\s*=\s*"postgres -D data"$/m,
    );
  });

  await test.step('settings set の値が次の settings get で返る（FR6.3）', async () => {
    const get = outputOf(outputs, 'pitchfork settings get general.interval');
    expect(get.exitCode).toBe(0);
    expect(get.stdout.trim()).toBe('5s');
  });
});
