// FR7.1（Node.js）：aube #1645 の手順を Node.js の Worker 上の blink で実行し、書き起こしが
// native の基準値 fixtures/baseline/aube-1645.native.txt と一致すること。
// 前提：bash .mise/tasks/build-blink-wasm、bash .mise/tasks/build-guests aube、
//       bash .mise/tasks/native-baseline を実行済み。
// fixtures はテストの中で仮想ファイルシステムに写すだけで、書き換えない。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { GUESTS } from '../../runtime/registry.js';
import {
  formatTranscript,
  normalizeTranscript,
  parseSessionScript,
  toSessionSteps,
} from '../../runtime/session.js';
import { missingArtifacts, root } from './helpers.js';

const TIMEOUT_MS = 15 * 60 * 1000;
const PROJECT_ROOT = '/work';
const CWD = '/work/app';

export async function runAube1645() {
  const commands = parseSessionScript(
    readFileSync(path.join(root, 'fixtures/sessions/aube-1645.txt'), 'utf8'),
  );
  const { results } = await runInWorker({
    guest: path.join(root, 'dist/guests/aube'),
    copyIn: [
      {
        host: path.join(root, 'fixtures/aube-local-deps'),
        guest: PROJECT_ROOT,
      },
    ],
    cwd: CWD,
    steps: toSessionSteps(commands, CWD),
    persist: [PROJECT_ROOT, '/root'],
    env: GUESTS.aube.env,
    timeoutMs: TIMEOUT_MS,
  });
  return { commands, results, transcript: formatTranscript(commands, results) };
}

describe('aube #1645（Node.js の Worker）', () => {
  it('書き起こしが native の基準値と一致する', {
    timeout: TIMEOUT_MS,
  }, async () => {
    assert.equal(
      missingArtifacts([
        'dist/blink/blink.mjs',
        'dist/guests/aube',
        'fixtures/baseline/aube-1645.native.txt',
      ]),
      null,
    );
    const baseline = readFileSync(
      path.join(root, 'fixtures/baseline/aube-1645.native.txt'),
      'utf8',
    );
    const { transcript } = await runAube1645();
    assert.equal(
      normalizeTranscript(transcript),
      normalizeTranscript(baseline),
    );
  });
});

describe('手順ファイルの解釈（runtime/session.js）', () => {
  it('aube と rm -rf 以外のコマンドは拒否する', () => {
    assert.throws(
      () => parseSessionScript('$ curl http://example.com\n'),
      /unsupported command/,
    );
  });

  it('rm -rf はプロジェクトの外を指すパスを拒否する', () => {
    assert.throws(
      () => parseSessionScript('$ rm -rf /root\n'),
      /relative path/,
    );
    assert.throws(
      () => parseSessionScript('$ rm -rf ../outside\n'),
      /relative path/,
    );
  });

  it('書き起こしは stdout と終了コードだけを含み、改行の違いは正規化で吸収する', () => {
    const commands = parseSessionScript(
      '# comment\n$ aube list\n$ rm -rf node_modules\n',
    );
    const transcript = formatTranscript(commands, [
      { exitCode: 0, stdout: 'app@1.0.0\r\nfiledep 0.0.0' },
      { exitCode: 0, stdout: new Uint8Array() },
    ]);
    assert.equal(
      normalizeTranscript(transcript),
      '$ aube list\napp@1.0.0\nfiledep 0.0.0\n[exit 0]\n$ rm -rf node_modules\n[exit 0]\n',
    );
  });
});
