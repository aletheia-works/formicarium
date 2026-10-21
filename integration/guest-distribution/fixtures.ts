import type { FsEntry } from './index.js';
import { isRecord } from './manifest.js';

const ROOT = '/work';
const ROOTS = [ROOT, '/root'];
const inside = (path: string) =>
  ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
const parent = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

function pathOf(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.includes('\0')
  ) {
    throw new Error('fixture: path must be absolute POSIX');
  }
  const parts = value.split('/');
  if (parts.includes('..')) throw new Error('fixture: parent path forbidden');
  const path = `/${parts.filter((part) => part && part !== '.').join('/')}`;
  if (!inside(path)) throw new Error('fixture: path outside persistence roots');
  return path;
}

function modeOf(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0o7777
  ) {
    throw new Error('fixture: invalid mode');
  }
  return value;
}

function bytesOf(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (
    Array.isArray(value) &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return new Uint8Array(value);
  }
  throw new Error('fixture: file data must contain explicit bytes');
}

function linkTarget(path: string, target: unknown) {
  if (typeof target !== 'string' || !target || target.includes('\0')) {
    throw new Error('fixture: invalid symlink target');
  }
  const parts = target.startsWith('/')
    ? []
    : parent(path).split('/').filter(Boolean);
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  if (!inside(`/${parts.join('/')}`))
    throw new Error('fixture: symlink escapes persistence roots');
  return target;
}

function entryOf(raw: unknown): FsEntry {
  if (!isRecord(raw)) throw new Error('fixture: invalid entry');
  const path = pathOf(raw.path);
  if (raw.type === 'symlink')
    return { path, type: raw.type, target: linkTarget(path, raw.target) };
  if (raw.type !== 'dir' && raw.type !== 'file')
    throw new Error('fixture: invalid entry type');
  const mode = modeOf(raw.mode);
  if (raw.type === 'dir') return { path, type: raw.type, mode };
  if (
    typeof raw.inodeId !== 'string' ||
    !raw.inodeId ||
    raw.inodeId.includes('\0')
  ) {
    throw new Error('fixture: invalid inodeId');
  }
  return {
    path,
    type: raw.type,
    mode,
    inodeId: raw.inodeId,
    data: bytesOf(raw.data),
  };
}

function mapEntries(files: unknown): FsEntry[] {
  if (!isRecord(files)) throw new Error('fixture: invalid UTF-8 file map');
  return Object.entries(files).map(([name, value], index) => {
    if (!name || name.startsWith('/') || typeof value !== 'string')
      throw new Error('fixture: invalid UTF-8 file');
    return {
      path: `${ROOT}/${name}`,
      type: 'file',
      mode: 0o644,
      inodeId: `fixture-file-${index}`,
      data: new TextEncoder().encode(value),
    };
  });
}

function insertEntry(
  found: Map<string, FsEntry>,
  inodes: Map<string, Extract<FsEntry, { type: 'file' }>>,
  raw: unknown,
) {
  const entry = entryOf(raw);
  if (found.has(entry.path)) throw new Error('fixture: duplicate path');
  if (ROOTS.includes(entry.path) && entry.type !== 'dir')
    throw new Error('fixture: root must be a directory');
  if (entry.type === 'file') {
    const peer = inodes.get(entry.inodeId);
    if (
      peer &&
      (peer.mode !== entry.mode ||
        peer.data.length !== entry.data.length ||
        !peer.data.every((byte, index) => byte === entry.data[index]))
    ) {
      throw new Error('fixture: hard-link group differs');
    }
    inodes.set(entry.inodeId, entry);
  }
  found.set(entry.path, entry);
}

function completeParents(found: Map<string, FsEntry>, cwd: string) {
  if (found.has(cwd) && found.get(cwd)?.type !== 'dir')
    throw new Error('fixture: cwd must be a directory');
  if (!found.has(cwd)) found.set(cwd, { path: cwd, type: 'dir', mode: 0o755 });
  for (const entry of [...found.values()]) {
    let path = parent(entry.path);
    while (inside(path)) {
      if (found.has(path) && found.get(path)?.type !== 'dir')
        throw new Error('fixture: non-directory parent');
      if (!found.has(path)) found.set(path, { path, type: 'dir', mode: 0o755 });
      path = parent(path);
    }
  }
}

/** Keep the undefined/default and explicit empty-fixture semantics. */
export function selectFixture(
  tool: { fixture?: string; cwd?: string },
  wanted: string | undefined,
  fixtures: Record<string, unknown>,
) {
  const name = wanted === undefined ? tool.fixture : wanted;
  if (name !== undefined && typeof name !== 'string')
    throw new Error('fixture: invalid selection');
  if (!name) return { name: '', cwd: ROOT };
  if (!fixtures || !Object.hasOwn(fixtures, name))
    throw new Error('fixture: unknown fixture');
  const cwd = pathOf(tool.cwd ?? ROOT);
  return { name, cwd };
}

/** Convert legacy UTF-8 maps or explicit byte-entry arrays to owned C1 seeds. */
export function convertFixture(payload: unknown, { cwd = ROOT } = {}) {
  const directory = pathOf(cwd);
  const entries = Array.isArray(payload) ? payload : mapEntries(payload);
  const found = new Map<string, FsEntry>();
  const inodes = new Map<string, Extract<FsEntry, { type: 'file' }>>();
  for (const raw of entries) insertEntry(found, inodes, raw);
  completeParents(found, directory);
  return [...found.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}
