// Deno：/node の入口を jsr: のようにリモートの URL から読んでも、ゲストが走ること。
// Deno の node:worker_threads は file: と data: の URL しか受け付けないので、
// パッケージの Worker を data: のモジュールから読む（runtime/node/api.ts）。
// パッケージのレイアウトのまま localhost から配り、README の権限だけを渡す。
// Deno は FORMICARIUM_DENO か PATH の deno を使う。
// 前提：bun run build と bash mise-tasks/build/guests.sh probe を実行済み。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import { CORE_FILES } from '../../runtime/core.js';
import { missingArtifacts, root } from './helpers.js';

const TIMEOUT_MS = 5 * 60 * 1000;
const deno = process.env.FORMICARIUM_DENO ?? 'deno';
const hello = path.join(root, 'dist/guests/hello');
const CORE = '/assets/paludarium/';

/** リポジトリを、公開するパッケージと同じパスで配る。コアは dist/paludarium にある。 */
async function servePackage() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      if (pathname.split('/').includes('..') || pathname.includes('\0'))
        throw new Error('invalid path');
      const name = pathname.slice(CORE.length);
      const file = pathname.startsWith(CORE)
        ? [...CORE_FILES, 'build-info.json'].includes(name)
          ? path.join(root, 'dist/paludarium', name)
          : undefined
        : pathname.startsWith('/runtime/') && pathname.endsWith('.js')
          ? path.join(root, pathname)
          : undefined;
      if (!file) throw new Error('not in the package');
      response.setHeader(
        'Content-Type',
        /\.m?js$/.test(file) ? 'text/javascript' : 'application/octet-stream',
      );
      response.end(await readFile(file));
    } catch {
      response.statusCode = 404;
      response.end('missing');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    host: `127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Deno で、配った /node の入口から hello を実行した結果。 */
const SCRIPT = `
const [base, guest] = Deno.args;
const { createSession } = await import(base + '/runtime/node/api.js');
const session = await createSession();
try {
  const result = await session.run({
    guest: await Deno.readFile(guest),
    args: ['one'],
  });
  console.log(JSON.stringify({
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  }));
} catch (error) {
  console.log(JSON.stringify({ code: error?.code, message: error?.message }));
} finally {
  await session.dispose();
}
`;

function runDeno(args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(deno, args, {
        env: { ...process.env, DENO_NO_UPDATE_CHECK: '1' },
        timeout: TIMEOUT_MS,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    },
  );
}

describe('Deno（/node の入口をリモートの URL から読む）', () => {
  const missing = missingArtifacts([
    'dist/guests/hello',
    'dist/paludarium/build-info.json',
    'runtime/node/api.js',
  ]);
  it('README の権限で hello が走る', {
    skip: missing ?? false,
    timeout: TIMEOUT_MS,
  }, async (t) => {
    const server = await servePackage();
    t.after(server.close);
    const script = path.join(
      tmpdir(),
      `formicarium-deno-${process.pid}-${Date.now()}.mjs`,
    );
    await writeFile(script, SCRIPT);
    t.after(() => rm(script, { force: true }));
    const { status, stdout, stderr } = await runDeno([
      'run',
      '--no-prompt',
      `--allow-import=${server.host}`,
      `--allow-net=${server.host}`,
      '--allow-read',
      '--allow-write',
      '--allow-env',
      script,
      `http://${server.host}`,
      hello,
    ]);
    assert.equal(status, 0, stderr);
    assert.deepEqual(JSON.parse(stdout.trim().split('\n').at(-1) ?? ''), {
      exitCode: 0,
      stdout: 'hello from formicarium guest\narg: one\n',
      stderr: '',
    });
  });
});
