import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, sha256 } from '../../scripts/build-key.ts';
import {
  DIR_MODE,
  EXECUTABLE_MODE,
  FILE_MODE,
  type FixtureEntry,
  type FixtureIndex,
  validateFixtureIndex,
} from '../src/model/fixture-index.ts';
import { comparePaths } from '../src/model/model-error.ts';
import { fail, SHOWCASE_DIR, writeText } from './common.ts';

/** Site path of the demo fixture indexes; never named like the regression fixtures (BR3.2, NFR2.1(4)). */
export const DEMO_FIXTURE_DIR = 'demo-fixtures';

/**
 * Reads showcase/fixtures/<name>/ entirely (app/ and the directories beside
 * it, NFR7.4). Modes are normalised; an empty directory, a symbolic link or a
 * special file fails the build.
 */
export async function readFixtureTree(root: string): Promise<FixtureEntry[]> {
  const entries: FixtureEntry[] = [];
  async function walk(directory: string, prefix: string): Promise<void> {
    const names = (await readdir(directory)).sort(comparePaths);
    if (prefix && names.length === 0)
      fail('fixture-invalid', `empty directory: ${prefix}`);
    for (const name of names) {
      const path = prefix ? `${prefix}/${name}` : name;
      const absolute = join(directory, name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink())
        fail('fixture-invalid', `symbolic link refused: ${path}`);
      if (info.isDirectory()) {
        entries.push({ path, type: 'dir', mode: DIR_MODE });
        await walk(absolute, path);
      } else if (info.isFile()) {
        const bytes = await readFile(absolute);
        entries.push({
          path,
          type: 'file',
          mode: info.mode & 0o111 ? EXECUTABLE_MODE : FILE_MODE,
          sha256: sha256(bytes),
          size: bytes.length,
          bytes: bytes.toString('base64'),
        });
      } else fail('fixture-invalid', `special file refused: ${path}`);
    }
  }
  await walk(root, '');
  if (entries.length === 0) fail('fixture-invalid', `empty fixture: ${root}`);
  return entries.sort((a, b) => comparePaths(a.path, b.path));
}

export async function buildFixtureIndex(
  name: string,
  fixturesDir = join(SHOWCASE_DIR, 'fixtures'),
): Promise<FixtureIndex> {
  return validateFixtureIndex({
    schemaVersion: 1,
    fixture: name,
    entries: await readFixtureTree(join(fixturesDir, name)),
  });
}

export interface WrittenIndex {
  fixture: string;
  path: string;
  sha256: string;
  bytes: number;
  entries: number;
}

/** Writes public/demo-fixtures/<name>.json (canonical JSON) for each fixture. */
export async function writeFixtureIndexes(
  names: readonly string[],
  publicDir: string,
  fixturesDir?: string,
): Promise<WrittenIndex[]> {
  const written: WrittenIndex[] = [];
  for (const name of [...new Set(names)].sort()) {
    const index = await buildFixtureIndex(name, fixturesDir);
    const text = canonicalJson(index);
    const path = `${DEMO_FIXTURE_DIR}/${name}.json`;
    await writeText(join(publicDir, path), text);
    written.push({
      fixture: name,
      path,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
      entries: index.entries.length,
    });
  }
  return written;
}
