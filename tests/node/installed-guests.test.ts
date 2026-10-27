// 導入済みのゲストの起動：Session に登録したゲストが、実行のたびに /usr/bin/<tool> に置かれ、
// 別のゲストから PATH で名前を引いて起動できること。
// spawn は probe と一緒にビルドするゲストで、release candidate の固定の入力には含まれないため、
// product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { coreAssets } from '../../runtime/core.js';
import { createSession } from '../../runtime/node/api.js';
import { registerValidatedGuest, validateGuest } from '../../runtime/public.js';
import { expectation } from '../package/session-fixtures.js';
import { root } from './helpers.js';

const assets = coreAssets(
  pathToFileURL(`${root}/dist/paludarium/`),
  pathToFileURL(`${root}/runtime/node/package-worker.js`),
);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const read = async (name: string) =>
  new Uint8Array(await readFile(`${root}/dist/guests/${name}`));

describe('導入済みのゲストの起動（Node.js の Session）', () => {
  it('登録した hello を、spawn が /usr/bin から名前で起動する', async (t) => {
    const session = await createSession({ assets });
    t.after(() => session.dispose());
    const hello = await read('hello');
    await registerValidatedGuest(
      session,
      'hello',
      validateGuest(new Uint8Array(hello), expectation(hello)),
    );
    // spawn は最初の引数を PATH（/usr/bin:/bin）から探して実行する
    const result = await session.run({
      guest: await read('spawn'),
      args: ['hello', 'from spawn'],
    });
    assert.equal(decode(result.stderr), '');
    assert.equal(result.exitCode, 0);
    assert.equal(
      decode(result.stdout),
      'hello from formicarium guest\narg: from spawn\n',
    );
    // 置いたゲストは Session のファイルではない
    assert.deepEqual(await session.listEntries(), []);
  });
});
