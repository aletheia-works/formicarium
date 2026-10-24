// The probe page and the install and command API checks in real Safari through
// safaridriver (W3C WebDriver over HTTP, no extra dependency). Playwright's
// WebKit is a separate WebKit build, so this is the check against the Safari
// that ships with macOS. It runs one session at a time with no retries, like the
// Playwright suites.
// Requires: bun run build, the probe guests (probe, hello, exit3) in dist/guests,
// `safaridriver --port <port>` already running (FORMICARIUM_SAFARIDRIVER), and,
// for the install tests only, openssl and tar for the HTTPS guest server.
import assert from 'node:assert/strict';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { expectation } from '../package/session-fixtures.js';

const driver = process.env.FORMICARIUM_SAFARIDRIVER ?? 'http://127.0.0.1:4444';
const port = Number(process.env.FORMICARIUM_PORT ?? 8787);
const origin = `http://127.0.0.1:${port}`;
/** The same per-run limit as the Playwright probe test. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;
const CHECKS = [
  'tokio-timer',
  'unix-stream-pair',
  'rayon',
  'mutex-condvar',
  'fs-basic',
  'fs-hardlink',
  'fs-symlink',
  'fs-flock',
];

interface PageResult {
  exitCode?: number;
  error?: string;
}

let server: ChildProcess;
let session: string;

async function webdriver(method: string, path: string, body?: unknown) {
  const response = await fetch(`${driver}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const reply = (await response.json()) as { value: unknown };
  if (!response.ok)
    throw new Error(`WebDriver ${method} ${path}: ${JSON.stringify(reply)}`);
  return reply.value;
}

const run = (script: string) =>
  webdriver('POST', `/session/${session}/execute/sync`, { script, args: [] });

function probeUrl(args: string[] = []) {
  const query = new URLSearchParams({ guest: 'probe' });
  for (const arg of args) query.append('arg', arg);
  return `/web/index.html?${query}`;
}

/** Open the page and wait until it records a result, as the Playwright test does. */
async function runPage(path: string) {
  await webdriver('POST', `/session/${session}/url`, { url: origin + path });
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  for (;;) {
    const result = (await run(
      'return window.formicariumResult ?? null',
    )) as PageResult | null;
    if (result) {
      const streams = (await run(
        'return window.formicariumDiagnostics ?? { stdout: "", stderr: "" }',
      )) as { stdout: string; stderr: string };
      const output = (await run(
        'return document.getElementById("output")?.textContent ?? ""',
      )) as string;
      return { result, streams, output };
    }
    if (Date.now() > deadline)
      throw new Error(`no result within ${RUN_TIMEOUT_MS} ms: ${path}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * Serve the hello guest over HTTPS, which a catalog requires, with a throwaway
 * certificate that the WebDriver session accepts. The page itself stays on
 * http://127.0.0.1, a secure context.
 */
async function serveGuests(files: Record<string, Uint8Array>) {
  const certificates = await mkdtemp(join(tmpdir(), 'formicarium-safari-'));
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-keyout',
        join(certificates, 'key.pem'),
        '-out',
        join(certificates, 'cert.pem'),
      ],
      { stdio: 'ignore' },
    );
    const guests: Server = createServer(
      {
        key: await readFile(join(certificates, 'key.pem')),
        cert: await readFile(join(certificates, 'cert.pem')),
      },
      (request, response) => {
        const body = files[request.url ?? ''];
        if (!body) {
          response.writeHead(404).end();
          return;
        }
        // The page is cross-origin isolated, so the download needs CORS and CORP.
        response.writeHead(200, {
          'access-control-allow-origin': origin,
          'cross-origin-resource-policy': 'cross-origin',
          'content-type': 'application/octet-stream',
        });
        response.end(body);
      },
    ).listen(0, '127.0.0.1');
    await once(guests, 'listening');
    return guests;
  } finally {
    await rm(certificates, { recursive: true, force: true });
  }
}

before(async () => {
  server = spawn(
    process.execPath,
    ['scripts/serve.js', '--port', String(port)],
    { stdio: 'inherit' },
  );
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${origin}/web/index.html`)).ok) break;
    } catch {}
    if (attempt > 100) throw new Error('the page server did not start');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // safaridriver may still be starting when the test does.
  for (let attempt = 0; ; attempt++) {
    try {
      const status = (await (await fetch(`${driver}/status`)).json()) as {
        value?: { ready?: boolean };
      };
      if (status.value?.ready) break;
    } catch {}
    if (attempt > 100) throw new Error(`safaridriver is not ready: ${driver}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const created = (await webdriver('POST', '/session', {
    capabilities: {
      alwaysMatch: { browserName: 'safari', acceptInsecureCerts: true },
    },
  })) as { sessionId: string; capabilities: Record<string, unknown> };
  session = created.sessionId;
  await webdriver('POST', `/session/${session}/timeouts`, {
    script: RUN_TIMEOUT_MS,
  });
  console.log(
    `Safari ${created.capabilities.browserVersion} on ${created.capabilities.platformName}`,
  );
});

after(async () => {
  if (session) await webdriver('DELETE', `/session/${session}`).catch(() => {});
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
});

test('the page is crossOriginIsolated in Safari', async () => {
  await webdriver('POST', `/session/${session}/url`, {
    url: `${origin}/web/index.html?guest=hello`,
  });
  assert.equal(await run('return crossOriginIsolated'), true);
});

test('the hello guest starts and exits 0 in Safari', async () => {
  const { result, streams } = await runPage(
    '/web/index.html?guest=hello&arg=from-safari',
  );
  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 0);
  assert.match(streams.stdout, /arg: from-safari/);
});

test('a guest exit code of 3 reaches the page in Safari', async () => {
  const { result, streams } = await runPage('/web/index.html?guest=exit3');
  assert.equal(result.exitCode, 3);
  assert.match(streams.stderr, /exiting with status 3/);
});

test('every probe item passes in Safari', async () => {
  const { result, output } = await runPage(probeUrl());
  assert.equal(result.error, undefined);
  for (const name of CHECKS)
    assert.ok(output.includes(`PASS ${name}\n`), `item ${name}`);
  assert.ok(!output.includes('FAIL '));
  assert.equal(result.exitCode, 0);
});

for (const item of ['futex-deadline', 'madvise-dontneed', 'page-fault-race'])
  test(`probe regression item ${item} passes in Safari`, async () => {
    const { result, streams } = await runPage(probeUrl([item]));
    assert.equal(result.error, undefined);
    assert.equal(streams.stdout.trim(), `PASS ${item}`);
    assert.equal(result.exitCode, 0);
  });

/**
 * A catalog with the hello guest as a raw ELF (`hello`) and as a ustar tar.gz
 * (`hello-archive`), served over HTTPS by serveGuests.
 */
async function helloCatalog(t: { after: (fn: () => unknown) => void }) {
  const bytes = await readFile('dist/guests/hello');
  const archive = await mkdtemp(join(tmpdir(), 'formicarium-safari-tar-'));
  t.after(() => rm(archive, { recursive: true, force: true }));
  // COPYFILE_DISABLE keeps macOS tar from adding ._hello AppleDouble entries.
  execFileSync(
    'tar',
    [
      '--format=ustar',
      '-czf',
      join(archive, 'hello.tar.gz'),
      '-C',
      'dist/guests',
      'hello',
    ],
    { env: { ...process.env, COPYFILE_DISABLE: '1' } },
  );
  const tarball = await readFile(join(archive, 'hello.tar.gz'));
  const guests = await serveGuests({
    '/hello': bytes,
    '/hello.tar.gz': tarball,
  });
  t.after(() => guests.close());
  const base = `https://127.0.0.1:${(guests.address() as AddressInfo).port}`;
  const elf = expectation(bytes, { tool: 'hello', versionOrName: '1.0.0' });
  const packed = expectation(bytes, {
    tool: 'hello-archive',
    versionOrName: '1.0.0',
  });
  return {
    schemaVersion: 1,
    catalogId: 'safari-probe',
    defaults: { hello: '1.0.0', 'hello-archive': '1.0.0' },
    entries: [
      {
        tool: 'hello',
        versionOrName: '1.0.0',
        url: `${base}/hello`,
        format: 'elf',
        downloadSha256: elf.elfSha256,
        downloadBytes: bytes.length,
        elfBytes: bytes.length,
        buildInfo: elf.identity,
        buildInfoSha256: elf.buildInfoSha256,
      },
      {
        tool: 'hello-archive',
        versionOrName: '1.0.0',
        url: `${base}/hello.tar.gz`,
        format: 'tar.gz',
        archiveEntry: 'hello',
        downloadSha256: createHash('sha256').update(tarball).digest('hex'),
        downloadBytes: tarball.length,
        elfBytes: bytes.length,
        buildInfo: packed.identity,
        buildInfoSha256: packed.buildInfoSha256,
      },
    ],
  };
}

/**
 * Run `body` in Safari with `api` (the public root entry), a browser
 * `session` from the dev tree's core (as web/run.ts) and `arg`; returns
 * what `body` returns, or { error } with the ExecutionError code.
 */
async function inSafari<T>(
  body: string,
  arg: unknown,
  options = '{}',
): Promise<T & { error?: string }> {
  await webdriver('POST', `/session/${session}/url`, {
    url: `${origin}/web/index.html`,
  });
  return (await webdriver('POST', `/session/${session}/execute/async`, {
    script: `const [arg, done] = arguments;
(async () => {
  const api = await import('/runtime/public.js');
  const { coreAssets } = await import('/runtime/core.js');
  const { createSession } = await import('/runtime/web/api.js');
  const session = await createSession({
    ...${options},
    assets: coreAssets(
      new URL('/dist/paludarium/', location.href),
      new URL('/runtime/web/package-worker.bundle.js', location.href),
    ),
  });
  try {
${body}
  } finally {
    await session.dispose();
  }
})().then(done, (error) => done({ error: String(error?.code ?? error) }));`,
    args: [arg],
  })) as T & { error?: string };
}

test('install and command run a catalog guest in Safari', async (t) => {
  const catalog = await helloCatalog(t);
  const observed = await inSafari<{
    installed: boolean;
    exitCode: number;
    stdout: string;
  }>(
    `const shell = api.createCommandSession(session, { catalog: arg });
    const installed = await shell.execute('install hello');
    const ran = await shell.execute('hello from-safari');
    return {
      installed: installed.kind === 'install' && installed.exitCode === 0,
      exitCode: ran.exitCode,
      stdout: api.decodeUtf8(ran.stdout),
    };`,
    catalog,
  );
  assert.equal(observed.error, undefined);
  assert.equal(observed.installed, true);
  assert.equal(observed.exitCode, 0);
  assert.match(observed.stdout, /arg: from-safari/);
});

test('a tar.gz entry is extracted with every progress phase in Safari', async (t) => {
  const catalog = await helloCatalog(t);
  const observed = await inSafari<{
    phases: string[];
    installed: boolean;
    exitCode: number;
    stdout: string;
  }>(
    `const shell = api.createCommandSession(session, { catalog: arg });
    const phases = [];
    const installed = await shell.execute('install hello-archive', {
      onProgress: (progress) => {
        if (phases.at(-1) !== progress.phase) phases.push(progress.phase);
      },
    });
    const ran = await shell.execute('hello-archive from-archive');
    return {
      phases,
      installed: installed.kind === 'install' && installed.exitCode === 0,
      exitCode: ran.exitCode,
      stdout: api.decodeUtf8(ran.stdout),
    };`,
    catalog,
  );
  assert.equal(observed.error, undefined);
  assert.deepEqual(observed.phases, [
    'fetch',
    'extract',
    'digest',
    'validate',
    'register',
  ]);
  assert.equal(observed.installed, true);
  assert.equal(observed.exitCode, 0);
  assert.match(observed.stdout, /arg: from-archive/);
});

test('a cancelled install registers nothing and the next install works in Safari', async (t) => {
  const catalog = await helloCatalog(t);
  const observed = await inSafari<{
    aborted: string | null;
    missing: string | null;
    exitCode: number;
  }>(
    `const shell = api.createCommandSession(session, { catalog: arg });
    const controller = new AbortController();
    let aborted = null;
    try {
      await shell.execute('install hello', {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      });
    } catch (error) {
      aborted = String(error?.code ?? error);
    }
    let missing = null;
    try {
      await shell.execute('hello');
    } catch (error) {
      missing = String(error?.code ?? error);
    }
    await shell.execute('install hello');
    const ran = await shell.execute('hello');
    return { aborted, missing, exitCode: ran.exitCode };`,
    catalog,
  );
  assert.equal(observed.error, undefined);
  assert.equal(observed.aborted, 'ABORTED');
  assert.equal(observed.missing, 'NOT_FOUND');
  assert.equal(observed.exitCode, 0);
});

test('ls, cat, cd and rm -rf act on the session files in Safari', async () => {
  const observed = await inSafari<{ outputs: string[]; codes: number[] }>(
    `const shell = api.createCommandSession(session, {
      catalog: { schemaVersion: 1, catalogId: 'none', defaults: {}, entries: [] },
    });
    const outputs = [];
    const codes = [];
    for (const line of ['ls', 'cat note.txt', 'cd sub', 'ls', 'cd /work', 'rm -rf sub', 'ls']) {
      const result = await shell.execute(line);
      outputs.push(api.decodeUtf8(result.stdout));
      codes.push(result.exitCode);
    }
    return { outputs, codes };`,
    null,
    `{
      cwd: '/work',
      entries: [
        { path: '/work/sub', type: 'dir', mode: 0o755 },
        { path: '/work/sub/inner.txt', type: 'file', mode: 0o644, inodeId: 'i1', data: new TextEncoder().encode('in') },
        { path: '/work/note.txt', type: 'file', mode: 0o644, inodeId: 'n1', data: new TextEncoder().encode('hello safari\\n') },
      ],
    }`,
  );
  assert.equal(observed.error, undefined);
  assert.deepEqual(observed.codes, [0, 0, 0, 0, 0, 0, 0]);
  assert.match(observed.outputs[0]!, /note\.txt/);
  assert.match(observed.outputs[0]!, /sub/);
  assert.equal(observed.outputs[1], 'hello safari\n');
  assert.match(observed.outputs[3]!, /inner\.txt/);
  assert.doesNotMatch(observed.outputs[6]!, /sub/);
  assert.match(observed.outputs[6]!, /note\.txt/);
});
