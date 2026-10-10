import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePayloadInventory } from './bundle.js';
import {
  type InputManifest,
  validateManifestContents,
  verifyPins,
} from './verification.js';

export async function candidateSourcePaths(root: string) {
  const paths = [
    'package.json',
    'bun.lock',
    'mise.toml',
    'blink.lock',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'tsconfig.json',
    'tsconfig.tests.json',
    'biome.json',
    'playwright.config.ts',
    '.github/workflows/ci.yml',
    '.github/workflows/candidate-verify.yml',
  ];
  async function walk(directory: string) {
    for (const row of await readdir(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${row.name}`;
      if (
        row.isDirectory() &&
        ![
          'target',
          'node_modules',
          '__pycache__',
          'test-results',
          'playwright-report',
        ].includes(row.name)
      )
        await walk(path);
      else if (row.isFile() && !/\.js(?:\.map)?$/.test(path)) paths.push(path);
      else if (row.isSymbolicLink()) throw Error(`symlink source: ${path}`);
    }
  }
  for (const directory of [
    'runtime',
    'scripts',
    'tests',
    'integration',
    'patches',
    'guest',
  ])
    await walk(directory);
  return paths.sort();
}

export function validateCandidateManifest(
  manifest: InputManifest,
  context: { repository: string; commit: string; event: string; ref: string },
) {
  if (
    context.repository !== 'aletheia-works/formicarium' ||
    context.event !== 'workflow_dispatch' ||
    !context.ref.startsWith('refs/heads/')
  )
    throw Error('untrusted modernization candidate source');
  validateManifestContents(manifest, context);
  const resolver = '.artifacts/ci-candidate/inputs/resolver/';
  for (const name of ['manifest.js', 'fixtures.js', 'resolver.js'])
    if (!manifest.files.some((row) => row.path === resolver + name))
      throw Error(`required resolver missing: ${name}`);
}

export async function validateCandidateInputs(options: {
  root: string;
  inputRoot: string;
  context: { repository: string; commit: string; event: string; ref: string };
  sourcePaths: string[];
}) {
  const manifest = JSON.parse(
    await readFile(resolve(options.inputRoot, 'manifest.json'), 'utf8'),
  ) as InputManifest;
  validateCandidateManifest(manifest, options.context);
  if (
    JSON.stringify(manifest.sourceFiles.map((row) => row.path).sort()) !==
    JSON.stringify([...options.sourcePaths].sort())
  )
    throw Error('candidate source inventory differs');
  await verifyPins(options.root, manifest.sourceFiles);
  await validatePayloadInventory(
    resolve(options.inputRoot, 'payload'),
    manifest.files.map((row) => row.path),
  );
  await verifyPins(resolve(options.inputRoot, 'payload'), manifest.files);
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = process.cwd();
  await validateCandidateInputs({
    root,
    inputRoot: resolve(root, '.ci-inputs'),
    sourcePaths: await candidateSourcePaths(root),
    context: {
      repository: process.env.GITHUB_REPOSITORY ?? '',
      commit: process.env.GITHUB_SHA ?? '',
      event: process.env.GITHUB_EVENT_NAME ?? '',
      ref: process.env.GITHUB_REF ?? '',
    },
  });
  // Loading the regression/coverage runner is an execution boundary. Pure
  // input validation must not require generated distribution collector data.
  const { runVerification } = await import('./run.js');
  await runVerification(validateCandidateManifest);
}
