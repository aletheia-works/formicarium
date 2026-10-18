import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PACKAGE_FILES, sha256 } from '../../scripts/package/stage-package.js';
import type { GuestCatalog } from '../../types/index.js';
import { consumerInput } from '../migration-session/consumer-input.js';

const input = await consumerInput();
assert.equal(input.candidate.unit, 'u4-command');
for (const name of ['command', 'command-parse', 'install', 'session-port'])
  assert.ok(
    input.candidate.files.some(
      (entry: { path: string }) => entry.path === `runtime/${name}.js`,
    ),
    `current U4 pack must contain ${name}`,
  );
const api = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/public.js')).href
)) as typeof import('../../runtime/public.js');
const { createSession } = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/node/api.js')).href
)) as typeof import('../../runtime/node/api.js');
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const code = (expected: string) => (error: { code?: string }) => {
  assert.equal(error.code, expected);
  return true;
};
const URL_GUEST = 'https://install.invalid/guest';

function catalog(): GuestCatalog {
  const info = structuredClone(input.expected.identity);
  return {
    schemaVersion: 1,
    catalogId: 'u4-controlled-transport',
    defaults: { [info.tool]: info.versionOrName },
    entries: [
      {
        tool: info.tool,
        versionOrName: info.versionOrName,
        url: URL_GUEST,
        format: 'elf',
        downloadSha256: sha256(input.bytes),
        downloadBytes: input.bytes.length,
        elfBytes: input.bytes.length,
        buildInfo: info,
        buildInfoSha256: input.expected.buildInfoSha256,
      },
    ],
  };
}
/** Controlled transport serving the fixed guest bytes, or zeros when `bad`. */
function serve(t: import('node:test').TestContext, state = { bad: false }) {
  t.mock.method(
    globalThis,
    'fetch',
    async (url: unknown, options: RequestInit) => {
      assert.equal(String(url), URL_GUEST);
      assert.equal(options.credentials, 'omit');
      return new Response(
        state.bad
          ? new Uint8Array(input.bytes.length)
          : new Uint8Array(input.bytes),
      );
    },
  );
  return state;
}

test('installed U4 exports C05 from the root and keeps parser and port modules private', async () => {
  assert.equal(typeof api.createCommandSession, 'function');
  for (const name of ['sessionPort', 'tokenizeCommand', 'RESERVED_COMMANDS'])
    assert.equal(name in api, false, name);
  const require = createRequire(resolve(input.consumerRoot, 'package.json'));
  for (const path of [
    'runtime/command.js',
    'runtime/command-parse.js',
    'runtime/session-port.js',
  ])
    assert.throws(
      () => require.resolve(`@aletheia-works/formicarium/${path}`),
      { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
    );
  assert.deepEqual(
    input.candidate.files.map((entry: { path: string }) => entry.path).sort(),
    [...PACKAGE_FILES].sort(),
  );
  const declarations = await readFile(
    resolve(input.packageRoot, 'types/index.d.ts'),
    'utf8',
  );
  for (const name of [
    'interface CommandOptions',
    'interface CommandResult',
    'interface CommandSession',
    'function createCommandSession',
  ])
    assert.ok(declarations.includes(name), name);
});
test('installed U4 declarations compile the valid fixture and enforce every invalid shape', async () => {
  const paths: string[] = [];
  for (const name of ['types-valid.ts', 'types-invalid.ts']) {
    const destination = resolve(input.consumerRoot, `u4-${name}`);
    paths.push(destination);
    await writeFile(
      destination,
      await readFile(new URL(name, import.meta.url)),
    );
  }
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../../node_modules/typescript/bin/tsc', import.meta.url),
      ),
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--target',
      'ES2023',
      '--noEmit',
      ...paths,
    ],
    { cwd: input.consumerRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
test('installed empty terminal installs aube, runs it, uses builtins and resets', async (t) => {
  serve(t);
  const session = await createSession();
  t.after(() => session.dispose());
  const shell = api.createCommandSession(session, { catalog: catalog() });
  const tool = input.expected.identity.tool;
  assert.equal((await shell.execute('')).kind, 'empty');
  assert.equal((await shell.execute('ls')).stdout.length, 0);
  await assert.rejects(shell.execute(`${tool} --version`), code('NOT_FOUND'));
  const installed = await shell.execute(`install ${tool}`);
  assert.equal(
    decode(installed.stdout),
    `installed ${tool}@${input.expected.identity.versionOrName} (sha256 ${input.expected.elfSha256})\n`,
  );
  const run = await shell.execute(`${tool} --version`);
  assert.equal(run.kind, 'guest');
  assert.equal(run.exitCode, 0);
  assert.match(decode(run.stdout), /^2\.7\.0/);
  assert.equal(typeof run.runId, 'string');
  await assert.rejects(shell.execute('cat /work/none'), code('NOT_FOUND'));
  await assert.rejects(shell.execute('rm -rf /work'), code('INVALID_INPUT'));
  for (const line of ['cd /root', 'ls', 'rm -rf /root/none', 'cd /work'])
    assert.equal((await shell.execute(line)).exitCode, 0, line);
  await session.reset();
  await assert.rejects(shell.execute(`${tool} --version`), code('NOT_FOUND'));
});
test('installed builtins keep cwd/FS and non-ASCII paths across consecutive commands', async (t) => {
  const name = '/work/日本語　名.txt';
  const session = await createSession({
    entries: [
      {
        path: name,
        type: 'file',
        mode: 0o644,
        inodeId: 'jp',
        data: new TextEncoder().encode('内容 ok'),
      },
      { path: '/work/d', type: 'dir', mode: 0o755 },
      {
        path: '/work/d/a.b',
        type: 'file',
        mode: 0o644,
        inodeId: 'ab',
        data: new Uint8Array([1]),
      },
      { path: '/work/d/a', type: 'dir', mode: 0o755 },
    ],
  });
  t.after(() => session.dispose());
  const shell = api.createCommandSession(session, { catalog: catalog() });
  const output = async (line: string) =>
    decode((await shell.execute(line)).stdout);
  assert.equal(await output(`cat ${name}`), '内容 ok');
  assert.equal(await output(`cat "${name}"`), '内容 ok');
  assert.equal(await output('ls /work'), 'd/\n日本語　名.txt\n');
  // Relative paths resolve against the installed Session's current cwd.
  assert.equal(await output('cat "日本語　名.txt"'), '内容 ok');
  assert.equal(await output('ls d'), 'a.b\na/\n');
  await shell.execute('cd d');
  assert.equal(await output('ls'), 'a.b\na/\n');
  assert.deepEqual([...(await shell.execute('cat a.b')).stdout], [1]);
  await shell.execute('rm -rf ./a.b');
  assert.equal(await output('ls'), 'a/\n');
  assert.deepEqual(
    (await session.listEntries()).map((entry) => entry.path),
    ['/work/d/a'],
  );
  for (const bad of [
    'cat a|b',
    'ls -a',
    'rm -r -f /work/d',
    `cat "${name}`,
    'cat ../日本語　名.txt',
    'cd ..',
  ])
    await assert.rejects(shell.execute(bad), code('INVALID_INPUT'), bad);
});
test('installed command and direct install compete with BUSY and return identical results', async (t) => {
  let release!: (response: Response) => void;
  let began!: () => void;
  const fetching = new Promise<void>((done) => {
    began = done;
  });
  const session = await createSession();
  t.after(() => session.dispose());
  const mock = t.mock.method(globalThis, 'fetch', () => {
    began();
    return new Promise<Response>((done) => {
      release = done;
    });
  });
  const manifest = catalog();
  const shell = api.createCommandSession(session, { catalog: manifest });
  const installer = api.createInstaller(session, manifest);
  const tool = input.expected.identity.tool;
  const pending = shell.execute(`install ${tool}`);
  await fetching;
  await assert.rejects(installer.install(tool), code('BUSY'));
  await assert.rejects(session.listEntries(), code('BUSY'));
  await assert.rejects(shell.execute('ls'), code('BUSY'));
  release(new Response(new Uint8Array(input.bytes)));
  const viaCommand = (await pending).installation!;
  mock.mock.restore();
  serve(t);
  const direct = await installer.install(tool);
  for (const field of ['tool', 'versionOrName', 'digest', 'buildKey'] as const)
    assert.equal(viaCommand[field], direct[field], field);
  assert.equal(viaCommand.digest, input.expected.elfSha256);
  assert.equal(viaCommand.buildKey, input.expected.identity.buildKey);
});
test('installed failed reinstall keeps the old guest runnable through the command', async (t) => {
  const state = serve(t);
  const session = await createSession();
  t.after(() => session.dispose());
  const shell = api.createCommandSession(session, { catalog: catalog() });
  const tool = input.expected.identity.tool;
  await shell.execute(`install ${tool}`);
  state.bad = true;
  await assert.rejects(shell.execute(`install ${tool}`), code('INVALID_INPUT'));
  const run = await shell.execute(`${tool} --version`);
  assert.equal(run.exitCode, 0);
  assert.match(decode(run.stdout), /^2\.7\.0/);
});
