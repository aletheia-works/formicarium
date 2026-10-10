import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetDigest } from './publication-assets.ts';

function run(executable: string, args: string[], root: string) {
  if (!executable.startsWith('/')) throw Error('UNTRUSTED_EXECUTABLE');
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { PATH: process.env.PATH ?? '', HOME: root },
    encoding: 'utf8',
    shell: false,
  });
  if (result.signal || result.error || result.status !== 0)
    throw Error('BUNDLE_TOOL_FAILED');
  return result.stdout.trim();
}
export async function publicationBundles(
  root: string,
  bun: string,
  biome: string,
  generate = false,
) {
  if (
    run(bun, ['--version'], root) !== '1.4.2' ||
    run(biome, ['--version'], root) !== 'Version: 2.5.15'
  )
    throw Error('BUNDLE_TOOLCHAIN_MISMATCH');
  const temporary = await mkdtemp(join(tmpdir(), 'publication-bundle-'));
  const directory = resolve(root, '.github/publication');
  try {
    const results: { path: string; sha256: string; size: number }[] = [];
    for (const [source, name] of [
      ['scripts/release/publication-cli.ts', 'runner.mjs'],
      ['scripts/release/bootstrap.ts', 'bootstrap.mjs'],
    ] as const) {
      const output = join(temporary, name);
      run(
        bun,
        [
          'build',
          source,
          '--target=node',
          '--format=esm',
          '--packages=bundle',
          `--outfile=${output}`,
        ],
        root,
      );
      run(
        biome,
        [
          'check',
          '--write',
          `--config-path=${resolve(root, 'biome.json')}`,
          output,
        ],
        root,
      );
      const bytes = await readFile(output);
      if (generate) {
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, name), bytes);
      } else if (!bytes.equals(await readFile(join(directory, name))))
        throw Error('BUNDLE_MISMATCH');
      if (name === 'runner.mjs')
        results.push({
          path: name,
          sha256: assetDigest(bytes),
          size: bytes.length,
        });
    }
    const policy = await readFile(join(directory, 'trusted-policy.json'));
    results.push({
      path: 'trusted-policy.json',
      sha256: assetDigest(policy),
      size: policy.length,
    });
    const manifest = Buffer.from(
      `${JSON.stringify({ schemaVersion: 1, files: results }, null, 2)}\n`,
    );
    if (generate)
      await writeFile(join(directory, 'runner-manifest.json'), manifest);
    else if (
      !manifest.equals(await readFile(join(directory, 'runner-manifest.json')))
    )
      throw Error('BUNDLE_MANIFEST_MISMATCH');
    return results;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [mode, bun, biome] = process.argv.slice(2);
  if (!['generate', 'verify'].includes(mode ?? '') || !bun || !biome)
    throw Error(
      'usage: bundle generate|verify <absolute-bun> <absolute-biome>',
    );
  await publicationBundles(process.cwd(), bun, biome, mode === 'generate');
}
