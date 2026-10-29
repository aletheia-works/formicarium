// ゲストの TCP（ADR 0014）：Node.js では、許可した行き先にだけゲストが TCP でつながること。
// probe の tcp-echo は release candidate の固定の入力の probe にはない項目なので、
// product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, root } from './helpers.js';

const TIMEOUT_MS = 10 * 60 * 1000;
const probe = path.join(root, 'dist/guests/probe');

async function tcpEcho(target: string, network?: { allow: string[] }) {
  let stdout = '';
  let stderr = '';
  const decoder = new TextDecoder();
  const { results } = await runInWorker({
    guest: probe,
    args: ['tcp-echo', target],
    timeoutMs: TIMEOUT_MS,
    ...(network ? { network } : {}),
    onStdout: (c) => (stdout += decoder.decode(c, { stream: true })),
    onStderr: (c) => (stderr += decoder.decode(c, { stream: true })),
  });
  return { exitCode: results.at(-1)?.exitCode, stdout, stderr };
}

describe('ゲストの TCP（Node.js の Worker）', () => {
  it('ビルド物がそろっている', () => {
    assert.equal(
      missingArtifacts([
        'dist/paludarium/build-info.json',
        'dist/guests/probe',
      ]),
      null,
    );
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

    const allowed = await tcpEcho(target, { allow: [target] });
    assert.equal(
      allowed.stdout.trim(),
      'PASS tcp-echo',
      `stdout:\n${allowed.stdout}\nstderr:\n${allowed.stderr}`,
    );
    assert.equal(allowed.exitCode, 0);

    // 別の port だけを許可すると ENETUNREACH（101）、許可がなければ EAFNOSUPPORT（97）。
    const other = await tcpEcho(target, {
      allow: [`127.0.0.1:${port === 65535 ? port - 1 : port + 1}`],
    });
    assert.match(other.stdout, /^FAIL tcp-echo: connect: .*\(errno 101\)$/m);
    assert.equal(other.exitCode, 1);
    const none = await tcpEcho(target);
    assert.match(none.stdout, /^FAIL tcp-echo: connect: .*\(errno 97\)$/m);
    assert.equal(none.exitCode, 1);
  });
});
