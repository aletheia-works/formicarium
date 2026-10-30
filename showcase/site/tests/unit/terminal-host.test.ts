import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type {
  CommandOptions,
  CommandResult,
  FsEntry,
  SessionOptions,
} from '@aletheia-works/formicarium';
import type { LoadedFormicarium } from '../../src/terminal/formicarium-loader.ts';
import type { TerminalPageData } from '../../src/terminal/page-data.ts';
import {
  API_MISTAKES,
  API_USAGE,
  attachPageEvents,
  copyAction,
  type HostOptions,
  type KeyMods,
  keyPlatform,
  nextCwd,
  passKey,
  TerminalHost,
} from '../../src/terminal/terminal-host.ts';
import { chunked, fakeTimers } from './helpers.ts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const encode = (text: string) => new TextEncoder().encode(text);
const fixtureText = JSON.stringify({
  schemaVersion: 1,
  fixture: 'aube-local-deps',
  entries: [
    { path: 'app', type: 'dir', mode: 0o755 },
    {
      path: 'app/package.json',
      type: 'file',
      mode: 0o644,
      sha256: sha('{}'),
      size: 2,
      bytes: 'e30=',
    },
  ],
});
const catalogText = JSON.stringify({
  schemaVersion: 1,
  catalogId: 'c',
  defaults: { aube: '2.7.2' },
  entries: [{ tool: 'aube', url: 'guests/aube/2.7.2/aube.tar.gz' }],
});
/** The relay's token function in these tests (never the real one). */
const TOKEN_URL = 'https://relay-token.test/';
const caText = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n';
const fetchImpl = (async (url: string) =>
  chunked([
    encode(url.endsWith('catalog.json') ? catalogText : fixtureText),
  ])) as unknown as typeof fetch;

function data(
  mode: 'empty' | 'preinstalled',
  overrides: Partial<TerminalPageData> = {},
): TerminalPageData {
  return {
    mode,
    locale: 'en',
    base: '/formicarium/',
    tool: mode === 'preinstalled' ? 'aube' : null,
    version: mode === 'preinstalled' ? '2.7.2' : null,
    catalog: { path: 'catalog.json', sha256: sha(catalogText) },
    fixture:
      mode === 'preinstalled'
        ? {
            path: 'demo-fixtures/aube-local-deps.json',
            sha256: sha(fixtureText),
          }
        : null,
    formicarium: {
      version: '0.3.0',
      base: '_formicarium/0.3.0/',
      root: 'r',
      browser: 'b',
      assets: { loader: 'l', wasm: 'w', worker: 'k', buildInfo: 'i' },
      files: [],
    },
    interactive: [],
    everyPage: [],
    homeFiles: [],
    companions: {},
    network: [],
    relay: { tokenUrl: TOKEN_URL, allow: ['github.com:443'] },
    caBundle: null,
    ...overrides,
  };
}

type Execute = (
  line: string,
  options: CommandOptions,
) => Promise<CommandResult>;
const result = (
  kind: CommandResult['kind'],
  stdout = '',
  exitCode = 0,
  extra: Partial<CommandResult> = {},
): CommandResult => ({
  kind,
  exitCode,
  stdout: encode(stdout),
  stderr: new Uint8Array(),
  ...extra,
});
const installed = (tool = 'aube') =>
  result('install', `installed ${tool} 2.7.2\n`, 0, {
    installation: {
      operationId: 'o',
      tool,
      versionOrName: '2.7.2',
      digest: 'd',
      buildKey: 'k',
    },
  });

function harness(
  mode: 'empty' | 'preinstalled',
  execute: Execute,
  extra: Partial<HostOptions> = {},
) {
  const writes: string[] = [];
  const lines: string[] = [];
  const sessions: SessionOptions[] = [];
  const cwds: string[] = [];
  let disposed = 0;
  const terminal = {
    cols: 80,
    rows: 24,
    write: (text: string) => writes.push(text),
    reset: () => writes.push('<reset>'),
    focus() {},
    dispose: () => writes.push('<dispose>'),
  };
  const loaded = {
    root: {
      fixtureToFsEntries: (entries: readonly FsEntry[]) => entries,
      createCommandSession: () => ({
        execute: (line: string, options: CommandOptions = {}) => {
          lines.push(line);
          return execute(line, options);
        },
      }),
      // The installer answers as `install <tool>` would, recorded apart.
      createInstaller: () => ({
        install: async (selection: string, options: CommandOptions = {}) => {
          lines.push(`installer ${selection}`);
          return (await execute(`install ${selection}`, options)).installation;
        },
      }),
    },
    browser: {
      createSession: async (options: SessionOptions) => {
        sessions.push(options);
        return {
          dispose: async () => void disposed++,
          setCwd: async (path: string) => void cwds.push(path),
        };
      },
    },
    assets: { loaderURL: 'l', wasmURL: 'w', workerURL: 'k', buildInfoURL: 'i' },
  } as unknown as LoadedFormicarium;
  const status = { textContent: '' as string | null };
  const omitted = { textContent: '' as string | null, hidden: true as boolean };
  const root = { dataset: {} as Record<string, string | undefined> };
  const host = new TerminalHost({
    data: data(mode),
    terminal,
    status,
    omitted,
    root,
    pageUrl: 'https://localhost:8443/formicarium/tools/aube/',
    isolation: () => ({ isolated: true, serviceWorker: 'controlled' }),
    load: async () => loaded,
    fetchImpl,
    ...extra,
  });
  return {
    host,
    writes,
    lines,
    sessions,
    cwds,
    status,
    omitted,
    root,
    disposed: () => disposed,
  };
}
const settle = () => new Promise((done) => setImmediate(done));
/** Typing then Enter (one onData with text and CR would be a paste). */
const type = (host: TerminalHost, line: string) => {
  host.onData(line);
  host.onData('\r');
};

test('a tool page installs its tool after placing the fixture below /work', async () => {
  const h = harness('preinstalled', async () => installed());
  const states: string[] = [];
  const observe = setInterval(() => states.push(h.host.state), 0);
  await h.host.start();
  clearInterval(observe);
  assert.equal(h.host.state, 'ready');
  assert.equal(h.root.dataset.state, 'ready');
  assert.deepEqual(h.lines, ['install aube']);
  assert.deepEqual(
    h.sessions[0]!.entries!.map((entry) => entry.path),
    ['/work', '/work/app', '/work/app/package.json'],
  );
  // The persistence root covers /work; the shell starts in /work/app.
  assert.equal(h.sessions[0]!.cwd, '/work');
  assert.deepEqual(h.cwds, ['/work/app']);
  assert.equal(h.status.textContent, 'Ready: aube 2.7.2');
  assert.ok(h.writes.join('').endsWith('installed aube 2.7.2\n/work/app$ '));
});

test('a failed or cancelled automatic install leaves ready_failed_install and accepts a retry', async () => {
  let calls = 0;
  const h = harness('preinstalled', async (_line, options) => {
    calls += 1;
    if (calls === 1)
      throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
    options.onProgress?.({
      operationId: 'o',
      sequence: 1,
      phase: 'fetch',
      processedBytes: 3,
      totalBytes: null,
    });
    return installed();
  });
  await h.host.start();
  assert.equal(h.host.state, 'ready_failed_install');
  assert.match(
    h.status.textContent!,
    /Install failed \(ASSET_LOAD: HTTP 404\)/,
  );
  assert.match(h.writes.join(''), /ASSET_LOAD: HTTP 404\n/);
  // help prints its list but keeps the failed install in view.
  type(h.host, 'help');
  await settle();
  assert.match(afterLast(h.writes, 'help'), /\nBuiltins: /);
  assert.equal(h.host.state, 'ready_failed_install');
  assert.match(
    h.status.textContent!,
    /Install failed \(ASSET_LOAD: HTTP 404\)/,
  );
  assert.equal(calls, 1);
  type(h.host, 'install aube');
  await settle();
  assert.equal(h.host.state, 'ready');
  assert.equal(calls, 2);
});

test('Ctrl-C cancels a running command; its late output is not shown', async () => {
  let release: (value: CommandResult) => void = () => {};
  const h = harness('empty', (line, options) => {
    if (line === 'aube --version')
      return new Promise((done) => {
        release = done;
        options.signal?.addEventListener('abort', () => {
          options.onOutput?.({
            runId: 'r',
            sequence: 0,
            stream: 'stdout',
            bytes: encode('late output\n'),
          });
          done(result('guest', 'late output\n', 130));
        });
      });
    return Promise.resolve(result('builtin'));
  });
  await h.host.start();
  type(h.host, 'aube --version');
  await settle();
  assert.equal(h.host.state, 'running');
  h.host.onData('typed while running');
  h.host.onData('\x03');
  await settle();
  assert.equal(h.host.state, 'ready');
  const text = h.writes.join('');
  assert.match(text, /ABORTED: the command was cancelled/);
  assert.doesNotMatch(text, /late output|typed while running/);
  assert.equal(h.status.textContent, 'Cancelled (ABORTED).');
  release(result('guest'));
});

/** Reads a stdin stream to its end as text. */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  let text = '';
  const decoder = new TextDecoder();
  for await (const chunk of stream) text += decoder.decode(chunk);
  return text;
}

test('an interactive tool gets every key, a terminal and the Stop button; its screen skips the buffer', async () => {
  const seen: CommandOptions[] = [];
  let finish: (value: CommandResult) => void = () => {};
  const stop = { hidden: true };
  const h = harness(
    'empty',
    (line, options) => {
      seen.push(options);
      if (line !== 'nano notes.txt') return Promise.resolve(result('builtin'));
      options.onOutput?.({
        runId: 'r',
        sequence: 0,
        stream: 'stdout',
        bytes: encode('\x1b[?1049h\x1b[2J  GNU nano'),
      });
      return new Promise((done) => {
        finish = done;
      });
    },
    { data: data('empty', { interactive: ['nano'] }), stop },
  );
  await h.host.start();
  type(h.host, 'nano notes.txt');
  await settle();
  assert.equal(h.host.state, 'running');
  assert.equal(stop.hidden, false);
  assert.equal(
    h.status.textContent,
    'Running interactively. Keys, Ctrl-C included, go to the tool; press Stop to end it.',
  );
  const options = seen[0]!;
  assert.deepEqual(options.terminal, { columns: 80, rows: 24 });
  const typed = readAll(options.stdin!);
  // Keys, Enter as CR and Ctrl-C reach the tool unchanged; nothing is echoed.
  const before = h.writes.length;
  h.host.onData('hi\r');
  h.host.onData('\x03');
  h.host.onData('é');
  assert.equal(h.host.state, 'running');
  assert.equal(h.writes.length, before);
  assert.ok(h.writes.join('').includes('\x1b[2J  GNU nano'));
  assert.doesNotMatch(h.host.display.text, /GNU nano/);
  finish(result('guest'));
  await settle();
  assert.equal(await typed, 'hi\r\x03é');
  assert.equal(stop.hidden, true);
  assert.equal(h.host.state, 'ready');
  assert.ok(h.writes.join('').endsWith('/work/app$ '));
  // A key after the run goes to the line again, and other commands get no stdin.
  type(h.host, 'ls');
  await settle();
  assert.equal(seen[1]?.stdin, undefined);
  assert.equal(seen[1]?.terminal, undefined);
});

test('Stop ends an interactive run with ABORTED and closes its stdin', async () => {
  const seen: CommandOptions[] = [];
  const stop = { hidden: true };
  const h = harness(
    'empty',
    (_line, options) => {
      seen.push(options);
      return new Promise((_done, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })),
        );
      });
    },
    { data: data('empty', { interactive: ['nano'] }), stop },
  );
  await h.host.start();
  type(h.host, 'nano');
  await settle();
  const typed = readAll(seen[0]!.stdin!);
  h.host.onData('x');
  h.host.abort();
  await settle();
  assert.equal(await typed, 'x');
  assert.equal(h.host.state, 'ready');
  assert.equal(stop.hidden, true);
  assert.equal(h.status.textContent, 'Cancelled (ABORTED).');
  assert.match(h.writes.join(''), /ABORTED: the command was cancelled\n/);
  // install is never interactive, even for an interactive tool.
  type(h.host, 'install nano');
  await settle();
  assert.equal(seen[1]?.stdin, undefined);
});

test('a page installs its own tool as typed, then every-page tools quietly, and writes the home files', async () => {
  const seen: CommandOptions[] = [];
  const h = harness(
    'preinstalled',
    async (line, options) => {
      seen.push(options);
      if (line.startsWith('install ')) return installed(line.slice(8));
      return result('guest');
    },
    {
      data: data('preinstalled', {
        interactive: ['nano'],
        everyPage: ['nano'],
        homeFiles: [
          { path: '.config/jj/config.toml', text: 'x' },
          { path: '.config/jj/more.toml', text: 'y' },
        ],
      }),
    },
  );
  await h.host.start();
  assert.deepEqual(h.lines, ['install aube', 'installer nano']);
  assert.equal(h.host.state, 'ready');
  // The ready text names the page's tool, not the one every page gets.
  assert.equal(h.status.textContent, 'Ready: aube 2.7.2');
  // Only the page's own install is shown; nano leaves no trace, and one
  // prompt follows.
  const shown = h.writes.join('');
  assert.ok(shown.endsWith('installed aube 2.7.2\n/work/app$ '));
  assert.doesNotMatch(shown, /nano/);
  assert.equal(seen[1]?.stdin, undefined);
  // The home files and the directories above them, each directory once.
  const home = h.sessions[0]!.entries!.filter((entry) =>
    entry.path.startsWith('/root'),
  );
  assert.deepEqual(
    home.map((entry) => [entry.path, entry.type]),
    [
      ['/root/.config', 'dir'],
      ['/root/.config/jj', 'dir'],
      ['/root/.config/jj/config.toml', 'file'],
      ['/root/.config/jj/more.toml', 'file'],
    ],
  );
  const file = home[2] as Extract<FsEntry, { type: 'file' }>;
  assert.equal(new TextDecoder().decode(file.data), 'x');
  assert.notEqual(file.inodeId, (home[3] as typeof file).inodeId);
  type(h.host, 'nano note.txt');
  await settle();
  assert.equal(h.lines.at(-1), 'nano note.txt');
  assert.ok(seen.at(-1)?.stdin);
});

test('the empty terminal installs every-page tools once; a failed install stops the rest', async () => {
  const empty = harness('empty', async (line) => installed(line.slice(8)), {
    data: data('empty', { everyPage: ['nano', 'aube'] }),
  });
  await empty.host.start();
  assert.deepEqual(empty.lines, ['installer nano', 'installer aube']);
  assert.equal(empty.host.state, 'ready');
  assert.equal(empty.writes.join(''), '/work/app$ ');
  assert.equal(
    empty.status.textContent,
    'Ready. Type install <tool> to add a tool.',
  );
  // The nano page installs nano once, as its own tool.
  const nanoPage = harness(
    'preinstalled',
    async (line) => installed(line.slice(8)),
    { data: data('preinstalled', { tool: 'nano', everyPage: ['nano'] }) },
  );
  await nanoPage.host.start();
  assert.deepEqual(nanoPage.lines, ['install nano']);
  assert.equal(nanoPage.status.textContent, 'Ready: nano 2.7.2');
  // The page's own install fails: every-page tools are not installed.
  const failed = harness(
    'preinstalled',
    async () => {
      throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
    },
    { data: data('preinstalled', { everyPage: ['nano'] }) },
  );
  await failed.host.start();
  assert.deepEqual(failed.lines, ['install aube']);
  assert.equal(failed.host.state, 'ready_failed_install');
  // An every-page install fails after the page's tool: the failure names
  // the tool, and typing the install retries it.
  let fail = true;
  const later = harness(
    'preinstalled',
    async (line) => {
      if (line === 'install nano' && fail)
        throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
      return installed(line.slice(8));
    },
    { data: data('preinstalled', { everyPage: ['nano'] }) },
  );
  await later.host.start();
  assert.equal(later.host.state, 'ready_failed_install');
  assert.match(later.status.textContent ?? '', /ASSET_LOAD: HTTP 404/);
  assert.match(later.writes.join(''), /\nnano: ASSET_LOAD: HTTP 404\n/);
  fail = false;
  type(later.host, 'install nano');
  await settle();
  assert.equal(later.host.state, 'ready');
  // A typed install names its tool in the ready text.
  assert.equal(later.status.textContent, 'Ready: nano 2.7.2');
  assert.deepEqual(later.lines, [
    'install aube',
    'installer nano',
    'install nano',
  ]);
});

test("a tool's companions are installed quietly with it, at its version, on every path", async () => {
  const companions = { aube: ['aube-extra'], nano: ['nano-a', 'nano-b'] };
  const answer = async (line: string) => installed(line.slice(8));
  // The page's own tool, then an every-page tool, each with its companions.
  const page = harness('preinstalled', answer, {
    data: data('preinstalled', { everyPage: ['nano'], companions }),
  });
  await page.host.start();
  assert.deepEqual(page.lines, [
    'install aube',
    'installer aube-extra@2.7.2',
    'installer nano',
    'installer nano-a@2.7.2',
    'installer nano-b@2.7.2',
  ]);
  assert.equal(page.host.state, 'ready');
  assert.equal(page.status.textContent, 'Ready: aube 2.7.2');
  assert.doesNotMatch(page.writes.join(''), /extra|nano/);
  // A typed install brings the companions too; the ready text names the tool.
  const empty = harness('empty', answer, {
    data: data('empty', { companions }),
  });
  await empty.host.start();
  type(empty.host, 'install aube');
  await settle();
  assert.deepEqual(empty.lines, ['install aube', 'installer aube-extra@2.7.2']);
  assert.equal(empty.host.state, 'ready');
  assert.equal(empty.status.textContent, 'Ready: aube 2.7.2');
  // A companion that fails is named, and leaves the typed install failed.
  const failing = harness(
    'empty',
    async (line) => {
      if (line === 'install aube-extra@2.7.2')
        throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
      return installed(line.slice(8));
    },
    { data: data('empty', { companions }) },
  );
  await failing.host.start();
  type(failing.host, 'install aube');
  await settle();
  assert.equal(failing.host.state, 'ready');
  assert.match(failing.writes.join(''), /\naube-extra: ASSET_LOAD: HTTP 404\n/);
  assert.match(failing.status.textContent ?? '', /ASSET_LOAD: HTTP 404/);
  // On the page's own install it leaves ready_failed_install, naming it too.
  const own = harness(
    'preinstalled',
    async (line) => {
      if (line === 'install nano-b@2.7.2')
        throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
      return installed(line.slice(8));
    },
    { data: data('preinstalled', { tool: 'nano', companions }) },
  );
  await own.host.start();
  assert.equal(own.host.state, 'ready_failed_install');
  assert.match(own.writes.join(''), /\nnano-b: ASSET_LOAD: HTTP 404\n/);
  const quiet = harness(
    'empty',
    async (line) => {
      if (line === 'install nano-a@2.7.2')
        throw Object.assign(new Error('HTTP 404'), { code: 'ASSET_LOAD' });
      return installed(line.slice(8));
    },
    { data: data('empty', { everyPage: ['nano', 'aube'], companions }) },
  );
  await quiet.host.start();
  // The first failure stops the rest, named by the companion.
  assert.deepEqual(quiet.lines, ['installer nano', 'installer nano-a@2.7.2']);
  assert.equal(quiet.host.state, 'ready_failed_install');
  assert.match(quiet.writes.join(''), /^nano-a: ASSET_LOAD: HTTP 404\n/);
});

test('Ctrl-C cancels a quiet every-page install', async () => {
  const h = harness(
    'empty',
    (_line, options) =>
      new Promise((_done, fail) =>
        options.signal?.addEventListener('abort', () =>
          fail(Object.assign(new Error('aborted'), { code: 'ABORTED' })),
        ),
      ),
    { data: data('empty', { everyPage: ['nano'] }) },
  );
  const started = h.host.start();
  // Loading takes several turns of the event loop (more on a slow runner).
  for (let turn = 0; turn < 100 && h.host.state !== 'installing'; turn++)
    await settle();
  assert.equal(h.host.state, 'installing');
  assert.match(h.status.textContent ?? '', /^Installing nano: /);
  h.host.onData('\x03');
  await started;
  assert.equal(h.host.state, 'ready_failed_install');
  assert.match(h.writes.join(''), /ABORTED: the command was cancelled\n/);
});

test('the empty terminal runs builtins once, follows cd and reports empty output', async () => {
  const h = harness('empty', async (line, options) => {
    if (line === 'ls') return result('builtin', 'package.json\n');
    if (line === 'cd ..') return result('builtin');
    if (line === 'missing')
      throw Object.assign(new Error('no guest named missing'), {
        code: 'NOT_FOUND',
      });
    options.onOutput?.({
      runId: 'r',
      sequence: 0,
      stream: 'stdout',
      bytes: encode('boom'),
    });
    return result('guest', 'boom', 3);
  });
  await h.host.start();
  assert.equal(
    h.status.textContent,
    'Ready. Type install <tool> to add a tool.',
  );
  assert.deepEqual(
    h.sessions[0]!.entries!.map((entry) => entry.path),
    ['/work', '/work/app'],
  );
  type(h.host, 'ls');
  await settle();
  assert.equal(h.writes.join('').split('package.json').length - 1, 1);
  type(h.host, 'cd ..');
  await settle();
  assert.equal(h.status.textContent, '(no output)');
  assert.equal(h.host.cwd, '/work');
  type(h.host, 'aube x');
  await settle();
  assert.match(h.writes.join(''), /boom\nexit code 3\n\/work\$ $/);
  type(h.host, 'missing');
  await settle();
  assert.equal(h.host.state, 'ready');
  assert.equal(
    h.status.textContent,
    'The last command failed (NOT_FOUND: no guest named missing).',
  );
  assert.match(
    h.writes.join(''),
    /NOT_FOUND: no guest named missing\n\/work\$ $/,
  );
});

test('clear and Ctrl-L wipe the screen and scrollback without running a command', async () => {
  const h = harness('empty', async (line) =>
    line === 'ls' ? result('builtin', 'package.json\n') : result('builtin'),
  );
  await h.host.start();
  type(h.host, 'ls');
  await settle();
  type(h.host, 'clear');
  await settle();
  assert.deepEqual(h.lines, ['ls']);
  const afterReset = () =>
    h.writes.slice(h.writes.lastIndexOf('<reset>') + 1).join('');
  assert.equal(afterReset(), '/work/app$ ');
  assert.equal(h.host.display.text, '/work/app$ ');
  assert.equal(h.host.state, 'ready');
  // Ctrl-L keeps the line being typed on the fresh prompt.
  h.host.onData('ca');
  h.host.onData('\x0c');
  assert.equal(afterReset(), '/work/app$ ca');
  h.host.onData('t');
  h.host.onData('\r');
  await settle();
  assert.deepEqual(h.lines, ['ls', 'cat']);
});

/** An API failure as ExecutionError carries it: a code and a message. */
const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code });
/** A catalog with git (and its companion) beside aube; git is on every page. */
const gitCatalogText = JSON.stringify({
  schemaVersion: 1,
  catalogId: 'c',
  defaults: { git: '2.7.2', aube: '2.7.2', 'git-remote-https': '2.7.2' },
  entries: [],
});
function gitHarness(execute: Execute, locale: 'en' | 'ja' = 'en') {
  return harness('empty', execute, {
    data: data('empty', {
      locale,
      catalog: { path: 'catalog.json', sha256: sha(gitCatalogText) },
      everyPage: ['git'],
      companions: { git: ['git-remote-https'] },
    }),
    fetchImpl: (async () =>
      chunked([encode(gitCatalogText)])) as unknown as typeof fetch,
  });
}
const installs = async (line: string) =>
  installed(line.slice('install '.length).split('@')[0]);
const afterLast = (writes: string[], line: string) => {
  const text = writes.join('');
  return text.slice(text.lastIndexOf(`$ ${line}`) + `$ ${line}`.length);
};

test('help prints the builtins, the installed and installable tools and the keys without a run', async () => {
  const h = gitHarness(installs);
  await h.host.start();
  const before = [...h.lines];
  type(h.host, '  help ');
  await settle();
  assert.deepEqual(h.lines, before);
  assert.equal(h.host.state, 'ready');
  assert.equal(
    h.status.textContent,
    'Ready. Type install <tool> to add a tool.',
  );
  const shown = afterLast(h.writes, '  help ');
  assert.equal(
    shown,
    [
      '',
      'Builtins: ls, cat, cd, rm -rf, cp, mv, install <tool>, clear, help',
      'Installed: git',
      'install <tool> adds: aube, git',
      'Keys: Ctrl-C cancels a run or drops the line; with text selected it copies, off macOS.',
      '      Ctrl-V / Cmd-V pastes; Ctrl-L clears the screen.',
      '/work/app$ ',
    ].join('\n'),
  );
  assert.ok(shown.split('\n').length <= 12);
  // Arguments ask for the same help; a longer word is a command.
  type(h.host, 'help install');
  await settle();
  assert.deepEqual(h.lines, before);
  assert.match(afterLast(h.writes, 'help install'), /\nInstalled: git\n/);
  // A typed install joins the installed tools; its companion does not.
  type(h.host, 'install aube');
  await settle();
  type(h.host, 'help');
  await settle();
  assert.match(afterLast(h.writes, 'help'), /\nInstalled: aube, git\n/);
  assert.equal(h.status.textContent, 'Ready: aube 2.7.2');

  const ja = gitHarness(installs, 'ja');
  await ja.host.start();
  type(ja.host, 'help');
  await settle();
  assert.match(
    afterLast(ja.writes, 'help'),
    /\n導入済み：git\ninstall <ツール> で導入できるもの：aube、git\n/,
  );
  assert.equal(
    ja.status.textContent,
    '準備完了。install <ツール> でツールを導入できます。',
  );
});

test('each API mistake the terminal explains is a message of the formicarium package it ships', async () => {
  // The site's own pack (showcase/site/node_modules), as the pages load it.
  const runtime = join(
    import.meta.dirname,
    '../../node_modules/@aletheia-works/formicarium/runtime',
  );
  const sources = (
    await Promise.all(
      (
        await readdir(runtime, { recursive: true })
      )
        .filter((file) => file.endsWith('.js'))
        .map((file) => readFile(join(runtime, file), 'utf8')),
    )
  ).join('\n');
  for (const { code, message } of Object.values(API_MISTAKES)) {
    assert.ok(
      sources.includes(`'${message}'`) || sources.includes(`"${message}"`),
      message,
    );
    assert.ok(sources.includes(code), code);
  }
  // cat and cd share one message, written with the builtin's name.
  for (const message of Object.values(API_USAGE).flat())
    assert.ok(
      sources.includes(`'${message}'`) ||
        sources.includes(`\`${message.replace(/^\w+/, '${name}')}\``),
      message,
    );
});

test('the mistakes the API reports are explained in the locale; other failures keep their code', async () => {
  const execute: Execute = async (line) => {
    if (line === 'python3 --version' || line === 'gti status')
      throw failure('NOT_FOUND', 'Guest is not registered');
    if (line === 'install foo')
      throw failure('INVALID_INPUT', 'install identifier invalid');
    if (line === 'cd /nope' || line === 'rm -rf /' || line === 'cp a /b')
      throw failure('INVALID_INPUT', 'path lies outside persistence roots');
    if (line === 'cat missing' || line === 'cat -x' || line === 'mv a b')
      throw failure('NOT_FOUND', 'Entry does not exist');
    if (line === 'ls | head')
      throw failure('INVALID_INPUT', 'shell syntax is unsupported');
    if (line === 'cat')
      throw failure('INVALID_INPUT', 'cat requires exactly one path');
    if (line === 'install')
      throw failure('INVALID_INPUT', 'install requires exactly one selection');
    // Not an API outcome (gti goes to the guest path): a usage message under
    // another name must keep its code.
    if (line === 'gti x y')
      throw failure('INVALID_INPUT', 'install requires exactly one selection');
    if (line === 'cat "a') throw failure('INVALID_INPUT', 'unterminated quote');
    if (line === 'git log') throw failure('BUSY', 'Session is busy');
    return installs(line);
  };
  const h = gitHarness(execute);
  await h.host.start();
  type(h.host, 'python3 --version');
  await settle();
  assert.equal(h.host.state, 'ready');
  assert.equal(
    afterLast(h.writes, 'python3 --version'),
    '\npython3: command not found. Installed: git. Add a tool with install <tool> (aube, git).\n/work/app$ ',
  );
  assert.equal(
    h.status.textContent,
    'python3: command not found. Type help for the commands.',
  );
  type(h.host, 'gti status');
  await settle();
  assert.match(
    afterLast(h.writes, 'gti status'),
    /^\ngti: command not found\./,
  );

  type(h.host, 'install foo');
  await settle();
  assert.equal(
    afterLast(h.writes, 'install foo'),
    '\ninstall: no tool named foo. Tools: aube, git.\n/work/app$ ',
  );
  assert.equal(
    h.status.textContent,
    'No tool named foo. Type help for the tools.',
  );

  type(h.host, 'cd /nope');
  await settle();
  assert.equal(h.host.cwd, '/work/app');
  assert.equal(
    afterLast(h.writes, 'cd /nope'),
    '\ncd: /nope is outside /work and the home directory /root.\n/work/app$ ',
  );
  assert.equal(h.status.textContent, 'cd reaches only /work and /root.');

  for (const [line, shown, status] of [
    [
      'rm -rf /',
      'rm: / is outside /work and the home directory /root.',
      'rm reaches only /work and /root.',
    ],
    [
      'cp a /b',
      'cp: a path is outside /work and the home directory /root.',
      'cp reaches only /work and /root.',
    ],
    [
      'cat missing',
      'cat: missing: no such file or directory.',
      'cat: no such file or directory. ls shows what is here.',
    ],
    [
      'cat -x',
      'cat: -x: no such file or directory.',
      'cat: no such file or directory. ls shows what is here.',
    ],
    [
      'mv a b',
      'mv: no such file or directory.',
      'mv: no such file or directory. ls shows what is here.',
    ],
    [
      'ls | head',
      'There is no shell: pipes, redirections, $ expansion and globs do not work. Run one command per line.',
      'No shell: one command per line.',
    ],
    [
      'cat',
      'cat: usage: cat path',
      'cat: wrong arguments. Type help for the builtins.',
    ],
    [
      'install',
      'install: usage: install <tool>',
      'install: wrong arguments. Type help for the builtins.',
    ],
  ] as const) {
    type(h.host, line);
    await settle();
    assert.equal(afterLast(h.writes, line), `\n${shown}\n/work/app$ `, line);
    assert.equal(h.status.textContent, status, line);
  }

  // A usage message under another name, an unrelated message of a known
  // code and an unrelated code are shown as the API gives them.
  for (const [line, shown] of [
    ['gti x y', 'INVALID_INPUT: install requires exactly one selection'],
    ['cat "a', 'INVALID_INPUT: unterminated quote'],
    ['git log', 'BUSY: Session is busy'],
  ] as const) {
    type(h.host, line);
    await settle();
    assert.equal(afterLast(h.writes, line), `\n${shown}\n/work/app$ `);
    assert.equal(h.status.textContent, `The last command failed (${shown}).`);
  }

  const ja = gitHarness(execute, 'ja');
  await ja.host.start();
  for (const [line, shown, status] of [
    [
      'python3 --version',
      'python3：command が見つかりません。導入済み：git。install <ツール> でツールを追加できます（aube、git）。',
      'python3：command が見つかりません。help で使える command を表示します。',
    ],
    [
      'install foo',
      'install：foo という名前のツールはありません。ツール：aube、git。',
      'foo という名前のツールはありません。help でツールの一覧を表示します。',
    ],
    [
      'cd /nope',
      'cd：/nope は /work と home directory の /root の外にあります。',
      'cd で使えるのは /work と /root の中だけです。',
    ],
    [
      'cp a /b',
      'cp：path が /work と home directory の /root の外にあります。',
      'cp で使えるのは /work と /root の中だけです。',
    ],
    [
      'cat missing',
      'cat：missing はありません。',
      'cat：その file か dir はありません。ls で中身を表示します。',
    ],
    [
      'mv a b',
      'mv：その file か dir はありません。',
      'mv：その file か dir はありません。ls で中身を表示します。',
    ],
    [
      'ls | head',
      'shell はありません。pipe・redirect・$ の展開・glob は使えません。1 行に 1 つの command を打ってください。',
      'shell はありません。1 行に 1 つの command です。',
    ],
    [
      'install',
      'install：使い方は install <ツール> です。',
      'install の引数が違います。help で組込みの command を表示します。',
    ],
  ] as const) {
    type(ja.host, line);
    await settle();
    assert.equal(afterLast(ja.writes, line), `\n${shown}\n/work/app$ `);
    assert.equal(ja.status.textContent, status);
  }
});

test("the page's own install keeps the code of an invalid identifier for its retry", async () => {
  const h = harness('preinstalled', async () => {
    throw failure('INVALID_INPUT', 'install identifier invalid');
  });
  await h.host.start();
  assert.equal(h.host.state, 'ready_failed_install');
  assert.match(
    h.writes.join(''),
    /INVALID_INPUT: install identifier invalid\n/,
  );
  assert.match(h.status.textContent ?? '', /INVALID_INPUT/);
});

test('isolation that never comes fails the page after the wait; no input is taken', async () => {
  const clock = fakeTimers();
  const h = harness('empty', async () => result('builtin'), {
    isolation: () => ({ isolated: false, serviceWorker: 'pending' }),
    timers: clock.timers,
  });
  await h.host.start();
  assert.equal(h.host.state, 'isolating');
  assert.equal(h.status.textContent, 'Preparing cross-origin isolation…');
  clock.fire();
  assert.equal(h.host.state, 'failed');
  assert.match(h.status.textContent!, /Allow service workers/);
  h.host.onData('ls\r');
  assert.deepEqual(h.lines, []);
  const blocked = harness('empty', async () => result('builtin'), {
    isolation: () => ({ isolated: false, serviceWorker: 'unsupported' }),
  });
  await blocked.host.start();
  assert.equal(blocked.host.state, 'failed');
});

test('a catalog that does not match the page fails loading with its cause', async () => {
  const h = harness('empty', async () => result('builtin'), {
    data: data('empty', {
      catalog: { path: 'catalog.json', sha256: 'f'.repeat(64) },
    }),
  });
  await h.host.start();
  assert.equal(h.host.state, 'failed');
  assert.deepEqual(h.sessions, []);
  assert.match(
    h.status.textContent!,
    /^EXECUTION: digest-mismatch: SHA256 differs \(https:\/\/localhost:8443\/formicarium\/catalog\.json\)\. Reload/,
  );
  h.host.onData('l');
  assert.deepEqual(h.lines, []);
});

test('pagehide disposes; pageshow from the back-forward cache reloads; Tab is passed on', async () => {
  let release: (value: CommandResult) => void = () => {};
  const h = harness('empty', (line) =>
    line === 'aube'
      ? new Promise((done) => (release = done))
      : Promise.resolve(result('builtin')),
  );
  await h.host.start();
  type(h.host, 'aube');
  await settle();
  const events = new EventTarget();
  let reloads = 0;
  attachPageEvents(events, h.host, () => reloads++);
  events.dispatchEvent(new Event('pagehide'));
  await settle();
  assert.equal(h.host.state, 'disposed');
  assert.equal(h.disposed(), 1);
  assert.ok(h.writes.includes('<dispose>'));
  release(result('guest', 'after dispose'));
  await settle();
  assert.doesNotMatch(h.writes.join(''), /after dispose/);
  events.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: false }),
  );
  events.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true }),
  );
  assert.equal(reloads, 1);
  assert.equal(passKey({ key: 'Tab' }), false);
  assert.equal(passKey({ key: 'a' }), true);
});

test('Ctrl+C copies a selection off macOS; without one it still reaches the terminal', () => {
  const key = (key: string, mods: Partial<KeyMods> = {}) => ({
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  });
  const ctrlC = key('c', { ctrlKey: true });
  const ctrlShiftC = key('C', { ctrlKey: true, shiftKey: true });
  // With a selection, Ctrl+C goes to the browser, whose copy event xterm
  // fills; without one it is ^C (drop the line, interrupt the run).
  assert.equal(copyAction(ctrlC, 'other', true), 'browser');
  assert.equal(copyAction(ctrlC, 'other', false), null);
  // Ctrl+Shift+C opens the element picker in Chrome and Edge, so the page
  // starts the copy itself and keeps the key from the browser.
  assert.equal(copyAction(ctrlShiftC, 'other', true), 'write');
  assert.equal(copyAction(ctrlShiftC, 'other', false), 'swallow');
  // macOS copies with Cmd+C itself; other keys are not copies.
  assert.equal(copyAction(ctrlC, 'mac', true), null);
  assert.equal(copyAction(ctrlShiftC, 'mac', true), null);
  assert.equal(
    copyAction(key('c', { ctrlKey: true, altKey: true }), 'other', true),
    null,
  );
  assert.equal(copyAction(key('c'), 'other', true), null);
  assert.equal(copyAction(key('x', { ctrlKey: true }), 'other', true), null);
});

test('Ctrl+V and Ctrl+Shift+V paste through the browser off macOS', () => {
  const key = (key: string, mods: Partial<KeyMods> = {}) => ({
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  });
  // Returning false leaves the key to the browser, whose paste event xterm
  // then reads; xterm itself would send ^V.
  for (const event of [
    key('v', { ctrlKey: true }),
    key('V', { ctrlKey: true, shiftKey: true }),
  ]) {
    assert.equal(passKey(event, 'other'), false);
    assert.equal(passKey(event, 'mac'), true);
  }
  // Cmd+V on macOS already pastes; other control keys still reach xterm.
  assert.equal(passKey(key('c', { ctrlKey: true }), 'other'), true);
  assert.equal(
    passKey(key('v', { ctrlKey: true, altKey: true }), 'other'),
    true,
  );
  assert.equal(passKey(key('v'), 'other'), true);
  assert.equal(keyPlatform('MacIntel'), 'mac');
  assert.equal(keyPlatform('iPhone'), 'mac');
  assert.equal(keyPlatform('Win32'), 'other');
  assert.equal(keyPlatform('Linux x86_64'), 'other');
});

test('more than 1 MiB of output redraws the tail and shows the omitted notice', async () => {
  const h = harness('empty', async (_line, options) => {
    for (let index = 0; index < 11; index++)
      options.onOutput?.({
        runId: 'r',
        sequence: index,
        stream: 'stdout',
        bytes: encode(`${'x'.repeat(99999)}\n`),
      });
    return result('guest');
  });
  await h.host.start();
  type(h.host, 'aube');
  await settle();
  assert.ok(h.writes.includes('<reset>'));
  assert.equal(h.omitted.hidden, false);
  assert.match(
    h.omitted.textContent!,
    /^Earlier output omitted \(\d+ bytes, \d+ lines\)$/,
  );
  assert.equal(nextCwd('/work/app', 'cd ../x'), '/work/x');
  assert.equal(nextCwd('/work/app', 'cd /tmp'), '/tmp');
  assert.equal(nextCwd('/work/app', 'ls'), null);
});

// ---- network tools: the relay token, the CA bundle and their failures ----

const tokenBody = (n: number, minutes = 15) =>
  JSON.stringify({
    url: `wss://vm${n}.lambda-microvm.ap-northeast-1.on.aws/`,
    protocols: [
      'lambda-microvms',
      `lambda-microvms.authentication.t${n}`,
      'lambda-microvms.port.8080',
    ],
    expiresInMinutes: minutes,
  });
type TokenAnswer = (
  count: number,
  init: RequestInit | undefined,
) => Response | Promise<Response>;
const tokenOk: TokenAnswer = (count) => chunked([encode(tokenBody(count))]);

/** An empty terminal whose git and jj are network tools, with a fake clock. */
function networkHarness(
  execute: Execute,
  token: TokenAnswer = tokenOk,
  caBody = caText,
) {
  const tokenCalls: (RequestInit | undefined)[] = [];
  const fetched: string[] = [];
  let now = 1_000_000;
  const fetch = (async (url: string, init?: RequestInit) => {
    fetched.push(url);
    if (url === TOKEN_URL) {
      tokenCalls.push(init);
      return token(tokenCalls.length, init);
    }
    if (url.endsWith('/ca/cacert.pem')) return chunked([encode(caBody)]);
    return fetchImpl(url);
  }) as unknown as typeof globalThis.fetch;
  const h = harness('empty', execute, {
    data: data('empty', {
      network: ['git', 'jj'],
      interactive: ['jj'],
      caBundle: { path: 'ca/cacert.pem', sha256: sha(caText) },
    }),
    fetchImpl: fetch,
    now: () => now,
  });
  return {
    ...h,
    tokenCalls,
    fetched,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
const RELAY_UNREACHABLE =
  'Relay unreachable, so this runs without the network; clone and fetch will fail.';

test('only a network tool gets the network, through the relay, with the CA bundle in the home', async () => {
  const seen: [string, CommandOptions][] = [];
  const h = networkHarness(async (line, options) => {
    seen.push([line, options]);
    return line.startsWith('install ') ? installed('git') : result('guest');
  });
  await h.host.start();
  // The CA bundle is written below the home when the session starts, beside
  // the directories it needs; no token is fetched before a network run.
  const home = h.sessions[0]!.entries!.filter((entry) =>
    entry.path.startsWith('/root'),
  );
  assert.deepEqual(
    home.map((entry) => [entry.path, entry.type]),
    [
      ['/root/.config', 'dir'],
      ['/root/.config/ssl', 'dir'],
      ['/root/.config/ssl/cacert.pem', 'file'],
    ],
  );
  assert.equal(
    new TextDecoder().decode(
      (home[2] as Extract<FsEntry, { type: 'file' }>).data,
    ),
    caText,
  );
  assert.ok(
    h.fetched.includes('https://localhost:8443/formicarium/ca/cacert.pem'),
  );
  assert.equal(h.tokenCalls.length, 0);
  for (const line of [
    'git clone https://github.com/octocat/Hello-World',
    'ls',
    'install git',
    'biome --version',
    'jj git clone https://github.com/octocat/Hello-World',
  ]) {
    type(h.host, line);
    await settle();
    assert.equal(h.host.state, 'ready');
  }
  const network = Object.fromEntries(
    seen.map(([line, options]) => [line, options.network]),
  );
  const relay = {
    url: 'wss://vm1.lambda-microvm.ap-northeast-1.on.aws/',
    protocols: [
      'lambda-microvms',
      'lambda-microvms.authentication.t1',
      'lambda-microvms.port.8080',
    ],
  };
  assert.deepEqual(network, {
    'git clone https://github.com/octocat/Hello-World': {
      allow: ['github.com:443'],
      relay,
    },
    ls: undefined,
    'install git': undefined,
    'biome --version': undefined,
    'jj git clone https://github.com/octocat/Hello-World': {
      allow: ['github.com:443'],
      relay,
    },
  });
  // One GET without credentials or redirects served both network runs.
  assert.equal(h.tokenCalls.length, 1);
  assert.equal(h.tokenCalls[0]?.credentials, 'omit');
  assert.equal(h.tokenCalls[0]?.redirect, 'error');
  // An interactive network tool still gets its keys and terminal.
  assert.ok(seen.at(-1)![1].stdin);
});

test('the token is reused until a minute before it expires, then fetched again', async () => {
  const relays: string[] = [];
  const h = networkHarness(async (_line, options) => {
    relays.push(options.network?.relay?.protocols?.[1] ?? 'none');
    return result('guest');
  });
  await h.host.start();
  const clone = async () => {
    type(h.host, 'git ls-remote https://github.com/octocat/Hello-World');
    await settle();
  };
  await clone();
  h.advance(14 * 60000 - 1);
  await clone();
  h.advance(1);
  await clone();
  await clone();
  assert.deepEqual(relays, [
    'lambda-microvms.authentication.t1',
    'lambda-microvms.authentication.t1',
    'lambda-microvms.authentication.t2',
    'lambda-microvms.authentication.t2',
  ]);
  assert.equal(h.tokenCalls.length, 2);
});

test('without a token the network run still starts, with no network and a notice', async () => {
  const answers: TokenAnswer[] = [
    () =>
      chunked([encode('{"error":"the relay is unavailable"}')], {
        status: 503,
      }),
    () => {
      throw new TypeError('offline');
    },
    () => chunked([encode('not json')]),
    () =>
      chunked([
        encode(
          JSON.stringify({
            url: 'ws://relay.test/',
            protocols: [],
            expiresInMinutes: 15,
          }),
        ),
      ]),
    () => chunked([encode(JSON.stringify({ url: 'wss://relay.test/' }))]),
    () => chunked([encode('x'.repeat(20000))]),
  ];
  const ran: [string, CommandOptions['network']][] = [];
  const h = networkHarness(
    async (line, options) => {
      ran.push([line, options.network]);
      options.onOutput?.({
        runId: 'r',
        sequence: 0,
        stream: 'stdout',
        bytes: encode('cloned\n'),
      });
      return result('guest', 'cloned\n');
    },
    (count, init) =>
      count <= answers.length
        ? answers[count - 1]!(count, init)
        : tokenOk(count, init),
  );
  await h.host.start();
  const line = 'git clone https://github.com/octocat/Hello-World';
  for (let attempt = 0; attempt < answers.length; attempt++) {
    const before = h.writes.length;
    type(h.host, line);
    await settle();
    assert.equal(h.host.state, 'ready');
    const printed = h.writes.slice(before).join('');
    assert.ok(printed.includes(`${RELAY_UNREACHABLE}\n`), printed);
    assert.ok(printed.endsWith('cloned\n/work/app$ '), printed);
  }
  // Each one ran without the network; a failure is not cached.
  assert.deepEqual(
    ran,
    answers.map(() => [line, undefined]),
  );
  type(h.host, line);
  await settle();
  assert.equal(ran.length, answers.length + 1);
  assert.deepEqual(ran.at(-1)![1]?.allow, ['github.com:443']);
  assert.equal(
    h.status.textContent,
    'Ready. Type install <tool> to add a tool.',
  );
});

test('Ctrl-C or dispose during the token fetch ends the line without running it', async () => {
  const pending: TokenAnswer = (_count, init) =>
    new Promise((_done, reject) =>
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      ),
    );
  const ran: string[] = [];
  const h = networkHarness(async (line) => {
    ran.push(line);
    return result('guest');
  }, pending);
  await h.host.start();
  type(h.host, 'git clone https://github.com/octocat/Hello-World');
  await settle();
  assert.equal(h.host.state, 'running');
  assert.equal(
    h.status.textContent,
    'Asking the relay for a connection token… Press Ctrl-C to cancel.',
  );
  h.host.onData('\x03');
  await settle();
  assert.equal(h.host.state, 'ready');
  assert.equal(h.status.textContent, 'Cancelled (ABORTED).');
  assert.match(
    h.writes.join(''),
    /ABORTED: the command was cancelled\n\/work\/app\$ $/,
  );
  type(h.host, 'jj git clone https://github.com/octocat/Hello-World');
  await settle();
  const before = h.writes.length;
  await h.host.dispose();
  await settle();
  assert.equal(h.host.state, 'disposed');
  assert.deepEqual(ran, []);
  // Nothing is printed after dispose (xterm is gone).
  assert.deepEqual(h.writes.slice(before), ['<dispose>']);
});

test('a CA bundle that differs from the page data stops the page before any session', async () => {
  const h = networkHarness(async () => result('guest'), tokenOk, `${caText}x`);
  await h.host.start();
  assert.equal(h.host.state, 'failed');
  assert.match(h.status.textContent!, /digest-mismatch/);
  assert.equal(h.sessions.length, 0);
});
