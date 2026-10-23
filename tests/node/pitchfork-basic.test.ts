// Node.js：pitchfork-basic の 8 コマンドを Node.js の Worker 上の paludarium で順に実行し、
// 書き起こしが native の基準値 fixtures/baseline/pitchfork-basic.native.txt と一致すること、
// 手順の間で状態が引き継がれること。設定は runtime/registry.js の表から読む。
// 前提：bun run build、bash mise-tasks/build/guests.sh pitchfork、
//       bash mise-tasks/build/native-baseline.sh pitchfork-basic を実行済み。
// fixtures はテストの中で仮想ファイルシステムに写すだけで、書き換えない。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { GUESTS, lookupSession } from '../../runtime/registry.js';
import {
  formatTranscript,
  normalizeTranscript,
  parseSessionScript,
  toSessionSteps,
} from '../../runtime/session.js';
import {
  daemonSection,
  outputOf,
  NODE_TIMEOUT_MS as TIMEOUT_MS,
  transcriptOutputs,
} from '../shared/pitchfork-basic.js';
import { missingArtifacts, root } from './helpers.js';

const SESSION_NAME = 'pitchfork-basic';
const session = lookupSession(SESSION_NAME);
const guest = GUESTS[session.guest as keyof typeof GUESTS];

async function runPitchforkBasic() {
  const missing = missingArtifacts([
    'dist/paludarium/build-info.json',
    guest.path,
    session.baseline,
  ]);
  assert.equal(missing, null);
  const commands = parseSessionScript(
    readFileSync(path.join(root, session.script), 'utf8'),
    { tool: session.guest },
  );
  const started = performance.now();
  const { results } = await runInWorker({
    guest: path.join(root, guest.path),
    copyIn: [
      {
        host: path.join(root, session.projectBase),
        guest: session.projectRoot,
      },
    ],
    cwd: session.cwd,
    steps: toSessionSteps(commands, session.cwd),
    persist: [...session.persist],
    env: { ...guest.env },
    timeoutMs: TIMEOUT_MS,
  });
  const transcript = formatTranscript(commands, results);
  return {
    commands,
    transcript,
    outputs: transcriptOutputs(transcript, commands),
    elapsedMs: performance.now() - started,
    stepMs: results.map((r) => Math.round(r.elapsedMs)),
  };
}

// 3 つの確認で同じ 1 回の実行を使う（1 回に数分かかるため）
let pending: ReturnType<typeof runPitchforkBasic> | undefined;
const run = () => (pending ??= runPitchforkBasic());

describe('pitchfork-basic（Node.js の Worker）', () => {
  it('書き起こしが native の基準値と一致する', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    const { transcript, elapsedMs, stepMs } = await run();
    // 時間の上限を実測から決めるための記録
    t.diagnostic(
      `elapsedMs=${Math.round(elapsedMs)} stepMs=${stepMs.join(',')}`,
    );
    const baseline = readFileSync(path.join(root, session.baseline), 'utf8');
    assert.equal(
      normalizeTranscript(transcript),
      normalizeTranscript(baseline),
    );
  });

  it('daemons add と remove の結果が cat pitchfork.toml に表れる', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { outputs } = await run();
    const cat = outputOf(outputs, 'cat pitchfork.toml');
    assert.equal(cat.exitCode, 0);
    assert.notEqual(daemonSection(cat.stdout, 'api'), null, cat.stdout);
    assert.equal(daemonSection(cat.stdout, 'worker'), null, cat.stdout);
    const db = daemonSection(cat.stdout, 'db');
    assert.notEqual(db, null, cat.stdout);
    assert.match(db!, /^run\s*=\s*"postgres -D data"$/m);
  });

  it('settings set の値が次の settings get で返る', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { outputs } = await run();
    const get = outputOf(outputs, 'pitchfork settings get general.interval');
    assert.equal(get.exitCode, 0);
    assert.equal(get.stdout.trim(), '5s');
  });
});
