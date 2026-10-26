import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './build-key.ts';
import { fail } from './errors.ts';

/** showcase/ directory (this file lives in showcase/scripts/). */
export const SHOWCASE_ROOT = fileURLToPath(new URL('../', import.meta.url));
/** formicarium repository root. */
export const REPOSITORY_ROOT = resolve(SHOWCASE_ROOT, '..');

/**
 * Layout of the work directory (gitignored). Each job only reads the files
 * the previous jobs wrote; nothing here is a candidate until candidate.ts
 * assembles and checks it.
 */
export function workLayout(work = resolve(SHOWCASE_ROOT, '.work')) {
  return Object.freeze({
    root: work,
    resolutions: join(work, 'resolutions.json'),
    licenses: join(work, 'licenses'),
    /** Signed GNU tarballs and their signatures (build input and site source). */
    tarballs: join(work, 'tarballs'),
    acquired: join(work, 'acquired'),
    plans: join(work, 'build-plans'),
    sources: join(work, 'sources'),
    staging: join(work, 'staging'),
    site: join(work, 'site'),
    catalog: join(work, 'site', 'catalog.json'),
    pack: join(work, 'pack'),
    acceptance: join(work, 'acceptance'),
    tls: join(work, 'tls'),
    candidate: join(work, 'candidate'),
  });
}
export type WorkLayout = ReturnType<typeof workLayout>;

/** Writes a file exactly once; an existing file is a failure, never replaced. */
export async function writeOnce(
  path: string,
  bytes: string | Uint8Array,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      fail('output-exists', `refusing to overwrite ${path}`);
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Relative POSIX path that must stay below the base directory. */
export function inside(base: string, target: string): string {
  const path = relative(base, target);
  if (!path || path.startsWith('..') || resolve(base, path) !== target)
    fail('archive-invalid', `path escapes ${base}`);
  return path.split(sep).join('/');
}

export interface InventoryFile {
  path: string;
  sha256: string;
  bytes: number;
}

/** Regular files below a directory in canonical path order; links are refused. */
export async function fileInventory(
  directory: string,
  base = directory,
): Promise<InventoryFile[]> {
  const files: InventoryFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      fail('config-invalid', `symbolic link refused: ${path}`);
    if (entry.isDirectory()) files.push(...(await fileInventory(path, base)));
    else if (entry.isFile()) {
      const bytes = await readFile(path);
      files.push({
        path: inside(base, path),
        sha256: sha256(bytes),
        bytes: bytes.length,
      });
    } else fail('config-invalid', `special file refused: ${path}`);
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
