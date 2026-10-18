import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSourceInventory } from '../migration-install/stage.js';
import {
  FIRST_PARTY_JS,
  sha256,
  stagePackage,
} from '../package/stage-package.js';
import { verifyPackage } from '../package/verify-package.js';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
export const COMMAND_UNIT = 'u4-command';
/** U4 adds exactly these two first-party JS files to the U3 twenty-one. */
export const COMMAND_JS = Object.freeze([
  'runtime/command-parse.js',
  'runtime/command.js',
]);
export const COMMAND_FIRST_PARTY_COUNT = 23;

export function assertCommandDistribution(
  inventory: readonly string[] = FIRST_PARTY_JS,
): void {
  if (
    inventory.length !== COMMAND_FIRST_PARTY_COUNT ||
    new Set(inventory).size !== inventory.length ||
    COMMAND_JS.some((path) => !inventory.includes(path))
  )
    throw Error('U4 fixed 23 first-party JS inventory differs');
}

/** Retains the U2+U3 regression inventory, and adds every U4 test, task and doc. */
export async function commandSourceInventory(root = workspace) {
  const shared = await installSourceInventory(root);
  const paths: string[] = [
    'docs/command-api.md',
    '.github/workflows/migration-command-u4.yml',
  ];
  for (const directory of [
    'scripts/migration-command',
    'tests/migration-command',
  ]) {
    for (const entry of await readdir(resolve(root, directory), {
      withFileTypes: true,
    })) {
      if (entry.isSymbolicLink() || entry.isDirectory())
        throw Error(`unexpected U4 source entry: ${directory}/${entry.name}`);
      if (/\.(?:ts|js|json)$/.test(entry.name))
        paths.push(`${directory}/${entry.name}`);
    }
  }
  const inventory = new Map(shared.map((entry) => [entry.path, entry]));
  for (const path of paths)
    inventory.set(path, {
      path,
      sha256: sha256(await readFile(resolve(root, path))),
    });
  return [...inventory.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

/** Local U4 candidate preparation only. No source version change or publication. */
export async function stageCommand({
  root = workspace,
  sourceCommit = process.env.FORMICARIUM_SESSION_SOURCE,
  out = `.artifacts/migration-command/candidate-${randomUUID()}/package`,
} = {}) {
  if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit))
    throw Error('exact FORMICARIUM_SESSION_SOURCE base revision required');
  assertCommandDistribution();
  const destination = resolve(root, out);
  if (!relative(root, destination).startsWith('.artifacts/migration-command/'))
    throw Error('U4 stage must be below .artifacts/migration-command/');
  const sourceFiles = await commandSourceInventory(root);
  const candidate = await stagePackage({ root, out });
  const packagePath = resolve(destination, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  manifest.version = '0.3.0';
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  candidate.version = '0.3.0';
  candidate.files.find((entry) => entry.path === 'package.json')!.sha256 =
    sha256(await readFile(packagePath));
  const candidatePath = `${destination}.manifest.json`;
  await writeFile(
    candidatePath,
    `${JSON.stringify(
      {
        ...candidate,
        unit: COMMAND_UNIT,
        provisional: true,
        sourceCommit,
        sourceCommitKind: 'base-revision-with-working-source-inventory',
        sourceFiles,
        sourceIdentity: sha256(JSON.stringify(sourceFiles)),
        distributionInventory: FIRST_PARTY_JS,
      },
      null,
      2,
    )}\n`,
  );
  const npm = resolve(
    dirname(process.execPath),
    '../lib/node_modules/npm/bin/npm-cli.js',
  );
  execFileSync(process.execPath, [npm, 'pack', '--ignore-scripts'], {
    cwd: destination,
    stdio: 'inherit',
  });
  await verifyPackage({
    manifestPath: candidatePath,
    tarballPath: resolve(destination, 'aletheia-works-formicarium-0.3.0.tgz'),
  });
  if (
    JSON.stringify(await commandSourceInventory(root)) !==
    JSON.stringify(sourceFiles)
  )
    throw Error('U4 source changed while staging');
  return candidatePath;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(await stageCommand());
