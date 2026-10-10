import type { ExecFileSyncOptions } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
  NPM_ASSET,
  npmFiles,
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
  assertPublicationContext(request.identity, {
    event: process.env.GITHUB_EVENT_NAME ?? '',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    ref: process.env.GITHUB_REF ?? '',
    sha: process.env.GITHUB_SHA ?? '',
  });
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
export type PublicationExecutor = (
  executable: string,
  args: readonly string[],
  options: ExecFileSyncOptions,
) => void;
const executePublication: PublicationExecutor = (executable, args, options) => {
  execFileSync(executable, [...args], options);
};
export async function publicationCli(
  args: string[],
  executor: PublicationExecutor = executePublication,
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
  if (
    ['gate', 'publish', 'release', 'prepare-assets'].includes(command ?? '') &&
    paths.length === (command === 'prepare-assets' ? 2 : 1)
  ) {
    const result = await gatePublication(paths[0]!, boundary);
    if (command === 'gate') return result.decision;
    if (command === 'prepare-assets') {
      const policyRoot = boundary?.policyRoot ?? process.cwd();
      const npm = await fetchAsset(
        NPM_ASSET.url,
        ASSET_LIMITS.npmBytes,
        boundary?.fetcher ?? fetch,
      );
      npmFiles(npm);
      const inputs = await readFile(`${resolve(paths[0]!)}.tgz`);
      requireCondition(
        sha256(inputs) === process.env.FORMICARIUM_RELEASE_INPUT_SHA256,
        'transfer input digest differs',
      );
      unpackTar(inputs, ASSET_LIMITS.expandedBytes, ASSET_LIMITS.members);
      const output = resolve(paths[1]!);
      await mkdir(output);
      for (const name of [
        'runner.mjs',
        'runner-manifest.json',
        'trusted-policy.json',
      ]) {
        await writeFile(
          join(output, name),
          await readFile(join(policyRoot, '.github/publication', name)),
          { flag: 'wx' },
        );
      }
      await writeFile(join(output, 'npm.tgz'), npm, { flag: 'wx' });
      await writeFile(join(output, 'inputs.tgz'), inputs, { flag: 'wx' });
      return { outcome: 'verified-transfer-prepared-not-published' };
    }
    if (command === 'publish') {
      requireCondition(
        process.env.AIDLC_RELEASE_OPERATION === 'publish' &&
          Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL) &&
          !process.env.NODE_AUTH_TOKEN &&
          !process.env.NPM_TOKEN,
        'isolated OIDC publish job required',
      );
      const npmConfig = `${resolve(paths[0]!)}.empty-npmrc`;
      const npmCli = process.env.FORMICARIUM_NPM_CLI ?? '';
      requireCondition(
        npmCli.startsWith('/') &&
          npmCli.endsWith('/package/bin/npm-cli.js') &&
          (await json(resolve(dirname(npmCli), '../package.json'))).version ===
            '11.19.0',
        'fixed verified npm CLI required',
      );
      await writeFile(npmConfig, '', { flag: 'wx' });
      const cleanEnvironment = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(npm_config_|node_auth_token$|npm_token$)/i.test(key),
        ),
      );
      executor(
        process.execPath,
        [
          npmCli,
          'publish',
          join(resolve(paths[0]!), 'candidate.tgz'),
          '--access',
          'public',
          '--registry',
          'https://registry.npmjs.org/',
          '--tag',
          result.request.identity.distTag,
          '--ignore-scripts',
        ],
        {
          cwd: resolve(paths[0]!),
          stdio: 'inherit',
          env: {
            ...cleanEnvironment,
            NPM_CONFIG_USERCONFIG: npmConfig,
            NPM_CONFIG_GLOBALCONFIG: '/dev/null',
            NPM_CONFIG_PROVENANCE: 'true',
          },
        },
      );
      return { outcome: 'publish-command-completed-readback-required' };
    }
    requireCondition(
      process.env.AIDLC_RELEASE_OPERATION === 'release',
      'isolated release job required',
    );
    requireCondition(
      result.request.approvals.some(
        (a) =>
          a.operation === 'create-github-release' &&
          a.target === result.request.identity.repository &&
          a.candidateId === result.request.candidate.candidateId &&
          a.version === result.request.identity.version &&
          a.sourceCommit === result.request.identity.sourceCommit &&
          a.humanInput.trim() &&
          Number.isFinite(Date.parse(a.approvedAt)),
      ),
      'GitHub Release approval missing',
    );
    executor(
      'gh',
      [
        'release',
        'create',
        result.request.identity.tag,
        join(resolve(paths[0]!), 'candidate.tgz'),
        '--repo',
        result.request.identity.repository,
        '--verify-tag',
        '--title',
        `formicarium ${result.request.identity.version}`,
        '--notes',
        `Reviewed package SHA256: ${result.archive.tarball.sha256}`,
        ...(result.request.identity.distTag === 'next' ? ['--prerelease'] : []),
      ],
      { stdio: 'inherit' },
    );
    return { outcome: 'release-command-completed-readback-required' };
  }
  throw new Error(
    'usage: prepare <old-manifest> <old.tgz> <new-out> <identity>; validate <publication-manifest> <identity> <tgz>; plan <evidence-root> <request>; fetch|gate|publish|release <bundle-root>',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(await publicationCli(process.argv.slice(2)), null, 2),
  );
