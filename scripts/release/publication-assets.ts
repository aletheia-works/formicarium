import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { gunzipSync, inflateRawSync } from 'node:zlib';

export const ASSET_LIMITS = Object.freeze({
  inputBytes: 256 * 1024 * 1024 - 1,
  expandedBytes: 512 * 1024 * 1024,
  members: 8192,
  npmBytes: 32 * 1024 * 1024,
  npmExpandedBytes: 64 * 1024 * 1024,
  npmMembers: 4096,
  metadataBytes: 8 * 1024 * 1024,
});
export const NPM_ASSET = Object.freeze({
  version: '11.19.0',
  url: 'https://registry.npmjs.org/npm/-/npm-11.19.0.tgz',
  integrity:
    'sha512-SDd/hHg3KqHE5Ht2NHWxNYNtqCQ2pXAPLl6OtQhPyED5PHsRfrOtO199MZTIG2cQoQ1ZRI9t28shrD+2cr3AAw==',
});
function ensure(value: unknown, code: string): asserts value {
  if (!value) throw Error(code);
}
export interface BoundedReadHandle {
  read(buffer: Buffer): Promise<number>;
  close(): Promise<void>;
}
export type BoundedOpen = (path: string) => Promise<BoundedReadHandle>;
const openBounded: BoundedOpen = async (path) => {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    ensure((await file.stat()).isFile(), 'ASSET_FILE_REQUIRED');
  } catch (error) {
    await file.close();
    throw error;
  }
  return {
    read: async (buffer) =>
      (await file.read(buffer, 0, buffer.length, null)).bytesRead,
    close: () => file.close(),
  };
};
/** Read at most limit+1 bytes; concurrent growth cannot bypass a prior stat size. */
export async function readBoundedFile(
  path: string,
  limit: number,
  acquire: BoundedOpen = openBounded,
) {
  ensure(Number.isSafeInteger(limit) && limit >= 0, 'ASSET_LIMIT_INVALID');
  const file = await acquire(path),
    chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit - total + 1));
      const count = await file.read(chunk);
      ensure(
        Number.isSafeInteger(count) && count >= 0 && count <= chunk.length,
        'ASSET_READ_INVALID',
      );
      if (!count) return Buffer.concat(chunks, total);
      total += count;
      ensure(total <= limit, 'JSON_METADATA_LIMIT');
      chunks.push(chunk.subarray(0, count));
    }
  } finally {
    await file.close();
  }
}
export function assetDigest(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}
export function safeAssetPath(path: string) {
  ensure(
    typeof path === 'string' &&
      /^[A-Za-z0-9_@.+/-]+$/.test(path) &&
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path
        .split('/')
        .some(
          (part) =>
            part === '..' || part === '.' || part === '' || part === '.npmrc',
        ),
    'UNSAFE_ASSET_PATH',
  );
  return path;
}
export async function boundedBody(
  response: Response,
  limit: number,
  signal?: AbortSignal,
) {
  ensure(response.ok && response.body, 'ASSET_DOWNLOAD_FAILED');
  const reader = response.body.getReader(),
    rows: Uint8Array[] = [];
  let total = 0;
  const abort = () => {
    void reader.cancel();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      ensure(!signal?.aborted, 'ASSET_TIMEOUT');
      const next = await reader.read();
      ensure(!signal?.aborted, 'ASSET_TIMEOUT');
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Error('ASSET_BYTE_LIMIT');
      }
      rows.push(next.value);
    }
    return Buffer.concat(rows, total);
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
export async function fetchAsset(
  url: string,
  limit: number,
  fetcher: typeof fetch = fetch,
  headers: Record<string, string> = {},
  redirectHosts: string[] = [],
  timeoutMs = 120_000,
) {
  const source = new URL(url);
  ensure(
    source.protocol === 'https:' &&
      !source.username &&
      !source.password &&
      !source.hash,
    'UNSAFE_ASSET_URL',
  );
  const timer = AbortSignal.timeout(timeoutMs);
  let response = await fetcher(url, {
    headers,
    redirect: 'manual',
    signal: timer,
  });
  if (response.status === 302 || response.status === 307) {
    const location = new URL(response.headers.get('location') ?? '', source);
    ensure(
      location.protocol === 'https:' &&
        !location.username &&
        !location.password &&
        !location.hash &&
        redirectHosts.includes(location.hostname),
      'UNSAFE_ASSET_REDIRECT',
    );
    response = await fetcher(location.href, {
      redirect: 'error',
      signal: timer,
    });
  }
  return boundedBody(response, limit, timer);
}
export function verifyNpmIntegrity(bytes: Uint8Array) {
  ensure(
    bytes.byteLength <= ASSET_LIMITS.npmBytes &&
      `sha512-${createHash('sha512').update(bytes).digest('base64')}` ===
        NPM_ASSET.integrity,
    'NPM_INTEGRITY_MISMATCH',
  );
}
export function unpackTar(
  bytes: Uint8Array,
  expandedLimit: number,
  memberLimit: number,
) {
  ensure(
    Number.isSafeInteger(expandedLimit) &&
      expandedLimit >= 0 &&
      Number.isSafeInteger(memberLimit) &&
      memberLimit >= 0,
    'ASSET_LIMIT_INVALID',
  );
  ensure(bytes.byteLength <= ASSET_LIMITS.inputBytes, 'ASSET_BYTE_LIMIT');
  const archive = gunzipSync(bytes, {
    maxOutputLength: expandedLimit + memberLimit * 1024 + 1024,
  });
  const result = new Map<string, Buffer>();
  const seen = new Set<string>();
  let offset = 0,
    members = 0,
    total = 0;
  const string = (header: Buffer, start: number, length: number) =>
    header
      .subarray(start, start + length)
      .toString('utf8')
      .split('\0')[0] ?? '';
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      ensure(
        archive.subarray(offset).every((byte) => byte === 0),
        'TAR_TRAILING_DATA',
      );
      return result;
    }
    ensure(++members <= memberLimit, 'ASSET_MEMBER_LIMIT');
    const number = (start: number, length: number) => {
      const value = string(header, start, length).trim();
      ensure(/^[0-7]+$/.test(value), 'UNSAFE_TAR_NUMBER');
      const parsed = Number.parseInt(value, 8);
      ensure(Number.isSafeInteger(parsed), 'UNSAFE_TAR_NUMBER');
      return parsed;
    };
    const checksum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0,
    );
    ensure(checksum === number(148, 8), 'TAR_CHECKSUM');
    const prefix = string(header, 345, 155),
      name = string(header, 0, 100),
      type = header[156];
    const rawPath = prefix ? `${prefix}/${name}` : name;
    const path = safeAssetPath(
      rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath,
    );
    ensure(!seen.has(path), 'ASSET_DUPLICATE_PATH');
    seen.add(path);
    const size = number(124, 12);
    ensure(
      !path.endsWith('.json') || size <= ASSET_LIMITS.metadataBytes,
      'JSON_METADATA_LIMIT',
    );
    ensure(type === 0 || type === 48 || type === 53, 'ASSET_LINK_OR_SPECIAL');
    ensure(type !== 53 || size === 0, 'UNSAFE_DIRECTORY');
    total += size;
    ensure(
      total <= expandedLimit && offset + 512 + size <= archive.length,
      'ASSET_EXPANDED_LIMIT',
    );
    if (type !== 53)
      result.set(path, archive.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw Error('TRUNCATED_TAR');
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function unpackZip(
  bytes: Uint8Array,
  expandedLimit: number = ASSET_LIMITS.expandedBytes,
  memberLimit: number = ASSET_LIMITS.members,
) {
  ensure(
    Number.isSafeInteger(expandedLimit) &&
      expandedLimit >= 0 &&
      Number.isSafeInteger(memberLimit) &&
      memberLimit >= 0,
    'ASSET_LIMIT_INVALID',
  );
  ensure(bytes.byteLength <= ASSET_LIMITS.inputBytes, 'ASSET_BYTE_LIMIT');
  const archive = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let i = archive.length - 22;
    i >= Math.max(0, archive.length - 65557);
    i--
  )
    if (
      archive.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + archive.readUInt16LE(i + 20) === archive.length
    ) {
      end = i;
      break;
    }
  ensure(
    end >= 0 &&
      archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0,
    'UNSAFE_ZIP',
  );
  const count = archive.readUInt16LE(end + 10),
    start = archive.readUInt32LE(end + 16),
    length = archive.readUInt32LE(end + 12);
  ensure(
    count <= memberLimit &&
      count === archive.readUInt16LE(end + 8) &&
      start + length === end,
    'ASSET_MEMBER_LIMIT',
  );
  const result = new Map<string, Buffer>();
  let cursor = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    ensure(
      cursor + 46 <= end && archive.readUInt32LE(cursor) === 0x02014b50,
      'UNSAFE_ZIP',
    );
    const flags = archive.readUInt16LE(cursor + 8),
      method = archive.readUInt16LE(cursor + 10),
      crc = archive.readUInt32LE(cursor + 16),
      compressed = archive.readUInt32LE(cursor + 20),
      size = archive.readUInt32LE(cursor + 24),
      names = archive.readUInt16LE(cursor + 28),
      extra = archive.readUInt16LE(cursor + 30),
      comment = archive.readUInt16LE(cursor + 32),
      local = archive.readUInt32LE(cursor + 42),
      mode = archive.readUInt32LE(cursor + 38) >>> 16;
    ensure(
      cursor + 46 + names + extra + comment <= end &&
        (flags & ~0x808) === 0 &&
        [0, 8].includes(method) &&
        (mode === 0 || (mode & 0xf000) === 0x8000) &&
        archive.readUInt16LE(cursor + 34) === 0,
      'ASSET_LINK_OR_SPECIAL',
    );
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      archive.subarray(cursor + 46, cursor + 46 + names),
    );
    const path = safeAssetPath(name);
    ensure(
      !path.endsWith('.json') || size <= ASSET_LIMITS.metadataBytes,
      'JSON_METADATA_LIMIT',
    );
    ensure(!result.has(path), 'ASSET_DUPLICATE_PATH');
    total += size;
    ensure(
      total <= expandedLimit && size <= expandedLimit,
      'ASSET_EXPANDED_LIMIT',
    );
    ensure(
      local + 30 <= start &&
        archive.readUInt32LE(local) === 0x04034b50 &&
        archive.readUInt16LE(local + 6) === flags &&
        archive.readUInt16LE(local + 8) === method,
      'UNSAFE_ZIP',
    );
    const localNames = archive.readUInt16LE(local + 26),
      localExtra = archive.readUInt16LE(local + 28),
      data = local + 30 + localNames + localExtra;
    ensure(
      archive
        .subarray(local + 30, local + 30 + localNames)
        .equals(Buffer.from(name)) && data + compressed <= start,
      'UNSAFE_ZIP',
    );
    const output =
      method === 8
        ? inflateRawSync(archive.subarray(data, data + compressed), {
            maxOutputLength: Math.max(
              1,
              Math.min(
                expandedLimit - total + size,
                path.endsWith('.json')
                  ? ASSET_LIMITS.metadataBytes
                  : expandedLimit,
              ),
            ),
          })
        : archive.subarray(data, data + compressed);
    ensure(output.length === size && crc32(output) === crc, 'ZIP_SIZE_CRC');
    result.set(path, output);
    cursor += 46 + names + extra + comment;
  }
  ensure(cursor === end, 'UNSAFE_ZIP');
  return result;
}
export function npmFiles(bytes: Uint8Array) {
  verifyNpmIntegrity(bytes);
  const files = unpackTar(
    bytes,
    ASSET_LIMITS.npmExpandedBytes,
    ASSET_LIMITS.npmMembers,
  );
  ensure(
    [...files.keys()].every(
      (path) => path === 'package' || path.startsWith('package/'),
    ),
    'NPM_PATH_MISMATCH',
  );
  ensure(
    JSON.parse(files.get('package/package.json')?.toString() ?? '{}')
      .version === NPM_ASSET.version && files.has('package/bin/npm-cli.js'),
    'NPM_VERSION_MISMATCH',
  );
  return files;
}
