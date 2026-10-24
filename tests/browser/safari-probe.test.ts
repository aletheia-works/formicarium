// The probe page and one install + command run in real Safari through
// safaridriver (W3C WebDriver over HTTP, no extra dependency). Playwright's
// WebKit is a separate WebKit build, so this is the check against the Safari
// that ships with macOS. It runs one session at a time with no retries, like the
// Playwright suites.
// Requires: bun run build, the probe guests (probe, hello, exit3) in dist/guests,
// `safaridriver --port <port>` already running (FORMICARIUM_SAFARIDRIVER), and,
// for the install test only, openssl for its HTTPS guest server.
import assert from 'node:assert/strict';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
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
async function serveGuest(hello: Uint8Array) {
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
        if (request.url !== '/hello') {
          response.writeHead(404).end();
          return;
        }
        // The page is cross-origin isolated, so the download needs CORS and CORP.
        response.writeHead(200, {
          'access-control-allow-origin': origin,
          'cross-origin-resource-policy': 'cross-origin',
          'content-type': 'application/octet-stream',
        });
        response.end(hello);
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

test('install and command run a catalog guest in Safari', async (t) => {
  const bytes = await readFile('dist/guests/hello');
  const guests = await serveGuest(bytes);
  t.after(() => guests.close());
  const expected = expectation(bytes, {
    tool: 'hello',
    versionOrName: '1.0.0',
  });
  const catalog = {
    schemaVersion: 1,
    catalogId: 'safari-probe',
    defaults: { hello: '1.0.0' },
    entries: [
      {
        tool: 'hello',
        versionOrName: '1.0.0',
        url: `https://127.0.0.1:${(guests.address() as AddressInfo).port}/hello`,
        format: 'elf',
        downloadSha256: expected.elfSha256,
        downloadBytes: bytes.length,
        elfBytes: bytes.length,
        buildInfo: expected.identity,
        buildInfoSha256: expected.buildInfoSha256,
      },
    ],
  };
  await webdriver('POST', `/session/${session}/url`, {
    url: `${origin}/web/index.html`,
  });
  // The public root and browser entries, with the core from the dev tree as
  // web/run.ts uses it.
  const observed = (await webdriver(
    'POST',
    `/session/${session}/execute/async`,
    {
      script: `const [catalog, done] = arguments;
(async () => {
  const api = await import('/runtime/public.js');
  const { coreAssets } = await import('/runtime/core.js');
  const { createSession } = await import('/runtime/web/api.js');
  const session = await createSession({
    assets: coreAssets(
      new URL('/dist/paludarium/', location.href),
      new URL('/runtime/web/package-worker.bundle.js', location.href),
    ),
  });
  try {
    const shell = api.createCommandSession(session, { catalog });
    const installed = await shell.execute('install hello');
    const ran = await shell.execute('hello from-safari');
    return {
      installed: installed.kind === 'install' && installed.exitCode === 0,
      exitCode: ran.exitCode,
      stdout: api.decodeUtf8(ran.stdout),
    };
  } finally {
    await session.dispose();
  }
})().then(done, (error) => done({ error: String(error?.code ?? error) }));`,
      args: [catalog],
    },
  )) as {
    installed?: boolean;
    exitCode?: number;
    stdout?: string;
    error?: string;
  };
  assert.equal(observed.error, undefined);
  assert.equal(observed.installed, true);
  assert.equal(observed.exitCode, 0);
  assert.match(observed.stdout ?? '', /arg: from-safari/);
});
