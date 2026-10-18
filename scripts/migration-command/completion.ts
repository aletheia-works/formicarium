import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import { requireInstallActualSite } from '../migration-install/ci-inputs.js';
import {
  assertInstallTestOutput,
  executeInstallCommand,
} from '../migration-install/completion.js';
import { summarizeInstallTrials } from '../migration-install/measure.js';
import type { Command } from '../migration-session/completion.js';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
  sha256,
} from '../package/stage-package.js';
import {
  type ApiAcceptance,
  assembleB1,
  type ObservedCommand,
  readPreflightEvidenceId,
} from './b1.js';
import { COMMAND_COVERAGE_TESTS, COMMAND_REALMS } from './coverage.js';
import {
  assertCommandDistribution,
  COMMAND_UNIT,
  commandSourceInventory,
} from './stage.js';

export interface LabeledCommand {
  label: string;
  command: Command;
}
const TEST_TASKS = [
  'test-light',
  'test-consumer',
  'migration-session-unit',
  'migration-install-unit',
  'migration-command-unit',
  'migration-session-browser',
  'migration-install-browser',
  'migration-command-browser',
];
/** U4 also recognises its own tasks; U3's predicate would treat them as builds. */
export function isCommandTestCommand(command: Command): boolean {
  return (
    command.args.includes('--test') ||
    (command.args.includes('test') &&
      command.args.some((arg) =>
        /(?:^|\/)@playwright\/test\/cli\.js$/.test(arg),
      )) ||
    command.args.some((arg) => TEST_TASKS.includes(arg))
  );
}
/** Exit 0 is not enough: a test log must hold a complete, skip-free summary. */
export async function verifyCommandLog(
  command: Command,
  execution: { rawLogPath: string; rawLogSha256: string; exitCode: number },
): Promise<void> {
  const bytes = await readFile(execution.rawLogPath);
  if (execution.exitCode !== 0 || sha256(bytes) !== execution.rawLogSha256)
    throw Error('U4 retained command log/exit differs');
  if (isCommandTestCommand(command))
    assertInstallTestOutput(bytes.toString('utf8'));
}

/** Refuses a U3 (or any other) candidate and stale source/pack identity. */
export async function checkCommandCandidate(path: string, root: string) {
  const candidate = JSON.parse(await readFile(path, 'utf8'));
  if (
    candidate.unit !== COMMAND_UNIT ||
    candidate.version !== '0.3.0' ||
    candidate.provisional !== true ||
    !/^[a-f0-9]{40}$/.test(candidate.sourceCommit)
  )
    throw Error('current U4 candidate identity missing');
  const sourceFiles = await commandSourceInventory(root);
  if (
    JSON.stringify(candidate.sourceFiles) !== JSON.stringify(sourceFiles) ||
    candidate.sourceIdentity !== sha256(JSON.stringify(sourceFiles))
  )
    throw Error('current U4 source differs from candidate');
  assertCommandDistribution();
  if (
    JSON.stringify([...candidate.distributionInventory].sort()) !==
      JSON.stringify([...FIRST_PARTY_JS].sort()) ||
    JSON.stringify(
      candidate.files.map((row: { path: string }) => row.path).sort(),
    ) !== JSON.stringify([...PACKAGE_FILES].sort())
  )
    throw Error('current U4 complete23JS/package inventory differs');
  if (
    sha256(await readFile(candidate.tarball.path)) !== candidate.tarball.sha256
  )
    throw Error('current U4 tarball changed');
  return candidate;
}

/**
 * U3's sequence plus U4 unit/browser/type suites and U4-inclusive coverage.
 * Browser suites call Playwright directly with the list reporter so that each
 * project's own result lines are retained for the per-environment B1 rows.
 */
export function commandCompletionCommands(
  root: string,
  coverage: string,
  measurement: string,
): LabeledCommand[] {
  const node = process.execPath;
  const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
  const command = (label: string, args: string[], cwd = root) => ({
    label,
    command: { executable: node, args, cwd },
  });
  const task = (label: string, name: string) => ({
    label,
    command: { executable: 'mise', args: ['run', name], cwd: root },
  });
  const test = (label: string, paths: string[]) =>
    command(label, ['--test', '--test-concurrency=1', ...paths]);
  const browser = (label: string, config: string, specs: string[]) =>
    command(label, [
      playwright,
      'test',
      ...specs,
      '--config',
      config,
      '--workers=1',
      '--retries=0',
      '--reporter=list',
    ]);
  const coverageBrowser = (label: string, directory: string, extra: string[]) =>
    command(
      label,
      [
        playwright,
        'test',
        ...extra,
        '--config',
        'playwright.coverage.config.mjs',
        '--workers=1',
        '--retries=0',
        '--output',
        resolve(coverage, `browser-results/${label.slice(9)}`),
      ],
      resolve(coverage, directory),
    );
  return [
    task('build', 'build'),
    task('typecheck', 'typecheck'),
    task('test-light', 'test-light'),
    test('acceptance', [
      'tests/migration-command/acceptance.test.js',
      'tests/migration-install/acceptance.test.js',
      'tests/migration-session/ci.test.js',
    ]),
    task('session-unit', 'migration-session-unit'),
    task('install-unit', 'migration-install-unit'),
    task('command-unit', 'migration-command-unit'),
    browser('session-browser', 'tests/migration-session/playwright.config.ts', [
      'tests/migration-session/consumer.spec.ts',
    ]),
    browser('install-browser', 'tests/migration-install/playwright.config.ts', [
      'tests/migration-install/consumer.spec.ts',
      'tests/migration-install/hash-regression.spec.ts',
    ]),
    browser('command-browser', 'tests/migration-command/playwright.config.ts', [
      'tests/migration-command/consumer.spec.ts',
    ]),
    task('test-consumer', 'test-consumer'),
    test('node-regression', [
      'tests/node/build.test.js',
      'tests/node/probe.test.js',
      'tests/node/aube-1645.test.js',
    ]),
    command('browser-regression', [
      playwright,
      'test',
      'tests/browser/probe.spec.ts',
      'tests/browser/aube-1645.spec.ts',
      '--workers=1',
      '--retries=0',
      '--reporter=list',
    ]),
    command('coverage-prepare', [
      'scripts/migration-command/coverage.js',
      'prepare',
      coverage,
    ]),
    command('coverage-package-node', [
      '--import',
      resolve(coverage, 'coverage-node-preload.mjs'),
      '--test',
      '--test-reporter=tap',
      '--test-isolation=none',
      ...[
        'errors',
        'validation',
        'state',
        'lifecycle',
        'protocol',
        'core',
        'guest-io',
        'worker-execution',
        'public',
        'node-api',
        'node-worker',
        'consumer',
      ].map((name) => resolve(coverage, `tests/package/${name}.test.js`)),
    ]),
    command('coverage-session-node', [
      '--import',
      resolve(coverage, 'coverage-session-node-preload.mjs'),
      '--test',
      '--test-reporter=tap',
      '--test-isolation=none',
      ...[
        'guest-validation',
        'fixture',
        'reservation',
        'public',
        'consumer',
      ].map((name) =>
        resolve(coverage, `tests/migration-session/${name}.test.js`),
      ),
      ...[
        'catalog',
        'transfer',
        'archive',
        'lifecycle',
        'public',
        'consumer',
        'hash-regression',
      ].map((name) =>
        resolve(coverage, `tests/migration-install/${name}.test.js`),
      ),
      ...COMMAND_COVERAGE_TESTS.map((name) =>
        resolve(coverage, `tests/migration-command/${name}.test.js`),
      ),
    ]),
    coverageBrowser('coverage-package', 'tests/package', [
      'browser-api.spec',
      'browser-worker.spec',
      'browser-broker.spec',
      'consumer.spec',
    ]),
    coverageBrowser('coverage-session', 'tests/migration-session', []),
    coverageBrowser('coverage-install', 'tests/migration-install', []),
    coverageBrowser('coverage-command', 'tests/migration-command', []),
    command('coverage-report', [
      'scripts/migration-command/coverage.js',
      'report',
      coverage,
      resolve(coverage, 'browser-results'),
      resolve(process.env.FORMICARIUM_CANDIDATE ?? ''),
    ]),
    command('measure', ['scripts/migration-command/measure.js', measurement]),
  ];
}

/** U4 CI evidence must name this unit, source and pack; U3 records are refused. */
export function checkCommandCIEvidence(
  ci: Record<string, unknown> | null,
  candidate: {
    sourceIdentity: string;
    sourceCommit: string;
    tarball: { sha256: string };
  },
) {
  if (
    ci?.recordKind !== 'observed-ci-summary' ||
    ci.unit !== COMMAND_UNIT ||
    ci.conclusion !== 'success' ||
    ci.sourceIdentity !== candidate.sourceIdentity ||
    ci.candidateSha256 !== candidate.tarball.sha256 ||
    ci.sourceCommit !== candidate.sourceCommit
  )
    throw Error('U4 same-source/same-pack independent CI evidence differs');
}

type Execution = Awaited<ReturnType<typeof executeInstallCommand>>;
export async function runCommandCompletion(
  options: {
    root?: string;
    /** Must write the raw log at `logPath`, inside this completion output. */
    execute?: (command: Command, logPath: string) => Promise<Execution>;
  } = {},
) {
  const root = resolve(options.root ?? process.cwd());
  const actualSite = await requireInstallActualSite(root);
  const candidatePath = process.env.FORMICARIUM_CANDIDATE;
  if (
    !candidatePath ||
    !process.env.FORMICARIUM_CONSUMER ||
    !process.env.FORMICARIUM_SESSION_GUEST
  )
    throw Error(
      'U4 completion current candidate/independent consumer/fixed guest inputs required',
    );
  const candidate = await checkCommandCandidate(candidatePath, root);
  const input = await consumerInput();
  const preflight = await readPreflightEvidenceId(root);
  const localOnly = process.env.FORMICARIUM_COMMAND_LOCAL_ONLY === '1';
  const ciPath = process.env.FORMICARIUM_COMMAND_CI_EVIDENCE;
  const ciDigest = process.env.FORMICARIUM_COMMAND_CI_SHA256;
  let ci: Record<string, unknown> | null = null;
  if (ciPath && ciDigest) {
    const bytes = await readFile(ciPath);
    if (sha256(bytes) !== ciDigest)
      throw Error('U4 independent CI evidence hash differs');
    ci = JSON.parse(bytes.toString('utf8'));
    checkCommandCIEvidence(ci, candidate);
  }
  if (!localOnly && !ci)
    throw Error(
      'new U4 signed same-candidate CI evidence required; explicit local mode is provisional only',
    );
  const scratch = resolve(root, '.artifacts/migration-command');
  await mkdir(scratch, { recursive: true });
  const lockPath = resolve(scratch, 'completion.lock');
  const lock = await open(lockPath, 'wx');
  const output = resolve(scratch, `completion-${randomUUID()}`);
  await mkdir(output);
  const coverage = resolve(output, 'coverage');
  const measurement = resolve(output, 'measurement');
  const planned = commandCompletionCommands(root, coverage, measurement);
  const observed: ObservedCommand[] = [];
  try {
    for (const [index, { label, command }] of planned.entries()) {
      const logPath = resolve(output, `command-${index + 1}.log`);
      const execution = options.execute
        ? await options.execute(command, logPath)
        : await executeInstallCommand(command, logPath);
      await verifyCommandLog(command, execution);
      observed.push({ ...command, ...execution, label });
    }
    await checkCommandCandidate(candidatePath, root);
    await requireInstallActualSite(root);
    const coverageReport = JSON.parse(
      await readFile(resolve(coverage, 'coverage-report.json'), 'utf8'),
    );
    const measured = JSON.parse(
      await readFile(resolve(measurement, 'measurement-report.json'), 'utf8'),
    );
    if (
      !coverageReport.passed ||
      coverageReport.threshold !== 80 ||
      coverageReport.files.length !== 23 ||
      coverageReport.candidateSha256 !== candidate.tarball.sha256
    )
      throw Error('U4 current23JS/rawrealms coverage acceptance failed');
    if (
      measured.passed !== true ||
      measured.thresholdMs !== 3000 ||
      measured.trialCount !== 36 ||
      measured.sourceIdentity !== candidate.sourceIdentity ||
      measured.candidateSha256 !== candidate.tarball.sha256
    )
      throw Error('U4 formal36 same-candidate evidence failed');
    summarizeInstallTrials(measured.trials);
    const acceptance: ApiAcceptance = await assembleB1({
      evidenceId: ci
        ? `u4-b1-ci-${String(ci.runID ?? 'run')}-${String(ci.attempt ?? '1')}`
        : `u4-b1-local-${randomUUID()}`,
      identity: {
        sourceCommit: candidate.sourceCommit,
        packSha256: candidate.tarball.sha256,
        inventorySha256: sha256(JSON.stringify(candidate.files)),
        preflightEvidenceId: preflight.evidenceId,
      },
      observed,
      expectedCommands: planned,
      output,
    });
    const b1Path = resolve(output, 'b1-acceptance.json');
    await writeFile(b1Path, `${JSON.stringify(acceptance, null, 2)}\n`, {
      flag: 'wx',
    });
    const report = {
      schemaVersion: 1,
      unit: COMMAND_UNIT,
      provisional: true,
      status: localOnly ? 'local-provisional' : 'verified-with-ci',
      assembledAt: new Date().toISOString(),
      candidatePath: resolve(candidatePath),
      candidateSha256: candidate.tarball.sha256,
      sourceCommit: candidate.sourceCommit,
      sourceCommitKind: candidate.sourceCommitKind,
      sourceIdentity: candidate.sourceIdentity,
      sourceFiles: candidate.sourceFiles,
      distributionInventory: FIRST_PARTY_JS,
      installedPackage: input.packageRoot,
      actualSite,
      localPassed: true,
      acceptancePassed: !localOnly && ci !== null,
      ci,
      blockers: ci ? [] : ['new U4 signed CI not independently verified'],
      b1: {
        path: b1Path,
        sha256: sha256(await readFile(b1Path)),
        // Local rows are a preflight; the formal B1 row comes from signed CI.
        formal: !localOnly && ci !== null,
      },
      preflightEvidence: preflight,
      coverageReport: resolve(coverage, 'coverage-report.json'),
      expectedFreshRealms: COMMAND_REALMS,
      measurementReport: resolve(measurement, 'measurement-report.json'),
      commands: observed.map((row) => ({
        ...row,
        recordKind: 'observed-command-summary',
      })),
      realSafari: '未検証',
    };
    const path = resolve(
      output,
      localOnly ? 'local-provisional-report.json' : 'completion-report.json',
    );
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, {
      flag: 'wx',
    });
    console.log(path);
    return path;
  } catch (error) {
    await writeFile(
      resolve(output, 'incomplete.json'),
      `${JSON.stringify(
        {
          unit: COMMAND_UNIT,
          status: 'incomplete',
          observedCommands: observed,
          failure: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      )}\n`,
      { flag: 'wx' },
    );
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  await runCommandCompletion();
