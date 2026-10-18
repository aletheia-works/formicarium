import { randomUUID } from 'node:crypto';
import {
  link,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AssetInput } from './assets.js';
import { ASSET_LIMITS, AssetError, sha256 } from './assets.js';

export const OFFICIAL_PINS = Object.freeze({
  aube: {
    version: '2.7.0',
    sourceCommit: 'd36fec01764689ef6d99a5e43de98925b571d67f',
    originalUrl:
      'https://github.com/aubepkg/aube/releases/download/v2.7.0/aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz',
    downloadSha256:
      'fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666',
    fileName: 'aube.tar.gz',
  },
  biome: {
    version: '2.5.15',
    sourceCommit: '0b4c11f553a7e702f9851af139662e1de45dc131',
    originalUrl:
      'https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.5.15/biome-linux-x64-musl',
    downloadSha256:
      '42b6fd3662fc1fc3075a370414478aa3ed82fd43d28430bbfb81ebd02cbde656',
    fileName: 'biome.elf',
  },
});
export interface MirrorEntry {
  tool: AssetInput['tool'];
  version: string;
  sourceCommit: string;
  originalUrl: string;
  mirrorUrl: string;
  file: string;
  sha256: string;
  bytes: number;
  upstreamFinalUrl: string | null;
  redirects: number | null;
  acquisition: 'verified-local-pin-reuse' | 'manual-HTTPS-download';
}
export interface MirrorManifest {
  schemaVersion: 1;
  sourceCommit: string;
  origin: string;
  entries: MirrorEntry[];
}
function secureUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new AssetError(
      'INVALID_INPUT',
      'mirror preparation requires credential-free HTTPS URLs',
    );
  return url;
}
export function mirrorOrigin(value: string): string {
  const url = secureUrl(value);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/' ||
    url.search ||
    url.port !== '4182'
  )
    throw new AssetError(
      'INVALID_INPUT',
      'mirror origin must be localhost HTTPS port 4182',
    );
  return url.origin;
}
function raceAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
/** Main-session-only upstream acquisition. Every redirect is inspected; a
 * browser never follows GitHub's unobservable redirect chain itself. */
export async function downloadPinned(options: {
  url: string;
  sha256: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  limit?: number;
}): Promise<{
  bytes: Uint8Array<ArrayBuffer>;
  finalUrl: string;
  redirects: number;
}> {
  if (!/^[0-9a-f]{64}$/.test(options.sha256))
    throw new AssetError('INVALID_INPUT', 'download pin SHA256 required');
  const timeout = options.timeoutMs ?? 120_000;
  const limit = options.limit ?? ASSET_LIMITS.download;
  if (
    !Number.isFinite(timeout) ||
    timeout <= 0 ||
    timeout > 120_000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > ASSET_LIMITS.download
  )
    throw new AssetError(
      'INVALID_INPUT',
      'cannot exceed C11 deadline or byte bound',
    );
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    let url = secureUrl(options.url);
    const seen = new Set<string>();
    let redirects = 0;
    while (true) {
      controller.signal.throwIfAborted();
      if (seen.has(url.href))
        throw new AssetError('ASSET_LOAD', 'upstream redirect loop');
      seen.add(url.href);
      const response = await raceAbort(
        (options.fetch ?? fetch)(url.href, {
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
          cache: 'no-store',
        }),
        controller.signal,
      );
      if (
        response.redirected ||
        response.type === 'opaque' ||
        response.type === 'opaqueredirect' ||
        (response.url && response.url !== url.href)
      ) {
        await response.body?.cancel();
        throw new AssetError('ASSET_LOAD', 'unobservable upstream redirect');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects >= 5)
          throw new AssetError(
            'ASSET_LOAD',
            'upstream redirect limit/location',
          );
        url = secureUrl(new URL(location, url).href);
        redirects++;
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new AssetError('ASSET_LOAD', 'upstream HTTP/body failure');
      }
      reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      const cancelReader = () => {
        void reader?.cancel().catch(() => {});
      };
      controller.signal.addEventListener('abort', cancelReader, { once: true });
      try {
        while (true) {
          const { value, done } = await raceAbort(
            reader.read(),
            controller.signal,
          );
          controller.signal.throwIfAborted();
          if (done) break;
          if (!(value instanceof Uint8Array))
            throw new AssetError('ASSET_LOAD', 'invalid upstream bytes');
          size += value.length;
          if (!Number.isSafeInteger(size) || size > limit)
            throw new AssetError(
              'INVALID_INPUT',
              'upstream byte limit exceeded',
            );
          parts.push(new Uint8Array(value));
        }
      } finally {
        controller.signal.removeEventListener('abort', cancelReader);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
      }
      if ((await sha256(bytes)) !== options.sha256)
        throw new AssetError('INVALID_INPUT', 'upstream digest mismatch');
      controller.signal.throwIfAborted();
      // Signed transient redirect query strings are not persisted to evidence.
      return { bytes, finalUrl: url.origin + url.pathname, redirects };
    }
  } catch (caught) {
    if (controller.signal.aborted)
      throw new AssetError(
        timedOut ? 'TIMEOUT' : 'ABORTED',
        timedOut ? 'upstream deadline expired' : 'upstream cancelled',
      );
    if (caught instanceof AssetError) throw caught;
    throw new AssetError('ASSET_LOAD', 'upstream URL/network/body failure');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
/** Same-filesystem hard-link publication is atomic and refuses an existing
 * destination. This preparation never replaces previous accepted inputs. */
export async function publishNewFile(
  file: string,
  bytes: Uint8Array,
): Promise<void> {
  const temporary = `${file}.${randomUUID()}.staging`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await link(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function prepareMirror(options: {
  inventory: string;
  output: string;
  origin: string;
  localFiles?: Partial<Record<AssetInput['tool'], string>>;
}) {
  const root = await realpath('.');
  const output = resolve(options.output);
  if (!output.startsWith(resolve(root, '.artifacts') + sep))
    throw Error('mirror output must be beneath project .artifacts');
  await mkdir(dirname(output), { recursive: true });
  if ((await realpath(dirname(output))) !== dirname(output))
    throw Error('symlink mirror output refused');
  // An attempt owns a new directory. EEXIST preserves every earlier attempt.
  await mkdir(output);
  const inventory = JSON.parse(await readFile(options.inventory, 'utf8')) as {
    schemaVersion: number;
    sourceCommit: string;
    assets: AssetInput[];
  };
  if (
    inventory.schemaVersion !== 1 ||
    !/^[0-9a-f]{40}$/.test(inventory.sourceCommit) ||
    !Array.isArray(inventory.assets) ||
    inventory.assets.length !== 2
  )
    throw Error('fixed official inventory required');
  const origin = mirrorOrigin(options.origin);
  const entries: MirrorEntry[] = [];
  const assets: AssetInput[] = [];
  for (const tool of ['aube', 'biome'] as const) {
    const matches = inventory.assets.filter((asset) => asset.tool === tool);
    const input = matches[0];
    const pin = OFFICIAL_PINS[tool];
    if (
      matches.length !== 1 ||
      !input ||
      input.version !== pin.version ||
      input.url !== pin.originalUrl ||
      input.downloadSha256 !== pin.downloadSha256 ||
      input.buildInfo.source.commit !== pin.sourceCommit
    )
      throw Error(`${tool}: official pinned identity mismatch`);
    const local = options.localFiles?.[tool];
    const downloaded = local
      ? {
          bytes: new Uint8Array(await readFile(local)),
          finalUrl: null,
          redirects: null,
        }
      : await downloadPinned({
          url: pin.originalUrl,
          sha256: pin.downloadSha256,
        });
    if (
      downloaded.bytes.length > ASSET_LIMITS.download ||
      (await sha256(downloaded.bytes)) !== pin.downloadSha256
    )
      throw Error(`${tool}: local byte pin mismatch`);
    const file = resolve(output, pin.fileName);
    await publishNewFile(file, downloaded.bytes);
    const mirrorUrl = `${origin}/mirror/${pin.fileName}`;
    entries.push({
      tool,
      version: pin.version,
      sourceCommit: pin.sourceCommit,
      originalUrl: pin.originalUrl,
      mirrorUrl,
      file,
      sha256: pin.downloadSha256,
      bytes: downloaded.bytes.length,
      upstreamFinalUrl: downloaded.finalUrl,
      redirects: downloaded.redirects,
      acquisition: local ? 'verified-local-pin-reuse' : 'manual-HTTPS-download',
    });
    assets.push({ ...input, url: mirrorUrl });
  }
  const manifest: MirrorManifest = {
    schemaVersion: 1,
    sourceCommit: inventory.sourceCommit,
    origin,
    entries,
  };
  await publishNewFile(
    resolve(output, 'mirror-manifest.json'),
    new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n'),
  );
  await publishNewFile(
    resolve(output, 'mirror-input.json'),
    new TextEncoder().encode(
      JSON.stringify({ ...inventory, assets, mirror: manifest }, null, 2) +
        '\n',
    ),
  );
  return manifest;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [inventory, output, origin, aube, biome, ...extra] =
    process.argv.slice(2);
  if (!inventory || !output || !origin || extra.length)
    throw Error(
      'usage: prepare-mirror.js <official-inventory> <new-output-dir> <https-localhost:4182> [local-aube] [local-biome]',
    );
  const manifest = await prepareMirror({
    inventory,
    output,
    origin,
    localFiles: { ...(aube ? { aube } : {}), ...(biome ? { biome } : {}) },
  });
  console.log(JSON.stringify(manifest));
}
