import {
  checkRelativePath,
  comparePaths,
  exactKeys,
  isRecord,
  reject,
  SHA256_HEX,
} from './model-error.ts';

/** C11 bounds for the demo fixture index (maxArchiveEntries, maxPathBytes). */
export const FIXTURE_LIMITS = Object.freeze({
  maxEntries: 4096,
  maxPathBytes: 4096,
});
/** Normalised modes (NFR7.4): directories and executables 0755, files 0644. */
export const DIR_MODE = 0o755;
export const FILE_MODE = 0o644;
export const EXECUTABLE_MODE = 0o755;

export interface FixtureDirEntry {
  path: string;
  type: 'dir';
  mode: number;
}
export interface FixtureFileEntry {
  path: string;
  type: 'file';
  mode: number;
  sha256: string;
  size: number;
  /** File bytes in standard base64. */
  bytes: string;
}
export type FixtureEntry = FixtureDirEntry | FixtureFileEntry;
/** One demo fixture: the whole showcase/fixtures/<fixture>/ tree, path order. */
export interface FixtureIndex {
  schemaVersion: 1;
  fixture: string;
  entries: FixtureEntry[];
}

export const FIXTURE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const CODE = 'fixture-index-invalid';

/** A path below /work: relative, no `..`, absolute, empty segment or NUL. */
export const checkFixturePath = (path: unknown) =>
  checkRelativePath(CODE, path, FIXTURE_LIMITS.maxPathBytes);

function checkEntry(value: unknown): FixtureEntry {
  if (!isRecord(value)) reject(CODE, 'entry must be an object');
  const path = checkFixturePath(value.path);
  if (value.type === 'dir') {
    exactKeys(CODE, value, ['path', 'type', 'mode']);
    if (value.mode !== DIR_MODE) reject(CODE, `directory mode: ${path}`);
    return { path, type: 'dir', mode: DIR_MODE };
  }
  if (value.type !== 'file') reject(CODE, `entry type refused: ${path}`);
  exactKeys(CODE, value, ['path', 'type', 'mode', 'sha256', 'size', 'bytes']);
  if (value.mode !== FILE_MODE && value.mode !== EXECUTABLE_MODE)
    reject(CODE, `file mode: ${path}`);
  if (typeof value.sha256 !== 'string' || !SHA256_HEX.test(value.sha256))
    reject(CODE, `file sha256: ${path}`);
  if (!Number.isSafeInteger(value.size) || (value.size as number) < 0)
    reject(CODE, `file size: ${path}`);
  if (typeof value.bytes !== 'string' || !BASE64.test(value.bytes))
    reject(CODE, `file bytes must be base64: ${path}`);
  return {
    path,
    type: 'file',
    mode: value.mode,
    sha256: value.sha256,
    size: value.size as number,
    bytes: value.bytes,
  };
}

/**
 * Checks the whole index: shape, limits, strict path order without
 * duplicates, and that every parent directory is listed before its children.
 */
export function validateFixtureIndex(value: unknown): FixtureIndex {
  if (!isRecord(value)) reject(CODE, 'index must be an object');
  exactKeys(CODE, value, ['schemaVersion', 'fixture', 'entries']);
  if (value.schemaVersion !== 1) reject(CODE, 'schemaVersion must be 1');
  if (typeof value.fixture !== 'string' || !FIXTURE_NAME.test(value.fixture))
    reject(CODE, 'fixture name invalid');
  if (!Array.isArray(value.entries)) reject(CODE, 'entries must be an array');
  if (value.entries.length === 0) reject(CODE, 'entries must not be empty');
  if (value.entries.length > FIXTURE_LIMITS.maxEntries)
    reject(CODE, `more than ${FIXTURE_LIMITS.maxEntries} entries`);
  const entries = value.entries.map(checkEntry);
  const directories = new Set<string>();
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    if (previous && comparePaths(previous.path, entry.path) >= 0)
      reject(CODE, `entries out of order or duplicated: ${entry.path}`);
    const parent = entry.path.includes('/')
      ? entry.path.slice(0, entry.path.lastIndexOf('/'))
      : null;
    if (parent !== null && !directories.has(parent))
      reject(CODE, `parent directory missing: ${entry.path}`);
    if (entry.type === 'dir') directories.add(entry.path);
  });
  return { schemaVersion: 1, fixture: value.fixture, entries };
}
