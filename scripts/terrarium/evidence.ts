import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
export async function directoryIdentity(directory: string) {
  const root = await realpath(directory),
    files: { path: string; size: number; sha256: string }[] = [];
  async function walk(current: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), relative);
      else if (entry.isFile()) {
        const bytes = await readFile(join(current, entry.name));
        files.push({
          path: relative,
          size: bytes.length,
          sha256: sha256(bytes),
        });
      } else throw new Error(`candidate special file refused: ${relative}`);
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root, files, sha256: sha256(JSON.stringify(files)) };
}
