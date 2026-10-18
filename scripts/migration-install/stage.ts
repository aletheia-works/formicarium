import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionSourceInventory } from '../migration-session/stage.js';
import {
  FIRST_PARTY_JS,
  sha256,
  stagePackage,
} from '../package/stage-package.js';
import { verifyPackage } from '../package/verify-package.js';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
/** Retains the shared regression source inventory, and adds every U3 test/task. */
export async function installSourceInventory(root = workspace) {
  const shared = await sessionSourceInventory(root);
  const paths: string[] = [
    'tsconfig.json',
    'tsconfig.tests.json',
    '.github/workflows/migration-install-u3.yml',
  ];
  for (const directory of [
    'scripts/migration-install',
    'tests/migration-install',
  ]) {
    for (const entry of await readdir(resolve(root, directory), {
      withFileTypes: true,
    })) {
      if (entry.isSymbolicLink() || entry.isDirectory())
        throw Error(`unexpected U3 source entry: ${directory}/${entry.name}`);
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
export type SourceInventory = Awaited<
  ReturnType<typeof installSourceInventory>
>;
/** Candidate units the U3 acceptance entries accept on the current tree. */
export const INSTALL_REGRESSION_UNITS: readonly string[] = Object.freeze([
  'u3-install',
  'u4-command',
]);
export interface InstallCandidateOptions {
  /** Supplied by the U4 entries, so U3 never imports a U4 module. */
  commandSourceInventory?: (root: string) => Promise<SourceInventory>;
}
/**
 * The source inventory a candidate must match. A U3 candidate always uses the
 * U3 inventory; a U4 candidate needs the inventory its caller supplies.
 */
export async function installCandidateInventory(
  unit: unknown,
  root = workspace,
  options: InstallCandidateOptions = {},
): Promise<SourceInventory> {
  if (unit === 'u3-install') return await installSourceInventory(root);
  if (unit === 'u4-command' && options.commandSourceInventory)
    return await options.commandSourceInventory(root);
  throw Error(
    `U3 acceptance has no source inventory for candidate unit ${String(unit)}`,
  );
}
/** Local U3 candidate preparation only. No source version change or publication. */
export async function stageInstall({
  root = workspace,
  sourceCommit = process.env.FORMICARIUM_SESSION_SOURCE,
  out = `.artifacts/migration-install/candidate-${randomUUID()}/package`,
} = {}) {
  if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit))
    throw Error('exact FORMICARIUM_SESSION_SOURCE base revision required');
  const destination = resolve(root, out);
  if (!relative(root, destination).startsWith('.artifacts/migration-install/'))
    throw Error('U3 stage must be below .artifacts/migration-install/');
  const sourceFiles = await installSourceInventory(root);
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
    `${JSON.stringify({ ...candidate, unit: 'u3-install', provisional: true, sourceCommit, sourceCommitKind: 'base-revision-with-working-source-inventory', sourceFiles, sourceIdentity: sha256(JSON.stringify(sourceFiles)), distributionInventory: FIRST_PARTY_JS }, null, 2)}\n`,
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
    JSON.stringify(await installSourceInventory(root)) !==
    JSON.stringify(sourceFiles)
  )
    throw Error('U3 source changed while staging');
  return candidatePath;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(await stageInstall());
