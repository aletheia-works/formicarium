import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from '../ci/quality-evidence.ts';
import {
  BoundaryError,
  BYTE_LIMIT,
  decodeJson,
  limitBytes,
  unpackArchive,
} from './archive.ts';
import { GitHubApi } from './github.ts';
import { parseMaintenanceInputs, type TrustedPolicy } from './input.ts';
import { labelPullRequest } from './metadata.ts';
import {
  executeMaintenance,
  observeProtection,
  type PreparedMaintenance,
  preparationFrom,
} from './operations.ts';
import {
  type AcquisitionPolicy,
  acquireMaintenance,
  contentAt,
  validateAcquisitionPolicy,
} from './receipt.ts';
import {
  fetchSourceFiles,
  reproduceDependency,
  reproduceFormat,
} from './reproduce.ts';

export interface RunnerConfig {
  schemaVersion: 1;
  writerEnabled: boolean;
  acquisition: AcquisitionPolicy;
  policy: TrustedPolicy;
  preparationWorkflowId: number;
  preparationWorkflowPath: string;
  preparationProducerAppId: number;
}
function ensure(value: unknown, code: string): asserts value {
  if (!value) throw new BoundaryError(code);
}
function obj(value: unknown): Record<string, unknown> {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value as Record<string, unknown>;
}
const id = (value: string | undefined) => {
  ensure(
    value && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)),
    'INVALID_ID',
  );
  return Number(value);
};
export async function loadConfig(root: string): Promise<RunnerConfig> {
  const raw = obj(
    decodeJson(
      limitBytes(
        await readFile(resolve(root, '.github/maintenance/policy.json')),
      ),
    ),
  );
  ensure(
    raw.schemaVersion === 1 && raw.writerEnabled === true,
    'WRITER_DISABLED',
  );
  const acquisition = validateAcquisitionPolicy(raw.acquisition);
  ensure(
    Number.isSafeInteger(raw.preparationWorkflowId) &&
      (raw.preparationWorkflowId as number) > 0 &&
      raw.preparationWorkflowPath === '.github/workflows/maintenance.yml' &&
      Number.isSafeInteger(raw.preparationProducerAppId) &&
      (raw.preparationProducerAppId as number) > 0,
    'INVALID_POLICY',
  );
  return {
    schemaVersion: 1,
    writerEnabled: true,
    acquisition,
    policy: raw.policy as TrustedPolicy,
    preparationWorkflowId: raw.preparationWorkflowId as number,
    preparationWorkflowPath: raw.preparationWorkflowPath,
    preparationProducerAppId: raw.preparationProducerAppId as number,
  };
}
async function verifyTrustedSupply(
  api: GitHubApi,
  root: string,
  config: RunnerConfig,
  baseSha: string,
) {
  ensure(/^[a-f0-9]{40}$/.test(baseSha), 'UNTRUSTED_BASE');
  const repository = obj(
    await api.json(`/repos/${config.acquisition.repository}`),
  );
  ensure(repository.default_branch === 'main', 'UNTRUSTED_BASE');
  const ref = obj(
    await api.json(
      `/repos/${config.acquisition.repository}/git/ref/heads/main`,
    ),
  );
  ensure(obj(ref.object).sha === baseSha, 'UNTRUSTED_BASE');
  for (const path of [
    '.github/maintenance/runner.mjs',
    '.github/maintenance/policy.json',
    'biome.json',
  ]) {
    const actual = await contentAt(
      api,
      config.acquisition.repository,
      path,
      baseSha,
    );
    ensure(
      digest(actual) ===
        digest(limitBytes(await readFile(resolve(root, path)))),
      'UNTRUSTED_SUPPLY',
    );
  }
}
export async function fetchPrepared(
  api: GitHubApi,
  config: RunnerConfig,
  runId: number,
  attempt: number,
  head: string,
  baseSha: string,
): Promise<PreparedMaintenance> {
  const prefix = `/repos/${config.acquisition.repository}`;
  const run = obj(await api.json(`${prefix}/actions/runs/${runId}`));
  ensure(
    run.id === runId &&
      run.run_attempt === attempt &&
      run.workflow_id === config.preparationWorkflowId &&
      run.path === config.preparationWorkflowPath &&
      run.event === 'workflow_run' &&
      run.head_sha === baseSha &&
      obj(run.repository).full_name === config.acquisition.repository,
    'UNTRUSTED_PREPARATION',
  );
  const jobs = await api.pages(
    `${prefix}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    'jobs',
  );
  const matches = jobs.map(obj).filter((job) => job.name === 'prepare');
  ensure(
    matches.length === 1 &&
      matches[0]?.conclusion === 'success' &&
      matches[0]?.run_attempt === attempt,
    'UNTRUSTED_PREPARATION',
  );
  const checkUrl = matches[0]?.check_run_url;
  ensure(
    typeof checkUrl === 'string' &&
      checkUrl.startsWith(`https://api.github.com${prefix}/check-runs/`),
    'UNTRUSTED_PREPARATION',
  );
  const check = obj(await api.json(checkUrl));
  ensure(
    check.name === 'prepare' &&
      check.conclusion === 'success' &&
      obj(check.app).id === config.preparationProducerAppId &&
      obj(check.check_suite).id === run.check_suite_id &&
      check.head_sha === baseSha,
    'UNTRUSTED_PREPARATION',
  );
  const artifacts = await api.pages(
    `${prefix}/actions/runs/${runId}/artifacts?per_page=100`,
    'artifacts',
  );
  const selected = artifacts
    .map(obj)
    .filter(
      (item) =>
        item.name === `maintenance-${head}-${runId}-${attempt}` &&
        item.expired === false,
    );
  ensure(
    selected.length === 1 && obj(selected[0]?.workflow_run).id === runId,
    'UNTRUSTED_PREPARATION',
  );
  const artifactId = selected[0]?.id;
  ensure(
    Number.isSafeInteger(artifactId) && (artifactId as number) > 0,
    'UNTRUSTED_PREPARATION',
  );
  const bytes = await api.bytes(
    `${prefix}/actions/artifacts/${artifactId}/zip`,
    config.acquisition.archiveRedirectHosts,
  );
  const members = await unpackArchive(bytes, ['prepared.json']);
  const preparedBytes = members.get('prepared.json');
  ensure(preparedBytes, 'UNTRUSTED_PREPARATION');
  const prepared = obj(
    decodeJson(preparedBytes),
  ) as unknown as PreparedMaintenance;
  const parsed = parseMaintenanceInputs(prepared.request, config.policy);
  ensure(
    parsed.ok &&
      prepared.schemaVersion === 1 &&
      prepared.preparationRunId === runId &&
      prepared.preparationAttempt === attempt &&
      prepared.trustedBaseSha === baseSha &&
      parsed.value.request.context.headSha === head &&
      Array.isArray(prepared.changes),
    'UNTRUSTED_PREPARATION',
  );
  return { ...prepared, request: parsed.value.request };
}
export async function runMaintenanceCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const mode = args[0];
  if (mode === 'labels') {
    const root = resolve(args[1] ?? '.');
    const rules = obj(
      decodeJson(
        limitBytes(
          await readFile(resolve(root, '.github/maintenance/label-rules.json')),
        ),
      ),
    );
    const raw = obj(
      decodeJson(
        limitBytes(
          await readFile(resolve(root, '.github/maintenance/policy.json')),
        ),
      ),
    );
    const repository = obj(raw.acquisition).repository;
    ensure(
      typeof repository === 'string' && env.MAINTENANCE_TOKEN,
      'INVALID_METADATA',
    );
    const api = new GitHubApi(env.MAINTENANCE_TOKEN);
    const baseSha = env.TRUSTED_BASE_SHA ?? '';
    ensure(/^[a-f0-9]{40}$/.test(baseSha), 'UNTRUSTED_BASE');
    for (const path of [
      '.github/maintenance/runner.mjs',
      '.github/maintenance/label-rules.json',
    ]) {
      ensure(
        digest(await contentAt(api, repository, path, baseSha)) ===
          digest(limitBytes(await readFile(resolve(root, path)))),
        'UNTRUSTED_SUPPLY',
      );
    }
    ensure(
      rules.schemaVersion === 1 && Array.isArray(rules.rules),
      'INVALID_LABEL_RULE',
    );
    return labelPullRequest(api, repository, id(env.PR_NUMBER), rules.rules);
  }
  ensure(
    ['prepare', 'format-write', 'dependency-merge'].includes(mode ?? ''),
    'INVALID_OPERATION',
  );
  const root = resolve(args[1] ?? '.');
  const config = await loadConfig(root);
  const token = env.MAINTENANCE_TOKEN;
  ensure(token, 'TOKEN_MISSING');
  const baseSha = env.TRUSTED_BASE_SHA ?? '';
  const api = new GitHubApi(token);
  await verifyTrustedSupply(api, root, config, baseSha);
  if (mode === 'prepare') {
    const acquisition = await acquireMaintenance(
      api,
      id(env.CI_RUN_ID),
      config.acquisition,
    );
    const files = acquisition.files;
    let prepared: PreparedMaintenance;
    if (
      files.length === 2 &&
      files.every((file) => ['package.json', 'bun.lock'].includes(file.path))
    ) {
      const protectedState = await observeProtection(api, acquisition);
      const result = await reproduceDependency(
        { ...acquisition, ...protectedState },
        config.policy,
        await contentAt(api, acquisition.repository, 'package.json', baseSha),
        await contentAt(api, acquisition.repository, 'bun.lock', baseSha),
        await contentAt(
          api,
          acquisition.repository,
          'package.json',
          acquisition.headSha,
        ),
        await contentAt(
          api,
          acquisition.repository,
          'bun.lock',
          acquisition.headSha,
        ),
        env.BUN_EXECUTABLE ?? '',
      );
      prepared = preparationFrom(
        result.request,
        [],
        baseSha,
        id(env.GITHUB_RUN_ID),
        id(env.GITHUB_RUN_ATTEMPT),
      );
    } else {
      const result = await reproduceFormat(
        acquisition,
        await fetchSourceFiles(api, acquisition),
        config.policy,
        await readFile(resolve(root, 'biome.json')),
        env.BIOME_EXECUTABLE ?? '',
      );
      prepared = preparationFrom(
        result.request,
        result.changes.map((item) => ({
          path: item.path,
          originalDigest: item.originalDigest,
          replacementBase64: Buffer.from(item.replacementBytes).toString(
            'base64',
          ),
        })),
        baseSha,
        id(env.GITHUB_RUN_ID),
        id(env.GITHUB_RUN_ATTEMPT),
      );
    }
    const bytes = new TextEncoder().encode(JSON.stringify(prepared));
    ensure(bytes.length <= BYTE_LIMIT, 'BYTE_LIMIT');
    await writeFile(resolve(root, 'prepared.json'), bytes);
    if (env.GITHUB_OUTPUT)
      await writeFile(
        env.GITHUB_OUTPUT,
        `pr=${acquisition.prNumber}\nhead=${acquisition.headSha}\noperation=${prepared.request.operation}\nbase=${baseSha}\n`,
        { flag: 'a' },
      );
    return {
      status: 'prepared',
      headSha: acquisition.headSha,
      prNumber: acquisition.prNumber,
    };
  }
  const prepared = await fetchPrepared(
    api,
    config,
    id(env.PREPARATION_RUN_ID),
    id(env.PREPARATION_ATTEMPT),
    env.PREPARED_HEAD ?? '',
    baseSha,
  );
  ensure(
    prepared.request.operation ===
      (mode === 'format-write' ? 'format-push' : mode),
    'OPERATION_MISMATCH',
  );
  return executeMaintenance(
    api,
    prepared,
    config.policy,
    config.acquisition,
    baseSha,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runMaintenanceCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(JSON.stringify(result) + '\n');
      if (
        'status' in result &&
        ['failure', 'unknown', 'reject'].includes(result.status)
      )
        process.exitCode = 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        JSON.stringify({
          status: 'reject',
          reasons: [
            error instanceof BoundaryError ? error.code : 'MAINTENANCE_FAILED',
          ],
        }) + '\n',
      );
      process.exitCode = 1;
    });
}
