import { lstat, mkdir, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { crc32, createGunzip, inflateRawSync } from 'node:zlib';
import { fail } from './errors.ts';
import {
  ARTIFACT_LIMITS,
  type ArchiveLimits,
  ASSET_ARCHIVE_LIMITS,
  TRANSFER_POLICY,
} from './limits.ts';

export interface TarEntry {
  path: string;
  kind: 'file' | 'dir' | 'symlink' | 'hardlink';
  mode: number;
  target?: string;
  bytes?: Uint8Array;
}
export interface TarOptions extends ArchiveLimits {
  /** git archive (codeload) writes one global PAX header with the commit. */
  allowGlobalHeader?: boolean;
  /** GNU release tarballs (nano's) may use the pre-POSIX v7 header. */
  allowV7Header?: boolean;
}
export interface TarResult {
  entries: Map<string, TarEntry>;
  globalComment: string | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
function bad(message: string): never {
  return fail('archive-invalid', message);
}

/** Streams gzip output and stops as soon as the expanded total exceeds the limit. */
export function gunzipBounded(
  bytes: Uint8Array,
  limit: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const settle = (error: unknown, value?: Uint8Array) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value!);
    };
    gunzip.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        gunzip.destroy();
        try {
          fail('size-limit', `expanded archive exceeds ${limit} bytes`);
        } catch (error) {
          settle(error);
        }
        return;
      }
      chunks.push(chunk);
    });
    gunzip.on('end', () => settle(null, new Uint8Array(Buffer.concat(chunks))));
    gunzip.on('error', (error) => {
      try {
        fail('archive-invalid', 'gzip stream invalid', error);
      } catch (failure) {
        settle(failure);
      }
    });
    gunzip.end(Buffer.from(bytes));
  });
}

function text(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    return bad('archive text is not UTF-8');
  }
}
function field(header: Uint8Array, offset: number, length: number): string {
  const bytes = header.subarray(offset, offset + length);
  const end = bytes.indexOf(0);
  if (end < 0) return text(bytes);
  if (!bytes.subarray(end).every((byte) => byte === 0))
    bad('archive text field has data after NUL');
  return text(bytes.subarray(0, end));
}
function octal(header: Uint8Array, offset: number, length: number): number {
  const value = text(header.subarray(offset, offset + length))
    .replace(/[\0 ]+$/g, '')
    .replace(/^ +/g, '');
  if (!/^[0-7]+$/.test(value)) bad('archive numeric field invalid');
  const result = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(result)) bad('archive numeric field overflow');
  return result;
}

/** Relative POSIX entry path; `.` parts are dropped, traversal is refused. */
export function entryPath(raw: string, maxPathBytes: number): string {
  if (
    raw.length === 0 ||
    raw.startsWith('/') ||
    raw.includes('\0') ||
    raw.includes('\\')
  )
    bad(`archive path refused: ${JSON.stringify(raw.slice(0, 64))}`);
  if (encoder.encode(raw).length > maxPathBytes)
    fail('size-limit', 'archive path byte limit exceeded');
  const parts = raw.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.some((part) => part === '..')) bad('archive traversal refused');
  return parts.join('/');
}

function pax(bytes: Uint8Array): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space <= offset || space - offset > 10) bad('PAX length missing');
    const length = Number(text(bytes.subarray(offset, space)));
    const end = offset + length;
    if (
      !Number.isSafeInteger(length) ||
      end > bytes.length ||
      end <= space + 2 ||
      bytes[end - 1] !== 10
    )
      bad('PAX record boundary invalid');
    const record = text(bytes.subarray(space + 1, end - 1));
    const separator = record.indexOf('=');
    if (separator <= 0) bad('PAX key missing');
    const key = record.slice(0, separator);
    if (Object.hasOwn(values, key)) bad('PAX duplicate key');
    values[key] = record.slice(separator + 1);
    offset = end;
  }
  return values;
}

function linkTarget(raw: string, maxPathBytes: number): string {
  if (
    raw.length === 0 ||
    raw.startsWith('/') ||
    raw.includes('\0') ||
    raw.includes('\\') ||
    encoder.encode(raw).length > maxPathBytes
  )
    bad('archive link target refused');
  return raw;
}

/** Parses every ustar/GNU/PAX header; nothing is skipped or extracted here. */
export function readTar(tar: Uint8Array, options: TarOptions): TarResult {
  const entries = new Map<string, TarEntry>();
  let offset = 0;
  let count = 0;
  let extended: Record<string, string> = Object.create(null);
  let globalComment: string | null = null;
  const take = (length: number) => {
    if (offset + length > tar.length) bad('archive truncated');
    const bytes = tar.subarray(offset, offset + length);
    offset += length;
    return bytes;
  };
  while (true) {
    const header = take(512);
    if (header.every((byte) => byte === 0)) {
      if (!take(512).every((byte) => byte === 0))
        bad('archive requires two end blocks');
      if (Object.keys(extended).length > 0)
        bad('archive extension has no following entry');
      if (!tar.subarray(offset).every((byte) => byte === 0))
        bad('archive trailing data refused');
      break;
    }
    if (++count > options.maxArchiveEntries)
      fail('size-limit', 'archive entry count exceeded');
    let checksum = 0;
    for (let index = 0; index < 512; index++)
      checksum += index >= 148 && index < 156 ? 32 : header[index]!;
    if (checksum !== octal(header, 148, 8)) bad('archive checksum invalid');
    const magic = text(header.subarray(257, 263));
    const version = text(header.subarray(263, 265));
    if (
      !(magic === 'ustar\0' && version === '00') &&
      !(magic === 'ustar ' && version === ' \0') &&
      !(options.allowV7Header && magic === '\0'.repeat(6) && version === '\0\0')
    )
      bad('archive header format unsupported');
    const size = octal(header, 124, 12);
    const mode = octal(header, 100, 8);
    const type = String.fromCharCode(header[156]!);
    const metadata = ['x', 'L', 'K', 'g'].includes(type);
    if (!metadata && !['\0', '0', '1', '2', '5'].includes(type))
      bad(`archive entry type refused: ${JSON.stringify(type)}`);
    if (type === 'g' && !options.allowGlobalHeader)
      bad('archive global header refused');
    if (metadata && size > TRANSFER_POLICY.maxMetadataBytes)
      fail('size-limit', 'archive metadata limit exceeded');
    if (!metadata && !['\0', '0'].includes(type) && size !== 0)
      bad('archive non-file entry has a body');
    const body = take(size);
    if (!take((512 - (size % 512)) % 512).every((byte) => byte === 0))
      bad('archive padding invalid');
    if (type === 'g') {
      const values = pax(body);
      if (globalComment !== null) bad('archive has two global headers');
      globalComment = values.comment ?? '';
      continue;
    }
    if (metadata) {
      const values =
        type === 'x'
          ? pax(body)
          : {
              [type === 'L' ? 'path' : 'linkpath']: text(body).replace(
                /\0$/,
                '',
              ),
            };
      for (const [key, value] of Object.entries(values)) {
        if (Object.hasOwn(extended, key)) bad('archive duplicate extension');
        extended[key] = value;
      }
      continue;
    }
    const prefix = magic === 'ustar\0' ? field(header, 345, 155) : '';
    const raw =
      extended.path ?? `${prefix ? `${prefix}/` : ''}${field(header, 0, 100)}`;
    const path = entryPath(raw, options.maxPathBytes);
    const linkpath = extended.linkpath;
    extended = Object.create(null);
    if (path === '') {
      if (type !== '5') bad('archive root must be a directory');
      continue;
    }
    if (entries.has(path)) bad(`archive duplicate entry: ${path}`);
    const kind =
      type === '5'
        ? 'dir'
        : type === '2'
          ? 'symlink'
          : type === '1'
            ? 'hardlink'
            : 'file';
    const entry: TarEntry = { path, kind, mode };
    if (kind === 'file') entry.bytes = body;
    if (kind === 'symlink' || kind === 'hardlink')
      entry.target = linkTarget(
        linkpath ?? field(header, 157, 100),
        options.maxPathBytes,
      );
    else if (linkpath !== undefined) bad('archive linkpath on a non-link');
    entries.set(path, entry);
  }
  validateLinks(entries, options.maxPathBytes);
  return { entries, globalComment };
}

/** Resolves a path through symbolic and hard links inside the archive root. */
export function resolveEntry(
  entries: Map<string, TarEntry>,
  raw: string,
  maxPathBytes: number,
  visited = new Set<string>(),
): string {
  if (encoder.encode(raw).length > maxPathBytes)
    fail('size-limit', 'archive resolved path limit exceeded');
  const parts = raw.split('/').filter((part) => part !== '' && part !== '.');
  const result: string[] = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    if (part === '..') {
      if (result.length === 0) bad('archive link escapes the root');
      result.pop();
      continue;
    }
    result.push(part);
    const name = result.join('/');
    const entry = entries.get(name);
    if (entry?.kind === 'symlink' || entry?.kind === 'hardlink') {
      if (visited.has(name)) bad('archive link cycle');
      visited.add(name);
      const destination =
        entry.kind === 'hardlink'
          ? entry.target!
          : [...result.slice(0, -1), entry.target!].join('/');
      const resolved = resolveEntry(
        entries,
        destination,
        maxPathBytes,
        visited,
      );
      visited.delete(name);
      if (!entries.has(resolved)) bad('archive link target missing');
      return resolveEntry(
        entries,
        [resolved, ...parts.slice(index + 1)].join('/'),
        maxPathBytes,
        visited,
      );
    }
    if (index < parts.length - 1 && entry && entry.kind !== 'dir')
      bad('archive parent is not a directory');
  }
  return result.join('/');
}

function validateLinks(entries: Map<string, TarEntry>, maxPathBytes: number) {
  for (const entry of entries.values()) {
    if (entry.kind !== 'symlink' && entry.kind !== 'hardlink') continue;
    const resolved = resolveEntry(entries, entry.path, maxPathBytes);
    if (entry.kind === 'hardlink' && entries.get(resolved)?.kind !== 'file')
      bad('archive hardlink must reference a regular file');
  }
}

/** Selects exactly the configured entry after checking every entry. */
export function selectEntry(
  entries: Map<string, TarEntry>,
  selection: string,
  maxPathBytes: number,
): Uint8Array {
  const path = resolveEntry(
    entries,
    entryPath(selection, maxPathBytes),
    maxPathBytes,
  );
  const entry = entries.get(path);
  if (entry?.kind !== 'file' || !entry.bytes)
    bad(`archive selection is not a regular file: ${selection}`);
  if (entry.bytes.length > TRANSFER_POLICY.maxElfBytes)
    fail('size-limit', 'selected ELF exceeds the ELF limit');
  return new Uint8Array(entry.bytes);
}

/** Bounded extraction of one entry from a release tar.gz. */
export async function extractEntry(
  compressed: Uint8Array,
  selection: string,
  limits: ArchiveLimits = ASSET_ARCHIVE_LIMITS,
): Promise<Uint8Array> {
  const tar = await gunzipBounded(compressed, limits.maxExpandedBytes);
  const { entries } = readTar(tar, limits);
  return selectEntry(entries, selection, limits.maxPathBytes);
}

/**
 * Writes a checked tree into a new empty directory. The single top-level
 * directory is stripped when `strip` names it. A path that passes through a
 * link entry is refused so no write can follow a link.
 */
export async function writeTree(
  entries: Map<string, TarEntry>,
  destination: string,
  strip: string | null,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length > 0)
    bad('tree destination must be empty');
  const links = new Set(
    [...entries.values()]
      .filter((entry) => entry.kind === 'symlink' || entry.kind === 'hardlink')
      .map((entry) => entry.path),
  );
  const ordered = [...entries.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  for (const entry of ordered) {
    let path = entry.path;
    if (strip !== null) {
      if (path === strip) continue;
      if (!path.startsWith(`${strip}/`)) bad(`entry outside ${strip}/`);
      path = path.slice(strip.length + 1);
    }
    const parts = entry.path.split('/');
    for (let index = 1; index < parts.length; index++)
      if (links.has(parts.slice(0, index).join('/')))
        bad('archive entry below a link refused');
    const target = join(destination, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    if (entry.kind === 'dir') await mkdir(target, { recursive: true });
    else if (entry.kind === 'file')
      await writeFile(target, entry.bytes!, {
        flag: 'wx',
        mode: entry.mode & 0o111 ? 0o755 : 0o644,
      });
    else if (entry.kind === 'symlink') await symlink(entry.target!, target);
    else {
      const source = resolveEntry(
        entries,
        entry.path,
        TRANSFER_POLICY.maxPathBytes,
      );
      await writeFile(target, entries.get(source)!.bytes!, {
        flag: 'wx',
        mode: 0o644,
      });
    }
  }
  const info = await lstat(destination);
  if (!info.isDirectory()) bad('tree destination replaced');
}

/** First path component shared by every entry (git archive / npm pack root). */
export function singleRoot(entries: Map<string, TarEntry>): string {
  const roots = new Set([...entries.keys()].map((path) => path.split('/')[0]!));
  if (roots.size !== 1) bad('archive must have one top-level directory');
  return [...roots][0]!;
}

/**
 * Minimal ZIP reader for Actions artifacts: stored or deflated entries only,
 * no ZIP64, no encryption, CRC32 and sizes checked, names checked like tar.
 */
export function readZip(
  zip: Uint8Array,
  limits: ArchiveLimits = ARTIFACT_LIMITS,
): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let end = -1;
  for (
    let index = zip.length - 22;
    index >= Math.max(0, zip.length - 65557);
    index--
  )
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  if (end < 0) bad('zip end record missing');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 0xffff || offset === 0xffffffff) bad('zip64 refused');
  if (count > limits.maxArchiveEntries)
    fail('size-limit', 'zip entry count exceeded');
  const files = new Map<string, Uint8Array>();
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > zip.length || view.getUint32(offset, true) !== 0x02014b50)
      bad('zip central header invalid');
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = text(zip.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (flags & 1) bad('zip encryption refused');
    if (name.endsWith('/')) continue;
    const path = entryPath(name, limits.maxPathBytes);
    if (files.has(path)) bad(`zip duplicate entry: ${path}`);
    expanded += size;
    if (expanded > limits.maxExpandedBytes)
      fail('size-limit', 'zip expanded size exceeded');
    if (local + 30 > zip.length || view.getUint32(local, true) !== 0x04034b50)
      bad('zip local header invalid');
    const start =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    if (start + compressedSize > zip.length) bad('zip entry truncated');
    const data = zip.subarray(start, start + compressedSize);
    let bytes: Uint8Array;
    if (method === 0) bytes = new Uint8Array(data);
    else if (method === 8) {
      try {
        bytes = new Uint8Array(
          inflateRawSync(data, { maxOutputLength: Math.max(size, 1) }),
        );
      } catch (error) {
        return fail('archive-invalid', 'zip entry inflate failed', error);
      }
    } else return bad('zip compression method refused');
    if (bytes.length !== size || crc32(bytes) !== crc)
      bad(`zip entry corrupt: ${path}`);
    files.set(path, bytes);
  }
  return files;
}
