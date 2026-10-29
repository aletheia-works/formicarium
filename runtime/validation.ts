import type { Assets, FsEntry, RunOptions } from './contracts.js';
import { errorCode, INSTALLED_GUEST_DIRECTORY, isRecord } from './contracts.js';
import { failure, invalid } from './errors.js';

export function normalizePath(value: unknown): string {
  invalid(
    typeof value === 'string' && value.startsWith('/') && !value.includes('\0'),
    'path must be an absolute POSIX path',
  );
  const parts = value.split('/');
  invalid(!parts.includes('..'), 'parent path components are forbidden');
  return `/${parts.filter((part) => part && part !== '.').join('/')}`;
}

export const inRoots = (path: string, roots: readonly string[]) =>
  roots.some((root) => path === root || path.startsWith(`${root}/`));
export const parentPath = (path: string) =>
  path.slice(0, path.lastIndexOf('/')) || '/';
export const copyEntry = (entry: FsEntry): FsEntry =>
  entry.type === 'file'
    ? { ...entry, data: new Uint8Array(entry.data) }
    : { ...entry };

export function normalizeRoots(cwd: string, home: string) {
  const roots = [normalizePath(cwd), normalizePath(home)];
  for (const root of roots) {
    // A root may not hold or lie in the installed guest directory either:
    // its files would then be snapshotted and kept as the session's own.
    invalid(
      root !== '/' &&
        !inRoots(root, [
          '/guest',
          '/dev',
          '/proc',
          '/tmp',
          INSTALLED_GUEST_DIRECTORY,
        ]) &&
        !inRoots(INSTALLED_GUEST_DIRECTORY, [root]),
      'reserved persistence root',
    );
  }
  return [...new Set(roots)]
    .filter(
      (root, index, all) =>
        !all.some((outer, other) => other !== index && inRoots(root, [outer])),
    )
    .sort();
}

function resolveLink(path: string, target: unknown) {
  invalid(
    typeof target === 'string' && target.length > 0 && !target.includes('\0'),
    'symlink target must be a nonempty string',
  );
  const parts = target.startsWith('/')
    ? []
    : parentPath(path).split('/').filter(Boolean);
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function validateMode(mode: unknown): asserts mode is number {
  invalid(
    typeof mode === 'number' &&
      Number.isInteger(mode) &&
      mode >= 0 &&
      mode <= 0o7777,
    'file mode is invalid',
  );
}

function validateEntry(raw: unknown, roots: readonly string[]): FsEntry {
  invalid(isRecord(raw), 'entry must be an object');
  const path = normalizePath(raw.path);
  invalid(inRoots(path, roots), 'entry must lie inside persistence roots');
  invalid(
    typeof raw.type === 'string' &&
      ['dir', 'file', 'symlink'].includes(raw.type),
    'entry type is invalid',
  );
  if (raw.type === 'symlink') {
    invalid(
      inRoots(resolveLink(path, raw.target), roots),
      'symlink target escapes persistence roots',
    );
    return { path, type: 'symlink', target: raw.target as string };
  }
  validateMode(raw.mode);
  if (raw.type === 'dir') return { path, type: 'dir', mode: raw.mode };
  invalid(
    typeof raw.inodeId === 'string' &&
      raw.inodeId.length > 0 &&
      !raw.inodeId.includes('\0'),
    'file inodeId is invalid',
  );
  invalid(raw.data instanceof Uint8Array, 'file data must be Uint8Array');
  return {
    path,
    type: 'file',
    mode: raw.mode,
    inodeId: raw.inodeId,
    data: new Uint8Array(raw.data),
  };
}

export function equalBytes(left: Uint8Array, right: Uint8Array) {
  return (
    left.length === right.length &&
    left.every((byte, index) => byte === right[index])
  );
}

/** Validate the entire candidate before returning any owned state. */
export function validateEntries(
  entries: unknown,
  roots: readonly string[],
  {
    seed = false,
    directories = [],
  }: { seed?: boolean; directories?: readonly string[] } = {},
): FsEntry[] {
  invalid(Array.isArray(entries), 'entries must be an array');
  const found = new Map<string, FsEntry>();
  const inodes = new Map<string, Extract<FsEntry, { type: 'file' }>>();
  for (const raw of entries) {
    const entry = validateEntry(raw, roots);
    invalid(!found.has(entry.path), 'duplicate entry path');
    found.set(entry.path, entry);
    if (entry.type !== 'file') continue;
    const peer = inodes.get(entry.inodeId);
    invalid(
      !peer || (peer.mode === entry.mode && equalBytes(peer.data, entry.data)),
      'hard-link group differs in data or mode',
    );
    inodes.set(entry.inodeId, entry);
  }
  if (seed) {
    for (const path of directories) {
      const entry = found.get(path);
      invalid(
        !entry || entry.type === 'dir',
        'initial cwd/home must be directories',
      );
      if (!entry) found.set(path, { path, type: 'dir', mode: 0o755 });
    }
  }
  for (const root of roots)
    invalid(
      !found.has(root) || found.get(root)?.type === 'dir',
      'persistence roots must remain directories',
    );
  for (const entry of [...found.values()]) {
    let parent = parentPath(entry.path);
    while (inRoots(parent, roots)) {
      const existing = found.get(parent);
      invalid(
        !existing || existing.type === 'dir',
        'entry has a non-directory parent',
      );
      if (!existing) {
        invalid(seed, 'snapshot has a missing parent');
        found.set(parent, { path: parent, type: 'dir', mode: 0o755 });
      }
      parent = parentPath(parent);
    }
  }
  return [...found.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

export function validateElf(guest: unknown): Uint8Array<ArrayBuffer> {
  invalid(
    guest instanceof Uint8Array && guest.length >= 64,
    'guest must contain an ELF64 header',
  );
  const bytes = new Uint8Array(guest);
  const header = new DataView(bytes.buffer);
  invalid(
    [127, 69, 76, 70, 2, 1, 1].every((byte, index) => bytes[index] === byte),
    'guest must be ELF64 little-endian',
  );
  invalid(
    [2, 3].includes(header.getUint16(16, true)) &&
      header.getUint16(18, true) === 62 &&
      header.getUint32(20, true) === 1,
    'guest must be an x86-64 executable',
  );
  invalid(header.getUint16(52, true) === 64, 'ELF header size is invalid');
  const offset = header.getBigUint64(32, true);
  const count = header.getUint16(56, true);
  const size = header.getUint16(54, true);
  invalid(
    count >= 1 && count <= 256 && size === 56 && offset >= 64n,
    'ELF program header shape is unsupported',
  );
  invalid(
    offset + BigInt(count) * BigInt(size) <= BigInt(bytes.length),
    'ELF program headers exceed guest bounds',
  );
  let hasLoad = false;
  for (let index = 0; index < count; index++) {
    const start = Number(offset) + index * size;
    const type = header.getUint32(start, true);
    invalid(type !== 3, 'dynamic ELF interpreter is unsupported');
    hasLoad ||= type === 1;
    const fileOffset = header.getBigUint64(start + 8, true);
    const fileSize = header.getBigUint64(start + 32, true);
    invalid(
      fileOffset + fileSize <= BigInt(bytes.length),
      'ELF segment exceeds guest bounds',
    );
    invalid(
      type !== 1 || fileSize <= header.getBigUint64(start + 40, true),
      'ELF load segment memory bounds are invalid',
    );
  }
  invalid(hasLoad, 'ELF must contain a loadable segment');
  return bytes;
}

export function validateRun(options: RunOptions, home: string) {
  invalid(
    options && typeof options === 'object',
    'run options must be an object',
  );
  const guest = validateElf(options.guest);
  const args = options.args ?? [];
  invalid(
    Array.isArray(args) &&
      args.every((arg) => typeof arg === 'string' && !arg.includes('\0')),
    'args must contain strings without NUL',
  );
  const env = options.env ?? {};
  invalid(
    env && typeof env === 'object' && !Array.isArray(env),
    'env must be a string map',
  );
  const copy: Record<string, string> = Object.create(null);
  for (const [name, value] of Object.entries(env)) {
    invalid(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) &&
        typeof value === 'string' &&
        !value.includes('\0'),
      'env key or value is invalid',
    );
    copy[name] = value;
  }
  invalid(
    copy.HOME === undefined || copy.HOME === home,
    'env HOME must match session home',
  );
  copy.HOME = home;
  const stdin = options.stdin;
  invalid(
    stdin === undefined || (stdin instanceof ReadableStream && !stdin.locked),
    'stdin must be an unlocked ReadableStream',
  );
  const terminal = validateTerminal(options.terminal);
  const network = validateNetwork(options.network);
  invalid(
    options.timeoutMs === undefined ||
      (Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0),
    'timeoutMs must be a positive finite integer',
  );
  // An interactive guest waits for its user, so only stdin lifts the default.
  const timeoutMs =
    options.timeoutMs ?? (stdin ? Number.POSITIVE_INFINITY : 600_000);
  invalid(
    options.onOutput === undefined || typeof options.onOutput === 'function',
    'onOutput must be a function',
  );
  const signal = options.signal;
  invalid(
    signal === undefined ||
      (typeof signal?.aborted === 'boolean' &&
        typeof signal.addEventListener === 'function' &&
        typeof signal.removeEventListener === 'function'),
    'signal must be an AbortSignal',
  );
  if (signal?.aborted) throw failure('ABORTED', 'Run was already aborted');
  return {
    guest,
    args: [...args],
    env: copy,
    timeoutMs,
    onOutput: options.onOutput,
    signal,
    stdin,
    terminal,
    network,
  };
}

/** At most this many destinations, each at most a DNS name and a port long. */
const NETWORK_ENTRIES = 256;
const NETWORK_ENTRY_LENGTH = 263;
// host or *.host, IPv4 or [IPv6], each with an optional port, or a bare IPv6
// address, which takes no port.
const NETWORK_ENTRY =
  /^(?:(?:\*\.)?([A-Za-z0-9_.-]+)(?::(\d{1,5}))?|\[([0-9A-Fa-f:.]+)\](?::(\d{1,5}))?|[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*)$/;

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** An IPv6 address in text: eight groups, `::` once for zeros, and an IPv4 address last. */
function ipv6(text: string) {
  const halves = text.split('::');
  if (halves.length > 2) return false;
  const all = halves.flatMap((half) => (half === '' ? [] : half.split(':')));
  const last = all.at(-1);
  const embedded = last?.includes('.') ?? false;
  if (embedded && !IPV4.test(last!)) return false;
  const hex = embedded ? all.slice(0, -1) : all;
  if (!hex.every((group) => /^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
  const count = hex.length + (embedded ? 2 : 0);
  return halves.length === 2 ? count <= 7 : count === 8;
}

/** True when the core takes the entry: no empty name label, a port of 1 to 65535. */
function networkEntry(entry: unknown) {
  if (typeof entry !== 'string' || entry.length > NETWORK_ENTRY_LENGTH)
    return false;
  const match = NETWORK_ENTRY.exec(entry);
  if (!match) return false;
  const [, host, hostPort, address, addressPort] = match;
  const port = hostPort ?? addressPort;
  return (
    // One trailing dot names the root, as in a fully qualified name.
    (host === undefined ||
      host
        .replace(/\.$/, '')
        .split('.')
        .every((label) => label !== '')) &&
    (host !== undefined || ipv6(address ?? entry)) &&
    (port === undefined || (Number(port) >= 1 && Number(port) <= 65535))
  );
}

/** The TCP destinations a run may reach; without them the guest has no network. */
export function validateNetwork(value: unknown) {
  if (value === undefined) return undefined;
  invalid(isRecord(value), 'network must be an object');
  const { allow } = value;
  invalid(
    Array.isArray(allow) && allow.length <= NETWORK_ENTRIES,
    `network.allow must be an array of at most ${NETWORK_ENTRIES} entries`,
  );
  invalid(
    (allow as unknown[]).every(networkEntry),
    'network.allow entries must be host, *.host, an IPv4 address or [IPv6], with an optional port of 1 to 65535, or a bare IPv6 address',
  );
  return { allow: [...(allow as string[])] };
}

/** The core accepts 0 to 65535; a zero-sized terminal is refused as unusable. */
export function validateTerminal(value: unknown) {
  if (value === undefined) return undefined;
  invalid(isRecord(value), 'terminal must be an object');
  const { columns, rows } = value;
  invalid(
    [columns, rows].every(
      (size) =>
        Number.isInteger(size) &&
        (size as number) >= 1 &&
        (size as number) <= 65535,
    ),
    'terminal columns and rows must be integers from 1 to 65535',
  );
  return { columns: columns as number, rows: rows as number };
}

export function validateAssets(assets: unknown): Record<keyof Assets, string> {
  invalid(isRecord(assets), 'assets must be an object');
  const result = {} as Record<keyof Assets, string>;
  for (const name of [
    'loaderURL',
    'wasmURL',
    'workerURL',
    'buildInfoURL',
  ] as const) {
    try {
      invalid(
        typeof assets[name] === 'string' || assets[name] instanceof URL,
        'asset URL type is invalid',
      );
      const url = new URL(assets[name] as string | URL);
      invalid(
        ['file:', 'http:', 'https:'].includes(url.protocol),
        'asset URL scheme is unsupported',
      );
      result[name] = url.href;
    } catch (error) {
      if (errorCode(error) === 'INVALID_INPUT') throw error;
      throw failure('INVALID_INPUT', 'asset URL must be absolute');
    }
  }
  return result;
}
