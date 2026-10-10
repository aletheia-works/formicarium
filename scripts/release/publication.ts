import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { decideRelease, REGRESSION_CHECKS } from './decision.ts';
import type { EvidenceIndex } from './evidence.ts';
import {
  artifactBytes,
  hex,
  requireCondition,
  resolveEvidence,
  unique,
} from './evidence.ts';
import { PACKAGE_FILES, sha256 } from './inventory.ts';
import { ASSET_LIMITS, readBoundedFile } from './publication-assets.ts';
import type { CandidateIdentity, ReleaseApproval } from './types.ts';
import { publicationChannel } from './version.ts';

export { publicationChannel } from './version.ts';

export interface PublicationIdentity {
  repository: string;
  workflow: 'publish.yml';
  environment: string;
  sourceCommit: string;
  version: string;
  tag: string;
  distTag: 'next' | 'latest';
}
export interface PublicationCandidate {
  schemaVersion: 1;
  identity: PublicationIdentity;
  package: '@aletheia-works/formicarium';
  files: { path: string; sha256: string }[];
  originalTarballSha256: string;
  tarball: { path: string; sha256: string } | null;
}
export interface PublicationRequest {
  candidateRun?: { runId: number; runAttempt: number; artifactId: number };
  identity: PublicationIdentity;
  candidate: CandidateIdentity;
  index: EvidenceIndex;
  evidenceIds: string[];
  approvals: ReleaseApproval[];
  publisher: {
    repository: string;
    workflow: string;
    environment: string;
    observedAt: string;
    observationArtifact: string;
    observationSha256: string;
    authentication: 'oidc';
    allowedAction: 'publish';
    status: 'observed' | 'unverified';
  };
}
export function validatePublicationIdentity(i: PublicationIdentity) {
  requireCondition(
    i &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(
        i.repository,
      ),
    'publication repository required',
  );
  requireCondition(
    i.workflow === 'publish.yml' &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(i.environment),
    'publication workflow/environment invalid',
  );
  requireCondition(
    /^[a-f0-9]{40,64}$/.test(i.sourceCommit),
    'publication source commit invalid',
  );
  requireCondition(
    i.tag === `v${i.version}` &&
      i.distTag ===
        (publicationChannel(i.version) === 'stable' ? 'latest' : 'next'),
    'publication version/tag/dist-tag differs',
  );
  return i;
}
function members(tarball: string) {
  const rows = execFileSync('tar', ['-tzvf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  requireCondition(
    rows.every((row) => row[0] === '-'),
    'archive links/directories refused',
  );
  const paths = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split('\n');
  requireCondition(
    paths.every(
      (path) =>
        path.startsWith('package/') &&
        !path.includes('..') &&
        !path.includes('\\'),
    ),
    'unsafe archive path',
  );
  const inventory = paths.map((path) => path.slice(8));
  unique(inventory, 'archive path');
  requireCondition(
    JSON.stringify([...inventory].sort()) ===
      JSON.stringify([...PACKAGE_FILES].sort()),
    'archive inventory differs',
  );
  return inventory;
}
const extract = (path: string, member: string) =>
  execFileSync('tar', ['-xOzf', path, `package/${member}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
function manifestIdentity(
  manifest: Record<string, any>,
  i: PublicationIdentity,
) {
  requireCondition(
    manifest.name === '@aletheia-works/formicarium' &&
      manifest.version === i.version &&
      manifest.private === false,
    'public manifest identity/private differs',
  );
  requireCondition(
    manifest.repository?.type === 'git' &&
      manifest.repository.url === `git+https://github.com/${i.repository}.git`,
    'public repository differs',
  );
  requireCondition(
    manifest.publishConfig?.registry === 'https://registry.npmjs.org/' &&
      manifest.publishConfig.access === 'public',
    'public registry/access differs',
  );
  requireCondition(
    manifest.type === 'module' &&
      Object.keys(manifest.exports ?? {}).length === 6 &&
      !manifest.scripts &&
      !manifest.devDependencies,
    'public surface differs',
  );
}
/** Local-only preparation. The old archive and evidence are never rewritten. */
export async function preparePublication({
  originalManifestPath,
  originalTarballPath,
  out,
  identity,
}: {
  originalManifestPath: string;
  originalTarballPath: string;
  out: string;
  identity: PublicationIdentity;
}) {
  validatePublicationIdentity(identity);
  const original = JSON.parse(
    (
      await readBoundedFile(originalManifestPath, ASSET_LIMITS.metadataBytes)
    ).toString(),
  );
  const archive = resolve(originalTarballPath);
  const originalSha = sha256(await readFile(archive));
  requireCondition(
    original.tarball?.sha256 === originalSha &&
      original.blinkSourceDirty === false,
    'original candidate binding differs',
  );
  const inventory = members(archive);
  requireCondition(
    Array.isArray(original.files) && original.files.length === inventory.length,
    'original manifest inventory differs',
  );
  unique(
    original.files.map((row: { path: string }) => row.path),
    'original manifest path',
  );
  const contents = new Map<string, Buffer>();
  for (const path of inventory) {
    const bytes = extract(archive, path);
    requireCondition(
      original.files.find(
        (row: { path: string; sha256: string }) => row.path === path,
      )?.sha256 === sha256(bytes),
      'original archive digest differs',
    );
    contents.set(path, bytes);
  }
  const old = JSON.parse(contents.get('package.json')!.toString());
  requireCondition(
    old.name === '@aletheia-works/formicarium' &&
      old.private === true &&
      typeof old.version === 'string' &&
      !old.scripts &&
      !old.devDependencies,
    'original manifest not reviewed private candidate',
  );
  publicationChannel(old.version);
  const manifest = {
    ...old,
    version: identity.version,
    private: false,
    repository: {
      type: 'git',
      url: `git+https://github.com/${identity.repository}.git`,
    },
    publishConfig: {
      registry: 'https://registry.npmjs.org/',
      access: 'public',
    },
  };
  manifestIdentity(manifest, identity);
  contents.set(
    'package.json',
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
  );
  // Exclusive mkdir also rejects existing destinations and symlinks.
  const destination = resolve(out);
  await mkdir(destination, { recursive: false });
  for (const [path, bytes] of contents) {
    await mkdir(dirname(resolve(destination, path)), { recursive: true });
    await writeFile(resolve(destination, path), bytes, { flag: 'wx' });
  }
  const candidate: PublicationCandidate = {
    schemaVersion: 1,
    identity,
    package: '@aletheia-works/formicarium',
    originalTarballSha256: originalSha,
    files: [...contents].map(([path, bytes]) => ({
      path,
      sha256: sha256(bytes),
    })),
    tarball: null,
  };
  await writeFile(
    `${destination}.publication.json`,
    JSON.stringify(candidate, null, 2) + '\n',
    { flag: 'wx' },
  );
  return candidate;
}
/** Digest-check npm's packed bytes, without updating any saved manifest. */
export async function validatePublication(
  candidate: PublicationCandidate,
  identity: PublicationIdentity,
  tarballPath: string,
) {
  validatePublicationIdentity(identity);
  requireCondition(
    candidate.schemaVersion === 1 &&
      candidate.package === '@aletheia-works/formicarium' &&
      hex(candidate.originalTarballSha256) &&
      JSON.stringify(candidate.identity) === JSON.stringify(identity),
    'publication candidate identity differs',
  );
  const inventory = members(tarballPath);
  requireCondition(
    candidate.files.length === inventory.length,
    'publication files differ',
  );
  unique(
    candidate.files.map((row) => row.path),
    'publication manifest path',
  );
  for (const path of inventory)
    requireCondition(
      candidate.files.find((row) => row.path === path)?.sha256 ===
        sha256(extract(tarballPath, path)),
      'publication archive digest differs',
    );
  manifestIdentity(
    JSON.parse(extract(tarballPath, 'package.json').toString()),
    identity,
  );
  const digest = sha256(await readFile(tarballPath));
  if (candidate.tarball)
    requireCondition(
      candidate.tarball.sha256 === digest,
      'publication tarball digest differs',
    );
  return {
    ...candidate,
    tarball: { path: resolve(tarballPath), sha256: digest },
  };
}
/** Immutable reads and a plan only; there is no publication side effect here. */
export async function planPublication(
  root: string,
  request: PublicationRequest,
) {
  const i = validatePublicationIdentity(request.identity),
    p = request.publisher;
  requireCondition(
    request.candidate.sourceCommit === i.sourceCommit &&
      request.candidate.version === i.version,
    'publication evidence candidate differs',
  );
  requireCondition(
    p?.status === 'observed' &&
      p.authentication === 'oidc' &&
      p.allowedAction === 'publish' &&
      p.repository === i.repository &&
      p.workflow === i.workflow &&
      p.environment === i.environment &&
      Number.isFinite(Date.parse(p.observedAt)) &&
      hex(p.observationSha256),
    'publisher not observed or differs',
  );
  requireCondition(
    sha256(
      await artifactBytes(
        root,
        p.observationArtifact,
        ASSET_LIMITS.metadataBytes,
      ),
    ) === p.observationSha256,
    'publisher observation digest differs',
  );
  const observation = JSON.parse(
    (
      await artifactBytes(
        root,
        p.observationArtifact,
        ASSET_LIMITS.metadataBytes,
      )
    ).toString(),
  );
  requireCondition(
    observation.kind === 'npm-settings-observation' &&
      observation.package === '@aletheia-works/formicarium' &&
      observation.repository === i.repository &&
      observation.workflow === i.workflow &&
      observation.environment === i.environment &&
      observation.allowedAction === 'publish' &&
      observation.observedAt === p.observedAt &&
      observation.simulated === false,
    'publisher observation content differs',
  );
  const decision = await decideRelease({
    root,
    index: request.index,
    candidate: request.candidate,
    evidenceIds: request.evidenceIds,
    approvals: request.approvals,
    target: `https://registry.npmjs.org/@aletheia-works/formicarium`,
    channel: publicationChannel(i.version),
  });
  if (!decision.allowed) return decision;
  // Actual publication also requires the unchanged global quality contract.
  const envelopes = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  const missing = [...decision.missing];
  for (const id of REGRESSION_CHECKS) {
    const rows = envelopes.flatMap((e) =>
      e.checks.filter((c) => c.checkId === id),
    );
    if (
      !rows.length ||
      rows.some(
        (c) =>
          c.status !== 'passed' ||
          c.exitCode !== 0 ||
          c.termination !== 'exit' ||
          c.unverified.length,
      )
    )
      missing.push(`publication-check:${id}`);
  }
  if (
    !envelopes.some((e) => {
      if (
        !e.coverage ||
        e.coverage.files.some(
          (f) =>
            f.collection === 'missing' ||
            (f.collection === 'measured' && !f.realms.length),
        )
      )
        return false;
      const total = e.coverage.files.reduce((sum, f) => sum + f.totalLines, 0);
      return (
        total > 0 &&
        e.coverage.files.reduce((sum, f) => sum + f.coveredLines, 0) / total >=
          0.8
      );
    })
  )
    missing.push('publication-coverage:fixed-80%-realms');
  return {
    ...decision,
    missing,
    allowed: missing.length === 0,
    outcome: missing.length ? ('blocked' as const) : ('not-run' as const),
  };
}
