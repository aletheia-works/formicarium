// Node.js：probe の全項目が、Node.js の Worker 上の paludarium で PASS すること。
// 項目ごとに 1 回ずつコアを起動して確かめる（どの項目が通らないかを個別に示すため）。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, root } from './helpers.js';

const CHECKS = [
  'tokio-timer',
  'unix-stream-pair',
  'rayon',
  'mutex-condvar',
  'fs-basic',
  'fs-hardlink',
  'fs-symlink',
  'fs-flock',
];
const TIMEOUT_MS = 10 * 60 * 1000;
const probe = path.join(root, 'dist/guests/probe');

async function runProbe(args: string[], network?: { allow: string[] }) {
  let stdout = '';
  let stderr = '';
  const decoder = new TextDecoder();
  const { results } = await runInWorker({
    guest: probe,
    args,
    timeoutMs: TIMEOUT_MS,
    ...(network ? { network } : {}),
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
  it('tcp-echo は許可した行き先にだけ TCP でつながる', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    // 手元の echo サーバー。受け取ったものを、相手が送り終えてから返す。
    const server = net.createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('end', () => socket.end(Buffer.concat(chunks)));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    t.after(() => server.close());
    const { port } = server.address() as net.AddressInfo;
    const target = `127.0.0.1:${port}`;

    const allowed = await runProbe(['tcp-echo', target], { allow: [target] });
    assert.equal(
      allowed.stdout.trim(),
      'PASS tcp-echo',
      `stdout:\n${allowed.stdout}\nstderr:\n${allowed.stderr}`,
    );
    assert.equal(allowed.exitCode, 0);

    // 別の port だけを許可すると ENETUNREACH（101）、許可がなければ EAFNOSUPPORT（97）。
    const other = await runProbe(['tcp-echo', target], {
      allow: [`127.0.0.1:${port === 65535 ? port - 1 : port + 1}`],
    });
    assert.match(other.stdout, /^FAIL tcp-echo: connect: .*\(errno 101\)$/m);
    assert.equal(other.exitCode, 1);
    const none = await runProbe(['tcp-echo', target]);
    assert.match(none.stdout, /^FAIL tcp-echo: connect: .*\(errno 97\)$/m);
    assert.equal(none.exitCode, 1);
  });
  it('ビルド物がそろっている', () => {
    assert.equal(
      missingArtifacts([
        'dist/paludarium/build-info.json',
        'dist/guests/probe',
      ]),
      null,
    );
  });

  for (const name of CHECKS) {
    it(`${name} が PASS する`, {
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
