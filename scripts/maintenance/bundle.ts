import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BoundaryError } from './archive.ts';
import { executeCommand } from './reproduce.ts';

export async function verifyRunnerBundle(
  root: string,
  bunExecutable: string,
  biomeExecutable = resolve(root, 'node_modules/@biomejs/biome/bin/biome'),
): Promise<string> {
  if (!bunExecutable.startsWith('/') || !biomeExecutable.startsWith('/'))
    throw new BoundaryError('UNTRUSTED_EXECUTABLE');
  const workspace = await mkdtemp(join(tmpdir(), 'formicarium-bundle-'));
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: workspace,
    TMPDIR: workspace,
  };
  try {
    const version = Buffer.from(
      await executeCommand({
        executable: bunExecutable,
        args: ['--version'],
        cwd: root,
        env,
      }),
    )
      .toString()
      .trim();
    if (version !== '1.4.2') throw new BoundaryError('TOOLCHAIN_MISMATCH');
    const biomeVersion = Buffer.from(
      await executeCommand({
        executable: biomeExecutable,
        args: ['--version'],
        cwd: root,
        env,
      }),
    )
      .toString()
      .trim();
    if (biomeVersion !== 'Version: 2.5.15')
      throw new BoundaryError('TOOLCHAIN_MISMATCH');
    const output = join(workspace, 'runner.mjs');
    await executeCommand({
      executable: bunExecutable,
      args: [
        'build',
        'scripts/maintenance/runner.ts',
        '--target=node',
        '--format=esm',
        '--packages=bundle',
        `--outfile=${output}`,
      ],
      cwd: root,
      env,
    });
    await executeCommand({
      executable: biomeExecutable,
      args: [
        'check',
        '--write',
        `--config-path=${resolve(root, 'biome.json')}`,
        output,
      ],
      cwd: root,
      env,
    });
    const actual = await readFile(output),
      tracked = await readFile(resolve(root, '.github/maintenance/runner.mjs'));
    if (!actual.equals(tracked)) throw new BoundaryError('BUNDLE_MISMATCH');
    return output;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
