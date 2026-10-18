import { validateGuestElf } from '../../integration/terrarium/guest-distribution/resolver.js';

export interface AssetLimits {
  download: number;
  expanded: number;
  elf: number;
  metadata: number;
  entries: number;
  path: number;
}
export const ASSET_LIMITS: Readonly<AssetLimits> = Object.freeze({
  download: 128 * 1024 * 1024,
  expanded: 256 * 1024 * 1024,
  elf: 128 * 1024 * 1024,
  metadata: 1024 * 1024,
  entries: 4096,
  path: 4096,
});
export interface BuildIdentity {
  schemaVersion: 1;
  tool: string;
  versionOrName: string;
  source: { repository: string; commit: string };
  target: 'x86_64-unknown-linux-musl';
  rustc: string | null;
  sourcePatches: readonly { name: string; sha256: string }[];
  dependencies: readonly {
    tool: string;
    repository: string;
    commit: string;
    digest: string;
  }[];
  builderHash: string;
  buildKey: string;
  elfSha256: string;
  [key: string]: unknown;
}
export interface AssetInput {
  tool: 'aube' | 'biome';
  version: string;
  url: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
  downloadSha256: string;
  elfSha256: string;
  buildInfoSha256: string;
  buildInfo: BuildIdentity;
}
export class AssetError extends Error {
  readonly code: 'INVALID_INPUT' | 'ASSET_LOAD' | 'TIMEOUT' | 'ABORTED';
  constructor(
    code: 'INVALID_INPUT' | 'ASSET_LOAD' | 'TIMEOUT' | 'ABORTED',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const digestPattern = /^[0-9a-f]{64}$/;
function invalid(message: string): never {
  throw new AssetError('INVALID_INPUT', message);
}
function required(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    /[\uD800-\uDFFF]/u.test(
      value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''),
    )
  )
    invalid(`${field}: invalid string`);
}
function digest(value: unknown, field: string): void {
  required(value, field);
  if (!digestPattern.test(value)) invalid(`${field}: SHA256 required`);
}
function httpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid('URL: invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    invalid('URL: HTTPS without credentials/fragment required');
  return url;
}
/** C11 canonical JSON: no coercion, unsafe integers, undefined or lone surrogates. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'string') {
    required(value || 'empty', 'canonical string');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      invalid('canonical JSON: safe integer required');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${canonicalJson(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return invalid('canonical JSON: unsupported value');
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const result = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  return [...result].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function buildKey(identity: BuildIdentity): Promise<string> {
  const {
    tool,
    source,
    builderHash,
    target,
    rustc,
    sourcePatches,
    dependencies,
  } = identity;
  const sorted = [...dependencies].sort((a, b) => {
    const first = `${a.tool}/${a.repository}/${a.commit}`;
    const second = `${b.tool}/${b.repository}/${b.commit}`;
    return first < second ? -1 : first > second ? 1 : 0;
  });
  return sha256(
    encoder.encode(
      canonicalJson({
        tool,
        repository: source.repository,
        commit: source.commit,
        builderHash,
        target,
        rustc,
        sourcePatches,
        dependencies: sorted,
      }),
    ),
  );
}
function validateIdentity(input: AssetInput): void {
  const info = input.buildInfo;
  if (
    !info ||
    info.schemaVersion !== 1 ||
    info.tool !== input.tool ||
    info.versionOrName !== input.version ||
    info.target !== 'x86_64-unknown-linux-musl'
  )
    invalid('metadata: tool/version/schema/target mismatch');
  if (!info.source || !/^[0-9a-f]{40}$/.test(info.source.commit))
    invalid('metadata: full source commit required');
  httpsUrl(info.source.repository);
  if (info.rustc !== null) required(info.rustc, 'metadata.rustc');
  if (!Array.isArray(info.sourcePatches) || !Array.isArray(info.dependencies))
    invalid('metadata: patch/dependency inventory required');
  const patches = new Set<string>();
  const dependencies = new Set<string>();
  for (const patch of info.sourcePatches) {
    required(patch.name, 'patch.name');
    digest(patch.sha256, 'patch.sha256');
    if (patches.has(patch.name)) invalid('metadata: duplicate patch');
    patches.add(patch.name);
  }
  for (const dependency of info.dependencies) {
    required(dependency.tool, 'dependency.tool');
    httpsUrl(dependency.repository);
    digest(dependency.digest, 'dependency.digest');
    if (!/^[0-9a-f]{40}$/.test(dependency.commit))
      invalid('metadata: dependency commit required');
    const key = `${dependency.tool}/${dependency.repository}/${dependency.commit}`;
    if (dependencies.has(key)) invalid('metadata: duplicate dependency');
    dependencies.add(key);
  }
  for (const field of ['builderHash', 'buildKey', 'elfSha256'] as const)
    digest(info[field], `metadata.${field}`);
  if (info.elfSha256 !== input.elfSha256)
    invalid('metadata: ELF identity mismatch');
}
function validateInput(input: AssetInput, limits: AssetLimits): void {
  if (
    !input ||
    !['aube', 'biome'].includes(input.tool) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(input.version)
  )
    invalid('asset: tool/version required');
  httpsUrl(input.url);
  for (const field of [
    'downloadSha256',
    'elfSha256',
    'buildInfoSha256',
  ] as const)
    digest(input[field], field);
  if (
    !['elf', 'tar.gz'].includes(input.format) ||
    (input.format === 'elf' && input.archiveEntry !== undefined) ||
    (input.format === 'tar.gz' && !input.archiveEntry)
  )
    invalid('asset: format/entry mismatch');
  validateIdentity(input);
  if (encoder.encode(canonicalJson(input.buildInfo)).length > limits.metadata)
    invalid('metadata: byte limit exceeded');
}
export function checkSize(size: number, limit: number, label: string): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit)
    invalid(`${label}: byte limit exceeded`);
}
async function readBounded(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (!(value instanceof Uint8Array))
        throw new AssetError('ASSET_LOAD', 'response: invalid byte body');
      size += value.length;
      checkSize(size, limit, 'stream');
      chunks.push(new Uint8Array(value));
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function tarString(header: Uint8Array, offset: number, size: number): string {
  const bytes = header.subarray(offset, offset + size);
  const end = bytes.indexOf(0);
  return decoder.decode(end < 0 ? bytes : bytes.subarray(0, end));
}
function tarNumber(header: Uint8Array, offset: number, size: number): number {
  const field = tarString(header, offset, size).trim();
  if (!/^[0-7]+$/.test(field)) invalid('archive: invalid octal field');
  const value = Number.parseInt(field, 8);
  checkSize(value, Number.MAX_SAFE_INTEGER, 'archive integer');
  return value;
}
function archivePath(value: string, limit: number): string {
  required(value, 'archive path');
  checkSize(encoder.encode(value).length, limit, 'archive path');
  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    /^[a-zA-Z]:/.test(value) ||
    value.split('/').includes('..')
  )
    invalid('archive: escaping path');
  const path = value
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/');
  return path;
}
interface TarEntry {
  path: string;
  kind: string;
  bytes: Uint8Array;
  target?: string;
}
/** Scan every entry, including unselected paths and links, before returning bytes. */
export function extractTar(
  bytes: Uint8Array,
  selected: string,
  limits: AssetLimits = ASSET_LIMITS,
): Uint8Array<ArrayBuffer> {
  checkSize(bytes.length, limits.expanded, 'archive expanded');
  const entries = new Map<string, TarEntry>();
  let offset = 0;
  let ended = false;
  let total = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      if (
        offset + 512 > bytes.length ||
        !bytes.subarray(offset).every((byte) => byte === 0)
      )
        invalid('archive: missing end block/trailing data');
      ended = true;
      break;
    }
    const expected = tarNumber(header, 148, 8);
    const sum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0,
    );
    if (sum !== expected) invalid('archive: header checksum mismatch');
    const path = archivePath(
      [tarString(header, 345, 155), tarString(header, 0, 100)]
        .filter(Boolean)
        .join('/'),
      limits.path,
    );
    if (entries.has(path)) invalid('archive: duplicate path');
    checkSize(entries.size + 1, limits.entries, 'archive entries');
    const size = tarNumber(header, 124, 12);
    total += size;
    checkSize(total, limits.expanded, 'archive total');
    const padded = Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(padded) || offset + padded > bytes.length)
      invalid('archive: truncated entry');
    const kind = tarString(header, 156, 1) || '0';
    if (!['0', '1', '2', '5'].includes(kind) || (kind !== '0' && size !== 0))
      invalid('archive: unsupported entry');
    let target: string | undefined;
    if (kind === '1' || kind === '2') {
      const link = archivePath(tarString(header, 157, 100), limits.path);
      if (!link) invalid('archive: empty link');
      target =
        kind === '1' ? link : [...path.split('/').slice(0, -1), link].join('/');
    }
    if (!path && kind !== '5') invalid('archive: empty file path');
    entries.set(path, {
      path,
      kind,
      bytes: bytes.subarray(offset, offset + size),
      target,
    });
    offset += padded;
  }
  if (!ended) invalid('archive: missing end/truncated');
  for (const entry of entries.values()) {
    const seen = new Set<string>();
    let current = entry;
    while (current.target !== undefined) {
      if (seen.has(current.path)) invalid('archive: link loop');
      seen.add(current.path);
      const next = entries.get(current.target);
      if (!next) invalid('archive: dangling link');
      current = next;
    }
    for (const [index] of entry.path.split('/').entries()) {
      const parent = entries.get(
        entry.path.split('/').slice(0, index).join('/'),
      );
      if (parent && parent.kind !== '5')
        invalid('archive: non-directory parent');
    }
  }
  const entry = entries.get(archivePath(selected, limits.path));
  if (!entry || entry.kind !== '0')
    invalid('archive: selected regular file missing');
  checkSize(entry.bytes.length, limits.elf, 'ELF');
  return new Uint8Array(entry.bytes);
}
export interface AcquiredAsset {
  bytes: Uint8Array<ArrayBuffer>;
  input: AssetInput;
  finalUrl: string;
  phasesMs: {
    fetch: number;
    extract: number;
    digest: number;
    validate: number;
  };
}
function cancellable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
export async function acquireAsset(
  raw: AssetInput,
  options: {
    signal?: AbortSignal;
    fetch?: typeof fetch;
    timeoutMs?: number;
    limits?: Partial<AssetLimits>;
  } = {},
): Promise<AcquiredAsset> {
  const input = structuredClone(raw);
  const limits = { ...ASSET_LIMITS, ...options.limits };
  for (const key of Object.keys(limits) as (keyof typeof ASSET_LIMITS)[]) {
    if (
      !Number.isSafeInteger(limits[key]) ||
      limits[key] < 1 ||
      limits[key] > ASSET_LIMITS[key]
    )
      invalid('limits: cannot exceed C11');
  }
  validateInput(input, limits);
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000)
    invalid('deadline: cannot exceed C11');
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const times = { fetch: 0, extract: 0, digest: 0, validate: 0 };
  try {
    controller.signal.throwIfAborted();
    let start = performance.now();
    const response = await cancellable(
      (options.fetch ?? fetch)(input.url, {
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
        cache: 'no-store',
      }),
      controller.signal,
    );
    if (
      !response.ok ||
      response.type === 'opaque' ||
      response.type === 'opaqueredirect' ||
      response.redirected ||
      !response.body
    )
      throw new AssetError(
        'ASSET_LOAD',
        'asset: HTTP/CORS/redirect/body refused',
      );
    const finalUrl = response.url || input.url;
    httpsUrl(finalUrl);
    if (finalUrl !== input.url)
      throw new AssetError(
        'ASSET_LOAD',
        'asset: unobservable redirect refused',
      );
    const download = await readBounded(
      response.body,
      limits.download,
      controller.signal,
    );
    times.fetch = performance.now() - start;
    start = performance.now();
    const expanded =
      input.format === 'tar.gz'
        ? await readBounded(
            new Blob([download])
              .stream()
              .pipeThrough(new DecompressionStream('gzip')),
            limits.expanded,
            controller.signal,
          )
        : download;
    const elf =
      input.format === 'tar.gz'
        ? extractTar(expanded, input.archiveEntry!, limits)
        : new Uint8Array(expanded);
    checkSize(elf.length, limits.elf, 'ELF');
    times.extract = input.format === 'elf' ? 0 : performance.now() - start;
    start = performance.now();
    if (
      (await sha256(download)) !== input.downloadSha256 ||
      (await sha256(elf)) !== input.elfSha256 ||
      (await sha256(encoder.encode(canonicalJson(input.buildInfo)))) !==
        input.buildInfoSha256
    )
      invalid('asset: digest mismatch');
    times.digest = performance.now() - start;
    start = performance.now();
    if ((await buildKey(input.buildInfo)) !== input.buildInfo.buildKey)
      invalid('metadata: build key mismatch');
    const bytes = validateGuestElf(elf);
    times.validate = performance.now() - start;
    controller.signal.throwIfAborted();
    return { bytes, input, finalUrl, phasesMs: times };
  } catch (error) {
    if (controller.signal.aborted)
      throw new AssetError(
        timedOut ? 'TIMEOUT' : 'ABORTED',
        timedOut ? 'asset: deadline expired' : 'asset: cancelled',
      );
    if (error instanceof AssetError) throw error;
    throw new AssetError(
      'ASSET_LOAD',
      'asset: network, decompression or ELF validation failed',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
