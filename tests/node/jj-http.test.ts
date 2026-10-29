// ゲストの jj（ADR 0014）：Node.js で、許可した手元の HTTP サーバーから jj git clone できること。
// 手元の bare リポジトリを dumb HTTP で配る（http-repository.ts）。
// 外のネットワークを使わないので、結果は毎回同じになる。
// jj は fetch に PATH の git を使うので、git ゲストと HTTP の helper を /usr/bin に置く。
// jj と git は release candidate の固定の入力にないゲストなので、product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh の git と jj を実行済み。ホストに git があること。
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, readElfInfo, root } from './helpers.js';
import { bareRepository, gitHelpers, serve } from './http-repository.js';

const TIMEOUT_MS = 10 * 60 * 1000;
const jj = path.join(root, 'dist/guests/jj');
const decoder = () => new TextDecoder();

describe('ゲストの jj（Node.js の Worker）', () => {
  it('許可した手元の HTTP サーバーから jj git clone でき、許可がなければつながらない', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    assert.equal(
      missingArtifacts([
        'dist/paludarium/build-info.json',
        'dist/guests/jj',
        'dist/guests/git',
        'dist/guests/git-remote-https',
      ]),
      null,
    );
    const directory = mkdtempSync(path.join(tmpdir(), 'formicarium-jj-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const log = bareRepository(directory);
    const { server, port } = await serve(directory);
    t.after(() => server.close());
    const url = `http://127.0.0.1:${port}/repo.git`;

    let stderr = '';
    const output = decoder();
    const { results } = await runInWorker({
      guest: jj,
      copyIn: gitHelpers,
      env: { HOME: '/root' },
      network: { allow: [`127.0.0.1:${port}`] },
      steps: [
        { args: ['git', 'clone', '--quiet', url, '/work/c'] },
        {
          args: [
            '-R',
            '/work/c',
            'log',
            '--no-graph',
            '-r',
            '::main@origin ~ root()',
            '-T',
            'commit_id ++ " " ++ description.first_line() ++ "\\n"',
          ],
        },
        { catFile: '/work/c/a.txt' },
      ],
      timeoutMs: TIMEOUT_MS,
      onStderr: (chunk) => (stderr += output.decode(chunk, { stream: true })),
    });
    assert.deepEqual(
      results.map((result) => result.exitCode),
      [0, 0, 0],
      stderr,
    );
    assert.equal(decoder().decode(results[1]!.stdout), log);
    assert.equal(decoder().decode(results[2]!.stdout), 'hello\nmore\n');

    // 許可がなければ、jj が起動した git が接続できずに終わり、jj も失敗する。
    let refused = '';
    const none = await runInWorker({
      guest: jj,
      copyIn: gitHelpers,
      env: { HOME: '/root' },
      args: ['git', 'clone', '--quiet', url, '/work/c'],
      timeoutMs: TIMEOUT_MS,
      onStderr: (chunk) => (refused += output.decode(chunk, { stream: true })),
    });
    assert.notEqual(none.results.at(-1)?.exitCode, 0);
    assert.match(refused, /Could not connect|Failed to connect/);
  });
});

// release candidate の固定のゲストに jj はないので、ビルドの記録もここで確かめる
describe('jj ゲストのビルド', () => {
  it('dist/guests/jj は static な x86-64 の ELF', () => {
    assert.equal(missingArtifacts(['dist/guests/jj']), null);
    const info = readElfInfo(readFileSync(jj));
    assert.equal(info.machine, 0x3e);
    assert.equal(
      info.isStatic,
      true,
      `program headers: ${info.programHeaderTypes.join(',')}`,
    );
  });

  it('dist/guests/jj.commit に取得したコミットが記録される', () => {
    assert.equal(missingArtifacts(['dist/guests/jj.commit']), null);
    assert.match(
      readFileSync(path.join(root, 'dist/guests/jj.commit'), 'utf8'),
      /^[0-9a-f]{40}\n$/,
    );
  });
});
