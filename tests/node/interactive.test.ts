// 対話的な実行（ADR 0013）：Node.js の Session で、ゲストに端末の大きさと stdin が届くこと。
// ttyecho は probe と一緒にビルドするゲストで、release candidate の固定の入力には含まれないため、
// product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { coreAssets } from '../../runtime/core.js';
import { createSession } from '../../runtime/node/api.js';
import { root } from './helpers.js';

const assets = coreAssets(
  pathToFileURL(`${root}/dist/paludarium/`),
  pathToFileURL(`${root}/runtime/node/package-worker.js`),
);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('対話的な実行（Node.js の Session）', () => {
  it('端末の大きさと、流した stdin がそのままゲストに届く', async (t) => {
    const session = await createSession({ assets });
    t.after(() => session.dispose());
    const guest = new Uint8Array(await readFile(`${root}/dist/guests/ttyecho`));
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stdin = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const running = session.run({
      guest,
      stdin,
      terminal: { columns: 100, rows: 30 },
      // ゲストは読み始める前に端末の情報を出すので、入力はその後に送る
      onOutput: () => started(),
    });
    await ready;
    controller.enqueue(Uint8Array.of(0x61));
    controller.enqueue(Uint8Array.of(0x1b, 0x5b, 0x41, 0x0d));
    controller.close();
    const result = await running;
    assert.equal(result.exitCode, 0);
    assert.equal(
      decode(result.stdout),
      'tty in=1 out=1\nsize 100x30\ninput 61 1b 5b 41 0d\n',
    );
  });

  it('stdin と端末を渡さなければ、ゲストは端末を見ず、すぐに EOF を読む', async (t) => {
    const session = await createSession({ assets });
    t.after(() => session.dispose());
    const guest = new Uint8Array(await readFile(`${root}/dist/guests/ttyecho`));
    const result = await session.run({ guest });
    assert.equal(decode(result.stdout), 'tty in=0 out=0\nsize none\ninput \n');
  });
});
