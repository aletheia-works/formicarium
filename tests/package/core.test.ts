import type {
  ControlChannel,
  CoreLauncher,
  ResourceDescriptor,
} from '../../runtime/contracts.js';

interface Posted {
  type: string;
  resourceRequestId: number;
  files?: Record<string, Uint8Array>;
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  CORE_FILES,
  CORE_PACKAGE,
  CORE_WASM,
  createCoreResourceClient,
  createCoreResourceOwner,
  loadPackageCore,
  packageAssets,
  validateCoreBuildInfo,
} from '../../runtime/core.js';
import type { ExecutionError } from '../../runtime/errors.js';
import { runGuest } from '../../runtime/guest-io.js';
import { developmentAssets, fakeLauncher } from './fixtures.js';

const BASE = 'https://example.test/assets/paludarium/';

/** Core files served from memory, with build information that matches them. */
function assetsFixture() {
  const files: Record<string, Uint8Array> = Object.fromEntries(
    CORE_FILES.map((name, index) => [
      name,
      new TextEncoder().encode(`${name} ${index}`),
    ]),
  );
  const info = {
    schemaVersion: 1,
    core: 'paludarium',
    package: CORE_PACKAGE,
    version: '0.3.0',
    files: Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [
        name,
        createHash('sha256').update(bytes).digest('hex'),
      ]),
    ),
  } as Record<string, unknown> & { files: Record<string, string> };
  const reads: string[] = [];
  return {
    files,
    info,
    reads,
    assets: {
      loaderURL: `${BASE}index.mjs`,
      wasmURL: `${BASE}${CORE_WASM}`,
      buildInfoURL: `${BASE}build-info.json`,
      workerURL: 'https://example.test/runtime/web/package-worker.js',
    },
    async readBytes(url: string | URL) {
      const href = String(url);
      reads.push(href);
      if (href === `${BASE}build-info.json`)
        return new TextEncoder().encode(JSON.stringify(info));
      const bytes = files[href.slice(BASE.length)];
      if (!bytes) throw new Error(`missing ${href}`);
      return bytes;
    },
  };
}

const factoryModule = (launcher: CoreLauncher = fakeLauncher()) => {
  const calls: { wasmUrl: string }[] = [];
  return {
    calls,
    module: {
      createPaludarium: async (options: { wasmUrl: string }) => {
        calls.push(options);
        return launcher;
      },
    },
  };
};

test('package assets name the core directory next to the runtime', () => {
  const assets = packageAssets('https://example.test/worker.js');
  assert.ok(assets.loaderURL.endsWith('/assets/paludarium/index.mjs'));
  assert.ok(assets.wasmURL.endsWith('/assets/paludarium/paludarium.wasm'));
  assert.ok(assets.buildInfoURL.endsWith('/assets/paludarium/build-info.json'));
  assert.equal(assets.workerURL, 'https://example.test/worker.js');
});

test('build information must list exactly the core files with SHA-256 digests', () => {
  const { info } = assetsFixture();
  assert.equal(validateCoreBuildInfo(info), info);
  for (const change of [
    { core: 'other-core' },
    { package: 'other' },
    { version: 'latest' },
    { files: { ...info.files, extra: info.files[CORE_WASM] } },
    { files: { ...info.files, [CORE_WASM]: 'ab' } },
  ])
    assert.throws(() => validateCoreBuildInfo({ ...info, ...change }));
  const { [CORE_WASM]: _, ...missing } = info.files;
  assert.throws(() => validateCoreBuildInfo({ ...info, files: missing }));
});

test('every core file is verified before the browser imports the loader', async () => {
  const fixture = assetsFixture();
  const launcher = fakeLauncher();
  const { calls, module } = factoryModule(launcher);
  const imported: string[] = [];
  const adapter = await loadPackageCore({
    ...fixture,
    importModule: async (url) => {
      imported.push(url);
      return module;
    },
  });
  assert.deepEqual(imported, [fixture.assets.loaderURL]);
  assert.equal(fixture.reads.length, CORE_FILES.length + 1);
  assert.deepEqual(calls, [{ wasmUrl: fixture.assets.wasmURL }]);
  assert.equal(adapter.launcher, launcher);
  assert.equal(adapter.buildInfo.version, '0.3.0');
  await adapter.cleanup();
  assert.equal(launcher.state.disposed, 1);
});

test('changed, missing or unreadable files fail without importing the core', async () => {
  for (const mutate of [
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.files[CORE_WASM]![0] = 255;
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.files['coordinator.mjs']![0] = 0;
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.files['jit-support.mjs'] = new Uint8Array();
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.info.core = 'other-core';
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.assets.loaderURL = `${BASE}other.mjs`;
    },
  ]) {
    const fixture = assetsFixture();
    mutate(fixture);
    await assert.rejects(
      loadPackageCore({
        ...fixture,
        importModule: async () => assert.fail('core must not import'),
      }),
      { code: 'ASSET_LOAD' },
    );
  }
  await assert.rejects(
    loadPackageCore({
      ...assetsFixture(),
      readBytes: async () => {
        throw new Error('secret');
      },
    }),
    (error: ExecutionError) =>
      error.code === 'ASSET_LOAD' && !error.message.includes('secret'),
  );
});

test('import failure, a missing factory and factory rejection are classified', async () => {
  await assert.rejects(
    loadPackageCore({
      ...assetsFixture(),
      importModule: async () => {
        throw new Error('secret');
      },
    }),
    { code: 'ASSET_LOAD' },
  );
  await assert.rejects(
    loadPackageCore({
      ...assetsFixture(),
      importModule: async () => ({ createPaludarium: 1 }),
    }),
    { code: 'CORE_INIT' },
  );
  await assert.rejects(
    loadPackageCore({
      ...assetsFixture(),
      importModule: async () => ({
        createPaludarium: async () => {
          throw new Error('secret');
        },
      }),
    }),
    (error: ExecutionError) =>
      error.code === 'CORE_INIT' && !error.message.includes('secret'),
  );
  // The core's error stays as the cause, so a RangeError or a WebAssembly
  // error behind CORE_INIT can reach the host.
  const memory = new RangeError('could not allocate memory');
  await assert.rejects(
    loadPackageCore({
      ...assetsFixture(),
      importModule: async () => ({
        createPaludarium: async () => {
          throw memory;
        },
      }),
    }),
    (error: ExecutionError) =>
      error.code === 'CORE_INIT' && error.cause === memory,
  );
});

test('Node.js imports the core from the host-owned copy of the verified files', async () => {
  const fixture = assetsFixture();
  const { calls, module } = factoryModule();
  const allocated: Record<string, Uint8Array>[] = [];
  const descriptor: ResourceDescriptor = {
    resourceId: 1,
    moduleURL: 'file:///private/core/index.mjs',
    wasmURL: 'file:///private/core/paludarium.wasm',
  };
  const imported: string[] = [];
  await loadPackageCore({
    ...fixture,
    resources: {
      allocate: async (files) => {
        allocated.push(files);
        return descriptor;
      },
    },
    importModule: async (url) => {
      imported.push(url);
      return module;
    },
  });
  assert.deepEqual(
    Object.keys(allocated[0] ?? {}).sort(),
    [...CORE_FILES].sort(),
  );
  assert.deepEqual(allocated[0]?.[CORE_WASM], fixture.files[CORE_WASM]);
  assert.deepEqual(imported, [descriptor.moduleURL]);
  assert.deepEqual(calls, [{ wasmUrl: descriptor.wasmURL }]);
});

test('Node host owns exclusive read-only core files until disposal', {
  skip:
    process.platform === 'win32'
      ? 'POSIX permission bits require a Unix filesystem; run this test in Linux.'
      : false,
}, async () => {
  const { stat, readFile, access } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { files } = assetsFixture();
  const owner = createCoreResourceOwner();
  const descriptor = await owner.allocate(files);
  const loader = fileURLToPath(descriptor.moduleURL);
  const directory = dirname(loader);
  try {
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(loader)).mode & 0o777, 0o400);
    assert.deepEqual(
      new Uint8Array(await readFile(loader)),
      files['index.mjs'],
    );
    assert.equal(dirname(fileURLToPath(descriptor.wasmURL)), directory);
    await assert.rejects(owner.allocate({ 'index.mjs': files['index.mjs']! }));
  } finally {
    await owner.dispose();
  }
  await assert.rejects(access(directory), { code: 'ENOENT' });
  await assert.rejects(owner.allocate(files), /closed/);
});

test('host disposal during allocation removes late-created resources', async () => {
  const owner = createCoreResourceOwner();
  const allocating = owner.allocate(assetsFixture().files);
  const rejected = assert.rejects(allocating, /cancelled/);
  await owner.dispose();
  await rejected;
});

test('resource client resolves descriptors and rejects allocation errors or detached pending requests', async () => {
  let receive!: Parameters<ControlChannel['subscribe']>[0];
  const sent: Posted[] = [];
  let detached = false;
  const client = createCoreResourceClient({
    post: (message) => sent.push(message as Posted),
    subscribe: (callback) => {
      receive = callback;
      return () => {
        detached = true;
      };
    },
  });
  const files = { 'index.mjs': Uint8Array.of(1) };
  const first = client.allocate(files);
  assert.equal(sent[0]?.files, files);
  const descriptor: ResourceDescriptor = {
    resourceId: 1,
    moduleURL: 'file:///private/core/index.mjs',
    wasmURL: 'file:///private/core/paludarium.wasm',
  };
  receive({ type: 'unrelated' });
  receive({ type: 'resource-ready', resourceRequestId: 999, descriptor });
  receive({
    type: 'resource-ready',
    resourceRequestId: sent[0]!.resourceRequestId,
    descriptor,
  });
  assert.equal(await first, descriptor);
  const failed = client.allocate(files);
  const error = assert.rejects(failed, /allocation failed/);
  receive({
    type: 'resource-error',
    resourceRequestId: sent[1]!.resourceRequestId,
  });
  await error;
  const pending = client.allocate(files);
  const closed = assert.rejects(pending, /closed/);
  client.detach();
  await closed;
  assert.equal(detached, true);
});

test('a real guest run through the development core prints its output', async (t) => {
  const { readFile } = await import('node:fs/promises');
  const owner = createCoreResourceOwner();
  t.after(() => owner.dispose());
  const adapter = await loadPackageCore({
    assets: await developmentAssets(t),
    readBytes: async (url) => new Uint8Array(await readFile(new URL(url))),
    resources: owner,
  });
  t.after(() => adapter.cleanup());
  const guest = new Uint8Array(
    await readFile(
      new URL('../../.artifacts/u1-fixture/guest', import.meta.url),
    ),
  );
  const result = await runGuest({
    launcher: adapter.launcher,
    guestPath: '/guest/program',
    entries: [
      { path: '/guest/program', type: 'file', data: guest, mode: 0o755 },
    ],
    snapshotRoots: ['/work'],
  });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
});

test('real generated loader mutation never executes unverified original URL bytes', async (t) => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { mutatedLoaderFixture } = await import('./loader-mutation.js');
  const directory = await mkdtemp(join(tmpdir(), 'formicarium-loader-red-'));
  const fixture = await mutatedLoaderFixture(
    directory,
    fileURLToPath(new URL('../../dist/paludarium/', import.meta.url)),
  );
  const adapter = await loadPackageCore(fixture);
  t.after(async () => {
    await adapter.cleanup();
    await fixture.dispose();
    delete (globalThis as unknown as Record<string, unknown>)[fixture.marker];
    await rm(directory, { recursive: true, force: true });
  });
  const guest = new Uint8Array(
    await readFile(
      new URL('../../.artifacts/u1-fixture/guest', import.meta.url),
    ),
  );
  const result = await runGuest({
    launcher: adapter.launcher,
    guestPath: '/guest/program',
    entries: [
      { path: '/guest/program', type: 'file', data: guest, mode: 0o755 },
    ],
  });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
  assert.equal(
    (globalThis as unknown as Record<string, unknown>)[fixture.marker] ?? 0,
    0,
    'changed original URL marker executed despite digest verification',
  );
});
