import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  preparePublication,
  validatePublication,
} from '../release/publication.ts';
import { createBundle } from './bundle.js';
import { candidateSourcePaths, validateCandidateInputs } from './candidate.js';
import { GUEST_REFS, hash, type InputManifest } from './verification.js';

export function releaseCandidateContext(event: {
  number?: number;
  pull_request?: {
    head?: { sha?: string };
    base?: { repo?: { full_name?: string } };
  };
}) {
  const sha = event.pull_request?.head?.sha;
  if (
    !Number.isSafeInteger(event.number) ||
    (event.number ?? 0) < 1 ||
    !sha ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    event.pull_request?.base?.repo?.full_name !== 'aletheia-works/formicarium'
  )
    throw Error('release candidate requires an observed pull request head');
  return {
    repository: 'aletheia-works/formicarium',
    commit: sha,
    event: 'pull_request',
    ref: `refs/pull/${event.number}/merge`,
  };
}

export function candidateVersion(version: unknown): string {
  if (
    typeof version !== 'string' ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
  )
    throw Error('release candidate version invalid');
  return version;
}

/** Read-only candidate builds may be dispatched only on the upstream main SHA. */
export function dispatchedCandidateContext(context: {
  repository: string;
  commit: string;
  event: string;
  ref: string;
}) {
  if (
    context.repository !== 'aletheia-works/formicarium' ||
    context.event !== 'workflow_dispatch' ||
    context.ref !== 'refs/heads/main' ||
    !/^[a-f0-9]{40}$/.test(context.commit)
  )
    throw Error('release candidate dispatch requires upstream main');
  return context;
}

/** A stable tag runs fresh regression/coverage; it never re-labels PR evidence. */
export function taggedCandidateContext(
  context: { repository: string; commit: string; event: string; ref: string },
  version: string,
) {
  if (
    context.repository !== 'aletheia-works/formicarium' ||
    context.event !== 'push' ||
    context.ref !== `refs/tags/v${candidateVersion(version)}` ||
    !/^[a-f0-9]{40}$/.test(context.commit)
  )
    throw Error(
      'release candidate tag requires exact upstream stable version/source',
    );
  return context;
}

/** Every release is stable; the candidate is package.json's version. */
async function selectedVersion(root: string) {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  return candidateVersion(pkg.version);
}

/** Bind PR execution to its actual head; the publication validator is unchanged. */
export function validateReleaseCandidateContext(
  manifest: InputManifest,
  context: { repository: string; commit: string; event: string; ref: string },
  expected: ReturnType<typeof releaseCandidateContext>,
) {
  if (
    manifest.sourceCommit !== expected.commit ||
    context.repository !== expected.repository ||
    context.commit !== expected.commit ||
    context.event !== expected.event ||
    context.ref !== expected.ref
  )
    throw Error('release candidate execution differs from observed source');
  // Reuse strict inventory validation without admitting PRs to the publication workflow.
  return {
    ...expected,
    event: 'workflow_dispatch',
    ref: 'refs/heads/release-candidate',
  };
}

async function eventContext() {
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    return taggedCandidateContext(
      {
        repository: process.env.GITHUB_REPOSITORY ?? '',
        commit: process.env.GITHUB_SHA ?? '',
        event: 'push',
        ref: process.env.GITHUB_REF ?? '',
      },
      pkg.version,
    );
  }
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch')
    return dispatchedCandidateContext({
      repository: process.env.GITHUB_REPOSITORY ?? '',
      commit: process.env.GITHUB_SHA ?? '',
      event: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF ?? '',
    });
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request')
    throw Error(
      'release candidate requires pull_request or upstream main dispatch',
    );
  return releaseCandidateContext(
    JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, 'utf8')),
  );
}

async function preparePublic(root: string) {
  const context = await eventContext();
  const version = await selectedVersion(root);
  const identity = {
    repository: context.repository,
    workflow: 'publish.yml' as const,
    environment: 'release',
    sourceCommit: context.commit,
    version,
    tag: `v${version}`,
    distTag: 'latest' as const,
  };
  const out = resolve(root, '.artifacts/release-candidate');
  await preparePublication({
    originalManifestPath: `${out}/private.manifest.json`,
    originalTarballPath: `${out}/private.tgz`,
    out: `${out}/public`,
    identity,
  });
  await writeFile(`${out}/identity.json`, JSON.stringify(identity, null, 2));
}

/** The product-build guests the candidate runs, by their name in dist/guests. */
const CANDIDATE_GUESTS = Object.freeze([
  'probe',
  'hello',
  'exit3',
  'aube',
  'aube.commit',
  'pitchfork',
  'pitchfork.build-info',
  'pitchfork.commit',
]);
/** Where the package tests read the guest built from tests/package/fixtures/guest.rs. */
const FIXTURE_GUEST = '.artifacts/u1-fixture/guest';

/** Every file under a source directory, as paths relative to the root. */
async function sourceFiles(root: string, directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const row of await readdir(resolve(root, directory), {
    withFileTypes: true,
  })) {
    const path = `${directory}/${row.name}`;
    if (row.isDirectory()) paths.push(...(await sourceFiles(root, path)));
    else if (row.isFile()) paths.push(path);
    else throw Error(`nonregular fixture: ${path}`);
  }
  return paths.sort();
}

/**
 * Bind the fresh candidate, the guests this run's product build compiled
 * (downloaded to .ci-products) and this source's fixtures into .ci-inputs.
 */
export async function prepareInputs(
  root: string,
  expected: ReturnType<typeof releaseCandidateContext>,
) {
  const out = resolve(root, '.artifacts/release-candidate');
  const products = resolve(root, '.ci-products/guests');
  const identity = JSON.parse(await readFile(`${out}/identity.json`, 'utf8'));
  const version = await selectedVersion(root);
  if (identity.sourceCommit !== expected.commit || identity.version !== version)
    throw Error('prepared publication identity differs');
  const publication = await validatePublication(
    JSON.parse(await readFile(`${out}/public.publication.json`, 'utf8')),
    identity,
    `${out}/candidate.tgz`,
  );
  const original = JSON.parse(
    await readFile(`${out}/private.manifest.json`, 'utf8'),
  );
  const candidateRoot = '.artifacts/ci-candidate';
  const manifest = {
    schemaVersion: 1 as const,
    repository: expected.repository,
    sourceCommit: expected.commit,
    tarball: `${candidateRoot}/package.tgz`,
    packageManifest: `${candidateRoot}/package-manifest.json`,
    packageRoot: `${candidateRoot}/consumer/node_modules/@aletheia-works/formicarium`,
    guests: { ...GUEST_REFS },
  };
  const candidate = {
    ...original,
    version,
    files: publication.files,
    stagedDirectory: manifest.packageRoot,
    tarball: { ...publication.tarball, path: manifest.tarball },
  };
  await writeFile(
    `${out}/package-manifest.json`,
    JSON.stringify(candidate, null, 2),
  );
  await writeFile(
    `${out}/candidate.json`,
    JSON.stringify(publication, null, 2),
  );
  // Each record names the run that built the guest and its bytes, which the
  // runner checks against the guest it materializes.
  const run = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${expected.repository}/actions/runs/${process.env.GITHUB_RUN_ID ?? ''}`;
  const provenance = resolve(out, 'provenance');
  await mkdir(provenance, { recursive: true });
  for (const tool of ['aube', 'pitchfork'] as const)
    await writeFile(
      resolve(provenance, `${tool}.json`),
      JSON.stringify(
        {
          schemaVersion: 1,
          tool,
          ref: GUEST_REFS[tool],
          commit: (
            await readFile(resolve(products, `${tool}.commit`), 'utf8')
          ).trim(),
          evidence: {
            runURL: run,
            sourceCommit: expected.commit,
            guestSha256: hash(await readFile(resolve(products, tool))),
          },
        },
        null,
        2,
      ),
    );
  const inputs = [
    ...CANDIDATE_GUESTS.map((name) => ({
      path: `dist/guests/${name}`,
      source: resolve(products, name),
    })),
    { path: FIXTURE_GUEST, source: resolve(products, 'fixture') },
    ...(await sourceFiles(root, 'fixtures')).map((path) => ({
      path,
      source: resolve(root, path),
    })),
    ...(['aube', 'pitchfork'] as const).map((tool) => ({
      path: `${candidateRoot}/provenance/${tool}.json`,
      source: resolve(provenance, `${tool}.json`),
    })),
    { path: manifest.tarball, source: `${out}/candidate.tgz` },
    { path: manifest.packageManifest, source: `${out}/package-manifest.json` },
  ];
  const sourcePaths = await candidateSourcePaths(root);
  await createBundle(
    { manifest, sourcePaths, inputs },
    resolve(root, '.ci-inputs'),
    root,
  );
  await validateCandidateInputs({
    root,
    inputRoot: resolve(root, '.ci-inputs'),
    sourcePaths,
    context: {
      ...expected,
      event: 'workflow_dispatch',
      ref: 'refs/heads/release-candidate',
    },
  });
  await writeFile(
    `${out}/preparation.json`,
    JSON.stringify(
      {
        sourceCommit: expected.commit,
        version,
        tarballSha256: publication.tarball!.sha256,
        guestRun: run,
        limits:
          'Fresh candidate, guests built by this run, and measurement; no formal consumer acceptance or publication approval.',
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = process.cwd();
  switch (process.argv[2]) {
    case 'prepare-public':
      await preparePublic(root);
      break;
    case 'prepare-inputs':
      await prepareInputs(root, await eventContext());
      break;
    case 'verify':
    case 'merge': {
      const expected = await eventContext();
      const { validateCandidateManifest } = await import('./candidate.js');
      const { mergeParts, runPart, runVerification } = await import('./run.js');
      const validate: Parameters<typeof runVerification>[0] = (
        manifest,
        context,
      ) =>
        validateCandidateManifest(
          manifest,
          validateReleaseCandidateContext(manifest, context, expected),
        );
      const argument = process.argv[3];
      if (process.argv[2] === 'merge') await mergeParts(argument, validate);
      else if (argument)
        await runPart(argument as Parameters<typeof runPart>[0], validate);
      else await runVerification(validate);
      break;
    }
    default:
      throw Error(
        'usage: release-candidate.ts prepare-public|prepare-inputs|verify [part]|merge <parts-dir>',
      );
  }
}
