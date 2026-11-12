// 動的リンクのゲストの実行（ADR 0016）：Session の systemEntries に置いた動的リンカで、
// hello-dynamic が static な hello と同じ出力で終わること。動的リンカがなければ実行の前に
// INVALID_INPUT で止まり、導入するゲストは static のままであること。
// 期待する出力は、Alpine の amd64 コンテナで native に実行した hello-dynamic と同じ。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { coreAssets } from '../../runtime/core.js';
import { createSession } from '../../runtime/node/api.js';
import { validateGuest } from '../../runtime/public.js';
import { GUESTS } from '../../runtime/registry.js';
import type { FsEntry } from '../../types/index.js';
import { expectation } from '../package/session-fixtures.js';
import { missingArtifacts, root } from './helpers.js';

const assets = coreAssets(
  pathToFileURL(`${root}/dist/paludarium/`),
  pathToFileURL(`${root}/runtime/node/package-worker.js`),
);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const read = async (file: string) =>
  new Uint8Array(await readFile(`${root}/${file}`));
const guest = GUESTS['hello-dynamic'];
const [[linkerPath, linkerFile]] = Object.entries(guest.system);
const skip = missingArtifacts([guest.path, linkerFile]) ?? false;
const expected = 'hello from formicarium guest\narg: one\narg: two words\n';

describe('動的リンクのゲスト（Node.js の Session）', { skip }, () => {
  it('systemEntries の動的リンカで、hello-dynamic が hello と同じ出力で終わる', async (t) => {
    const linker = await read(linkerFile);
    const session = await createSession({
      assets,
      systemEntries: [
        {
          path: linkerPath,
          type: 'file',
          mode: 0o755,
          inodeId: 'ld',
          data: linker,
        },
      ],
    });
    t.after(() => session.dispose());
    for (const file of [guest.path, GUESTS.hello.path]) {
      const result = await session.run({
        guest: await read(file),
        args: ['one', 'two words'],
      });
      assert.equal(decode(result.stderr), '', file);
      assert.equal(result.exitCode, 0, file);
      assert.equal(decode(result.stdout), expected, file);
    }
    // システムファイルは Session のファイルではなく、reset の後も置かれる
    assert.deepEqual(await session.listEntries(), []);
    await session.reset();
    const again = await session.run({ guest: await read(guest.path) });
    assert.equal(decode(again.stdout), 'hello from formicarium guest\n');
  });

  it('symlink の先にある動的リンカも見つける', async (t) => {
    const systemEntries: FsEntry[] = [
      { path: '/lib', type: 'symlink', target: 'usr/lib' },
      {
        path: `/usr${linkerPath}`,
        type: 'file',
        mode: 0o755,
        inodeId: 'ld',
        data: await read(linkerFile),
      },
    ];
    const session = await createSession({ assets, systemEntries });
    t.after(() => session.dispose());
    const result = await session.run({ guest: await read(guest.path) });
    assert.equal(result.exitCode, 0);
    assert.equal(decode(result.stdout), 'hello from formicarium guest\n');
  });

  it('動的リンカがなければ、実行の前に INVALID_INPUT で止まる', async (t) => {
    const session = await createSession({ assets });
    t.after(() => session.dispose());
    await assert.rejects(session.run({ guest: await read(guest.path) }), {
      code: 'INVALID_INPUT',
      message: `ELF interpreter ${linkerPath} is not in the session`,
    });
    // 止まった後も、同じ Session で static なゲストを実行できる
    const result = await session.run({ guest: await read(GUESTS.hello.path) });
    assert.equal(result.exitCode, 0);
  });

  it('導入するゲストは static のままで、動的リンクのゲストは検証で止まる', async () => {
    const bytes = await read(guest.path);
    assert.throws(() => validateGuest(bytes, expectation(bytes)), {
      code: 'INVALID_INPUT',
      message: 'dynamic ELF interpreter is unsupported',
    });
  });
});
