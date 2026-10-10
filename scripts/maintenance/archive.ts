import { Readable } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

export const BYTE_LIMIT = 8 * 1024 * 1024;
export const MEMBER_LIMIT = 16;
export class BoundaryError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export function limitBytes(
  bytes: Uint8Array,
  maximum = BYTE_LIMIT,
): Uint8Array {
  if (bytes.byteLength > maximum) throw new BoundaryError('BYTE_LIMIT');
  return bytes;
}
export async function readBoundedStream(
  body: ReadableStream<Uint8Array> | null,
  maximum = BYTE_LIMIT,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!body) throw new BoundaryError('BODY_MISSING');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) throw new BoundaryError('CANCELLED');
      const row = await reader.read();
      if (signal?.aborted) throw new BoundaryError('CANCELLED');
      if (row.done) break;
      size += row.value.byteLength;
      if (size > maximum) throw new BoundaryError('BYTE_LIMIT');
      chunks.push(row.value);
    }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
export function decodeJson(bytes: Uint8Array): unknown {
  limitBytes(bytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BoundaryError('INVALID_JSON');
  }
}
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function inflate(
  bytes: Uint8Array,
  maximum: number,
): Promise<Uint8Array> {
  const decoder = createInflateRaw();
  const stream = Readable.from([bytes]).pipe(decoder);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const raw of stream) {
      const chunk = raw as Buffer;
      size += chunk.length;
      if (size > maximum) {
        decoder.destroy();
        throw new BoundaryError('BYTE_LIMIT');
      }
      chunks.push(chunk);
    }
    return new Uint8Array(Buffer.concat(chunks, size));
  } catch (error) {
    decoder.destroy();
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('INVALID_ZIP');
  }
}
/** ZIP members are data, never files to execute or extract through a shell. */
export async function unpackArchive(
  raw: Uint8Array,
  allowedNames: readonly string[] = ['receipt.json'],
): Promise<Map<string, Uint8Array>> {
  const bytes = limitBytes(raw);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => data.getUint16(at, true);
  const u32 = (at: number) => data.getUint32(at, true);
  try {
    let end = -1;
    for (
      let at = bytes.length - 22;
      at >= Math.max(0, bytes.length - 65557);
      at--
    ) {
      if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) {
        end = at;
        break;
      }
    }
    if (end < 0 || u16(end + 4) || u16(end + 6))
      throw new BoundaryError('INVALID_ZIP');
    const count = u16(end + 10),
      centralSize = u32(end + 12),
      centralStart = u32(end + 16);
    if (!count || count > MEMBER_LIMIT || count !== u16(end + 8))
      throw new BoundaryError('MEMBER_LIMIT');
    if (centralStart + centralSize !== end)
      throw new BoundaryError('INVALID_ZIP');
    const result = new Map<string, Uint8Array>();
    let cursor = centralStart,
      expanded = 0;
    const localRanges: [number, number][] = [];
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || u32(cursor) !== 0x02014b50)
        throw new BoundaryError('INVALID_ZIP');
      const flags = u16(cursor + 8),
        method = u16(cursor + 10),
        crc = u32(cursor + 16);
      const compressed = u32(cursor + 20),
        size = u32(cursor + 24);
      const nameLength = u16(cursor + 28),
        extraLength = u16(cursor + 30),
        commentLength = u16(cursor + 32);
      const local = u32(cursor + 42),
        mode = u32(cursor + 38) >>> 16;
      if (
        flags & ~0x0808 ||
        ![0, 8].includes(method) ||
        u16(cursor + 34) ||
        compressed === 0xffffffff ||
        size === 0xffffffff ||
        local === 0xffffffff ||
        size > BYTE_LIMIT ||
        expanded + size > BYTE_LIMIT
      )
        throw new BoundaryError('INVALID_ZIP');
      const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
      if (
        cursor + 46 + nameLength + extraLength + commentLength > end ||
        !name ||
        name.startsWith('/') ||
        name.includes('\\') ||
        name
          .split('/')
          .some((segment) => !segment || segment === '.' || segment === '..') ||
        /^[a-zA-Z]:/.test(name) ||
        !allowedNames.includes(name) ||
        result.has(name) ||
        ((mode & 0xf000) !== 0 && (mode & 0xf000) !== 0x8000)
      )
        throw new BoundaryError('UNSAFE_MEMBER');
      if (
        local + 30 > centralStart ||
        u32(local) !== 0x04034b50 ||
        u16(local + 6) !== flags ||
        u16(local + 8) !== method ||
        u16(local + 26) !== nameLength
      )
        throw new BoundaryError('INVALID_ZIP');
      const localName = bytes.subarray(local + 30, local + 30 + nameLength);
      if (!Buffer.from(localName).equals(Buffer.from(nameBytes)))
        throw new BoundaryError('INVALID_ZIP');
      const start = local + 30 + nameLength + u16(local + 28),
        finish = start + compressed;
      if (finish > centralStart) throw new BoundaryError('INVALID_ZIP');
      let recordEnd = finish;
      if (flags & 8) {
        const descriptor = u32(finish) === 0x08074b50 ? finish + 4 : finish;
        if (
          descriptor + 12 > centralStart ||
          u32(descriptor) !== crc ||
          u32(descriptor + 4) !== compressed ||
          u32(descriptor + 8) !== size
        )
          throw new BoundaryError('INVALID_ZIP');
        recordEnd = descriptor + 12;
      } else if (
        u32(local + 14) !== crc ||
        u32(local + 18) !== compressed ||
        u32(local + 22) !== size
      )
        throw new BoundaryError('INVALID_ZIP');
      localRanges.push([local, recordEnd]);
      const payload = bytes.subarray(start, finish);
      const output =
        method === 0
          ? limitBytes(payload, BYTE_LIMIT - expanded)
          : await inflate(payload, BYTE_LIMIT - expanded);
      if (output.length !== size || crc32(output) !== crc)
        throw new BoundaryError('INVALID_ZIP');
      expanded += output.length;
      result.set(name, output);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    localRanges.sort((a, b) => a[0] - b[0]);
    let position = 0;
    for (const [start, finish] of localRanges) {
      if (start !== position) throw new BoundaryError('INVALID_ZIP');
      position = finish;
    }
    if (position !== centralStart || cursor !== end)
      throw new BoundaryError('INVALID_ZIP');
    return result;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('INVALID_ZIP');
  }
}
