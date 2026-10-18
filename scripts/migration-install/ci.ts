import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CIContext } from '../migration-session/ci.js';
import {
  mapCICommand as mapSharedCICommand,
  validatePushContext,
} from '../migration-session/ci.js';
import { requireRestoredCore } from '../migration-session/ci-core.js';
import type { Command } from '../migration-session/completion.js';
import { sha256 } from '../package/stage-package.js';
import {
  INSTALL_SITE_DESTINATION,
  inspectInstallInputs,
  requireInstallActualSite,
  restoreInstallInputs,
} from './ci-inputs.js';
import {
  executeInstallCommand,
  runInstallCompletion,
  verifyInstallCommandLog,
} from './completion.js';
import { installSourceInventory, stageInstall } from './stage.js';

const BRANCH = 'refs/heads/codex/terrarium-migration-u3';
export const validateInstallCIContext = (env: NodeJS.ProcessEnv) =>
  validatePushContext(env, BRANCH);
function inside(root: string, path: string) {
  const suffix = relative(resolve(root), resolve(path));
  return suffix === '' || (!suffix.startsWith('..') && !isAbsolute(suffix));
}
export function mapInstallCICommand(command: Command, root: string): Command {
  root = resolve(root);
  if (!inside(root, command.cwd)) throw Error('U3 CI command cwd refused');
  if (command.executable === 'mise') {
    if (
      command.cwd !== root ||
      command.args.length !== 2 ||
      command.args[0] !== 'run'
    )
      throw Error('U3 CI task shape refused');
    if (command.args[1] === 'migration-install-unit')
      return {
        executable: process.execPath,
        cwd: root,
        args: [
          '--test',
          '--test-concurrency=1',
          ...[
            'runner-ready',
            'catalog',
            'transfer',
            'archive',
            'lifecycle',
            'public',
            'consumer',
            'hash-regression',
          ].map((name) => `tests/migration-install/${name}.test.js`),
        ],
      };
    if (command.args[1] === 'migration-install-browser')
      return {
        executable: process.execPath,
        cwd: root,
        args: [
          'node_modules/@playwright/test/cli.js',
          'test',
          'tests/migration-install/consumer.spec.ts',
          'tests/migration-install/hash-regression.spec.ts',
          '--config',
          'tests/migration-install/playwright.config.ts',
          '--workers=1',
          '--retries=0',
        ],
      };
    return mapSharedCICommand(command, root);
  }
  if (
    command.executable === process.execPath &&
    [
      'scripts/migration-install/coverage.js',
      'scripts/migration-install/measure.js',
    ].includes(command.args[0] ?? '')
  ) {
    if (command.args.some((arg) => isAbsolute(arg) && !inside(root, arg)))
      throw Error('U3 CI direct input path escapes checkout');
    return {
      executable: command.executable,
      cwd: command.cwd,
      args: [...command.args],
    };
  }
  return mapSharedCICommand(command, root);
}
interface Prepared {
  schema: 'migration-install-prepared-ci';
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
export async function prepareInstallCI(options: {
  root: string;
  manifestPath: string;
  consumer: string;
  contextPath: string;
  localPreparation?: boolean;
}) {
  const root = await realpath(options.root);
  const head = actualHead(root);
  if (!/^[a-f0-9]{40}$/.test(head) || process.versions.node !== '26.12.0')
    throw Error('U3 CI actualhead/Node26.12.0 required');
  const context: Prepared['context'] = options.localPreparation
    ? { kind: 'local-preparation', head, acceptancePassed: false }
    : validateInstallCIContext(process.env);
  if (context.head !== head)
    throw Error('U3 CI head differs from actual checkout');
  if (!isAbsolute(options.consumer) || inside(root, options.consumer))
    throw Error('U3 independent consumer must be outside checkout');
  if (
    !inside(resolve(root, '.artifacts/migration-install'), options.contextPath)
  )
    throw Error('U3 context output escapes own scratch');
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-install/npm-cache',
  );
  await requireRestoredCore(root);
  const installed = await restoreInstallInputs(
    root,
    resolve(options.manifestPath),
  );
  process.env.U2_ACTUAL_SITE = installed.actualSite;
  await requireInstallActualSite(root);
  if (
    JSON.stringify(await installSourceInventory(root)) !==
    JSON.stringify(installed.manifest.sourceFiles)
  )
    throw Error('U3 observed CI source inventory differs');
  await mkdir(options.consumer);
  const candidatePath = await stageInstall({ root, sourceCommit: head });
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  candidate.sourceCommitKind = options.localPreparation
    ? 'local-preparation-base-revision-with-working-source-inventory'
    : 'github-actions-head-with-generated-working-source-inventory';
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  const npm = resolve(
    dirname(process.execPath),
    '../lib/node_modules/npm/bin/npm-cli.js',
  );
  const log = resolve(
    root,
    `.artifacts/migration-install/consumer-install-${Date.now()}.log`,
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
    log,
  );
  const packageRoot = resolve(
    options.consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  for (const file of candidate.files)
    if (sha256(await readFile(resolve(packageRoot, file.path))) !== file.sha256)
      throw Error('U3 independently installed candidate bytes differ');
  const prepared: Prepared = {
    schema: 'migration-install-prepared-ci',
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
export async function verifyInstallCI(root: string, path: string) {
  root = await realpath(root);
  const prepared: Prepared = JSON.parse(await readFile(path, 'utf8'));
  const context = validateInstallCIContext(process.env);
  if (
    prepared.schema !== 'migration-install-prepared-ci' ||
    prepared.context.kind !== 'github-actions-context' ||
    actualHead(root) !== context.head ||
    JSON.stringify(prepared.context) !== JSON.stringify(context)
  )
    throw Error('U3 CI context changed/local-preparation cannot be CI proof');
  const input = await inspectInstallInputs(root, prepared.manifestPath);
  if (
    input.manifestSha256 !== prepared.manifestSha256 ||
    sha256(JSON.stringify(await installSourceInventory(root))) !==
      prepared.sourceIdentity
  )
    throw Error('U3 prepared current source/input differs');
  if (prepared.actualSite !== resolve(root, INSTALL_SITE_DESTINATION))
    throw Error('U3 prepared actual site path differs/missing');
  process.env.U2_ACTUAL_SITE = prepared.actualSite;
  await requireInstallActualSite(root);
  process.env.npm_config_cache = resolve(
    root,
    '.artifacts/migration-install/npm-cache',
  );
  process.env.FORMICARIUM_CANDIDATE = prepared.candidatePath;
  process.env.FORMICARIUM_CONSUMER = prepared.consumer;
  process.env.FORMICARIUM_SESSION_GUEST = prepared.guest;
  process.env.FORMICARIUM_INSTALL_LOCAL_ONLY = '1';
  delete process.env.FORMICARIUM_INSTALL_CI_EVIDENCE;
  delete process.env.FORMICARIUM_INSTALL_CI_SHA256;
  const actual: (Command &
    Awaited<ReturnType<typeof executeInstallCommand>>)[] = [];
  const logs = resolve(
    root,
    `.artifacts/migration-install/ci-execution-${Date.now()}`,
  );
  await mkdir(logs);
  const reportPath = await runInstallCompletion({
    root,
    execute: async (command) => {
      const mapped = mapInstallCICommand(command, root);
      const observed = await executeInstallCommand(
        mapped,
        resolve(logs, `command-${actual.length + 1}.log`),
      );
      actual.push({ ...mapped, ...observed });
      return observed;
    },
  });
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (
    report.localPassed !== true ||
    report.acceptancePassed !== false ||
    report.unit !== 'u3-install'
  )
    throw Error('U3 CI provisional report differs');
  // Independently re-read every producer log before emitting checksCompleted.
  for (const observed of actual)
    await verifyInstallCommandLog(observed, observed);
  await requireInstallActualSite(root);
  const output = resolve(dirname(reportPath), 'ci-job-observations.json');
  await writeFile(
    output,
    `${JSON.stringify({ recordKind: 'ci-job-observations', unit: 'u3-install', assembledAt: new Date().toISOString(), context, manifestSha256: prepared.manifestSha256, sourceCommit: context.head, sourceIdentity: report.sourceIdentity, candidateSha256: report.candidateSha256, checksCompleted: true, acceptancePassed: false, jobConclusion: 'requires-independent-GitHub-API-observation', reportPath, commands: actual }, null, 2)}\n`,
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
      await prepareInstallCI({
        root: process.cwd(),
        manifestPath: input,
        consumer,
        contextPath: output,
        localPreparation: mode === 'prepare-local',
      }),
    );
  else if (mode === 'verify' && input && !consumer && !output && !extra.length)
    console.log(await verifyInstallCI(process.cwd(), input));
  else
    throw Error(
      'usage: U3 ci.js prepare[-local] <manifest> <independentconsumer> <context> | verify <context>',
    );
}
