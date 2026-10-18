import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../package/stage-package.js';
import { requireRestoredCore } from './ci-core.js';
import { installCIInputs } from './ci-inputs.js';
import type { Command, Executor } from './completion.js';
import { runSessionCompletion } from './completion.js';
import { sessionSourceInventory, stageSession } from './stage.js';

export interface CIContext {
  kind: 'github-actions-context';
  repository: 'Marukome0743/formicarium';
  head: string;
  runID: string;
  attempt: string;
  runURL: string;
}
export function validatePushContext(
  env: NodeJS.ProcessEnv,
  expectedRef: string,
): CIContext {
  if (
    env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_REPOSITORY !== 'Marukome0743/formicarium' ||
    env.GITHUB_EVENT_NAME !== 'push' ||
    env.GITHUB_REF !== expectedRef ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') ||
    !/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? '') ||
    !/^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? '')
  )
    throw Error('U2 CI context refused');
  return {
    kind: 'github-actions-context',
    repository: 'Marukome0743/formicarium',
    head: env.GITHUB_SHA!,
    runID: env.GITHUB_RUN_ID!,
    attempt: env.GITHUB_RUN_ATTEMPT!,
    runURL: `https://github.com/Marukome0743/formicarium/actions/runs/${env.GITHUB_RUN_ID}`,
  };
}
export function validateCIContext(env: NodeJS.ProcessEnv): CIContext {
  return validatePushContext(env, 'refs/heads/codex/terrarium-migration-u2');
}
function inside(root: string, path: string) {
  const value = relative(root, resolve(path));
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}
/** Translate only the completion's six declared tasks; no shell or tool-path search. */
export function mapCICommand(command: Command, root: string): Command {
  root = resolve(root);
  const cwd = resolve(command.cwd);
  if (!inside(root, cwd)) throw Error('U2 CI command cwd refused');
  if (command.executable === 'mise') {
    if (cwd !== root || command.args.length !== 2 || command.args[0] !== 'run')
      throw Error('U2 CI task shape refused');
    const task = command.args[1];
    let args: string[];
    if (
      ['build', 'typecheck', 'test-light', 'test-consumer'].includes(task ?? '')
    )
      args = ['scripts/ci/tasks.ts', task!];
    else if (task === 'migration-session-unit')
      args = [
        '--test',
        '--test-concurrency=1',
        ...[
          'guest-validation',
          'fixture',
          'reservation',
          'public',
          'consumer',
        ].map((name) => `tests/migration-session/${name}.test.js`),
      ];
    else if (task === 'migration-session-browser')
      args = [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--config',
        'tests/migration-session/playwright.config.ts',
        'tests/migration-session/consumer.spec.ts',
      ];
    else throw Error('U2 CI unknown task refused');
    return { executable: process.execPath, args, cwd };
  }
  if (command.executable !== process.execPath)
    throw Error('U2 CI non-Node command refused');
  // Direct commands originate in completion.ts. Restrict their entry points and all absolute input paths.
  const first = command.args[0];
  if (
    ![
      '--test',
      '--import',
      'scripts/migration-session/coverage.js',
      resolve(root, 'node_modules/@playwright/test/cli.js'),
    ].includes(first ?? '')
  )
    throw Error('U2 CI Node entry refused');
  if (command.args.some((arg) => isAbsolute(arg) && !inside(root, arg)))
    throw Error('U2 CI argument path refused');
  return { executable: process.execPath, args: [...command.args], cwd };
}
const execute: Executor = (command) =>
  new Promise((done, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });
    child.once('error', reject);
    child.once('close', (code, signal) =>
      code === 0 && !signal
        ? done()
        : reject(Error(`U2 CI command failed (${signal ?? code})`)),
    );
  });
interface PreparedCI {
  schema: 'migration-session-prepared-ci';
  context:
    | CIContext
    | { kind: 'local-preparation'; head: string; acceptancePassed: false };
  manifestPath: string;
  manifestSha256: string;
  candidatePath: string;
  consumer: string;
  guest: string;
  sourceIdentity: string;
}
function checkHead(root: string, head: string) {
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (actual !== head) throw Error('U2 CI actual checkout head differs');
}
export async function prepareCI(options: {
  root: string;
  manifestPath: string;
  consumer: string;
  contextPath: string;
  localPreparation?: boolean;
}) {
  const root = await realpath(options.root);
  const localHead = options.localPreparation
    ? execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim()
    : undefined;
  if (localHead && !/^[a-f0-9]{40}$/.test(localHead))
    throw Error('U2 local actual head invalid');
  const context: PreparedCI['context'] = localHead
    ? { kind: 'local-preparation', head: localHead, acceptancePassed: false }
    : validateCIContext(process.env);
  if (process.versions.node !== '26.12.0')
    throw Error('U2 CI Node 26.12.0 required');
  checkHead(root, context.head);
  await requireRestoredCore(root);
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-session/npm-cache',
  );
  const consumer = resolve(options.consumer),
    contextPath = resolve(options.contextPath);
  if (inside(root, consumer) || !isAbsolute(options.consumer))
    throw Error('U2 CI independent consumer outside checkout required');
  if (!inside(resolve(root, '.artifacts/migration-session'), contextPath))
    throw Error('U2 CI context output path refused');
  const installed = await installCIInputs(root, resolve(options.manifestPath));
  let ownsConsumer = false;
  try {
    const sources = await sessionSourceInventory(root);
    if (
      JSON.stringify(sources) !== JSON.stringify(installed.manifest.sourceFiles)
    )
      throw Error('U2 CI source inventory differs from observed manifest');
    await mkdir(consumer);
    ownsConsumer = true;
    const candidatePath = await stageSession({
      root,
      sourceCommit: context.head,
    });
    const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
    // Generated JS is part of the inventory, not claimed to be committed source bytes.
    candidate.sourceCommitKind = options.localPreparation
      ? 'local-preparation-base-revision-with-working-source-inventory'
      : 'github-actions-head-with-generated-working-source-inventory';
    await writeFile(candidatePath, JSON.stringify(candidate, null, 2) + '\n');
    const npm = resolve(
      dirname(process.execPath),
      '../lib/node_modules/npm/bin/npm-cli.js',
    );
    await execute({
      executable: process.execPath,
      args: [
        npm,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        candidate.tarball.path,
      ],
      cwd: consumer,
    });
    const packageRoot = resolve(
      consumer,
      'node_modules/@aletheia-works/formicarium',
    );
    for (const file of candidate.files)
      if (
        sha256(await readFile(resolve(packageRoot, file.path))) !== file.sha256
      )
        throw Error('U2 CI installed package digest differs');
    const prepared: PreparedCI = {
      schema: 'migration-session-prepared-ci',
      context,
      manifestPath: resolve(options.manifestPath),
      manifestSha256: installed.manifestSha256,
      candidatePath,
      consumer,
      guest: resolve(root, '.artifacts/u2-release-inputs/aube-v2.7.0/aube'),
      sourceIdentity: candidate.sourceIdentity,
    };
    await mkdir(dirname(contextPath), { recursive: true });
    await writeFile(contextPath, JSON.stringify(prepared, null, 2) + '\n', {
      flag: 'wx',
    });
    return contextPath;
  } catch (error) {
    if (ownsConsumer) await rm(consumer, { recursive: true, force: true });
    for (const file of installed.created.reverse()) await rm(file);
    throw error;
  }
}
export async function verifyCI(root: string, contextPath: string) {
  root = await realpath(root);
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-session/npm-cache',
  );
  const prepared: PreparedCI = JSON.parse(await readFile(contextPath, 'utf8'));
  const context = validateCIContext(process.env);
  checkHead(root, context.head);
  if (
    prepared.schema !== 'migration-session-prepared-ci' ||
    prepared.context.kind !== 'github-actions-context' ||
    JSON.stringify(context) !== JSON.stringify(prepared.context)
  )
    throw Error(
      'U2 CI prepared context differs (local preparation cannot verify CI)',
    );
  if (
    sha256(await readFile(prepared.manifestPath)) !== prepared.manifestSha256 ||
    sha256(JSON.stringify(await sessionSourceInventory(root))) !==
      prepared.sourceIdentity
  )
    throw Error('U2 CI prepared source/input changed');
  process.env.FORMICARIUM_CANDIDATE = prepared.candidatePath;
  process.env.FORMICARIUM_CONSUMER = prepared.consumer;
  process.env.FORMICARIUM_SESSION_GUEST = prepared.guest;
  process.env.FORMICARIUM_SESSION_LOCAL_ONLY = '1';
  delete process.env.FORMICARIUM_SESSION_CI_EVIDENCE;
  delete process.env.FORMICARIUM_SESSION_CI_SHA256;
  const actualCommands: Command[] = [];
  const reportPath = await runSessionCompletion({
    root,
    execute: async (command) => {
      const actual = mapCICommand(command, root);
      await execute(actual);
      actualCommands.push(actual);
    },
  });
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (!report.localPassed || report.acceptancePassed !== false)
    throw Error('U2 CI provisional receipt differs');
  const observedPath = resolve(dirname(reportPath), 'ci-job-observations.json');
  await writeFile(
    observedPath,
    JSON.stringify(
      {
        recordKind: 'ci-job-observations',
        assembledAt: new Date().toISOString(),
        context,
        manifestSha256: prepared.manifestSha256,
        sourceCommit: context.head,
        sourceIdentity: report.sourceIdentity,
        candidateSha256: report.candidateSha256,
        checksCompleted: true,
        acceptancePassed: false,
        jobConclusion: 'requires-independent-GitHub-API-observation',
        reportPath,
        commands: actualCommands.map((command) => ({
          ...command,
          exitCode: 0,
          recordKind: 'observed-command-summary',
        })),
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  return observedPath;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, input, consumer, contextPath, ...extra] = process.argv.slice(2);
  if (
    (mode === 'prepare' || mode === 'prepare-local') &&
    input &&
    consumer &&
    contextPath &&
    !extra.length
  )
    console.log(
      await prepareCI({
        root: process.cwd(),
        manifestPath: input,
        consumer,
        contextPath,
        localPreparation: mode === 'prepare-local',
      }),
    );
  else if (
    mode === 'verify' &&
    input &&
    !consumer &&
    !contextPath &&
    !extra.length
  )
    console.log(await verifyCI(process.cwd(), input));
  else
    throw Error(
      'usage: ci.js prepare <manifest> <absolute-outside-consumer> <context-output> | verify <context>',
    );
}
