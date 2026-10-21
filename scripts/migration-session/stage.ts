import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIRST_PARTY_JS,
  sha256,
  stagePackage,
} from '../package/stage-package.js';
import { verifyPackage } from '../package/verify-package.js';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
export async function sessionSourceInventory(root = workspace) {
  const paths = [
    'package.json',
    'mise.toml',
    'blink.lock',
    'README.md',
    'scripts/package/coverage-inventory.json',
    'scripts/playwright-build-config.ts',
    'scripts/playwright-build-config.js',
    'scripts/terrarium/coverage.ts',
    'scripts/terrarium/coverage.js',
    'tests/terrarium/coverage.test.ts',
    'tests/terrarium/coverage.test.js',
    'tests/package/public.test.ts',
    'tests/package/public.test.js',
    'tests/package/coverage.test.ts',
    'tests/package/coverage.test.js',
    'tests/release/publication-alignment-fixture.ts',
    'tests/release/publication-alignment-fixture.js',
    'tests/tooling/publication-alignment.test.ts',
    'tests/tooling/publication-alignment.test.js',
    'tests/tooling/publication-version.test.ts',
    'tests/tooling/publication-version.test.js',
  ];
  for (const directory of [
    'runtime',
    'types',
    'scripts/package',
    'scripts/ci',
    'scripts/release',
    'scripts/migration-session',
    'tests/package',
    'tests/shared',
    'tests/node',
    'tests/browser',
    'tests/migration-session',
  ]) {
    async function scan(path: string): Promise<void> {
      for (const entry of await readdir(resolve(root, path), {
        withFileTypes: true,
      })) {
        const child = `${path}/${entry.name}`;
        if (entry.isSymbolicLink())
          throw Error(`source inventory symlink: ${child}`);
        if (entry.isDirectory()) await scan(child);
        else if (/\.(?:ts|js|json)$/.test(entry.name)) paths.push(child);
      }
    }
    await scan(directory);
  }
  return Promise.all(
    [...new Set(paths)].sort().map(async (path) => ({
      path,
      sha256: sha256(await readFile(resolve(root, path))),
    })),
  );
}

/** Provisional U2 pack only: never changes root version or publishes a package. */
export async function stageSession({
  root = workspace,
  sourceCommit = process.env.FORMICARIUM_SESSION_SOURCE,
  out = `.artifacts/migration-session/candidate-${randomUUID()}/package`,
} = {}) {
  if (!sourceCommit || !/^[0-9a-f]{40}$/.test(sourceCommit))
    throw Error('exact FORMICARIUM_SESSION_SOURCE commit required');
  const destination = resolve(root, out);
  if (!relative(root, destination).startsWith('.artifacts/migration-session/'))
    throw Error('U2 staging must be below .artifacts/migration-session/');
  const sourceFiles = await sessionSourceInventory(root);
  const candidate = await stagePackage({ root, out });
  const packagePath = resolve(destination, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  manifest.version = '0.3.0';
  await writeFile(packagePath, JSON.stringify(manifest, null, 2) + '\n');
  candidate.version = '0.3.0';
  candidate.files.find((file) => file.path === 'package.json')!.sha256 = sha256(
    await readFile(packagePath),
  );
  const candidatePath = `${destination}.manifest.json`;
  await writeFile(
    candidatePath,
    JSON.stringify(
      {
        ...candidate,
        unit: 'u2-session-guest-api',
        provisional: true,
        sourceCommit,
        sourceCommitKind: 'base-revision-with-working-source-inventory',
        sourceFiles,
        sourceIdentity: sha256(JSON.stringify(sourceFiles)),
        distributionInventory: FIRST_PARTY_JS,
      },
      null,
      2,
    ) + '\n',
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
    JSON.stringify(await sessionSourceInventory(root)) !==
    JSON.stringify(sourceFiles)
  )
    throw Error('source changed while staging');
  return candidatePath;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(await stageSession());
