import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../package/stage-package.js';
import { readBoundedFile } from '../release/publication-assets.js';
import { inspectCIInputs, installCIInputs } from './ci-inputs.js';

export const BLINK_IDENTITY = Object.freeze({
  head: 'a882fb2f3df14115b7e46f6812fb296eef5934d7',
  upstream: 'f006a4fc6f9b8de9272504fdff0dbbe5ce5dc580',
});
export type CoreGit = (directory: string, args: string[]) => string;
/** Git is required to restore/inspect Git's object-bundle format; never contacts a remote. */
const git: CoreGit = (directory, args) =>
  execFileSync(
    'git',
    [
      '-c',
      'protocol.allow=never',
      '-c',
      'protocol.file.allow=always',
      '-c',
      'core.hooksPath=/dev/null',
      ...args,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_COUNT: '0',
        GIT_TERMINAL_PROMPT: '0',
      },
    },
  ).trim();
export function validateBlinkLock(raw: string) {
  const values = new Map<string, string>();
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const match = /^([a-z_]+)=(.*)$/.exec(line);
    if (!match || values.has(match[1]!))
      throw Error('U2 core lock malformed/duplicate');
    values.set(match[1]!, match[2]!);
  }
  if (
    values.get('commit') !== BLINK_IDENTITY.head ||
    values.get('upstream_commit') !== BLINK_IDENTITY.upstream ||
    !/^[a-f0-9]{40}$/.test(values.get('commit') ?? '') ||
    !/^[a-f0-9]{40}$/.test(values.get('upstream_commit') ?? '')
  )
    throw Error('U2 core lock identity differs');
  return BLINK_IDENTITY;
}
export function inspectRestoredCore(directory: string, execute: CoreGit = git) {
  if (execute(directory, ['rev-parse', 'HEAD']) !== BLINK_IDENTITY.head)
    throw Error('U2 restored core HEAD differs');
  if (
    execute(directory, ['rev-parse', `${BLINK_IDENTITY.upstream}^{commit}`]) !==
    BLINK_IDENTITY.upstream
  )
    throw Error('U2 restored upstream object missing/differs');
  if (
    !execute(directory, [
      'diff',
      '--name-only',
      BLINK_IDENTITY.upstream,
      BLINK_IDENTITY.head,
    ])
      .split('\n')
      .includes('blink/emufd.c')
  )
    throw Error('U2 restored core upstream diff missing emufd');
  if (
    execute(directory, ['status', '--porcelain', '--untracked-files=all']) !==
    ''
  )
    throw Error('U2 restored core dirty');
}
export async function requireRestoredCore(root: string) {
  validateBlinkLock(await readFile(resolve(root, 'blink.lock'), 'utf8'));
  const directory = resolve(root, '.vendor/blink');
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw Error('U2 restored core directory refused');
  inspectRestoredCore(directory);
}
export async function restoreCoreBundle(root: string, manifestPath: string) {
  root = resolve(root);
  validateBlinkLock(await readFile(resolve(root, 'blink.lock'), 'utf8'));
  const checked = await inspectCIInputs(root, manifestPath);
  const row = checked.manifest.files.find(
    (file) => file.path === '.artifacts/migration-session/blink-source.bundle',
  );
  if (!row) throw Error('U2 core bundle input missing');
  const directory = resolve(root, '.vendor/blink'),
    parent = resolve(root, '.vendor');
  try {
    await lstat(directory);
    throw Error('U2 core restore refuses existing directory');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    const stat = await lstat(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw Error('U2 core parent directory refused');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const installed = await installCIInputs(root, manifestPath);
  const staging = resolve(
    root,
    `.artifacts/migration-session/core-restore-${randomUUID()}`,
  );
  let accepted = false;
  try {
    const bundle = resolve(root, row.path);
    const bytes = await readBoundedFile(bundle, 128 * 1024 * 1024);
    if (sha256(bytes) !== row.sha256 || bytes.length !== row.bytes)
      throw Error('U2 core bundle digest differs');
    // Self-contained v2 only: no prerequisites or imported refs/config/hooks.
    const header = bytes.subarray(0, 1024).toString('utf8').split('\n\n')[0];
    if (header !== `# v2 git bundle\n${BLINK_IDENTITY.head} HEAD`)
      throw Error('U2 core self-contained bundle header refused');
    await mkdir(staging, { recursive: true });
    const template = resolve(staging, 'empty-template');
    await mkdir(template);
    const repository = resolve(staging, 'repository');
    await mkdir(repository);
    git(repository, ['init', `--template=${template}`, '.']);
    git(repository, ['bundle', 'verify', bundle]);
    git(repository, [
      'fetch',
      '--no-tags',
      '--no-write-fetch-head',
      bundle,
      'HEAD',
    ]);
    git(repository, ['checkout', '--detach', BLINK_IDENTITY.head]);
    inspectRestoredCore(repository);
    await mkdir(parent, { recursive: true });
    await rename(repository, directory);
    accepted = true;
    const receipt = {
      recordKind: 'restored-local-git-bundle',
      assembledAt: new Date().toISOString(),
      head: BLINK_IDENTITY.head,
      upstream: BLINK_IDENTITY.upstream,
      bundleSha256: row.sha256,
      bundleBytes: row.bytes,
      manifestSha256: installed.manifestSha256,
      network: false,
      importedConfig: false,
      importedHooks: false,
    };
    const receiptPath = resolve(
      root,
      '.artifacts/migration-session/core-restore.json',
    );
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {
      flag: 'wx',
    });
    return receiptPath;
  } catch (error) {
    if (accepted) await rm(directory, { recursive: true, force: true });
    for (const path of installed.created.reverse()) await rm(path);
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [manifest, ...extra] = process.argv.slice(2);
  if (!manifest || extra.length)
    throw Error('usage: ci-core.js <input-manifest>');
  console.log(await restoreCoreBundle(process.cwd(), resolve(manifest)));
}
