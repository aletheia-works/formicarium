import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  attachPageEvents,
  type HostOptions,
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
