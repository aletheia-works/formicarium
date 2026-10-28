import type { FsEntry } from '@aletheia-works/formicarium';
import {
  type FixtureIndex,
  validateFixtureIndex,
} from '../model/fixture-index.ts';
import {
  decodeJson,
  FetchFailure,
  type FetchLimitedOptions,
  fetchVerified,
  MAX_FIXTURE_INDEX_BYTES,
  sha256Hex,
} from './fetch-limited.ts';
import type { HomeFile } from './page-data.ts';

/** Guest directory that holds the whole fixture tree (cwd is /work/app). */
export const WORK_ROOT = '/work';
export const WORK_CWD = '/work/app';
/** The session home, where tools read their settings. */
export const HOME = '/root';

/** Fetches demo-fixtures/<fixture>.json and checks its embedded SHA256. */
export async function loadFixtureIndex(options: {
  url: string;
  sha256: string;
  fetch?: Omit<FetchLimitedOptions, 'maxBytes'>;
}): Promise<FixtureIndex> {
  const bytes = await fetchVerified(options.url, options.sha256, {
    ...options.fetch,
    maxBytes: MAX_FIXTURE_INDEX_BYTES,
  });
  try {
    return validateFixtureIndex(decodeJson(bytes, options.url));
  } catch (error) {
    if (error instanceof FetchFailure) throw error;
    throw new FetchFailure(
      'bad-body',
      options.url,
      error instanceof Error ? error.message : 'fixture index invalid',
    );
  }
}

function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * FsEntry list below /work: each file's bytes are decoded and checked against
 * its size and SHA256, and each file gets its own inodeId (no hard links).
 */
export async function fixtureToEntries(
  index: FixtureIndex,
): Promise<FsEntry[]> {
  const entries: FsEntry[] = [{ path: WORK_ROOT, type: 'dir', mode: 0o755 }];
  let inode = 0;
  for (const entry of index.entries) {
    const path = `${WORK_ROOT}/${entry.path}`;
    if (entry.type === 'dir') {
      entries.push({ path, type: 'dir', mode: entry.mode });
      continue;
    }
    const data = decodeBase64(entry.bytes);
    if (data.length !== entry.size || (await sha256Hex(data)) !== entry.sha256)
      throw new FetchFailure(
        'digest-mismatch',
        path,
        'fixture file differs from its index',
      );
    inode += 1;
    entries.push({
      path,
      type: 'file',
      mode: entry.mode,
      inodeId: `${index.fixture}-${inode}`,
      data,
    });
  }
  return entries;
}

/** The empty terminal: only /work and /work/app. */
export const emptyEntries = (): FsEntry[] => [
  { path: WORK_ROOT, type: 'dir', mode: 0o755 },
  { path: WORK_CWD, type: 'dir', mode: 0o755 },
];

/**
 * The home files below /root, each with the directories above it, so a tool
 * finds its settings on every page (tools.json `homeFiles`).
 */
export function homeEntries(files: readonly HomeFile[]): FsEntry[] {
  const directories = new Set<string>();
  const entries: FsEntry[] = [];
  for (const [index, file] of files.entries()) {
    const parts = file.path.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      const path = `${HOME}/${parts.slice(0, depth).join('/')}`;
      if (directories.has(path)) continue;
      directories.add(path);
      entries.push({ path, type: 'dir', mode: 0o755 });
    }
    entries.push({
      path: `${HOME}/${file.path}`,
      type: 'file',
      mode: 0o644,
      inodeId: `home-${index + 1}`,
      data: new TextEncoder().encode(file.text),
    });
  }
  return entries;
}
