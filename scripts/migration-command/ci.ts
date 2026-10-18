import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mapInstallCICommand } from '../migration-install/ci.js';
import {
  INSTALL_SITE_DESTINATION,
  requireInstallActualSite,
} from '../migration-install/ci-inputs.js';
import {
  executeInstallCommand,
  verifyInstallCommandLog,
} from '../migration-install/completion.js';
import type { CIContext } from '../migration-session/ci.js';
import { validatePushContext } from '../migration-session/ci.js';
import { requireRestoredCore } from '../migration-session/ci-core.js';
import type { Command } from '../migration-session/completion.js';
import { sha256 } from '../package/stage-package.js';
import { inspectCommandInputs, restoreCommandInputs } from './ci-inputs.js';
import { runCommandCompletion, verifyCommandLog } from './completion.js';
import { COMMAND_UNIT, commandSourceInventory, stageCommand } from './stage.js';

/** The dedicated U4 branch; U3's branch or run never stands in for it. */
export const COMMAND_BRANCH = 'refs/heads/codex/terrarium-migration-b1';
export const validateCommandCIContext = (env: NodeJS.ProcessEnv) =>
  validatePushContext(env, COMMAND_BRANCH);
function inside(root: string, path: string) {
  const suffix = relative(resolve(root), resolve(path));
  return suffix === '' || (!suffix.startsWith('..') && !isAbsolute(suffix));
}
export const COMMAND_UNIT_FILES = Object.freeze([
  'runner-ready',
  'parse',
  'dispatch',
  'public',
  'consumer',
  'acceptance',
]);
/** Maps only the U4 tasks and scripts; every other command keeps U3/U2 rules. */
export function mapCommandCICommand(command: Command, root: string): Command {
  root = resolve(root);
  if (!inside(root, command.cwd)) throw Error('U4 CI command cwd refused');
  if (command.executable === 'mise') {
    if (
      command.cwd !== root ||
      command.args.length !== 2 ||
      command.args[0] !== 'run'
    )
      throw Error('U4 CI task shape refused');
    if (command.args[1] === 'migration-command-unit')
      return {
        executable: process.execPath,
        cwd: root,
        args: [
          '--test',
          '--test-concurrency=1',
          ...COMMAND_UNIT_FILES.map(
            (name) => `tests/migration-command/${name}.test.js`,
          ),
        ],
      };
    if (command.args[1]?.startsWith('migration-command-'))
      throw Error('U4 CI unmapped task refused');
    return mapInstallCICommand(command, root);
  }
  if (
    command.executable === process.execPath &&
    [
      'scripts/migration-command/coverage.js',
      'scripts/migration-command/measure.js',
    ].includes(command.args[0] ?? '')
  ) {
    if (command.args.some((arg) => isAbsolute(arg) && !inside(root, arg)))
      throw Error('U4 CI direct input path escapes checkout');
    return { ...command, args: [...command.args] };
  }
  return mapInstallCICommand(command, root);
}
interface Prepared {
  schema: 'migration-command-prepared-ci';
  context:
    | CIContext
    | { kind: 'local-preparation'; head: string; acceptancePassed: false };
  manifestPath: string;
  manifestSha256: string;
  candidatePath: string;
  consumer: string;
  guest: string;
  sourceIdentity: string;
  actualSite: string;
}
function actualHead(root: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}
export async function prepareCommandCI(options: {
  root: string;
  manifestPath: string;
  consumer: string;
  contextPath: string;
  localPreparation?: boolean;
}) {
  const root = await realpath(options.root);
  const head = actualHead(root);
  if (!/^[a-f0-9]{40}$/.test(head) || process.versions.node !== '26.12.0')
    throw Error('U4 CI actual head/Node 26.12.0 required');
  const context: Prepared['context'] = options.localPreparation
    ? { kind: 'local-preparation', head, acceptancePassed: false }
    : validateCommandCIContext(process.env);
  if (context.head !== head)
    throw Error('U4 CI head differs from actual checkout');
  if (!isAbsolute(options.consumer) || inside(root, options.consumer))
    throw Error('U4 independent consumer must be outside checkout');
  if (
    !inside(resolve(root, '.artifacts/migration-command'), options.contextPath)
  )
    throw Error('U4 context output escapes own scratch');
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-command/npm-cache',
  );
  await requireRestoredCore(root);
  const installed = await restoreCommandInputs(
    root,
    resolve(options.manifestPath),
  );
  process.env.U2_ACTUAL_SITE = installed.actualSite;
  await requireInstallActualSite(root);
  if (
    JSON.stringify(await commandSourceInventory(root)) !==
    JSON.stringify(installed.manifest.sourceFiles)
  )
    throw Error('U4 observed CI source inventory differs');
  await mkdir(options.consumer);
  const candidatePath = await stageCommand({ root, sourceCommit: head });
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  candidate.sourceCommitKind = options.localPreparation
    ? 'local-preparation-base-revision-with-working-source-inventory'
    : 'github-actions-head-with-generated-working-source-inventory';
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  const npm = resolve(
    dirname(process.execPath),
    '../lib/node_modules/npm/bin/npm-cli.js',
  );
  await executeInstallCommand(
    {
      executable: process.execPath,
      cwd: options.consumer,
      args: [
        npm,
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        candidate.tarball.path,
      ],
    },
    resolve(
      root,
      `.artifacts/migration-command/consumer-install-${Date.now()}.log`,
    ),
  );
  const packageRoot = resolve(
    options.consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  for (const file of candidate.files)
    if (sha256(await readFile(resolve(packageRoot, file.path))) !== file.sha256)
      throw Error('U4 independently installed candidate bytes differ');
  const prepared: Prepared = {
    schema: 'migration-command-prepared-ci',
    context,
    manifestPath: resolve(options.manifestPath),
    manifestSha256: installed.manifestSha256,
    candidatePath,
    consumer: options.consumer,
    guest: resolve(root, '.artifacts/u2-release-inputs/aube-v2.7.0/aube'),
    sourceIdentity: candidate.sourceIdentity,
    actualSite: installed.actualSite,
  };
  await mkdir(dirname(options.contextPath), { recursive: true });
  await writeFile(
    options.contextPath,
    `${JSON.stringify(prepared, null, 2)}\n`,
    { flag: 'wx' },
  );
  return options.contextPath;
}
export async function verifyCommandCI(root: string, path: string) {
  root = await realpath(root);
  const prepared: Prepared = JSON.parse(await readFile(path, 'utf8'));
  const context = validateCommandCIContext(process.env);
  if (
    prepared.schema !== 'migration-command-prepared-ci' ||
    prepared.context.kind !== 'github-actions-context' ||
    actualHead(root) !== context.head ||
    JSON.stringify(prepared.context) !== JSON.stringify(context)
  )
    throw Error('U4 CI context changed/local preparation cannot be CI proof');
  const input = await inspectCommandInputs(root, prepared.manifestPath);
  if (
    input.manifestSha256 !== prepared.manifestSha256 ||
    sha256(JSON.stringify(await commandSourceInventory(root))) !==
      prepared.sourceIdentity
  )
    throw Error('U4 prepared current source/input differs');
  if (prepared.actualSite !== resolve(root, INSTALL_SITE_DESTINATION))
    throw Error('U4 prepared actual site path differs/missing');
  process.env.U2_ACTUAL_SITE = prepared.actualSite;
  await requireInstallActualSite(root);
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-command/npm-cache',
  );
  process.env.FORMICARIUM_CANDIDATE = prepared.candidatePath;
  process.env.FORMICARIUM_CONSUMER = prepared.consumer;
  process.env.FORMICARIUM_SESSION_GUEST = prepared.guest;
  process.env.FORMICARIUM_COMMAND_LOCAL_ONLY = '1';
  delete process.env.FORMICARIUM_COMMAND_CI_EVIDENCE;
  delete process.env.FORMICARIUM_COMMAND_CI_SHA256;
  const actual: (Command &
    Awaited<ReturnType<typeof executeInstallCommand>>)[] = [];
  const reportPath = await runCommandCompletion({
    root,
    execute: async (command, logPath) => {
      const mapped = mapCommandCICommand(command, root);
      const observed = await executeInstallCommand(mapped, logPath);
      await verifyCommandLog(command, observed);
      actual.push({ ...mapped, ...observed });
      return observed;
    },
  });
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (
    report.localPassed !== true ||
    report.acceptancePassed !== false ||
    report.unit !== COMMAND_UNIT
  )
    throw Error('U4 CI provisional report differs');
  // Independently re-read every producer log before emitting checksCompleted.
  for (const observed of actual)
    await verifyInstallCommandLog(observed, observed);
  await requireInstallActualSite(root);
  const output = resolve(dirname(reportPath), 'ci-job-observations.json');
  await writeFile(
    output,
    `${JSON.stringify(
      {
        recordKind: 'ci-job-observations',
        unit: COMMAND_UNIT,
        assembledAt: new Date().toISOString(),
        context,
        manifestSha256: prepared.manifestSha256,
        sourceCommit: context.head,
        sourceIdentity: report.sourceIdentity,
        candidateSha256: report.candidateSha256,
        b1: report.b1,
        checksCompleted: true,
        acceptancePassed: false,
        jobConclusion: 'requires-independent-GitHub-API-observation',
        reportPath,
        commands: actual,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  return output;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, input, consumer, output, ...extra] = process.argv.slice(2);
  if (
    ['prepare', 'prepare-local'].includes(mode ?? '') &&
    input &&
    consumer &&
    output &&
    !extra.length
  )
    console.log(
      await prepareCommandCI({
        root: process.cwd(),
        manifestPath: input,
        consumer,
        contextPath: output,
        localPreparation: mode === 'prepare-local',
      }),
    );
  else if (mode === 'verify' && input && !consumer && !output && !extra.length)
    console.log(await verifyCommandCI(process.cwd(), input));
  else
    throw Error(
      'usage: U4 ci.js prepare[-local] <manifest> <independent consumer> <context> | verify <context>',
    );
}
