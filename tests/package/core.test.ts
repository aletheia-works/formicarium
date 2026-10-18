import type {
  ControlChannel,
  ResourceDescriptor,
} from '../../runtime/contracts.js';

interface Posted {
  type: string;
  childId: number;
  resourceRequestId: number;
  options?: WorkerOptions;
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  blinkCore,
  installChildWorkerBroker,
  loadPackageCore,
  packageAssets,
} from '../../runtime/core.js';
import type { ExecutionError } from '../../runtime/errors.js';
import { runGuest } from '../../runtime/guest-io.js';
import { entryAt } from '../shared/assertions.js';
import { fileEntry, memoryFs } from './fixtures.js';

test('core execution retains preRun FS when onExit precedes factory Promise resolution', async () => {
  const FS = memoryFs();
  const result = await runGuest({
    core: blinkCore,
    guestPath: '/guest/test',
    entries: [fileEntry()],
    snapshotRoots: ['/work'],
    createModule(options) {
      const module = { FS, ENV: {} };
      for (const preRun of options.preRun) preRun(module);
      options.onExit(3);
      return Promise.resolve(module);
    },
  });
  assert.equal(result.exitCode, 3);
  assert.ok(
    Array.isArray(result.snapshot),
    'normal exit requires the preRun FS snapshot',
  );
  assert.deepEqual(
    entryAt(result.snapshot, '/work/input', 'file').data,
    Uint8Array.of(1, 2),
  );
});

function assetsFixture() {
  const assets = packageAssets(
    new URL('../../runtime/node/package-worker.js', import.meta.url),
  );
  const loader = new TextEncoder().encode('fixture');
  const wasm = Uint8Array.of(0, 97, 115, 109);
  const hash = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');
  const info: {
    blinkCommit: string;
    blinkSourceDirty: boolean;
    assetDigests: { loaderSha256?: string; wasmSha256?: string };
  } = {
    blinkCommit: 'a'.repeat(40),
    blinkSourceDirty: false,
    assetDigests: { loaderSha256: hash(loader), wasmSha256: hash(wasm) },
  };
  const readBytes = (url: string | URL) =>
    Promise.resolve(
      url === assets.loaderURL
        ? loader
        : url === assets.wasmURL
          ? wasm
          : new TextEncoder().encode(JSON.stringify(info)),
    );
  return { assets, loader, wasm, info, readBytes };
}
test('core descriptor owns argv and package-relative asset layout', () => {
  assert.deepEqual(blinkCore.argv('/guest/program', ['one'], ['-s']), [
    '-L',
    '/dev/null',
    '-s',
    '/guest/program',
    'one',
  ]);
  const assets = packageAssets('https://example.test/worker.js');
  assert.ok(assets.loaderURL.endsWith('/assets/blink.mjs'));
  assert.ok(assets.wasmURL.endsWith('/assets/blink.wasm'));
  assert.equal(assets.workerURL, 'https://example.test/worker.js');
});
test('core tuple is verified before import and wasm configuration is copied', async () => {
  const fixture = assetsFixture();
  let imported = 0;
  let options!: { wasmBinary: Uint8Array; locateFile(path: string): string };
  const adapter = await loadPackageCore({
    ...fixture,
    importModule: async () => {
      imported++;
      return {
        default: async (value: typeof options) => {
          options = value;
          return {};
        },
      };
    },
  });
  await adapter.createModule({ noInitialRun: false });
  assert.equal(imported, 1);
  assert.deepEqual(options.wasmBinary, fixture.wasm);
  assert.notEqual(options.wasmBinary, fixture.wasm);
  assert.equal(options.locateFile('blink.wasm'), fixture.assets.wasmURL);
});
test('mixed, missing and dirty assets fail without importing guest core', async () => {
  for (const mutate of [
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.wasm[0] = 255;
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.info.blinkSourceDirty = true;
    },
    (fixture: ReturnType<typeof assetsFixture>) => {
      fixture.info.assetDigests = {};
    },
  ]) {
    const fixture = assetsFixture();
    mutate(fixture);
    await assert.rejects(
      loadPackageCore({
        ...fixture,
        importModule: async () => {
          assert.fail('core must not import');
        },
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
    { code: 'ASSET_LOAD' },
  );
});
test('loader import failure and unavailable factory are classified separately', async () => {
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
      importModule: async () => ({ default: 1 }),
    }),
    { code: 'CORE_INIT' },
  );
});
test('factory rejection is safe CORE_INIT and preRun capture requires FS', async () => {
  const adapter = await loadPackageCore({
    ...assetsFixture(),
    importModule: async () => ({
      default: async () => {
        throw new Error('secret');
      },
    }),
  });
  await assert.rejects(
    adapter.createModule({}),
    (error: ExecutionError) =>
      error.code === 'CORE_INIT' && !error.message.includes('secret'),
  );
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  assert.throws(() => adapter.core.captureModule({}), /filesystem/);
  adapter.core.captureModule({ FS: memoryFs(), ENV: {} });
  assert.equal(adapter.core.cleanup(), true);
  assert.equal(adapter.core.cleanup(), false);
});

test('core child proxy relays ordered create/post and message callbacks', () => {
  const original = globalThis.Worker;
  const sent: { message: Posted; transfer?: Transferable[] }[] = [];
  let receive!: Parameters<ControlChannel['subscribe']>[0];
  const broker = installChildWorkerBroker({
    post: (message, transfer) =>
      sent.push({ message: message as Posted, transfer }),
    subscribe: (callback) => {
      receive = callback;
      return () => {};
    },
  });
  try {
    const worker = new broker.Worker('https://example.test/helper.mjs', {
      type: 'module',
      name: 'em-pthread',
      workerData: 'em-pthread',
    });
    let result: unknown;
    worker.onmessage = ({ data }) => {
      result = data;
    };
    worker.postMessage({ value: 9 });
    receive({ type: 'child-message', childId: 1, payload: { value: 7 } });
    assert.deepEqual(
      sent.map((row) => row.message.type),
      ['child-create', 'child-post'],
    );
    assert.deepEqual(sent[0].message.options, {
      type: 'module',
      name: 'em-pthread',
    });
    assert.deepEqual(result, { value: 7 });
  } finally {
    broker.dispose();
    assert.equal(globalThis.Worker, original);
  }
});
test('core child proxy retains MessagePort transfer list and dispatches ports', () => {
  let receive!: Parameters<ControlChannel['subscribe']>[0];
  let transferred!: Transferable[];
  const broker = installChildWorkerBroker({
    post: (_, transfer) => {
      transferred = transfer!;
    },
    subscribe: (callback) => {
      receive = callback;
      return () => {};
    },
  });
  const channel = new MessageChannel();
  try {
    const worker = new broker.Worker('https://example.test/helper.mjs');
    worker.postMessage({ port: channel.port1 }, [channel.port1]);
    assert.equal(transferred[0], channel.port1);
    let port: MessagePort | undefined;
    worker.addEventListener('message', (event) => {
      port = (event as MessageEvent).ports[0];
    });
    receive({ type: 'child-message', childId: 1, payload: {} }, [
      channel.port2,
    ]);
    assert.equal(port, channel.port2);
  } finally {
    broker.dispose();
    channel.port1.close();
    channel.port2.close();
  }
});
test('core child cleanup terminates every remaining child and ignores stale replies', () => {
  const sent: Posted[] = [];
  let receive!: Parameters<ControlChannel['subscribe']>[0];
  let unsubscribed = false;
  const broker = installChildWorkerBroker({
    post: (message) => sent.push(message as Posted),
    subscribe: (callback) => {
      receive = callback;
      return () => {
        unsubscribed = true;
      };
    },
  });
  const first = new broker.Worker('https://example.test/a');
  const second = new broker.Worker('https://example.test/b');
  let received = false;
  first.onmessage = () => {
    received = true;
  };
  first.terminate();
  receive({ type: 'child-message', childId: first.id, payload: {} });
  broker.dispose();
  assert.equal(received, false);
  assert.equal(unsubscribed, true);
  assert.deepEqual(
    sent
      .filter((row) => row.type === 'child-terminate')
      .map((row) => row.childId),
    [first.id, second.id],
  );
});

test('real generated loader mutation never executes unverified original URL bytes', async (t) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'formicarium-loader-red-'));
  const { mutatedLoaderFixture } = await import('./loader-mutation.js');
  const { fileURLToPath } = await import('node:url');
  const { readFile } = await import('node:fs/promises');
  const fixture = await mutatedLoaderFixture(
    directory,
    fileURLToPath(new URL('../../dist/blink/', import.meta.url)),
  );
  const adapter = await loadPackageCore(fixture);
  t.after(async () => {
    adapter.core.cleanup();
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
    createModule: adapter.createModule,
    core: adapter.core,
    guestPath: '/guest/program',
    entries: [
      {
        path: '/guest/program',
        type: 'file' as const,
        data: guest,
        mode: 0o755,
      },
    ],
    args: [],
    env: {},
    cwd: '/work',
    snapshotRoots: ['/work'],
  });
  assert.equal(result.exitCode, 0);
  assert.equal(new TextDecoder().decode(result.stdout), 'fixture-ok\n');
  assert.equal(
    (globalThis as unknown as Record<string, unknown>)[fixture.marker] ?? 0,
    0,
    'changed original URL marker executed despite digest verification',
  );
});

test('Node host owns exclusive read-only checked loader bytes through forced-root cleanup', {
  skip:
    process.platform === 'win32'
      ? 'POSIX permission bits require a Unix filesystem; run this test in Linux.'
      : false,
}, async () => {
  const { createCoreResourceOwner } = await import('../../runtime/core.js');
  const { stat, readFile, access } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const owner = createCoreResourceOwner({ environment: 'node' });
  const bytes = new TextEncoder().encode('export default () => 7;');
  const descriptor = await owner.allocate(bytes);
  const file = fileURLToPath(descriptor.moduleURL);
  const directory = dirname(file);
  try {
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(file)).mode & 0o777, 0o400);
    assert.deepEqual(new Uint8Array(await readFile(file)), bytes);
    assert.equal(descriptor.bootstrapURL, descriptor.moduleURL);
    assert.equal(
      owner.get(descriptor.resourceId)?.moduleURL,
      descriptor.moduleURL,
    );
  } finally {
    await owner.dispose();
  }
  await assert.rejects(access(directory), { code: 'ENOENT' });
  await assert.rejects(owner.allocate(bytes), /closed/);
});
test('host disposal during allocation removes late-created resources', async () => {
  const { createCoreResourceOwner } = await import('../../runtime/core.js');
  const owner = createCoreResourceOwner({ environment: 'node' });
  const allocating = owner.allocate(new Uint8Array([1]));
  const rejected = assert.rejects(allocating, /cancelled/);
  await owner.dispose();
  await rejected;
  assert.equal(owner.get(1), undefined);
});
test('verified Blob bridge maps only literal pthread path and owned base', async () => {
  const { installVerifiedLoaderURLBridge } = await import(
    '../../runtime/core.js'
  );
  const Original = globalThis.URL;
  const descriptor = {
    resourceId: 1,
    moduleURL: 'blob:https://example.test/id',
    bootstrapURL: 'https://example.test/runtime/web/package-worker.js',
  };
  const restore = installVerifiedLoaderURLBridge(descriptor);
  try {
    assert.equal(
      new URL('blink.mjs', descriptor.moduleURL).href,
      descriptor.bootstrapURL,
    );
    assert.throws(() => new URL('other.mjs', descriptor.moduleURL));
    assert.throws(
      () => new URL('blink.mjs', 'blob:https://example.test/other'),
    );
    assert.equal(
      new URL('child.mjs', 'https://example.test/root.mjs').href,
      'https://example.test/child.mjs',
    );
  } finally {
    restore();
  }
  assert.equal(globalThis.URL, Original);
});

test('resource client resolves descriptors and rejects allocation errors or detached pending requests', async () => {
  const { createCoreResourceClient } = await import('../../runtime/core.js');
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
  const first = client.allocate(Uint8Array.of(1));
  const descriptor: ResourceDescriptor = {
    resourceId: 1,
    moduleURL: 'file:///private/checked.mjs',
    bootstrapURL: 'file:///private/checked.mjs',
  };
  receive({ type: 'unrelated' });
  receive({ type: 'resource-ready', resourceRequestId: 999, descriptor });
  receive({
    type: 'resource-ready',
    resourceRequestId: sent[0].resourceRequestId,
    descriptor,
  });
  assert.equal(await first, descriptor);
  const failed = client.allocate(Uint8Array.of(2));
  const error = assert.rejects(failed, /allocation failed/);
  receive({
    type: 'resource-error',
    resourceRequestId: sent[1].resourceRequestId,
  });
  await error;
  const pending = client.allocate(Uint8Array.of(3));
  const closed = assert.rejects(pending, /closed/);
  client.detach();
  await closed;
  assert.equal(detached, true);
});
