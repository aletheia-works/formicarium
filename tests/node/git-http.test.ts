// ゲストの git（ADR 0014）：Node.js で、許可した手元の HTTP サーバーから git clone できること。
// ホストの git で作った bare リポジトリを、dumb HTTP（静的なファイル）として 127.0.0.1 で配る。
// 外のネットワークを使わないので、結果は毎回同じになる。
// git は release candidate の固定の入力にないゲストなので、product の CI の Node.js の回帰テストでだけ実行する。
// 前提：bun run build と bash mise-tasks/build/guests.sh git を実行済み。ホストに git があること。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import type net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runInWorker } from '../../runtime/node/host.js';
import { missingArtifacts, readElfInfo, root } from './helpers.js';

const TIMEOUT_MS = 10 * 60 * 1000;
const git = path.join(root, 'dist/guests/git');
// git は helper を `git remote-<scheme>` として、git 自身を PATH（/usr/bin）から探して起動する。
// http:// の helper は git-remote-http で、git-remote-https と同じバイナリなので、その名前で置く。
const helpers = [
  { host: git, guest: '/usr/bin/git' },
  {
    host: path.join(root, 'dist/guests/git-remote-https'),
    guest: '/usr/bin/git-remote-http',
  },
];
const decoder = () => new TextDecoder();

/** ホストの git で、2 つのコミットを持つ bare リポジトリを作り、dumb HTTP で読めるようにする。 */
function bareRepository(directory: string) {
  const work = path.join(directory, 'work');
  const run = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@e',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@e',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
  run(directory, 'init', '-q', '-b', 'main', work);
  writeFileSync(path.join(work, 'a.txt'), 'hello\n');
  run(work, 'add', '.');
  run(work, 'commit', '-q', '-m', 'first');
  writeFileSync(path.join(work, 'a.txt'), 'hello\nmore\n');
  run(work, 'commit', '-q', '-am', 'second');
  run(directory, 'clone', '-q', '--bare', work, 'repo.git');
  run(path.join(directory, 'repo.git'), 'update-server-info');
  return run(work, 'log', '--format=%H %s');
}

/** directory の中のファイルだけを返す、静的なファイルのサーバー。 */
async function serve(directory: string) {
  const server = http.createServer(async (request, response) => {
    const file = path.join(
      directory,
      decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname),
    );
    if (!file.startsWith(`${directory}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.writeHead(200).end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.address() as net.AddressInfo).port };
}

describe('ゲストの git（Node.js の Worker）', () => {
  it('許可した手元の HTTP サーバーから clone でき、許可がなければつながらない', {
    timeout: TIMEOUT_MS,
  }, async (t) => {
    assert.equal(
      missingArtifacts([
        'dist/paludarium/build-info.json',
        'dist/guests/git',
        'dist/guests/git-remote-https',
      ]),
      null,
    );
    const directory = mkdtempSync(path.join(tmpdir(), 'formicarium-git-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const log = bareRepository(directory);
    const { server, port } = await serve(directory);
    t.after(() => server.close());
    const url = `http://127.0.0.1:${port}/repo.git`;

    let stderr = '';
    const output = decoder();
    const { results } = await runInWorker({
      guest: git,
      copyIn: helpers,
      env: { HOME: '/root' },
      network: { allow: [`127.0.0.1:${port}`] },
      steps: [
        { args: ['clone', '-q', url, '/work/c'] },
        { args: ['-C', '/work/c', 'log', '--format=%H %s'] },
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

    // 許可がなければ socket() が EAFNOSUPPORT になり、git は接続できずに終わる。
    let refused = '';
    const none = await runInWorker({
      guest: git,
      copyIn: helpers,
      args: ['clone', '-q', url, '/work/c'],
      timeoutMs: TIMEOUT_MS,
      onStderr: (chunk) => (refused += output.decode(chunk, { stream: true })),
    });
    assert.equal(none.results.at(-1)?.exitCode, 128);
    assert.match(refused, /Could not connect|Failed to connect/);
  });
});

// release candidate の固定のゲストに git はないので、ビルドの記録もここで確かめる
describe('git ゲストのビルド', () => {
  // 署名を確かめた tarball の SHA-256（mise-tasks/build/guests.sh の既定値と同じ）
  const GIT_SHA256 =
    '26c56c296b38c0695b26fa95f475f1d01704d2d38e73465ca30b0b2f5dc789d3';
  const CURL_SHA256 =
    '8dadd7d2536a314f982ad05a651b713f426bf7d02cc2c76cffb9796f2218e6c5';

  for (const name of ['git', 'git-remote-https'])
    it(`dist/guests/${name} は static な x86-64 の ELF`, () => {
      assert.equal(missingArtifacts([`dist/guests/${name}`]), null);
      const info = readElfInfo(
        readFileSync(path.join(root, `dist/guests/${name}`)),
      );
      assert.equal(info.machine, 0x3e);
      assert.equal(
        info.isStatic,
        true,
        `program headers: ${info.programHeaderTypes.join(',')}`,
      );
    });

  it('git.build-info に版と確かめた SHA-256 が記録され、ビルドの既定値と一致する', () => {
    assert.equal(missingArtifacts(['dist/guests/git.build-info']), null);
    const fields = Object.fromEntries(
      readFileSync(path.join(root, 'dist/guests/git.build-info'), 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((line) => [
          line.slice(0, line.indexOf('=')),
          line.slice(line.indexOf('=') + 1),
        ]),
    );
    assert.equal(fields.git, '2.56.0');
    assert.equal(fields['git-sha256'], GIT_SHA256);
    assert.equal(fields.curl, '8.23.0');
    assert.equal(fields['curl-sha256'], CURL_SHA256);
    assert.match(fields.openssl ?? '', /^\d/);
    assert.match(fields.alpine ?? '', /^\d+\.\d+/);
  });
});
