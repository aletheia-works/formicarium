import { ExecutionError, failure, invalid } from './errors.js';
import { GUEST_LIMITS } from './guest-validation.js';
import { archivePath, INSTALL_LIMITS } from './install-catalog.js';
import type { InstallControl } from './install-transfer.js';
import { interruptible } from './install-transfer.js';

interface ArchiveEntry {
  path: string;
  kind: 'file' | 'dir' | 'symlink' | 'hardlink';
  target?: string;
  bytes?: Uint8Array<ArrayBuffer>;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
function text(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw failure('INVALID_INPUT', 'Archive UTF8 invalid');
  }
}
function field(header: Uint8Array, offset: number, length: number): string {
  const bytes = header.subarray(offset, offset + length);
  const end = bytes.indexOf(0);
  if (end < 0) return text(bytes);
  invalid(
    bytes.subarray(end).every((byte) => byte === 0),
    'Archive text field has data after NUL',
  );
  return text(bytes.subarray(0, end));
}
function number(header: Uint8Array, offset: number, length: number): number {
  const value = text(header.subarray(offset, offset + length))
    .replace(/[\0 ]+$/g, '')
    .replace(/^ +/g, '');
  invalid(/^[0-7]+$/.test(value), 'Archive numeric field invalid');
  const result = Number.parseInt(value, 8);
  invalid(
    Number.isSafeInteger(result) && result >= 0,
    'Archive numeric field overflow',
  );
  return result;
}
function normalized(raw: string, directory = false): string {
  if (directory && /^(\.\/)*\.?\/?$/.test(raw)) return '';
  return archivePath(raw);
}
function target(raw: string): string {
  invalid(
    raw.length > 0 &&
      !raw.startsWith('/') &&
      !raw.includes('\0') &&
      !raw.includes('\\') &&
      encoder.encode(raw).length <= GUEST_LIMITS.path,
    'Archive link target invalid',
  );
  return raw;
}
function pax(bytes: Uint8Array): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    invalid(
      space > offset && space - offset <= 10,
      'PAX record length missing',
    );
    const prefix = text(bytes.subarray(offset, space));
    invalid(/^[1-9][0-9]*$/.test(prefix), 'PAX record length invalid');
    const length = Number(prefix);
    const end = offset + length;
    invalid(
      Number.isSafeInteger(end) &&
        end <= bytes.length &&
        end > space + 2 &&
        bytes[end - 1] === 10,
      'PAX record boundary invalid',
    );
    const record = text(bytes.subarray(space + 1, end - 1));
    const separator = record.indexOf('=');
    invalid(separator > 0, 'PAX key missing');
    const key = record.slice(0, separator);
    const value = record.slice(separator + 1);
    invalid(!Object.hasOwn(values, key), 'PAX duplicate key');
    invalid(
      [
        'path',
        'linkpath',
        'mtime',
        'atime',
        'ctime',
        'uid',
        'gid',
        'uname',
        'gname',
      ].includes(key),
      'PAX unsupported metadata',
    );
    invalid(
      !value.includes('\0') && !value.includes('\n'),
      'PAX value invalid',
    );
    if (['mtime', 'atime', 'ctime'].includes(key))
      invalid(
        /^-?[0-9]+(?:\.[0-9]+)?$/.test(value) && Number.isFinite(Number(value)),
        'PAX timestamp invalid',
      );
    if (['uid', 'gid'].includes(key))
      invalid(
        /^[0-9]+$/.test(value) && Number.isSafeInteger(Number(value)),
        'PAX identity invalid',
      );
    values[key] = value;
    offset = end;
  }
  return values;
}
function longText(bytes: Uint8Array): string {
  invalid(
    bytes.length > 0 &&
      bytes[bytes.length - 1] === 0 &&
      bytes.subarray(0, -1).every((byte) => byte !== 0),
    'GNU extended name terminator invalid',
  );
  return text(bytes.subarray(0, -1));
}
/** Includes every decompressed header, extension, padding and trailer in the quota. */
class ArchiveReader {
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  #chunk = new Uint8Array();
  #offset = 0;
  #ended = false;
  #received = 0;
  readonly control: InstallControl;
  readonly progress: (bytes: number) => void;
  constructor(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    control: InstallControl,
    progress: (bytes: number) => void,
  ) {
    this.#reader = reader;
    this.control = control;
    this.progress = progress;
  }
  async #next(): Promise<boolean> {
    this.control.check();
    while (this.#offset === this.#chunk.length && !this.#ended) {
      const result = await interruptible(
        this.#reader.read(),
        this.control.signal,
      );
      this.control.check();
      this.#ended = !!result.done;
      if (result.done) return false;
      invalid(
        result.value instanceof Uint8Array,
        'Archive decompression chunk invalid',
      );
      this.#received += result.value.length;
      invalid(
        Number.isSafeInteger(this.#received) &&
          this.#received <= INSTALL_LIMITS.expanded,
        'Archive expanded byte limit exceeded',
      );
      this.#chunk = new Uint8Array(result.value);
      this.#offset = 0;
      this.progress(this.#received);
      await this.control.yield();
    }
    return this.#offset < this.#chunk.length;
  }
  async read(length: number): Promise<Uint8Array<ArrayBuffer>> {
    invalid(
      Number.isSafeInteger(length) &&
        length >= 0 &&
        length <= INSTALL_LIMITS.expanded,
      'Archive read length invalid',
    );
    const bytes = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      invalid(await this.#next(), 'Archive truncated');
      const amount = Math.min(
        length - filled,
        this.#chunk.length - this.#offset,
        65536,
      );
      bytes.set(
        this.#chunk.subarray(this.#offset, this.#offset + amount),
        filled,
      );
      filled += amount;
      this.#offset += amount;
      await this.control.yield();
    }
    return bytes;
  }
  async zerosToEnd(): Promise<void> {
    while (await this.#next()) {
      invalid(
        this.#chunk.subarray(this.#offset).every((byte) => byte === 0),
        'Archive trailing data rejected',
      );
      this.#offset = this.#chunk.length;
      await this.control.yield();
    }
    invalid(
      this.#received % 512 === 0,
      'Archive trailer block alignment invalid',
    );
  }
}
async function validateGraph(
  entries: Map<string, ArchiveEntry>,
  selection: string,
  control: InstallControl,
): Promise<Uint8Array<ArrayBuffer>> {
  let visits = 0;
  const resolve = async (
    raw: string,
    visited = new Set<string>(),
  ): Promise<string> => {
    invalid(
      ++visits <= GUEST_LIMITS.entries * GUEST_LIMITS.entries,
      'Archive link graph limit exceeded',
    );
    if (visits % 32 === 0) await control.yield();
    invalid(
      encoder.encode(raw).length <= GUEST_LIMITS.path,
      'Archive resolved path limit exceeded',
    );
    const parts = raw.split('/').filter((part) => part !== '' && part !== '.');
    const result: string[] = [];
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]!;
      if (!part || part === '.') continue;
      if (part === '..') {
        invalid(result.length > 0, 'Archive link escapes root');
        result.pop();
        continue;
      }
      result.push(part);
      const name = result.join('/');
      const entry = entries.get(name);
      if (entry?.kind === 'symlink' || entry?.kind === 'hardlink') {
        invalid(!visited.has(name), 'Archive link cycle');
        visited.add(name);
        const destination =
          entry.kind === 'hardlink'
            ? entry.target!
            : `${result.slice(0, -1).join('/')}/${entry.target!}`;
        const resolved = await resolve(destination, visited);
        visited.delete(name);
        invalid(entries.has(resolved), 'Archive link target missing');
        return await resolve(
          `${resolved}/${parts.slice(index + 1).join('/')}`,
          visited,
        );
      }
      invalid(
        index === parts.length - 1 || !entry || entry.kind === 'dir',
        'Archive parent is not directory',
      );
    }
    return result.join('/');
  };
  for (const entry of entries.values()) {
    if (entry.kind === 'symlink' || entry.kind === 'hardlink') {
      const resolved = await resolve(entry.path);
      if (entry.kind === 'hardlink')
        invalid(
          entries.get(resolved)?.kind === 'file',
          'Archive hardlink must reference regular file',
        );
    } else await resolve(entry.path);
    await control.yield();
  }
  const selected = entries.get(await resolve(selection));
  invalid(
    selected?.kind === 'file' && selected.bytes !== undefined,
    'Archive selection is not regular file',
  );
  invalid(
    selected.bytes.length <= GUEST_LIMITS.elf,
    'Archive selected ELF byte limit exceeded',
  );
  return new Uint8Array(selected.bytes);
}
export async function extractArchive(
  compressed: Uint8Array,
  selection: string,
  control: InstallControl,
  progress: (bytes: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  control.check();
  const selectedPath = archivePath(selection);
  if (typeof DecompressionStream !== 'function')
    throw failure('UNSUPPORTED_ENV', 'Gzip stream support required');
  let offset = 0;
  const input = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      control.check();
      if (offset === compressed.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + 65536, compressed.length);
      controller.enqueue(new Uint8Array(compressed.subarray(offset, end)));
      offset = end;
    },
  });
  const reader = input.pipeThrough(new DecompressionStream('gzip')).getReader();
  let complete = false;
  try {
    const stream = new ArchiveReader(reader, control, progress);
    const entries = new Map<string, ArchiveEntry>();
    let count = 0;
    let extended: Record<string, string> = Object.create(null);
    while (true) {
      const header = await stream.read(512);
      if (header.every((byte) => byte === 0)) {
        invalid(
          (await stream.read(512)).every((byte) => byte === 0),
          'Archive requires two end blocks',
        );
        invalid(
          Object.keys(extended).length === 0,
          'Archive extension has no following entry',
        );
        await stream.zerosToEnd();
        break;
      }
      invalid(++count <= GUEST_LIMITS.entries, 'Archive entry count exceeded');
      const expected = number(header, 148, 8);
      let checksum = 0;
      for (let i = 0; i < header.length; i++)
        checksum += i >= 148 && i < 156 ? 32 : header[i]!;
      invalid(checksum === expected, 'Archive checksum invalid');
      const magic = text(header.subarray(257, 263));
      const version = text(header.subarray(263, 265));
      invalid(
        (magic === 'ustar\0' && version === '00') ||
          (magic === 'ustar ' && version === ' \0'),
        'Archive header format unsupported',
      );
      for (const [start, length] of [
        [100, 8],
        [108, 8],
        [116, 8],
        [136, 12],
      ] as const)
        number(header, start, length);
      const size = number(header, 124, 12);
      const type = header[156];
      const metadata = type === 76 || type === 75 || type === 120;
      invalid(
        metadata || [0, 48, 49, 50, 53].includes(type!),
        'Archive entry type unsupported',
      );
      if (metadata)
        invalid(
          size <= GUEST_LIMITS.metadata,
          'Archive metadata limit exceeded',
        );
      if (!metadata && ![0, 48].includes(type!))
        invalid(size === 0, 'Archive non-file body rejected');
      const body = await stream.read(size);
      invalid(
        (await stream.read((512 - (size % 512)) % 512)).every(
          (byte) => byte === 0,
        ),
        'Archive padding invalid',
      );
      if (metadata) {
        const values =
          type === 120
            ? pax(body)
            : { [type === 76 ? 'path' : 'linkpath']: longText(body) };
        for (const [key, value] of Object.entries(values)) {
          invalid(
            !Object.hasOwn(extended, key),
            'Archive duplicate extension key',
          );
          extended[key] = value;
        }
        continue;
      }
      const prefix = magic === 'ustar\0' ? field(header, 345, 155) : '';
      const raw =
        extended.path ??
        `${prefix ? `${prefix}/` : ''}${field(header, 0, 100)}`;
      const path = normalized(raw, type === 53);
      invalid(!entries.has(path), 'Archive duplicate normalized entry');
      const kind =
        type === 53
          ? 'dir'
          : type === 50
            ? 'symlink'
            : type === 49
              ? 'hardlink'
              : 'file';
      const entry: ArchiveEntry = { path, kind };
      if (kind === 'file') entry.bytes = body;
      if (kind === 'symlink' || kind === 'hardlink')
        entry.target = target(extended.linkpath ?? field(header, 157, 100));
      else
        invalid(
          extended.linkpath === undefined,
          'Archive linkpath on non-link',
        );
      entries.set(path, entry);
      extended = Object.create(null);
      await control.yield();
    }
    control.check();
    const result = await validateGraph(entries, selectedPath, control);
    await control.yield();
    control.check();
    complete = true;
    return result;
  } catch (error) {
    if (error instanceof ExecutionError) {
      control.fail?.(error);
      throw error;
    }
    control.check();
    const failed = failure('INVALID_INPUT', 'Gzip archive invalid');
    control.fail?.(failed);
    throw failed;
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
