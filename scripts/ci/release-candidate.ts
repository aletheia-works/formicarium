import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  preparePublication,
  validatePublication,
} from '../release/publication.ts';
import { createBundle, validatePayloadInventory } from './bundle.js';
import { candidateSourcePaths, validateCandidateInputs } from './candidate.js';
import { type InputManifest, verifyPins } from './verification.js';

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
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.[1-9]\d*)?$/.test(
      version,
    )
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
    version.includes('-') ||
    !/^[a-f0-9]{40}$/.test(context.commit)
  )
    throw Error(
      'release candidate tag requires exact upstream stable version/source',
    );
  return context;
}

export function selectedCandidateVersion(
  packageVersion: string,
  requested: string,
  event: string,
) {
  const base = candidateVersion(packageVersion);
  if (!requested) return base;
  const version = candidateVersion(requested);
  if (
    event !== 'workflow_dispatch' ||
    base.includes('-') ||
    !version.startsWith(`${base}-rc.`)
  )
    throw Error('RC candidate must match the dispatched package version');
  return version;
}

async function selectedVersion(root: string) {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  return selectedCandidateVersion(
    pkg.version,
    process.env.CANDIDATE_VERSION ?? '',
    process.env.GITHUB_EVENT_NAME ?? '',
  );
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
    distTag: version.includes('-') ? ('next' as const) : ('latest' as const),
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

export async function prepareInputs(
  root: string,
  expected: ReturnType<typeof releaseCandidateContext>,
) {
  const out = resolve(root, '.artifacts/release-candidate');
  const seed = resolve(root, '.ci-fixtures');
  // The fixture still carries the retired terrarium owner copy, its site and
  // the guest-distribution resolver; the fresh inputs leave them out.
  const old = JSON.parse(
    await readFile(`${seed}/manifest.json`, 'utf8'),
  ) as InputManifest & {
    site: string;
    terrarium: string;
    owner: unknown;
    coreCommit: string;
  };
  await validatePayloadInventory(
    `${seed}/payload`,
    old.files.map((row) => row.path),
  );
  await verifyPins(`${seed}/payload`, old.files);
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
  const {
    files,
    sourceFiles,
    site,
    terrarium,
    owner,
    coreCommit,
    ...manifest
  } = old;
  void sourceFiles;
  void owner;
  void coreCommit;
  // The core now ships inside the package, so the blink build inputs retire.
  const retired = [
    `${site}/`,
    `${terrarium}/`,
    '.artifacts/ci-candidate/inputs/resolver/',
    '.artifacts/ci-candidate/core-source.bundle',
    'assets/',
    'dist/blink/',
  ];
  manifest.sourceCommit = expected.commit;
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
  // The installed package is this run's candidate, whose files differ from
  // the fixture's older package, so its rows come from the public directory.
  const packageRows = publication.files.map(({ path }) => ({
    path: `${manifest.packageRoot}/${path}`,
    source: resolve(out, 'public', path),
  }));
  const fixtureRows = files
    .filter(
      (row) =>
        !retired.some((prefix) => row.path.startsWith(prefix)) &&
        !row.path.startsWith(`${manifest.packageRoot}/`),
    )
    .map((row) => {
      let source = resolve(seed, 'payload', row.path);
      if (row.path === manifest.tarball) source = `${out}/candidate.tgz`;
      if (row.path === manifest.packageManifest)
        source = `${out}/package-manifest.json`;
      return { path: row.path, source };
    });
  const sourcePaths = await candidateSourcePaths(root);
  await createBundle(
    { manifest, sourcePaths, inputs: [...fixtureRows, ...packageRows] },
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
        fixtureSourceCommit: old.sourceCommit,
        limits:
          'Fresh candidate and measurement; frozen external guest/consumer fixtures, no formal consumer acceptance or publication approval.',
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
    case 'verify': {
      const expected = await eventContext();
      const { validateCandidateManifest } = await import('./candidate.js');
      const { runVerification } = await import('./run.js');
      await runVerification((manifest, context) =>
        validateCandidateManifest(
          manifest,
          validateReleaseCandidateContext(manifest, context, expected),
        ),
      );
      break;
    }
    default:
      throw Error(
        'usage: release-candidate.ts prepare-public|prepare-inputs|verify',
      );
  }
}
