import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ASSET_LIMITS,
  assetDigest,
  fetchAsset,
  npmFiles,
  readBoundedFile,
  safeAssetPath,
  unpackTar,
  unpackZip,
} from './publication-assets.ts';

interface TransferPolicy {
  schemaVersion: 1;
  writerEnabled: boolean;
  evidence: { repository: string };
  transfer: {
    workflowId: number | null;
    producerAppId: number | null;
    workflowPath: string;
    verifyJob: string;
    artifactName: string;
    archiveRedirectHosts: string[];
  };
}
export interface TransferContext {
  repository: string;
  sourceSha: string;
  tag: string;
  runId: number;
  attempt: number;
  inputDigest: string;
}
export interface TransferObservation {
  repository: string;
  sourceSha: string;
  runId: number;
  attempt: number;
  workflowId: number;
  workflowPath: string;
  producerAppId: number;
  job: string;
  jobState: string;
  artifactId: number;
  artifactDigest: string;
  artifactName: string;
}
export interface RunnerManifest {
  schemaVersion: 1;
  files: { path: string; sha256: string; size: number }[];
}
const ensure = (value: unknown, code: string): void => {
  if (!value) throw Error(code);
};
async function trustedJson<T>(root: string, path: string): Promise<T> {
  const bytes = await readBoundedFile(
    resolve(root, '.github/publication', path),
    ASSET_LIMITS.metadataBytes,
  );
  ensure(bytes.length <= ASSET_LIMITS.metadataBytes, 'METADATA_LIMIT');
  return JSON.parse(bytes.toString()) as T;
}
function validatePolicy(policy: TransferPolicy) {
  ensure(
    policy.schemaVersion === 1 &&
      policy.writerEnabled === true &&
      policy.evidence.repository === 'aletheia-works/formicarium' &&
      Number.isSafeInteger(policy.transfer.workflowId) &&
      (policy.transfer.workflowId ?? 0) > 0 &&
      Number.isSafeInteger(policy.transfer.producerAppId) &&
      (policy.transfer.producerAppId ?? 0) > 0 &&
      policy.transfer.workflowPath === '.github/workflows/publish.yml' &&
      policy.transfer.verifyJob === 'verify' &&
      policy.transfer.artifactName === 'publication-assets' &&
      Array.isArray(policy.transfer.archiveRedirectHosts),
    'TRANSFER_POLICY_INCOMPLETE',
  );
}
export async function verifyTransfer(
  root: string,
  archive: Uint8Array,
  context: TransferContext,
  observed: TransferObservation,
) {
  const policy = await trustedJson<TransferPolicy>(root, 'trusted-policy.json');
  validatePolicy(policy);
  ensure(
    context.repository === policy.evidence.repository &&
      /^[a-f0-9]{40}$/.test(context.sourceSha) &&
      /^[a-f0-9]{64}$/.test(context.inputDigest) &&
      Number.isSafeInteger(context.runId) &&
      context.runId > 0 &&
      Number.isSafeInteger(context.attempt) &&
      context.attempt > 0,
    'TRANSFER_CONTEXT_INVALID',
  );
  for (const key of ['repository', 'sourceSha', 'runId', 'attempt'] as const)
    ensure(observed[key] === context[key], 'TRANSFER_IDENTITY_MISMATCH');
  ensure(
    observed.workflowId === policy.transfer.workflowId &&
      observed.workflowPath === policy.transfer.workflowPath &&
      observed.producerAppId === policy.transfer.producerAppId &&
      observed.job === policy.transfer.verifyJob &&
      observed.jobState === 'success' &&
      Number.isSafeInteger(observed.artifactId) &&
      observed.artifactId > 0 &&
      observed.artifactName === policy.transfer.artifactName &&
      observed.artifactDigest === `sha256:${assetDigest(archive)}`,
    'TRANSFER_PROVENANCE_MISMATCH',
  );
  const files = unpackZip(archive);
  const allowed = [
    'runner.mjs',
    'trusted-policy.json',
    'runner-manifest.json',
    'npm.tgz',
    'inputs.tgz',
  ];
  ensure(
    files.size === allowed.length && allowed.every((path) => files.has(path)),
    'TRANSFER_MEMBER_SET',
  );
  const trustedManifestBytes = await readBoundedFile(
    resolve(root, '.github/publication/runner-manifest.json'),
    ASSET_LIMITS.metadataBytes,
  );
  ensure(
    files.get('runner-manifest.json')?.equals(trustedManifestBytes),
    'TRANSFER_MANIFEST_MISMATCH',
  );
  const manifest = JSON.parse(
    trustedManifestBytes.toString(),
  ) as RunnerManifest;
  ensure(
    manifest.schemaVersion === 1 &&
      Array.isArray(manifest.files) &&
      manifest.files.length === 2 &&
      new Set(manifest.files.map((item) => item.path)).size === 2 &&
      manifest.files.every((item) =>
        ['runner.mjs', 'trusted-policy.json'].includes(item.path),
      ),
    'TRANSFER_MANIFEST_INVALID',
  );
  for (const item of manifest.files) {
    const file = files.get(item.path);
    ensure(
      file &&
        file.length <= ASSET_LIMITS.metadataBytes &&
        file.length === item.size &&
        assetDigest(file) === item.sha256,
      'TRANSFER_ASSET_MISMATCH',
    );
    const local = await readFile(
      resolve(root, '.github/publication', item.path),
    );
    ensure(file?.equals(local), 'TRANSFER_TAG_ASSET_MISMATCH');
  }
  const npm = files.get('npm.tgz')!;
  const npmMembers = npmFiles(npm);
  const inputs = files.get('inputs.tgz')!;
  ensure(
    assetDigest(inputs) === context.inputDigest,
    'TRANSFER_INPUT_MISMATCH',
  );
  const inputMembers = unpackTar(
    inputs,
    ASSET_LIMITS.expandedBytes,
    ASSET_LIMITS.members,
  );
  return { runner: files.get('runner.mjs')!, npmMembers, inputMembers };
}
type Executor = (
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => number;
export async function executeTransfer(
  root: string,
  archive: Uint8Array,
  context: TransferContext,
  observed: TransferObservation,
  mode: 'publish' | 'release',
  executor: Executor = (executable, args, env) => {
    const result = spawnSync(executable, args, {
      env,
      stdio: 'inherit',
      shell: false,
    });
    return result.signal || result.error ? 1 : (result.status ?? 1);
  },
) {
  ensure(['publish', 'release'].includes(mode), 'TRANSFER_OPERATION_INVALID');
  const verified = await verifyTransfer(root, archive, context, observed);
  const temporary = await mkdtemp(join(tmpdir(), 'publication-transfer-'));
  try {
    const runner = join(temporary, 'runner.mjs');
    await writeFile(runner, verified.runner, { flag: 'wx' });
    for (const [name, bytes] of verified.npmMembers) {
      const path = join(temporary, 'npm', safeAssetPath(name));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { flag: 'wx' });
    }
    for (const [name, bytes] of verified.inputMembers) {
      const path = join(temporary, 'inputs', safeAssetPath(name));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { flag: 'wx' });
    }
    const status = executor(
      process.execPath,
      [runner, mode, join(temporary, 'inputs')],
      {
        ...process.env,
        FORMICARIUM_NPM_CLI: join(temporary, 'npm/package/bin/npm-cli.js'),
        FORMICARIUM_TRUSTED_POLICY: resolve(
          root,
          '.github/publication/trusted-policy.json',
        ),
      },
    );
    ensure(status === 0, 'TRANSFER_EXECUTION_FAILED_OR_UNKNOWN');
    return { status: 'completed-readback-required' };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
export async function inspectTransfer(
  root: string,
  context: TransferContext,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const policy = await trustedJson<TransferPolicy>(root, 'trusted-policy.json');
  validatePolicy(policy);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const prefix = `https://api.github.com/repos/${policy.evidence.repository}`;
  const json = async (path: string) =>
    JSON.parse(
      (
        await fetchAsset(
          prefix + path,
          ASSET_LIMITS.metadataBytes,
          fetcher,
          headers,
        )
      ).toString(),
    );
  const run = await json(`/actions/runs/${context.runId}`);
  ensure(
    run.id === context.runId &&
      run.run_attempt === context.attempt &&
      run.repository?.full_name === context.repository &&
      run.head_sha === context.sourceSha &&
      run.event === 'push' &&
      run.head_branch === context.tag &&
      run.workflow_id === policy.transfer.workflowId &&
      run.path === policy.transfer.workflowPath,
    'TRANSFER_RUN_MISMATCH',
  );
  const tag = await json(`/git/ref/tags/${encodeURIComponent(context.tag)}`);
  ensure(
    tag.object?.type === 'commit' && tag.object.sha === context.sourceSha,
    'TRANSFER_TAG_MISMATCH',
  );
  const jobs = await json(
    `/actions/runs/${context.runId}/attempts/${context.attempt}/jobs?per_page=100`,
  );
  ensure(
    jobs.total_count <= 100 && Array.isArray(jobs.jobs),
    'TRANSFER_PAGINATION_LIMIT',
  );
  const matches = jobs.jobs.filter(
    (job: { name: string }) => job.name === policy.transfer.verifyJob,
  );
  ensure(
    matches.length === 1 &&
      matches[0].conclusion === 'success' &&
      matches[0].run_attempt === context.attempt,
    'TRANSFER_JOB_MISMATCH',
  );
  const checkUrl = matches[0].check_run_url;
  ensure(
    typeof checkUrl === 'string' &&
      checkUrl.startsWith(`${prefix}/check-runs/`),
    'TRANSFER_CHECK_URL',
  );
  const check = JSON.parse(
    (
      await fetchAsset(checkUrl, ASSET_LIMITS.metadataBytes, fetcher, headers)
    ).toString(),
  );
  ensure(
    check.head_sha === context.sourceSha &&
      check.app?.id === policy.transfer.producerAppId &&
      check.check_suite?.id === run.check_suite_id &&
      check.name === policy.transfer.verifyJob &&
      check.conclusion === 'success',
    'TRANSFER_PRODUCER_MISMATCH',
  );
  const artifacts = await json(
    `/actions/runs/${context.runId}/artifacts?per_page=100`,
  );
  ensure(
    artifacts.total_count <= 100 && Array.isArray(artifacts.artifacts),
    'TRANSFER_PAGINATION_LIMIT',
  );
  const selected = artifacts.artifacts.filter(
    (item: { name: string; expired: boolean }) =>
      item.name === policy.transfer.artifactName && item.expired === false,
  );
  ensure(
    selected.length === 1 &&
      selected[0].workflow_run?.id === context.runId &&
      selected[0].workflow_run?.head_sha === context.sourceSha,
    'TRANSFER_ARTIFACT_MISMATCH',
  );
  const item = selected[0];
  ensure(
    Number.isSafeInteger(item.id) &&
      item.id > 0 &&
      /^sha256:[a-f0-9]{64}$/.test(item.digest),
    'TRANSFER_ARTIFACT_DIGEST',
  );
  const archive = await fetchAsset(
    `${prefix}/actions/artifacts/${item.id}/zip`,
    ASSET_LIMITS.inputBytes,
    fetcher,
    headers,
    policy.transfer.archiveRedirectHosts,
  );
  const observed: TransferObservation = {
    repository: context.repository,
    sourceSha: context.sourceSha,
    runId: context.runId,
    attempt: context.attempt,
    workflowId: run.workflow_id,
    workflowPath: run.path,
    producerAppId: check.app.id,
    job: check.name,
    jobState: check.conclusion,
    artifactId: item.id,
    artifactName: item.name,
    artifactDigest: item.digest,
  };
  return { archive, observed };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const mode = process.argv[2];
  try {
    ensure(
      mode === 'publish' || mode === 'release',
      'TRANSFER_OPERATION_INVALID',
    );
    const context: TransferContext = {
      repository: process.env.GITHUB_REPOSITORY ?? '',
      sourceSha: process.env.GITHUB_SHA ?? '',
      tag: process.env.GITHUB_REF_NAME ?? '',
      runId: Number(process.env.GITHUB_RUN_ID),
      attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      inputDigest: process.env.FORMICARIUM_RELEASE_INPUT_SHA256 ?? '',
    };
    const root = process.cwd();
    const result = await inspectTransfer(
      root,
      context,
      process.env.GH_TOKEN ?? '',
    );
    await executeTransfer(
      root,
      result.archive,
      context,
      result.observed,
      mode as 'publish' | 'release',
    );
  } catch {
    process.stderr.write('PUBLICATION_BOOTSTRAP_REJECTED\n');
    process.exitCode = 1;
  }
}
