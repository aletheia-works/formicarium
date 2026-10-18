import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';

// WebKit refuses some module imports of a Worker that coi-serviceworker
// isolates, so browsers start this import-free copy of the package Worker.
export const WORKER_BUNDLE_ENTRY = 'runtime/web/package-worker.js';
export const WORKER_BUNDLE = 'runtime/web/package-worker.bundle.js';
export const WORKER_BUNDLE_MAP = `${WORKER_BUNDLE}.map`;

/** Bundle the package Worker below `root` with Bun's bundler (same input, same bytes). */
export function buildWorkerBundle({
  root,
  bun = process.versions.bun ? process.execPath : 'bun',
}: {
  root: string;
  bun?: string;
}) {
  execFileSync(
    bun,
    [
      'build',
      WORKER_BUNDLE_ENTRY,
      '--target',
      'browser',
      '--format',
      'esm',
      '--external',
      'node:*',
      '--sourcemap=external',
      '--outdir',
      dirname(WORKER_BUNDLE),
      '--entry-naming',
      '[name].bundle.[ext]',
    ],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

/** Root-relative modules that the bundle's source map names; unknown shapes fail closed. */
export async function workerBundleSources(root: string) {
  const map = JSON.parse(
    await readFile(resolve(root, WORKER_BUNDLE_MAP), 'utf8'),
  ) as { version?: unknown; sources?: unknown };
  if (
    map.version !== 3 ||
    !Array.isArray(map.sources) ||
    map.sources.some((source) => typeof source !== 'string')
  )
    throw Error('Worker bundle source map is malformed');
  return (map.sources as string[]).map((source) => {
    const path = posix.normalize(
      posix.join(posix.dirname(WORKER_BUNDLE), source),
    );
    if (path.startsWith('../') || posix.isAbsolute(path))
      throw Error(`Worker bundle source escapes the package: ${source}`);
    return path;
  });
}
