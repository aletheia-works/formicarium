import type {
  Assets,
  ControlChannel,
  CoreLoadOptions,
  CoreModule,
  ModuleOptions,
  ResourceDescriptor,
} from './contracts.js';

type GeneratedFactory = (
  options: Partial<ModuleOptions> & {
    wasmBinary: Uint8Array;
    locateFile(path: string): string;
  },
) => Promise<CoreModule>;
interface ResourceEntry {
  moduleURL: string;
  directory?: string;
  fs?: typeof import('node:fs/promises');
}
// エミュレータのコアの記述子。コア固有の知識はここだけに置く。
//
// コアは「wasm モジュール 1 つ＋起動用の JS」として扱う。起動用の JS は Emscripten の
// MODULARIZE 形式（ES モジュールの既定エクスポートがファクトリ）であることを前提にする。
// いまのコアは blink の fork（dist/blink/）。paludarium（Rust 版 blink）に置き換えるときは、
// この記述子を差し替える。

/** blink（fork）のコア */
export const blinkCore = {
  name: 'blink',
  /** プロジェクトのルートから見た、起動用 JS の場所 */
  loaderPath: 'dist/blink/blink.mjs',
  /** ビルド情報（コミットなど）の場所 */
  buildInfoPath: 'dist/blink/build-info.json',
  captureModule(module: CoreModule) {
    if (!module?.FS) throw new Error('Core did not provide a filesystem');
    return module;
  },
  /**
   * コアに渡すコマンドライン。blink は `blink [flags] <program> [args...]` の形で受け取る。
   * blink は -L がないと cwd に blink.log を作るので、先頭で /dev/null へ向ける。
   * 後ろの coreFlags の -L が優先されるので、診断ではログの場所を上書きできる。
   * @param {string} guestPath 仮想ファイルシステム上のゲストのパス
   * @param {string[]} args ゲストに渡す引数
   * @param {string[]} [coreFlags] コア自身へのフラグ（診断用。例：blink の -s はシステムコールの記録）
   */
  argv(
    guestPath: string,
    args: readonly string[],
    coreFlags: readonly string[] = [],
  ) {
    return ['-L', '/dev/null', ...coreFlags, guestPath, ...args];
  },
};

export const defaultCore = blinkCore;

/** Distribution layout is distinct from the legacy development dist descriptor. */
export function packageAssets(
  workerURL: string | URL,
): Record<keyof Assets, string> {
  return {
    loaderURL: new URL('../assets/blink.mjs', import.meta.url).href,
    wasmURL: new URL('../assets/blink.wasm', import.meta.url).href,
    buildInfoURL: new URL('../assets/build-info.json', import.meta.url).href,
    workerURL: new URL(workerURL).href,
  };
}

const digest = async (bytes: Uint8Array) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** Verify the asset tuple before evaluating the trusted generated loader. */
export async function loadPackageCore({
  assets,
  readBytes,
  childWorkers,
  resources,
  importModule = (url) => import(url),
}: CoreLoadOptions) {
  let loader: Uint8Array;
  let wasm: Uint8Array;
  let infoBytes: Uint8Array;
  let info: {
    blinkCommit: string;
    blinkSourceDirty: boolean;
    assetDigests?: { loaderSha256: string; wasmSha256: string };
  };
  try {
    [loader, wasm, infoBytes] = await Promise.all([
      readBytes(assets.loaderURL),
      readBytes(assets.wasmURL),
      readBytes(assets.buildInfoURL),
    ]);
    info = JSON.parse(new TextDecoder().decode(infoBytes));
    if (
      !loader.length ||
      !wasm.length ||
      !/^[0-9a-f]{40}$/.test(info.blinkCommit) ||
      info.blinkSourceDirty !== false
    )
      throw new Error('provenance');
    if (
      info.assetDigests?.loaderSha256 !== (await digest(loader)) ||
      info.assetDigests?.wasmSha256 !== (await digest(wasm))
    )
      throw new Error('asset digest');
  } catch {
    throw Object.assign(
      new Error('Core assets could not be loaded or verified'),
      { code: 'ASSET_LOAD' },
    );
  }
  const localOwner = resources
    ? null
    : createCoreResourceOwner({
        environment: globalThis.process?.versions?.node ? 'node' : 'browser',
        bootstrapURL: assets.workerURL,
      });
  const owner = resources ?? localOwner!;
  let descriptor: ResourceDescriptor;
  let restoreURL = () => {};
  let factory: unknown;
  try {
    descriptor = await owner.allocate(new Uint8Array(loader));
    restoreURL = installVerifiedLoaderURLBridge(descriptor);
    factory = (await importModule(descriptor.moduleURL)).default;
  } catch {
    restoreURL();
    await localOwner?.dispose();
    throw Object.assign(new Error('Core loader could not be imported'), {
      code: 'ASSET_LOAD',
    });
  }
  if (typeof factory !== 'function') {
    restoreURL();
    await localOwner?.dispose();
    throw Object.assign(new Error('Core factory is unavailable'), {
      code: 'CORE_INIT',
    });
  }
  const broker = childWorkers
    ? installChildWorkerBroker({ ...childWorkers, resource: descriptor })
    : null;
  let module: CoreModule | null = null;
  const core = {
    ...blinkCore,
    captureModule(value: CoreModule) {
      module = blinkCore.captureModule(value);
      return module;
    },
    cleanup() {
      broker?.dispose();
      restoreURL();
      if (localOwner) void localOwner.dispose();
      const owned = module;
      module = null;
      return Boolean(owned);
    },
  };
  const createModule = async (options: Partial<ModuleOptions>) => {
    try {
      return await (factory as GeneratedFactory)({
        ...options,
        wasmBinary: new Uint8Array(wasm),
        locateFile: (path: string) =>
          path.endsWith('.wasm')
            ? String(assets.wasmURL)
            : new URL(path, assets.loaderURL).href,
      });
    } catch (error) {
      if (
        (error instanceof Error && error.name === 'ExitStatus') ||
        error === 'unwind'
      )
        throw error;
      throw Object.assign(new Error('Core initialization failed'), {
        code: 'CORE_INIT',
      });
    }
  };
  return { createModule, core, buildInfo: info };
}

/** Keep generated pthread knowledge here; the host owns actual browser children. */
export function installChildWorkerBroker({
  post,
  subscribe,
  resource,
}: ControlChannel & { resource?: ResourceDescriptor }) {
  const Original = globalThis.Worker;
  const children = new Map<number, ChildWorker>();
  let next = 0;
  class ChildWorker extends EventTarget {
    id: number;
    onmessage?: (event: MessageEvent) => void;
    onerror?: (event: Event) => void;
    constructor(
      url: string | URL,
      options: WorkerOptions & { workerData?: unknown } = {},
    ) {
      super();
      this.id = ++next;
      children.set(this.id, this);
      // Emscripten emits the Node-only pthread marker even for browser Workers.
      const { workerData, ...browserOptions } = options;
      void workerData;
      post({
        type: 'child-create',
        childId: this.id,
        url: String(url),
        options: browserOptions,
        ...(resource ? { resourceId: resource.resourceId } : {}),
      });
    }
    postMessage(
      payload: unknown,
      transfer: Transferable[] | StructuredSerializeOptions = [],
    ) {
      post(
        { type: 'child-post', childId: this.id, payload },
        Array.isArray(transfer) ? transfer : (transfer.transfer ?? []),
      );
    }
    terminate() {
      children.delete(this.id);
      post({ type: 'child-terminate', childId: this.id });
    }
  }
  const unsubscribe = subscribe((message, ports = []) => {
    if (message.type !== 'child-message' && message.type !== 'child-error')
      return;
    const child = children.get(message.childId);
    if (!child) return;
    if (message.type === 'child-message') {
      const event = new MessageEvent('message', {
        data: message.payload,
        ports: [...ports],
      });
      child.onmessage?.(event);
      child.dispatchEvent(event);
    } else if (message.type === 'child-error') {
      const event = new Event('error');
      child.onerror?.(event);
      child.dispatchEvent(event);
    }
  });
  globalThis.Worker = ChildWorker as unknown as typeof Worker;
  return {
    Worker: ChildWorker,
    dispose() {
      for (const child of [...children.values()]) child.terminate();
      unsubscribe();
      if (globalThis.Worker === (ChildWorker as unknown as typeof Worker))
        globalThis.Worker = Original;
    },
  };
}

/** Host-owned run resources survive termination of the core Worker. */
export function createCoreResourceOwner({
  environment,
  bootstrapURL = '',
}: {
  environment: 'node' | 'browser';
  bootstrapURL?: string | URL;
}) {
  if (!['node', 'browser'].includes(environment))
    throw new Error('invalid resource environment');
  const entries = new Map<number, ResourceEntry>();
  let closed = false;
  let next = 0;
  let pending: Promise<unknown> = Promise.resolve();
  return {
    async allocate(bytes: Uint8Array): Promise<ResourceDescriptor> {
      if (closed || !(bytes instanceof Uint8Array) || !bytes.length)
        throw new Error('closed or invalid resource');
      const resourceId = ++next;
      let entry: ResourceEntry;
      const operation = (async () => {
        if (environment === 'node') {
          const fs = await import('node:fs/promises');
          const { tmpdir } = await import('node:os');
          const { join } = await import('node:path');
          const { pathToFileURL } = await import('node:url');
          const directory = await fs.mkdtemp(
            join(tmpdir(), 'formicarium-core-'),
          );
          entry = { directory, fs, moduleURL: '' };
          entries.set(resourceId, entry);
          await fs.chmod(directory, 0o700);
          const file = join(directory, 'blink.mjs');
          await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o400 });
          entry.moduleURL = pathToFileURL(file).href;
        } else {
          entry = {
            moduleURL: URL.createObjectURL(
              new Blob([new Uint8Array(bytes)], { type: 'text/javascript' }),
            ),
          };
          entries.set(resourceId, entry);
        }
        if (closed) throw new Error('resource creation cancelled');
        return {
          resourceId,
          moduleURL: entry.moduleURL,
          bootstrapURL:
            environment === 'node' ? entry.moduleURL : String(bootstrapURL),
        };
      })();
      pending = Promise.allSettled([pending, operation]);
      return operation;
    },
    get(resourceId: number) {
      return entries.get(resourceId);
    },
    async dispose() {
      closed = true;
      await pending;
      for (const entry of entries.values()) {
        if (entry.directory)
          await entry.fs?.rm(entry.directory, { recursive: true, force: true });
        else URL.revokeObjectURL(entry.moduleURL);
      }
      entries.clear();
    },
  };
}

/** The unmodified loader resolves its literal pthread name against import.meta.url. */
export function installVerifiedLoaderURLBridge(descriptor: ResourceDescriptor) {
  if (!descriptor.moduleURL.startsWith('blob:')) return () => {};
  const Original = globalThis.URL;
  class CoreURL extends Original {
    constructor(input: string | URL, base?: string | URL) {
      if (
        String(input) === 'blink.mjs' &&
        String(base) === descriptor.moduleURL
      )
        super(descriptor.bootstrapURL);
      else super(input, base);
    }
  }
  globalThis.URL = CoreURL;
  return () => {
    if (globalThis.URL === CoreURL) globalThis.URL = Original;
  };
}

/** Identity-bound resource allocation channel; replies are consumed before run messages. */
export function createCoreResourceClient({ post, subscribe }: ControlChannel) {
  let next = 0;
  const pending = new Map<
    number,
    { resolve(value: ResourceDescriptor): void; reject(error: unknown): void }
  >();
  const unsubscribe = subscribe((message) => {
    if (message.type !== 'resource-ready' && message.type !== 'resource-error')
      return;
    const request = pending.get(message.resourceRequestId);
    if (!request) return;
    pending.delete(message.resourceRequestId);
    if (message.type === 'resource-ready') request.resolve(message.descriptor);
    else request.reject(new Error('resource allocation failed'));
  });
  return {
    allocate(bytes: Uint8Array): Promise<ResourceDescriptor> {
      const resourceRequestId = ++next;
      return new Promise((resolve, reject) => {
        pending.set(resourceRequestId, { resolve, reject });
        post({ type: 'resource-create', resourceRequestId, bytes });
      });
    },
    detach() {
      unsubscribe();
      for (const request of pending.values())
        request.reject(new Error('resource channel closed'));
      pending.clear();
    },
  };
}

/** Browser pthread bootstrap buffers generated messages until the verified module is ready. */
export async function bootstrapVerifiedBrowserCore(
  descriptor: ResourceDescriptor,
) {
  if (
    !descriptor ||
    typeof descriptor.moduleURL !== 'string' ||
    !descriptor.moduleURL.startsWith(`blob:${location.origin}/`)
  )
    throw new Error('invalid verified module');
  const queued: MessageEvent[] = [];
  const buffer = (event: MessageEvent) => queued.push(event);
  self.addEventListener('message', buffer);
  const restore = installVerifiedLoaderURLBridge(descriptor);
  try {
    await import(descriptor.moduleURL);
    self.removeEventListener('message', buffer);
    for (const event of queued) self.onmessage?.(event);
  } finally {
    restore();
  }
}
