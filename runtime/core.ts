import type {
  Assets,
  ControlChannel,
  CoreLauncher,
  CoreLoadOptions,
  ResourceDescriptor,
} from './contracts.js';
import { isRecord } from './contracts.js';

// The emulator core. Knowledge specific to the core lives only here (ADR 0003).
//
// The core is paludarium (@aletheia-works/paludarium-wasm): an ES module that
// starts its own Workers from sibling modules, and one wasm binary. Package
// staging copies these files into assets/paludarium/ with a build-info.json
// that pins the version and the SHA-256 of every file.

export const CORE_PACKAGE = '@aletheia-works/paludarium-wasm';
export const CORE_MODULES = Object.freeze([
  'index.mjs',
  'coordinator.mjs',
  'execution.mjs',
  'worker-support.mjs',
  'jit-support.mjs',
  'filesystem-snapshot.mjs',
]);
export const CORE_WASM = 'paludarium.wasm';
export const CORE_FILES = Object.freeze([...CORE_MODULES, CORE_WASM]);

export interface CoreBuildInfo {
  schemaVersion: 1;
  core: 'paludarium';
  package: string;
  version: string;
  /** SHA-256 of each file in CORE_FILES. */
  files: Record<string, string>;
}

/** The core files in one directory, with the Worker that runs guests. */
export function coreAssets(
  directory: string | URL,
  workerURL: string | URL,
): Record<keyof Assets, string> {
  const base = new URL(directory);
  return {
    loaderURL: new URL('index.mjs', base).href,
    wasmURL: new URL(CORE_WASM, base).href,
    buildInfoURL: new URL('build-info.json', base).href,
    workerURL: new URL(workerURL).href,
  };
}

/** Distribution layout: the core sits in assets/paludarium/ of the package. */
export const packageAssets = (workerURL: string | URL) =>
  coreAssets(new URL('../assets/paludarium/', import.meta.url), workerURL);

export const sha256Hex = async (bytes: Uint8Array) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** The build information must name exactly the core files and their digests. */
export function validateCoreBuildInfo(value: unknown): CoreBuildInfo {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.core !== 'paludarium' ||
    value.package !== CORE_PACKAGE ||
    typeof value.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(value.version) ||
    !isRecord(value.files)
  )
    throw new Error('core build information');
  const files = value.files;
  if (
    JSON.stringify(Object.keys(files).sort()) !==
      JSON.stringify([...CORE_FILES].sort()) ||
    Object.values(files).some(
      (digest) => typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest),
    )
  )
    throw new Error('core file digests');
  return value as unknown as CoreBuildInfo;
}

const assetFailure = (message: string) =>
  Object.assign(new Error(message), { code: 'ASSET_LOAD' });
const initFailure = (message: string) =>
  Object.assign(new Error(message), { code: 'CORE_INIT' });

/**
 * Verifies every core file against the build information, then starts the
 * core. In Node.js the verified bytes are written to a private directory
 * (resources) and loaded from there. Browsers load the core from the asset
 * URLs after their bytes were verified, because its modules start sibling
 * Workers relative to their own URL.
 */
export async function loadPackageCore({
  assets,
  readBytes,
  resources,
  importModule = (url) => import(url),
}: CoreLoadOptions) {
  let info: CoreBuildInfo;
  const files: Record<string, Uint8Array> = {};
  try {
    info = validateCoreBuildInfo(
      JSON.parse(
        new TextDecoder().decode(await readBytes(assets.buildInfoURL)),
      ),
    );
    const loader = new URL(assets.loaderURL);
    if (!loader.pathname.endsWith('/index.mjs')) throw new Error('loader');
    const read = await Promise.all(
      CORE_FILES.map((name) =>
        readBytes(name === CORE_WASM ? assets.wasmURL : new URL(name, loader)),
      ),
    );
    for (const [index, name] of CORE_FILES.entries()) {
      const bytes = read[index]!;
      if (!bytes.length || (await sha256Hex(bytes)) !== info.files[name])
        throw new Error(`digest ${name}`);
      files[name] = bytes;
    }
  } catch {
    throw assetFailure('Core assets could not be loaded or verified');
  }
  let descriptor: ResourceDescriptor | undefined;
  let factory: unknown;
  try {
    descriptor = await resources?.allocate(files);
    factory = (
      await importModule(descriptor?.moduleURL ?? String(assets.loaderURL))
    ).createPaludarium;
  } catch {
    throw assetFailure('Core loader could not be imported');
  }
  if (typeof factory !== 'function')
    throw initFailure('Core factory is unavailable');
  let launcher: CoreLauncher;
  try {
    launcher = await (
      factory as (options: { wasmUrl: string }) => Promise<CoreLauncher>
    )({ wasmUrl: descriptor?.wasmURL ?? String(assets.wasmURL) });
  } catch {
    throw initFailure('Core initialization failed');
  }
  return {
    launcher,
    buildInfo: info,
    async cleanup() {
      await launcher.dispose();
    },
  };
}

/** Host-owned core files survive termination of the Worker that imports them. */
export function createCoreResourceOwner() {
  const entries = new Map<
    number,
    { directory: string; fs: typeof import('node:fs/promises') }
  >();
  let closed = false;
  let next = 0;
  let pending: Promise<unknown> = Promise.resolve();
  return {
    async allocate(
      files: Record<string, Uint8Array>,
    ): Promise<ResourceDescriptor> {
      if (
        closed ||
        JSON.stringify(Object.keys(files).sort()) !==
          JSON.stringify([...CORE_FILES].sort()) ||
        Object.values(files).some(
          (bytes) => !(bytes instanceof Uint8Array) || !bytes.length,
        )
      )
        throw new Error('closed or invalid resource');
      const resourceId = ++next;
      const operation = (async () => {
        const fs = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        const { pathToFileURL } = await import('node:url');
        const directory = await fs.mkdtemp(join(tmpdir(), 'formicarium-core-'));
        entries.set(resourceId, { directory, fs });
        await fs.chmod(directory, 0o700);
        for (const [name, bytes] of Object.entries(files))
          await fs.writeFile(join(directory, name), bytes, {
            flag: 'wx',
            mode: 0o400,
          });
        if (closed) throw new Error('resource creation cancelled');
        return {
          resourceId,
          moduleURL: pathToFileURL(join(directory, 'index.mjs')).href,
          wasmURL: pathToFileURL(join(directory, CORE_WASM)).href,
        };
      })();
      pending = Promise.allSettled([pending, operation]);
      return operation;
    },
    async dispose() {
      closed = true;
      await pending;
      for (const { directory, fs } of entries.values())
        await fs.rm(directory, { recursive: true, force: true });
      entries.clear();
    },
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
    allocate(files: Record<string, Uint8Array>): Promise<ResourceDescriptor> {
      const resourceRequestId = ++next;
      return new Promise((resolve, reject) => {
        pending.set(resourceRequestId, { resolve, reject });
        post({ type: 'resource-create', resourceRequestId, files });
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
