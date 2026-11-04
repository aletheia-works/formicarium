import assert from 'node:assert/strict';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { join } from 'node:path';
import test from 'node:test';
import {
  acceptChild,
  acceptCommand,
  acceptParent,
  type CommandApi,
  loadSite,
} from '../scripts/accept-node.ts';
import { startAcceptServer } from '../scripts/accept-server.ts';
import { causeOf } from '../scripts/errors.ts';
import { modeCommand, runModeStep } from '../scripts/mode.ts';
import { type WorkLayout, workLayout } from '../scripts/paths.ts';
import { pinCommand } from '../scripts/pin-release.ts';
import { reuseRepository } from '../scripts/reuse.ts';
import {
  createJobTls,
  removeJobTls,
  type TlsMaterial,
  tlsEnvironmentLines,
  tlsFromEnvironment,
} from '../scripts/tls.ts';
import { commit } from './fixtures/github.ts';
import { withLayout } from './fixtures/work.ts';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);

/** Real job TLS material from openssl, removed after the work. */
async function withTls(
  work: (tls: TlsMaterial, layout: WorkLayout) => Promise<void>,
) {
  await withLayout(async (layout) => {
    const tls = await createJobTls(layout.tls);
    try {
      await work(tls, layout);
    } finally {
      await removeJobTls(tls);
    }
  });
}

/** A GET or other method over HTTPS to the acceptance server, trusting the job CA. */
async function fetchTls(
  origin: string,
  path: string,
  ca: string,
  method = 'GET',
): Promise<{
  status: number;
  headers: Record<string, unknown>;
  body: string;
}> {
  const { port } = new URL(origin);
  const caPem = await readFile(ca);
  return new Promise((done, reject) => {
    const outgoing = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        ca: caPem,
        servername: 'localhost',
      },
      (response) => {
        const parts: Buffer[] = [];
        response.on('data', (part: Buffer) => parts.push(part));
        response.on('end', () =>
          done({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(parts).toString('utf8'),
          }),
        );
      },
    );
    outgoing.on('error', reject);
    outgoing.end();
  });
}

test('the mode step hands the accepted mode to the later steps', async () => {
  await withLayout(async (layout) => {
    await mkdir(layout.root, { recursive: true });
    const output = join(layout.root, 'output');
    assert.equal(await runModeStep({ GITHUB_OUTPUT: output }), 'verify');
    assert.equal(await readFile(output, 'utf8'), 'mode=verify\n');
    // Without GITHUB_OUTPUT it only reports.
    assert.equal(await runModeStep({}), 'verify');
    await rejects(
      runModeStep({
        SHOWCASE_MODE: 'distribute',
        GITHUB_EVENT_NAME: 'schedule',
      }),
      'mode-rejected',
    );
  });
});

/** Runs a command line that reports a failure through the shared exit code. */
async function failingCommand(run: () => Promise<boolean>) {
  const before = process.exitCode;
  try {
    assert.equal(await run(), false);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = before ?? 0;
  }
}

test('the command lines report a refused run through the exit code', async () => {
  assert.equal(await modeCommand({}), true);
  await failingCommand(() =>
    modeCommand({ SHOWCASE_MODE: 'distribute', GITHUB_EVENT_NAME: 'schedule' }),
  );
  // Only a stable version is pinned, and it is refused before any request.
  await failingCommand(() => pinCommand('not-a-version'));
  await withLayout(async (layout) => {
    await failingCommand(() => acceptCommand('--child', layout));
    // The parent fails too: this layout has no site for a child to accept.
    await failingCommand(() => acceptCommand(undefined, layout));
  });
});

test('the reuse lookup needs an owner/repo repository', () => {
  assert.equal(reuseRepository({ GITHUB_REPOSITORY: 'o/r' }), 'o/r');
  for (const env of [{}, { GITHUB_REPOSITORY: 'no-slash' }])
    assert.throws(
      () => reuseRepository(env),
      (error) => causeOf(error) === 'config-invalid',
    );
});

test('openssl makes a localhost leaf under a job CA whose key is gone', async () => {
  await withTls(async (tls) => {
    assert.match(tls.fingerprint, /^[a-f0-9]{64}$/);
    await assert.rejects(access(join(tls.directory, 'ca-key.pem')));
    assert.equal((await stat(tls.key)).isFile(), true);
    assert.deepEqual(tlsEnvironmentLines(tls).split('\n'), [
      `SHOWCASE_TLS_CA=${tls.caCert}`,
      `SHOWCASE_TLS_CERT=${tls.cert}`,
      `SHOWCASE_TLS_KEY=${tls.key}`,
      `SHOWCASE_TLS_SHA256=${tls.fingerprint}`,
    ]);
    assert.doesNotMatch(tlsEnvironmentLines(tls), /PRIVATE KEY/);
  });
});

test('a leaf that is not for localhost is refused', async () => {
  await withLayout(async (layout) => {
    const good = await createJobTls(join(layout.root, 'ca'));
    const leaf = await readFile(good.caCert);
    // The CA certificate stands in for a leaf: it is a CA, not a localhost leaf.
    await rejects(
      createJobTls(join(layout.root, 'bad'), (args) => {
        const out = args[args.indexOf('-out') + 1];
        if (out) void writeFile(out, leaf).catch(() => undefined);
      }),
      'config-invalid',
    );
  });
});

test('the material CI trusted is used only as a complete set with its fingerprint', async () => {
  await withTls(async (tls) => {
    const env = {
      SHOWCASE_TLS_CA: tls.caCert,
      SHOWCASE_TLS_CERT: tls.cert,
      SHOWCASE_TLS_KEY: tls.key,
      SHOWCASE_TLS_SHA256: tls.fingerprint,
    };
    const provided = await tlsFromEnvironment(env);
    assert.deepEqual(provided, { ...tls, directory: '' });
    // Material this process did not create is never removed.
    await removeJobTls(provided!);
    assert.equal((await stat(tls.cert)).isFile(), true);
    await rejects(
      tlsFromEnvironment({ ...env, SHOWCASE_TLS_SHA256: '0'.repeat(64) }),
      'config-invalid',
    );
  });
});

const manifest = JSON.stringify({
  name: '@aletheia-works/formicarium',
  exports: {
    '.': { import: './runtime/public.js' },
    './browser': { import: './runtime/web/api.js' },
  },
});

async function siteFiles(layout: WorkLayout) {
  const packageRoot = join(layout.root, 'package');
  await mkdir(join(packageRoot, 'runtime'), { recursive: true });
  await mkdir(layout.site, { recursive: true });
  await writeFile(join(packageRoot, 'package.json'), manifest);
  await writeFile(join(packageRoot, 'runtime', 'public.js'), 'export {};\n');
  await writeFile(join(layout.site, 'guest.wasm'), 'wasm');
  return packageRoot;
}

test('the acceptance server keeps guests and package same-origin under its headers', async () => {
  await withTls(async (tls, layout) => {
    const packageRoot = await siteFiles(layout);
    const server = await startAcceptServer({
      siteRoot: layout.site,
      packageRoot,
      cert: tls.cert,
      key: tls.key,
    });
    const get = (path: string, method?: string) =>
      fetchTls(server.origin, path, tls.caCert, method);
    try {
      assert.match(server.origin, /^https:\/\/localhost:\d+$/);
      const page = await get('/');
      assert.equal(page.status, 200);
      assert.match(String(page.headers['content-type']), /text\/html/);
      assert.equal(page.headers['cross-origin-opener-policy'], 'same-origin');
      assert.equal(
        page.headers['cross-origin-embedder-policy'],
        'require-corp',
      );
      assert.equal(page.headers['cross-origin-resource-policy'], 'same-origin');
      assert.match(
        String(page.headers['content-security-policy']),
        /default-src 'none'/,
      );
      assert.match(page.body, /\/pkg\/runtime\/public\.js/);

      const guest = await get('/guest.wasm');
      assert.deepEqual(
        [guest.status, guest.headers['content-type'], guest.body],
        [200, 'application/wasm', 'wasm'],
      );
      const script = await get('/pkg/runtime/public.js');
      assert.equal(script.status, 200);
      assert.equal(script.headers['content-type'], 'text/javascript');

      assert.equal((await get('/missing')).status, 404);
      assert.equal((await get('/a%00b')).status, 404);
      assert.equal((await get('/', 'POST')).status, 405);
    } finally {
      await server.close();
    }
    await assert.rejects(get('/'));
  });
});

const CA_BUNDLE = {
  file: 'cacert.pem',
  url: 'https://curl.se/ca/cacert.pem',
  sha256Url: 'https://curl.se/ca/cacert.pem.sha256',
  spdx: 'MPL-2.0',
  sha256: 'a'.repeat(64),
  size: 1,
};

async function writeSite(layout: WorkLayout) {
  await mkdir(join(layout.catalog, '..'), { recursive: true });
  await mkdir(join(layout.resolutions, '..'), { recursive: true });
  await writeFile(
    layout.catalog,
    JSON.stringify({ schemaVersion: 1, defaults: {}, entries: [] }),
  );
  await writeFile(
    layout.resolutions,
    JSON.stringify({ schemaVersion: 1, tools: [], caBundle: CA_BUNDLE }),
  );
}

const unusedApi = (): Promise<CommandApi> =>
  Promise.reject(Error('the API must not load'));

test('the child refuses an origin or CA it was not given, before any guest runs', async () => {
  await withLayout(async (layout) => {
    await writeSite(layout);
    const noApi = { ...process.env };
    delete noApi.NODE_EXTRA_CA_CERTS;
    await rejects(acceptChild(layout, {}, unusedApi), 'config-invalid');
    await rejects(
      acceptChild(
        layout,
        { SHOWCASE_ACCEPT_ORIGIN: 'https://example.test:1' },
        unusedApi,
      ),
      'config-invalid',
    );
    await rejects(
      acceptChild(
        layout,
        { SHOWCASE_ACCEPT_ORIGIN: 'https://localhost:1' },
        async () => ({}) as CommandApi,
      ),
      'config-invalid',
    );
  });
});

test('the child records the environment and one row for each tool', async () => {
  await withTls(async (tls, layout) => {
    await writeSite(layout);
    assert.deepEqual((await loadSite(layout)).tools, []);
    await mkdir(layout.acceptance, { recursive: true });
    await acceptChild(
      layout,
      {
        SHOWCASE_ACCEPT_ORIGIN: 'https://localhost:1',
        NODE_EXTRA_CA_CERTS: tls.caCert,
      },
      async () => ({}) as CommandApi,
    );
    const part = JSON.parse(
      await readFile(join(layout.acceptance, 'node.json'), 'utf8'),
    );
    assert.equal(part.environment.environment, 'node');
    assert.equal(part.environment.observed.platform, process.platform);
    assert.deepEqual(part.rows, []);
  });
});

test('the parent gives the child the job CA and origin, and needs its exit code 0', async () => {
  await withLayout(async (layout) => {
    const packageRoot = await siteFiles(layout);
    let seen: NodeJS.ProcessEnv = {};
    await acceptParent(layout, {
      env: { MARK: commit('kept') },
      packageRoot,
      runChild: async (env) => {
        seen = env;
        return 0;
      },
    });
    assert.equal(seen.MARK, commit('kept'));
    assert.match(String(seen.SHOWCASE_ACCEPT_ORIGIN), /^https:\/\/localhost:/);
    assert.match(String(seen.NODE_EXTRA_CA_CERTS), /ca-cert\.pem$/);
    // The material it created for the run is gone afterwards.
    await assert.rejects(access(String(seen.NODE_EXTRA_CA_CERTS)));
    for (const code of [1, null])
      await rejects(
        acceptParent(layout, {
          env: {},
          packageRoot,
          runChild: async () => code,
        }),
        'acceptance-row-missing',
      );
    await assert.rejects(access(layout.tls));
  });
});

const defaultNodeResult = join(workLayout().acceptance, 'node.json');

test('a child process that fails fails the parent', async () => {
  await withLayout(async (layout) => {
    const packageRoot = await siteFiles(layout);
    // This really runs the script with --child, on this layout: its site files
    // are absent. CI's own showcase/.work has a site, which must stay untouched.
    const before = await readFile(defaultNodeResult).catch(() => null);
    await rejects(
      acceptParent(layout, { env: { ...process.env }, packageRoot }),
      'acceptance-row-missing',
    );
    assert.deepEqual(
      await readFile(defaultNodeResult).catch(() => null),
      before,
    );
  });
});

test('the child loads the public package API by default', async () => {
  await withTls(async (tls, layout) => {
    await writeSite(layout);
    await mkdir(layout.acceptance, { recursive: true });
    await acceptChild(layout, {
      SHOWCASE_ACCEPT_ORIGIN: 'https://localhost:1',
      NODE_EXTRA_CA_CERTS: tls.caCert,
    });
    await access(join(layout.acceptance, 'node.json'));
  });
});

test('the parent uses the material CI provides and leaves it in place', async () => {
  await withTls(async (tls, layout) => {
    const packageRoot = await siteFiles(layout);
    await acceptParent(layout, {
      env: {
        SHOWCASE_TLS_CA: tls.caCert,
        SHOWCASE_TLS_CERT: tls.cert,
        SHOWCASE_TLS_KEY: tls.key,
        SHOWCASE_TLS_SHA256: tls.fingerprint,
      },
      packageRoot,
      runChild: async (env) => {
        assert.equal(env.NODE_EXTRA_CA_CERTS, tls.caCert);
        return 0;
      },
    });
    assert.equal((await stat(tls.cert)).isFile(), true);
  });
});
