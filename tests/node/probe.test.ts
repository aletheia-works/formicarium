// FR3・FR4・FR5.1・FR5.2（Node.js）：probe の全項目が、Node.js の Worker 上の blink で PASS すること。
// 項目ごとに 1 回ずつ blink を起動して確かめる（どの項目が通らないかを個別に示すため）。
// 前提：bash scripts/build-blink-wasm.sh と bash scripts/build-guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, root } from './helpers.js';

const CHECKS = [
  ['tokio-timer', 'FR3.1・FR3.2・FR3.3・FR5.1'],
  ['unix-stream-pair', 'FR4.2・FR5.1'],
  ['rayon', 'FR3.2・FR5.1'],
  ['mutex-condvar', 'FR3.2・FR5.1'],
  ['fs-basic', 'FR4.1'],
  ['fs-hardlink', 'FR4.1'],
  ['fs-symlink', 'FR4.1'],
  ['fs-flock', 'FR4.1'],
];
const TIMEOUT_MS = 10 * 60 * 1000;
const probe = path.join(root, 'dist/guests/probe');

async function runProbe(args: string[]) {
  let stdout = '';
  let stderr = '';
  const decoder = new TextDecoder();
  const { results } = await runInWorker({
    guest: probe,
    args,
    timeoutMs: TIMEOUT_MS,
    onStdout: (c) => (stdout += decoder.decode(c, { stream: true })),
    onStderr: (c) => (stderr += decoder.decode(c, { stream: true })),
  });
  return { exitCode: results.at(-1)?.exitCode, stdout, stderr };
}

describe('probe（Node.js の Worker）', () => {
  it('BSF zero は native 互換 destination と ZF を保持し非zero controlsも通る', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { exitCode, stdout, stderr } = await runProbe(['bsf-zero']);
    assert.equal(
      stdout.trim(),
      'PASS bsf-zero',
      `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.equal(exitCode, 0, stderr);
    assert.match(stderr, /bsf 16-nonzero destination=15 zf=0 expected=15\/0/);
    assert.match(stderr, /bsf 32-nonzero destination=15 zf=0 expected=15\/0/);
    assert.match(stderr, /bsf 64-nonzero destination=63 zf=0 expected=63\/0/);
    assert.match(stderr, /bsf 64-zero destination=64 zf=1 expected=64\/1/);
    assert.match(
      stderr,
      /bsf 64-zero-to-nonzero destination=15 zf=0 expected=15\/0/,
    );
  });
  it('loopback1: bitset 不一致 wake が絶対期限を短縮しない', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { exitCode, stdout, stderr } = await runProbe(['futex-deadline']);
    assert.equal(exitCode, 0, stderr);
    assert.equal(stdout.trim(), 'PASS futex-deadline', stderr);
    assert.match(stderr, /futex mismatch broadcasts=45 rc=-1 errno=110/);
    assert.match(stderr, /futex no-wake rc=-1 errno=110/);
  });
  it('loopback1: 同じ新規ページへの同時 fault でページが混線しない', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { exitCode, stdout, stderr } = await runProbe(['page-fault-race']);
    assert.equal(
      stdout.trim(),
      'PASS page-fault-race',
      `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.equal(exitCode, 0);
  });
  it('madvise(MADV_DONTNEED) の後、匿名メモリがゼロで読める', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { exitCode, stdout, stderr } = await runProbe(['madvise-dontneed']);
    assert.equal(
      stdout.trim(),
      'PASS madvise-dontneed',
      `stdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    assert.equal(exitCode, 0);
  });
  it('ビルド物がそろっている', () => {
    assert.equal(
      missingArtifacts(['dist/blink/blink.mjs', 'dist/guests/probe']),
      null,
    );
  });

  for (const [name, requirement] of CHECKS) {
    it(`${name} が PASS する（${requirement}）`, {
      timeout: TIMEOUT_MS,
    }, async () => {
      const { exitCode, stdout, stderr } = await runProbe([name]);
      assert.equal(
        stdout.trim(),
        `PASS ${name}`,
        `stdout:\n${stdout}\nstderr:\n${stderr}`,
      );
      assert.equal(exitCode, 0);
    });
  }

  it('未知の項目名は終了コード 2 で拒否される', {
    timeout: TIMEOUT_MS,
  }, async () => {
    const { exitCode, stderr } = await runProbe(['no-such-check']);
    assert.equal(exitCode, 2);
    assert.match(stderr, /unknown check: no-such-check/);
  });

  it('時間切れの実行はエラーになり、成功扱いにならない', async () => {
    await assert.rejects(
      runInWorker({ guest: probe, args: ['tokio-timer'], timeoutMs: 1 }),
      /timed out after 1 ms/,
    );
  });
});
