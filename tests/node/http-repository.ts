// 手元の HTTP の git リポジトリ：ゲストの git と jj の clone の試験（git-http・jj-http）で使う。
// ホストの git で作った bare リポジトリを、dumb HTTP（静的なファイル）として 127.0.0.1 で配る。
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import type net from 'node:net';
import path from 'node:path';

import { root } from './helpers.js';

const git = path.join(root, 'dist/guests/git');
// git は helper を `git remote-<scheme>` として、git 自身を PATH（/usr/bin）から探して起動する。
// http:// の helper は git-remote-http で、git-remote-https と同じバイナリなので、その名前で置く。
export const gitHelpers = [
  { host: git, guest: '/usr/bin/git' },
  {
    host: path.join(root, 'dist/guests/git-remote-https'),
    guest: '/usr/bin/git-remote-http',
  },
];

/** ホストの git で、2 つのコミットを持つ bare リポジトリを作り、dumb HTTP で読めるようにする。 */
export function bareRepository(directory: string) {
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
export async function serve(directory: string) {
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
