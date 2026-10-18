import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256 } from '../../scripts/package/stage-package.js';
import type { GuestCatalog } from '../../types/index.js';
import { consumerInput } from '../migration-session/consumer-input.js';

const input = await consumerInput();
assert.ok(['u3-install', 'u4-command'].includes(input.candidate.unit));
for (const name of [
  'install',
  'install-catalog',
  'install-transfer',
  'install-archive',
  'install-lifecycle',
])
  assert.ok(
    input.candidate.files.some(
      (entry: { path: string }) => entry.path === `runtime/${name}.js`,
    ),
    `current U3 pack must contain ${name}`,
  );
const api = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/public.js')).href
)) as typeof import('../../runtime/public.js');
const { createSession } = (await import(
  pathToFileURL(resolve(input.packageRoot, 'runtime/node/api.js')).href
)) as typeof import('../../runtime/node/api.js');
const compressed = new Uint8Array(
  await readFile(
    new URL(
      '../../.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
      import.meta.url,
    ),
  ),
);
assert.equal(
  sha256(compressed),
  'fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666',
);
function catalog(format: 'elf' | 'tar.gz' = 'elf'): GuestCatalog {
  const info = structuredClone(input.expected.identity);
  const bytes = format === 'elf' ? input.bytes : compressed;
  return {
    schemaVersion: 1,
    catalogId: 'u3-controlled-transport',
    defaults: { [info.tool]: info.versionOrName },
    entries: [
      {
        tool: info.tool,
        versionOrName: info.versionOrName,
        url: 'https://install.invalid/guest',
        format,
        ...(format === 'tar.gz' ? { archiveEntry: 'aube' } : {}),
        downloadSha256: sha256(bytes),
        downloadBytes: bytes.length,
        elfBytes: input.bytes.length,
        buildInfo: info,
        buildInfoSha256: input.expected.buildInfoSha256,
      },
    ],
  };
}
test('installed U3 exports C04 and keeps internal port and timing modules private', () => {
  assert.equal(typeof api.createInstaller, 'function');
  assert.equal('sessionPort' in api, false);
  assert.equal('installationTiming' in api, false);
  const require = createRequire(resolve(input.consumerRoot, 'package.json'));
  for (const path of ['runtime/install.js', 'runtime/session-port.js'])
    assert.throws(
      () => require.resolve(`@aletheia-works/formicarium/${path}`),
      { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
    );
});
test('installed U3 declarations compile valid fixture and enforce every expected invalid shape', async () => {
  const paths: string[] = [];
  for (const name of ['types-valid.ts', 'types-invalid.ts']) {
    const destination = resolve(input.consumerRoot, `u3-${name}`);
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
test('installed ELF and real U1 archive install via controlled transport and real public guest run', async (t) => {
  for (const format of ['elf', 'tar.gz'] as const) {
    const session = await createSession();
    t.after(() => session.dispose());
    const manifest = catalog(format);
    const name = manifest.entries[0]!.tool;
    const mock = t.mock.method(
      globalThis,
      'fetch',
      async (url: unknown, options: RequestInit) => {
        assert.equal(String(url), 'https://install.invalid/guest');
        assert.equal(options.credentials, 'omit');
        return new Response(
          new Uint8Array(format === 'elf' ? input.bytes : compressed),
        );
      },
    );
    const installer = api.createInstaller(session, manifest);
    manifest.entries[0]!.url = 'https://changed.invalid';
    const phases: string[] = [];
    const installed = await installer.install(name, {
      onProgress(event) {
        phases.push(event.phase);
      },
    });
    assert.equal(installed.digest, input.expected.elfSha256);
    assert.equal(installed.buildKey, input.expected.identity.buildKey);
    assert.deepEqual(
      [...new Set(phases)],
      format === 'elf'
        ? ['fetch', 'digest', 'validate', 'register']
        : ['fetch', 'extract', 'digest', 'validate', 'register'],
    );
    // U4 owns command execution of registered tools. This proves C04 install
    // plus C03 public execution of the identical fixed guest in the same pack.
    const owned = api.validateGuest(input.bytes, input.expected);
    const result = await api.runValidatedGuest(session, owned, {
      args: ['--version'],
    });
    assert.equal(result.exitCode, 0);
    assert.match(api.decodeUtf8(result.stdout), /^2\.7\.0/);
    mock.mock.restore();
  }
});
test('installed factory rejects foreign Session and unknown selection without transfer', async (t) => {
  const session = await createSession();
  t.after(() => session.dispose());
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(input.bytes);
  });
  assert.throws(() => api.createInstaller({} as typeof session, catalog()), {
    code: 'INVALID_INPUT',
  });
  await assert.rejects(
    api.createInstaller(session, catalog()).install('unknown'),
    { code: 'INVALID_INPUT' },
  );
  assert.equal(calls, 0);
});
test('installed failed reinstall and aborted fetch preserve seed filesystem', async (t) => {
  const session = await createSession({
    entries: [
      {
        path: '/work/seed',
        type: 'file',
        mode: 0o600,
        inodeId: 'seed',
        data: new Uint8Array([7]),
      },
    ],
  });
  t.after(() => session.dispose());
  let bad = false;
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(bad ? new Uint8Array(input.bytes.length) : input.bytes),
  );
  const manifest = catalog();
  const installer = api.createInstaller(session, manifest);
  await installer.install(manifest.entries[0]!.tool);
  bad = true;
  await assert.rejects(installer.install(manifest.entries[0]!.tool), {
    code: 'INVALID_INPUT',
  });
  assert.equal((await session.readFile('/work/seed'))[0], 7);
  const caller = new AbortController();
  caller.abort();
  await assert.rejects(
    installer.install(manifest.entries[0]!.tool, { signal: caller.signal }),
    { code: 'ABORTED' },
  );
  assert.equal((await session.readFile('/work/seed'))[0], 7);
});
test('installed progress reentry is BUSY and reset/dispose cancellation is classified by real owner', async (t) => {
  for (const owner of ['reset', 'dispose'] as const) {
    const session = await createSession();
    t.after(() => session.dispose());
    t.mock.method(globalThis, 'fetch', async () => new Response(input.bytes));
    const manifest = catalog();
    const installer = api.createInstaller(session, manifest);
    const busy: Promise<unknown>[] = [];
    let cleanup: Promise<void> | undefined;
    await assert.rejects(
      installer.install(manifest.entries[0]!.tool, {
        onProgress(event) {
          if (event.phase === 'fetch' && !cleanup) {
            busy.push(
              assert.rejects(installer.install(manifest.entries[0]!.tool), {
                code: 'BUSY',
              }),
            );
            cleanup = session[owner]();
          }
        },
      }),
      { code: owner === 'reset' ? 'ABORTED' : 'DISPOSED' },
    );
    await Promise.all(busy);
    await cleanup;
    if (owner === 'reset') await session.listEntries();
    else await assert.rejects(session.reset(), { code: 'DISPOSED' });
  }
});
