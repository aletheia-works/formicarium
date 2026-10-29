// ブラウザのゲストの TCP（ADR 0015）：network.relay の WebSocket を通って、
// relay と run の両方が許可した行き先にだけゲストがつながること（Chromium・Firefox・WebKit）。
// tcp-echo は release candidate の固定の入力の probe にはない項目なので、
// このファイルは product の CI（ゲストをソースからビルドする）でだけ実行する。
// 前提：bun run build、bash mise-tasks/build/guests.sh probe、
//       npx playwright install chromium firefox webkit
import net from 'node:net';
import { startRelay } from '@aletheia-works/paludarium-wasm/relay';
import { expect } from '@playwright/test';
import { captureDiagnostics, probeUrl, test } from './diagnostics.js';

let echo: net.Server;
let relay: Awaited<ReturnType<typeof startRelay>>;
let target: string;
let other: string;

test.beforeAll(async () => {
  // 手元の echo サーバー。受け取ったものを、相手が送り終えてから返す。
  echo = net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('end', () => socket.end(Buffer.concat(chunks)));
  });
  await new Promise<void>((resolve) => echo.listen(0, '127.0.0.1', resolve));
  const { port } = echo.address() as net.AddressInfo;
  target = `127.0.0.1:${port}`;
  other = `127.0.0.1:${port === 65535 ? port - 1 : port + 1}`;
  relay = await startRelay({ allow: [target], port: 0 });
});
test.afterAll(async () => {
  await relay.close();
  await new Promise((resolve) => echo.close(resolve));
});

/** probe の tcp-echo を、allow と relay を付けたページで動かす。 */
async function tcpEcho(
  page: import('@playwright/test').Page,
  destination: string,
) {
  const query = new URLSearchParams({ allow: destination, relay: relay.url });
  await page.goto(`${probeUrl(['tcp-echo', destination])}&${query}`);
  await page.waitForFunction(
    () => window.formicariumResult !== undefined,
    null,
    { timeout: 10 * 60 * 1000 },
  );
  const result = await page.evaluate(() => window.formicariumResult!);
  return { result, stdout: (await captureDiagnostics(page)).streams.stdout };
}

test('tcp-echo が relay を通って、許可した行き先につながる', async ({
  page,
}) => {
  const { result, stdout } = await tcpEcho(page, target);
  expect(result.error).toBeUndefined();
  expect(stdout.trim()).toBe('PASS tcp-echo');
  expect(result.exitCode).toBe(0);
});

test('relay が許可していない行き先は ENETUNREACH になる', async ({ page }) => {
  const { result, stdout } = await tcpEcho(page, other);
  expect(result.error).toBeUndefined();
  expect(stdout).toMatch(/^FAIL tcp-echo: connect: .*\(errno 101\)$/m);
  expect(result.exitCode).toBe(1);
});
