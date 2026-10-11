import { execFileSync } from 'node:child_process';
import {
  appendFile,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactBytes, hex, requireCondition } from './evidence.ts';
import { sha256 } from './inventory.ts';
import type {
  PublicationCandidate,
  PublicationIdentity,
  PublicationRequest,
} from './publication.ts';
import {
  planPublication,
  preparePublication,
  validatePublication,
} from './publication.ts';
import {
  ASSET_LIMITS,
  fetchAsset,
  readBoundedFile,
  safeAssetPath,
  unpackTar,
} from './publication-assets.ts';
import {
  acquirePublicationEvidence,
  readPublicationPolicy,
  verifyPublicationEvidence,
} from './publication-evidence.ts';
import {
  assertPublicationContext,
  assertReleasePreflightContext,
  validatePublishWorkflow,
} from './workflow.ts';

const json = async (path: string) =>
  JSON.parse(
    (await readBoundedFile(path, ASSET_LIMITS.metadataBytes)).toString(),
  );
export interface PublicationBoundary {
  policyRoot: string;
  fetcher: typeof fetch;
}
export async function gatePublication(
  root: string,
  boundary: PublicationBoundary = { policyRoot: process.cwd(), fetcher: fetch },
  mode: 'publication' | 'preflight' = 'publication',
) {
  const request = JSON.parse(
    (
      await artifactBytes(root, 'request.json', ASSET_LIMITS.metadataBytes)
    ).toString(),
  ) as PublicationRequest;
  const manifest = JSON.parse(
    (
      await artifactBytes(root, 'publication.json', ASSET_LIMITS.metadataBytes)
    ).toString(),
  ) as PublicationCandidate;
  requireCondition(
    manifest.tarball?.path === 'candidate.tgz',
    'publication tarball path differs',
  );
  const archive = await validatePublication(
    manifest,
    request.identity,
    join(root, 'candidate.tgz'),
  );
  requireCondition(
    request.candidate.tarballSha256 === archive.tarball.sha256,
    'request tarball differs',
  );
  // Also pins every fixed first-party source in the request to actual archive bytes.
  for (const source of request.candidate.firstPartyJs) {
    const packed = manifest.files.find((row) => row.path === source.path);
    const actual =
      packed?.sha256 ??
      sha256(await artifactBytes(root, `sources/${source.path}`));
    requireCondition(
      actual === source.sha256,
      'request first-party source differs',
    );
  }
  const buildInfoBytes = execFileSync('tar', [
    '-xOzf',
    join(root, 'candidate.tgz'),
    'package/assets/build-info.json',
  ]);
  const buildInfo = JSON.parse(buildInfoBytes.toString());
  requireCondition(
    sha256(buildInfoBytes) === request.candidate.core.buildInfoSha256 &&
      buildInfo.blinkSourceDirty === false &&
      buildInfo.blinkCommit === request.candidate.core.sourceCommit,
    'request core provenance differs',
  );
  const context = {
    event: process.env.GITHUB_EVENT_NAME ?? '',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    ref: process.env.GITHUB_REF ?? '',
    sha: process.env.GITHUB_SHA ?? '',
  };
  if (mode === 'preflight') {
    const pkg = await json(resolve(boundary.policyRoot, 'package.json'));
    assertReleasePreflightContext(request.identity, context, pkg.version);
  } else assertPublicationContext(request.identity, context);
  requireCondition(
    request.identity.repository === 'aletheia-works/formicarium' &&
      request.identity.environment === 'release',
    'publication target tuple differs',
  );
  validatePublishWorkflow(
    await readFile('.github/workflows/publish.yml', 'utf8'),
  );
  const decision = await planPublication(root, request);
  requireCondition(
    decision.allowed,
    `publication blocked: ${decision.missing.join(',')}`,
  );
  const policy = await readPublicationPolicy(boundary.policyRoot);
  const independent = await acquirePublicationEvidence(
    root,
    request,
    policy,
    process.env.GH_TOKEN ?? '',
    boundary.fetcher,
  );
  await verifyPublicationEvidence(
    root,
    request,
    independent.envelope,
    independent.observation,
    policy,
  );
  return { request, decision, archive };
}
/** Download an externally approved, SHA-pinned input bundle. No credentials. */
async function fetchBundle(out: string) {
  const url = process.env.FORMICARIUM_RELEASE_INPUT_URL ?? '',
    digest = process.env.FORMICARIUM_RELEASE_INPUT_SHA256;
  requireCondition(
    new URL(url).protocol === 'https:' && hex(digest),
    'reviewed release inputs missing',
  );
  const bytes = await fetchAsset(url, ASSET_LIMITS.inputBytes);
  requireCondition(
    bytes.length < 256 * 1024 * 1024 && sha256(bytes) === digest,
    'release input digest differs',
  );
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(`${resolve(out)}.tgz`, bytes, { flag: 'wx' });
  await mkdir(resolve(out), { recursive: false });
  for (const [name, content] of unpackTar(
    bytes,
    ASSET_LIMITS.expandedBytes,
    ASSET_LIMITS.members,
  )) {
    const path = join(resolve(out), safeAssetPath(name));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
  }
}
/** Only the YAML workflow performs external writes. This function exports a verified package. */
export async function preparePublicationArtifact(
  root: string,
  out: string,
  boundary?: PublicationBoundary,
) {
  const result = await gatePublication(root, boundary);
  const policyRoot = boundary?.policyRoot ?? process.cwd();
  const policy = await json(
    resolve(policyRoot, 'scripts/release/publication-policy.json'),
  );
  requireCondition(
    policy.schemaVersion === 1 && policy.writerEnabled === true,
    'publication writer disabled',
  );
  const { identity, candidate, approvals } = result.request;
  const releaseApproved = approvals.some(
    (a) =>
      a.operation === 'create-github-release' &&
      a.target === identity.repository &&
      a.candidateId === candidate.candidateId &&
      a.version === identity.version &&
      a.sourceCommit === identity.sourceCommit &&
      a.humanInput.trim() &&
      Number.isFinite(Date.parse(a.approvedAt)),
  );
  await mkdir(out, { recursive: false });
  const tarball = join(out, 'candidate.tgz');
  await copyFile(join(root, 'candidate.tgz'), tarball);
  requireCondition(
    sha256(await readBoundedFile(tarball, ASSET_LIMITS.inputBytes)) ===
      result.archive.tarball.sha256,
    'publication copy digest differs',
  );
  return {
    version: identity.version,
    tag: identity.tag,
    'dist-tag': identity.distTag,
    sha256: result.archive.tarball.sha256,
    'release-approved': String(releaseApproved),
  };
}
export async function publicationCli(
  args: string[],
  boundary?: PublicationBoundary,
) {
  const [command, ...paths] = args;
  if (command === 'prepare' && paths.length === 4)
    return preparePublication({
      originalManifestPath: paths[0]!,
      originalTarballPath: paths[1]!,
      out: paths[2]!,
      identity: (await json(paths[3]!)) as PublicationIdentity,
    });
  if (command === 'validate' && paths.length === 3)
    return validatePublication(
      await json(paths[0]!),
      await json(paths[1]!),
      paths[2]!,
    );
  if (command === 'plan' && paths.length === 2)
    return planPublication(paths[0]!, await json(paths[1]!));
  if (command === 'fetch' && paths.length === 1) {
    await fetchBundle(paths[0]!);
    return { outcome: 'downloaded-not-published' };
  }
  if (command === 'preflight' && paths.length === 1)
    return (await gatePublication(paths[0]!, boundary, 'preflight')).decision;
  if (command === 'gate' && paths.length === 1)
    return (await gatePublication(paths[0]!, boundary)).decision;
  if (command === 'prepare-artifact' && paths.length === 2) {
    const output = await preparePublicationArtifact(
      paths[0]!,
      paths[1]!,
      boundary,
    );
    if (process.env.GITHUB_OUTPUT)
      await appendFile(
        process.env.GITHUB_OUTPUT,
        Object.entries(output)
          .map(([key, value]) => `${key}=${value}\n`)
          .join(''),
      );
    return output;
  }
  throw new Error(
    'usage: prepare <old-manifest> <old.tgz> <new-out> <identity>; validate <publication-manifest> <identity> <tgz>; plan <evidence-root> <request>; fetch|gate|preflight <bundle-root>; prepare-artifact <bundle-root> <output-directory>',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(await publicationCli(process.argv.slice(2)), null, 2),
  );
