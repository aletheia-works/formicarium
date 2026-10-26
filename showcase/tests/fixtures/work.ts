import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
} from '../../scripts/paths.ts';

/** A fresh work layout inside the project (showcase/.work), removed after use. */
export async function withLayout<T>(work: (layout: WorkLayout) => Promise<T>) {
  const root = join(SHOWCASE_ROOT, '.work', `test-${randomUUID()}`);
  try {
    return await work(workLayout(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export const MAIN_ALLOWED = JSON.stringify({
  schemaVersion: 1,
  repositories: [
    'https://github.com/aubepkg/aube',
    'https://github.com/jdx/pitchfork',
    'https://github.com/biomejs/biome',
    'https://git.savannah.gnu.org/git/nano.git',
    'https://github.com/ThomasDickey/ncurses-snapshots',
  ],
});
/** Stand-in for `git show origin/main:<path>` in unit tests. */
export const readMain = (path: string) => {
  if (path === 'showcase/allowed-sources.json') return MAIN_ALLOWED;
  throw Error(`unexpected main read ${path}`);
};
