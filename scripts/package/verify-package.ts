import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_FILES, sha256 } from './stage-package.js';

/** Verify npm's real archive inventory and bytes, then bind evidence to one tgz. */
export async function verifyPackage({
  manifestPath,
  tarballPath,
}: {
  manifestPath: string;
  tarballPath: string;
}) {
  const path = resolve(manifestPath);
  const tarball = resolve(tarballPath);
  const candidate = JSON.parse(await readFile(path, 'utf8'));
  const inventory = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  const actual = inventory
    .filter((name) => !name.endsWith('/'))
    .map((name) => {
      if (!name.startsWith('package/') || name.includes('..'))
        throw new Error('unsafe archive path');
      return name.slice(8);
    })
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify([...PACKAGE_FILES].sort()))
    throw new Error('archive inventory differs from fixed package files');
  for (const entry of candidate.files) {
    // The core's wasm alone is several MB, above the default 1 MB buffer.
    const bytes = execFileSync(
      'tar',
      ['-xOzf', tarball, `package/${entry.path}`],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    if (sha256(bytes) !== entry.sha256)
      throw new Error(`archive digest differs: ${entry.path}`);
  }
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], {
      encoding: 'utf8',
    }),
  );
  if (
    manifest.name !== candidate.package ||
    manifest.version !== candidate.version ||
    manifest.private !== true
  )
    throw new Error('archive package identity differs');
  if (
    Object.keys(manifest.exports).length !== 6 ||
    manifest.scripts ||
    manifest.devDependencies
  )
    throw new Error('archive public surface differs');
  candidate.tarball = {
    path: tarball,
    filename: basename(tarball),
    sha256: sha256(await readFile(tarball)),
  };
  await writeFile(path, `${JSON.stringify(candidate, null, 2)}\n`);
  return candidate;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [manifestPath, tarballPath] = process.argv.slice(2);
  if (!manifestPath || !tarballPath || process.argv.length !== 4)
    throw new Error('usage: verify-package.js <manifest.json> <exact.tgz>');
  console.log(
    JSON.stringify(await verifyPackage({ manifestPath, tarballPath })),
  );
}
