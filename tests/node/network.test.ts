// ゲストの TCP（ADR 0014、0015）：Node.js では、許可した行き先にだけゲストが TCP でつながること。
// network.relay を渡すと、ホストのソケットの代わりに WebSocket の relay を通ること。
// probe の tcp-echo は release candidate の固定の入力の probe にはない項目なので、
// product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { describe, it } from 'node:test';

import { createRelay } from '@aletheia-works/paludarium-wasm/relay';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, root } from './helpers.js';

const TIMEOUT_MS = 10 * 60 * 1000;
const probe = path.join(root, 'dist/guests/probe');

async function tcpEcho(
  target: string,
  network?: { allow: string[]; relay?: { url: string; protocols: string[] } },
) {
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

/** 手元の echo サーバー。受け取ったものを、相手が送り終えてから返す。 */
async function echoServer() {
  const server = net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('end', () => socket.end(Buffer.concat(chunks)));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
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

  it('tcp-echo は network.relay の WebSocket を通って、両方が許可した行き先にだけつながる', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    const server = await echoServer();
    t.after(() => server.close());
    const { port } = server.address() as net.AddressInfo;
    const target = `127.0.0.1:${port}`;
    const other = `127.0.0.1:${port === 65535 ? port - 1 : port + 1}`;
    // relay を通った接続を数え、ホストのソケットに戻っていないことを確かめる。
    let upgrades = 0;
    const relay = createRelay({ allow: [target] });
    const front = http.createServer((_, response) => response.end());
    front.on('upgrade', (request, socket, head) => {
      upgrades += 1;
      relay.upgrade(request, socket, head);
    });
    await new Promise<void>((resolve) => front.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      relay.close();
      front.close();
    });
    const url = `ws://127.0.0.1:${(front.address() as net.AddressInfo).port}/`;

    const allowed = await tcpEcho(target, {
      allow: [target],
      relay: { url, protocols: [] },
    });
    assert.equal(
      allowed.stdout.trim(),
      'PASS tcp-echo',
      `stdout:\n${allowed.stdout}\nstderr:\n${allowed.stderr}`,
    );
    assert.equal(allowed.exitCode, 0);
    assert.ok(upgrades > 0, 'the guest connected through the relay');

    // run が許しても relay が許さない行き先は、relay が ENETUNREACH（101）で断る。
    const refused = await tcpEcho(other, {
      allow: [other],
      relay: { url, protocols: [] },
    });
    assert.match(refused.stdout, /^FAIL tcp-echo: connect: .*\(errno 101\)$/m);
    assert.equal(refused.exitCode, 1);
  });

  it('tcp-echo は許可した行き先にだけ TCP でつながる', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    const server = await echoServer();
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

    // 別の port だけを許可すると、loopback の宛先は guest の socket が listen して
    // いないので ECONNREFUSED（111）、ほかの宛先は ENETUNREACH（101）、許可が
    // なければ EAFNOSUPPORT（97）。
    const otherPort = `127.0.0.1:${port === 65535 ? port - 1 : port + 1}`;
    const other = await tcpEcho(target, { allow: [otherPort] });
    assert.match(other.stdout, /^FAIL tcp-echo: connect: .*\(errno 111\)$/m);
    assert.equal(other.exitCode, 1);
    // 192.0.2.1 は文書用の TEST-NET-1 で、接続を試みる前に断られる。
    const unlisted = await tcpEcho('192.0.2.1:7', { allow: [otherPort] });
    assert.match(unlisted.stdout, /^FAIL tcp-echo: connect: .*\(errno 101\)$/m);
    assert.equal(unlisted.exitCode, 1);
    const none = await tcpEcho(target);
    assert.match(none.stdout, /^FAIL tcp-echo: connect: .*\(errno 97\)$/m);
    assert.equal(none.exitCode, 1);
  });
});
