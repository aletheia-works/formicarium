import { randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import {
  checkInstallCandidate,
  executeInstallCommand,
  installCompletionCommands,
} from '../migration-install/completion.js';
import { reportInstallCoverage } from '../migration-install/coverage.js';
import { installSourceInventory } from '../migration-install/stage.js';
import type { Command } from '../migration-session/completion.js';
import { FIRST_PARTY_JS, sha256 } from '../package/stage-package.js';
import { verifyCurrentRawCoverage } from './current-coverage.js';
import { assemblePreflightEvidence } from './current-evidence.js';
import { checkAcceptance, parseUniqueJSON } from './verify.js';

type Seal = { path: string; sha256: string };
type ObservedCommand = Command &
  Awaited<ReturnType<typeof executeInstallCommand>> & { recordKind: string };
interface CurrentReport {
  schemaVersion: number;
  status: string;
  executionBoundary: string;
  exitCode: number;
  signal: null;
  startedAt: string;
  finishedAt: string;
  currentSourceVerified: boolean;
  acceptancePassed: boolean;
  mergeAllowed: boolean;
  laterUnitAcceptance: boolean;
  completedUnits: string[];
  sourceIdentity: string;
  currentSourceIdentity: string;
  candidateSha256: string;
  preparedInput: Seal;
  output: string;
  coveragePath: string;
  evidenceFiles: Seal[];
  commands: ObservedCommand[];
  pending: string[];
}
export interface CurrentCompletionInput {
  schemaVersion: 1;
  kind: 'current-completed-units-input';
  root: string;
  candidate: Seal;
  sourceIdentity: string;
  packSha256: string;
  currentSource: Seal[];
  currentSourceIdentity: string;
  consumer: string;
  guest: Seal;
  actualSite: { path: string; files: Seal[]; sha256: string };
  preflight: {
    trialsDirectory: string;
    browserLog: Seal;
    inventory: Seal;
    baselineDirectory: string;
    ciRun: Seal;
    files: Seal[];
  };
}
const readJSON = async <T>(path: string): Promise<T> =>
  parseUniqueJSON(await readFile(path, 'utf8')) as T;
const seal = async (path: string): Promise<Seal> => ({
  path: resolve(path),
  sha256: sha256(await readFile(path)),
});
async function tree(root: string, directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(resolve(root, directory), {
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink())
      throw Error(`symlink verification input: ${directory}/${entry.name}`);
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...(await tree(root, path)));
    else if (entry.isFile()) paths.push(path);
    else throw Error(`non-file verification input: ${path}`);
  }
  return paths;
}
export async function prepareActualSite(
  root: string,
  value: string | undefined,
): Promise<CurrentCompletionInput['actualSite']> {
  if (!value?.trim())
    throw Error(
      'U2_ACTUAL_SITE required; real distribution tests cannot be skipped',
    );
  const path = await realpath(resolve(root, value));
  const files = await Promise.all(
    (await tree(path, '.')).sort().map((file) => seal(resolve(path, file))),
  );
  if (!files.length)
    throw Error('U2_ACTUAL_SITE requires nonempty real distribution directory');
  return { path, files, sha256: sha256(JSON.stringify(files)) };
}
export async function assertActualSite(
  root: string,
  site: CurrentCompletionInput['actualSite'] | undefined,
): Promise<void> {
  if (
    !site?.path ||
    !Array.isArray(site.files) ||
    !site.files.length ||
    !/^[a-f0-9]{64}$/.test(site.sha256)
  )
    throw Error('prepared U2_ACTUAL_SITE missing');
  await assertSeals(site.files);
  if (
    JSON.stringify(await prepareActualSite(root, site.path)) !==
    JSON.stringify(site)
  )
    throw Error('U2_ACTUAL_SITE file inventory changed');
}
/** The U3 candidate's inventory is not a claim about the U1 verifier itself. */
export async function currentCompletionSource(root: string): Promise<Seal[]> {
  const paths = new Set(
    (await installSourceInventory(root)).map((row) => row.path),
  );
  for (const directory of [
    'scripts/migration-preflight',
    'tests/migration-preflight',
    'integration/vivarium/preflight',
  ])
    for (const path of await tree(root, directory)) paths.add(path);
  return Promise.all(
    [...paths].sort().map((path) => seal(resolve(root, path))),
  );
}
/** Every raw file this run's preflight evidence is assembled from. */
async function preflightFiles(
  root: string,
  preflight: Omit<CurrentCompletionInput['preflight'], 'files'>,
): Promise<Seal[]> {
  const paths = new Set<string>([
    preflight.browserLog.path,
    preflight.inventory.path,
    preflight.ciRun.path,
  ]);
  for (const directory of [
    preflight.trialsDirectory,
    preflight.baselineDirectory,
  ])
    for (const path of await tree(root, relative(root, directory)))
      paths.add(resolve(root, path));
  return Promise.all([...paths].sort().map(seal));
}
export async function assertSeals(rows: readonly Seal[]): Promise<void> {
  if (!rows.length || new Set(rows.map((row) => row.path)).size !== rows.length)
    throw Error('missing/duplicate immutable input files');
  for (const row of rows)
    if (
      !/^[a-f0-9]{64}$/.test(row.sha256) ||
      sha256(await readFile(row.path)) !== row.sha256
    )
      throw Error(`immutable input changed: ${row.path}`);
}
export function assertCurrentIdentity(
  input: CurrentCompletionInput,
  candidate: { sourceIdentity: string; tarball: { sha256: string } },
  source: Seal[],
): void {
  if (
    input.schemaVersion !== 1 ||
    input.kind !== 'current-completed-units-input' ||
    !/^[a-f0-9]{64}$/.test(input.packSha256) ||
    candidate.sourceIdentity !== input.sourceIdentity ||
    candidate.tarball.sha256 !== input.packSha256 ||
    !source.length ||
    JSON.stringify(source) !== JSON.stringify(input.currentSource) ||
    sha256(JSON.stringify(source)) !== input.currentSourceIdentity
  )
    throw Error('current source/pack/prepared input identity differs');
}
export async function acquireCurrentLock(root: string) {
  const path = resolve(
    root,
    '.artifacts/migration-preflight/current-completion.lock',
  );
  await mkdir(resolve(root, '.artifacts/migration-preflight'), {
    recursive: true,
  });
  const handle = await open(path, 'wx');
  return async () => {
    await handle.close();
    await rm(path);
  };
}
/** Work still open after a current local verification; finished units are not listed. */
export const CURRENT_PENDING: readonly string[] = Object.freeze([
  'current same-source signed CI before merge',
  'U4 B1 integration acceptance (C06)',
]);
/** Evidence made with an older toolchain is history, never current proof. */
export function assertCurrentToolchainEvidence(evidence: {
  environment?: { node?: unknown };
}): void {
  if (evidence.environment?.node !== process.version)
    throw Error(
      `preflight evidence must be produced with the current Node ${process.version}`,
    );
}
function preflightRun(input: CurrentCompletionInput) {
  return {
    trialsDirectory: input.preflight.trialsDirectory,
    browserLogPath: input.preflight.browserLog.path,
    inventoryPath: input.preflight.inventory.path,
    baselineDirectory: input.preflight.baselineDirectory,
    ciRunPath: input.preflight.ciRun.path,
  };
}
export function currentCompletionCommands(
  root: string,
  coverage: string,
  input: CurrentCompletionInput,
): Command[] {
  const existing = installCompletionCommands(
    root,
    coverage,
    resolve(coverage, 'unused-measurement'),
  );
  const commands = existing.filter(
    (command) => command.args[0] !== 'scripts/migration-install/measure.js',
  );
  const report = commands.at(-1)!;
  report.args[report.args.length - 1] = input.candidate.path;
  return [
    ...commands.slice(0, 2),
    {
      executable: 'mise',
      cwd: root,
      args: ['run', 'migration-preflight-unit'],
    },
    {
      executable: process.execPath,
      cwd: root,
      args: [
        '--test',
        '--test-concurrency=1',
        'tests/migration-preflight/current-completion.test.js',
        'tests/migration-preflight/current-evidence.test.js',
      ],
    },
    ...commands.slice(2),
  ];
}
/** Pure testable sequencing cannot mint a completion proof. */
export async function executeCurrentSequence<T>(
  commands: readonly Command[],
  execute: (command: Command, index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (const [index, command] of commands.entries())
    results.push(await execute(command, index));
  return results;
}
export function assertPassingTestOutput(raw: string): void {
  const ansiColors = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
  const normalized = raw.replace(ansiColors, '').replace(/^ℹ /gm, '# ');
  if (
    /\b(?:[1-9]\d*) (?:skipped|failed|flaky|interrupted|did not run)\b|# (?:skip|skipped|fail|cancelled|todo) [1-9]\d*|# SKIP\b|# TODO\b/.test(
      normalized,
    )
  )
    throw Error('test failures/skips/cancellations are not accepted');
  const taps = [...normalized.matchAll(/^# pass (\d+)$/gm)];
  const browser = normalized.match(/\b([1-9]\d*) passed\b/);
  const incompleteNode =
    taps.some((match) => Number(match[1]) <= 0) ||
    ['fail', 'skipped', 'cancelled', 'todo'].some((field) => {
      const rows = [
        ...normalized.matchAll(new RegExp(`^# ${field} (\\d+)$`, 'gm')),
      ];
      return rows.length !== taps.length || rows.some((row) => row[1] !== '0');
    });
  if ((!browser && !taps.length) || (taps.length > 0 && incompleteNode))
    throw Error('positive real test summary with no skips required');
}
export function assertCurrentCoverage(
  coverage: {
    passed: boolean;
    threshold: number;
    candidateSha256: string;
    lines: { total: number; covered: number; skipped: number; pct: number };
    files: { path: string; lines: Record<string, number> }[];
  },
  input: Pick<CurrentCompletionInput, 'packSha256'>,
): void {
  const { lines } = coverage;
  if (
    !coverage.passed ||
    coverage.threshold !== 80 ||
    coverage.candidateSha256 !== input.packSha256 ||
    !lines ||
    !Number.isSafeInteger(lines.total) ||
    lines.total <= 0 ||
    lines.skipped !== 0 ||
    !Number.isSafeInteger(lines.covered) ||
    lines.covered < 0 ||
    lines.covered > lines.total ||
    lines.covered / lines.total < 0.8 ||
    !Number.isFinite(lines.pct) ||
    Math.abs(lines.pct - (lines.covered / lines.total) * 100) >= 0.011 ||
    JSON.stringify(coverage.files.map((row) => row.path).sort()) !==
      JSON.stringify([...FIRST_PARTY_JS].sort()) ||
    coverage.files.some((row) => !Object.keys(row.lines).length)
  )
    throw Error(
      'fresh whole-distribution coverage missing/zero/skipped/below80',
    );
}
async function assertPreflight(input: CurrentCompletionInput) {
  await assertSeals(input.preflight.files);
  if (
    JSON.stringify(await preflightFiles(input.root, input.preflight)) !==
    JSON.stringify(input.preflight.files)
  )
    throw Error('preflight input inventory drift');
  const log = await readFile(input.preflight.browserLog.path, 'utf8');
  assertPassingTestOutput(log);
  const ansiColors = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
  if (!/\b36 passed\b/.test(log.replace(ansiColors, '')))
    throw Error('preflight browser log must show all 36 trials passed');
}
async function checkInput(input: CurrentCompletionInput) {
  await assertActualSite(input.root, input.actualSite);
  await assertSeals([
    input.candidate,
    input.guest,
    input.preflight.inventory,
    input.preflight.ciRun,
  ]);
  const candidate = await checkInstallCandidate(
    input.candidate.path,
    input.root,
  );
  assertCurrentIdentity(
    input,
    candidate,
    await currentCompletionSource(input.root),
  );
  const consumer = await consumerInput();
  await assertIndependentPackage(input, candidate);
  if (
    consumer.consumerRoot !== (await realpath(input.consumer)) ||
    consumer.candidate.sourceIdentity !== input.sourceIdentity ||
    consumer.candidate.tarball.sha256 !== input.packSha256
  )
    throw Error('independent installed consumer differs from prepared input');
  await assertPreflight(input);
  return { candidate, consumer };
}
async function assertIndependentPackage(
  input: Pick<CurrentCompletionInput, 'root' | 'consumer'>,
  candidate: { files: { path: string; sha256: string }[] },
) {
  const repository = await realpath(input.root);
  const consumer = await realpath(input.consumer);
  const packageRoot = await realpath(
    resolve(consumer, 'node_modules/@aletheia-works/formicarium'),
  );
  if (
    consumer === repository ||
    consumer.startsWith(repository + '/') ||
    packageRoot === repository ||
    packageRoot.startsWith(repository + '/')
  )
    throw Error(
      'independent installed consumer cannot resolve into repository',
    );
  for (const row of candidate.files) {
    const path = await realpath(resolve(packageRoot, row.path));
    if (
      !path.startsWith(packageRoot + '/') ||
      sha256(await readFile(path)) !== row.sha256
    )
      throw Error('independent installed package changed');
  }
}
export async function prepareCurrentInput(options: {
  root: string;
  candidate: string;
  consumer: string;
  guest: string;
  trials: string;
  browserLog: string;
  inventory: string;
  baseline: string;
  ciRun: string;
}): Promise<CurrentCompletionInput> {
  for (const [name, value] of Object.entries(options))
    if (typeof value !== 'string' || !value.trim())
      throw Error(`prepared input required: ${name}`);
  const actualSite = await prepareActualSite(
    options.root,
    process.env.U2_ACTUAL_SITE,
  );
  const root = await realpath(options.root);
  const candidate = await checkInstallCandidate(
    resolve(options.candidate),
    root,
  );
  await assertIndependentPackage(
    { root, consumer: options.consumer },
    candidate,
  );
  const currentSource = await currentCompletionSource(root);
  return {
    schemaVersion: 1,
    kind: 'current-completed-units-input',
    root,
    candidate: await seal(options.candidate),
    sourceIdentity: candidate.sourceIdentity,
    packSha256: candidate.tarball.sha256,
    currentSource,
    currentSourceIdentity: sha256(JSON.stringify(currentSource)),
    consumer: await realpath(options.consumer),
    guest: await seal(options.guest),
    actualSite,
    preflight: await preparePreflight(root, options),
  };
}
async function preparePreflight(
  root: string,
  options: {
    trials: string;
    browserLog: string;
    inventory: string;
    baseline: string;
    ciRun: string;
  },
): Promise<CurrentCompletionInput['preflight']> {
  const attempt = await realpath(options.trials);
  const preflight = {
    trialsDirectory: resolve(attempt, 'trials'),
    browserLog: await seal(options.browserLog),
    inventory: await seal(options.inventory),
    baselineDirectory: await realpath(options.baseline),
    ciRun: await seal(options.ciRun),
  };
  for (const path of [preflight.trialsDirectory, preflight.baselineDirectory])
    if (!path.startsWith(`${root}/`))
      throw Error('preflight evidence must be project-local');
  return { ...preflight, files: await preflightFiles(root, preflight) };
}
export async function writeCurrentPreparedInput(
  out: string,
  input: CurrentCompletionInput,
): Promise<Seal> {
  if (
    !relative(input.root, resolve(out)).startsWith(
      '.artifacts/migration-preflight/',
    )
  )
    throw Error('prepared input must be project-local preflight artifact');
  await writeFile(out, JSON.stringify(input, null, 2) + '\n', { flag: 'wx' });
  return seal(out);
}

/** Real executor only: fixture callers cannot promote synthetic exits to acceptance. */
export async function runCurrentCompletion(
  inputPath: string,
  expectedSha256: string,
): Promise<string> {
  const bytes = await readFile(inputPath);
  if (
    !/^[a-f0-9]{64}$/.test(expectedSha256) ||
    sha256(bytes) !== expectedSha256
  )
    throw Error('prepared input SHA differs');
  const input = parseUniqueJSON(
    bytes.toString('utf8'),
  ) as CurrentCompletionInput;
  if ((await realpath(process.cwd())) !== input.root)
    throw Error('prepared workspace differs');
  if (!input.actualSite?.path) throw Error('prepared U2_ACTUAL_SITE missing');
  const environment = {
    FORMICARIUM_CANDIDATE: input.candidate.path,
    FORMICARIUM_CONSUMER: input.consumer,
    FORMICARIUM_SESSION_GUEST: input.guest.path,
    U2_ACTUAL_SITE: input.actualSite.path,
  };
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  let release: (() => Promise<void>) | undefined;
  let output: string | undefined;
  const observed: object[] = [];
  const startedAt = new Date().toISOString();
  try {
    const initial = await checkInput(input);
    release = await acquireCurrentLock(input.root);
    output = resolve(
      input.root,
      `.artifacts/migration-preflight/current-completion-${randomUUID()}`,
    );
    await mkdir(output);
    const coveragePath = resolve(output, 'coverage');
    const commands = currentCompletionCommands(input.root, coveragePath, input);
    await executeCurrentSequence(commands, async (command, index) => {
      await checkInput(input);
      if (sha256(await readFile(inputPath)) !== expectedSha256)
        throw Error('prepared input changed during execution');
      const execution = await executeInstallCommand(
        command,
        resolve(output!, `command-${index + 1}.log`),
      );
      observed.push({
        ...command,
        ...execution,
        recordKind: 'observed-command-summary',
      });
      const isTest =
        command.args.includes('--test') ||
        command.args.includes('test') ||
        command.args.some((arg) =>
          /^(?:test-light|test-consumer|migration-.+-(?:unit|browser))$/.test(
            arg,
          ),
        );
      if (isTest)
        assertPassingTestOutput(await readFile(execution.rawLogPath, 'utf8'));
      await checkInput(input);
      return execution;
    });
    await reportInstallCoverage(
      coveragePath,
      resolve(coveragePath, 'browser-results'),
      input.candidate.path,
    );
    const coverage = await readJSON<
      Parameters<typeof checkAcceptance>[0]['coverage']
    >(resolve(coveragePath, 'coverage-report.json'));
    assertCurrentCoverage(coverage, input);
    await verifyCurrentRawCoverage(coveragePath, initial.candidate);
    const assembled = await assemblePreflightEvidence(preflightRun(input), {
      evidenceId: `u1-current-${output.slice(output.lastIndexOf('-') + 1)}`,
      recordedAt: new Date().toISOString(),
    });
    assertCurrentToolchainEvidence(assembled.evidence);
    checkAcceptance({ ...assembled, coverage, candidate: initial.candidate });
    const evidencePath = resolve(output, 'acceptance-evidence.json');
    await writeFile(
      evidencePath,
      `${JSON.stringify(assembled.evidence, null, 2)}\n`,
      { flag: 'wx' },
    );
    await checkInput(input);
    if (sha256(await readFile(inputPath)) !== expectedSha256)
      throw Error('prepared input changed');
    const evidenceFiles = await Promise.all(
      (await tree(input.root, relative(input.root, output)))
        .sort()
        .map((path) => seal(resolve(input.root, path))),
    );
    const path = resolve(output, 'current-local-verification-report.json');
    await writeFile(
      path,
      JSON.stringify(
        {
          schemaVersion: 1,
          status: 'current-local-verification',
          completedUnits: ['U1', 'U2'],
          currentSourceVerified: true,
          startedAt,
          finishedAt: new Date().toISOString(),
          exitCode: 0,
          signal: null,
          executionBoundary: 'real-sequential-child-exits',
          output,
          coveragePath,
          evidenceFiles,
          acceptancePassed: false,
          mergeAllowed: false,
          laterUnitAcceptance: false,
          sourceIdentity: input.sourceIdentity,
          currentSourceIdentity: input.currentSourceIdentity,
          currentSource: input.currentSource,
          candidateSha256: input.packSha256,
          preparedInput: { path: resolve(inputPath), sha256: expectedSha256 },
          preflightEvidenceVerified: true,
          preflightEvidenceNode: process.version,
          preflightEvidence: {
            evidence: await seal(evidencePath),
            trialsDirectory: input.preflight.trialsDirectory,
            browserLog: input.preflight.browserLog,
            ciRunUrl: assembled.evidence.baseline.ciRunUrl,
            executionScope:
              'current-toolchain C01/36 trials/baseline first/reuse',
          },
          coverageReport: await seal(
            resolve(coveragePath, 'coverage-report.json'),
          ),
          commands: observed,
          pending: [...CURRENT_PENDING],
          realSafari: '未検証',
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    return path;
  } catch (error) {
    if (output)
      await writeFile(
        resolve(output, 'incomplete.json'),
        JSON.stringify(
          {
            status: 'incomplete',
            observedCommands: observed,
            failure: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
    throw error;
  } finally {
    try {
      if (release) await release();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }
}
/** Short checkpoint verifier for a directly observed real execution; never reruns its long tests. */
export async function verifyCurrentCompletion(
  inputPath: string,
  inputSha256: string,
  reportPath: string,
  reportSha256: string,
) {
  await assertSeals([
    { path: inputPath, sha256: inputSha256 },
    { path: reportPath, sha256: reportSha256 },
  ]);
  const input = await readJSON<CurrentCompletionInput>(inputPath);
  const report = await readJSON<CurrentReport>(reportPath);
  if (
    report.schemaVersion !== 1 ||
    report.status !== 'current-local-verification' ||
    report.executionBoundary !== 'real-sequential-child-exits' ||
    report.exitCode !== 0 ||
    report.signal !== null ||
    !Number.isFinite(Date.parse(report.startedAt)) ||
    !Number.isFinite(Date.parse(report.finishedAt)) ||
    Date.parse(report.finishedAt) < Date.parse(report.startedAt) ||
    report.currentSourceVerified !== true ||
    report.acceptancePassed !== false ||
    report.mergeAllowed !== false ||
    report.laterUnitAcceptance !== false ||
    JSON.stringify(report.completedUnits) !== JSON.stringify(['U1', 'U2']) ||
    report.sourceIdentity !== input.sourceIdentity ||
    report.currentSourceIdentity !== input.currentSourceIdentity ||
    report.candidateSha256 !== input.packSha256 ||
    report.preparedInput.path !== resolve(inputPath) ||
    report.preparedInput.sha256 !== inputSha256
  )
    throw Error(
      'real current execution binding differs; historical/synthetic success is insufficient',
    );
  if (
    (await realpath(process.cwd())) !== input.root ||
    resolve(reportPath) !==
      resolve(report.output, 'current-local-verification-report.json') ||
    !relative(input.root, report.output).startsWith(
      '.artifacts/migration-preflight/current-completion-',
    ) ||
    report.coveragePath !== resolve(report.output, 'coverage')
  )
    throw Error('current execution output boundary differs');
  const previous = {
    FORMICARIUM_CANDIDATE: process.env.FORMICARIUM_CANDIDATE,
    FORMICARIUM_CONSUMER: process.env.FORMICARIUM_CONSUMER,
    FORMICARIUM_SESSION_GUEST: process.env.FORMICARIUM_SESSION_GUEST,
    U2_ACTUAL_SITE: process.env.U2_ACTUAL_SITE,
  };
  if (!input.actualSite?.path) throw Error('prepared U2_ACTUAL_SITE missing');
  Object.assign(process.env, {
    FORMICARIUM_CANDIDATE: input.candidate.path,
    FORMICARIUM_CONSUMER: input.consumer,
    FORMICARIUM_SESSION_GUEST: input.guest.path,
    U2_ACTUAL_SITE: input.actualSite.path,
  });
  try {
    const { candidate } = await checkInput(input);
    await assertSeals(report.evidenceFiles);
    const actualFiles = (
      await tree(input.root, relative(input.root, report.output))
    )
      .map((path) => resolve(input.root, path))
      .filter((path) => path !== resolve(reportPath))
      .sort();
    if (
      JSON.stringify(actualFiles) !==
      JSON.stringify(report.evidenceFiles.map((row: Seal) => row.path).sort())
    )
      throw Error('missing/extra current raw evidence seal');
    const commands = currentCompletionCommands(
      input.root,
      report.coveragePath,
      input,
    );
    if (report.commands.length !== commands.length)
      throw Error('required command inventory incomplete');
    for (const [index, command] of commands.entries()) {
      const row = report.commands[index];
      if (
        row?.recordKind !== 'observed-command-summary' ||
        row.exitCode !== 0 ||
        row.executable !== command.executable ||
        row.cwd !== command.cwd ||
        JSON.stringify(row.args) !== JSON.stringify(command.args) ||
        row.rawLogPath !== resolve(report.output, `command-${index + 1}.log`) ||
        !Number.isFinite(Date.parse(row.startedAt)) ||
        !Number.isFinite(Date.parse(row.finishedAt)) ||
        Date.parse(row.startedAt) < Date.parse(report.startedAt) ||
        Date.parse(row.finishedAt) < Date.parse(row.startedAt) ||
        Date.parse(row.finishedAt) > Date.parse(report.finishedAt) ||
        (index > 0 &&
          Date.parse(row.startedAt) <
            Date.parse(report.commands[index - 1]!.finishedAt))
      )
        throw Error('required command/real exit/time differs');
      await assertSeals([{ path: row.rawLogPath, sha256: row.rawLogSha256 }]);
      if (
        command.args.includes('--test') ||
        command.args.includes('test') ||
        command.args.some((arg) =>
          /^(?:test-light|test-consumer|migration-.+-(?:unit|browser))$/.test(
            arg,
          ),
        )
      )
        assertPassingTestOutput(await readFile(row.rawLogPath, 'utf8'));
    }
    await verifyCurrentRawCoverage(report.coveragePath, candidate);
    const coverage = await readJSON<
      Parameters<typeof checkAcceptance>[0]['coverage']
    >(resolve(report.coveragePath, 'coverage-report.json'));
    assertCurrentCoverage(coverage, input);
    const recorded = await readJSON<
      Parameters<typeof checkAcceptance>[0]['evidence']
    >(resolve(report.output, 'acceptance-evidence.json'));
    const assembled = await assemblePreflightEvidence(preflightRun(input), {
      evidenceId: recorded.evidenceId,
      recordedAt: recorded.recordedAt,
    });
    if (JSON.stringify(assembled.evidence) !== JSON.stringify(recorded))
      throw Error('recorded preflight evidence differs from its sealed inputs');
    assertCurrentToolchainEvidence(assembled.evidence);
    checkAcceptance({ ...assembled, coverage, candidate });
    await checkInput(input);
    await assertSeals([
      { path: inputPath, sha256: inputSha256 },
      { path: reportPath, sha256: reportSha256 },
    ]);
    return {
      verified: true,
      verificationScope: 'current-local-completed-U1-U2',
      currentSourceVerified: true,
      acceptancePassed: false,
      mergeAllowed: false,
      laterUnitAcceptance: false,
      pending: report.pending,
    };
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'run' && args.length === 2)
    console.log(await runCurrentCompletion(args[0]!, args[1]!));
  else if (mode === 'verify' && args.length === 4)
    console.log(
      JSON.stringify(
        await verifyCurrentCompletion(args[0]!, args[1]!, args[2]!, args[3]!),
      ),
    );
  else if (mode === 'prepare' && args.length === 9) {
    const [
      out,
      candidate,
      consumer,
      guest,
      trials,
      browserLog,
      inventory,
      baseline,
      ciRun,
    ] = args as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (
      !relative(process.cwd(), resolve(out)).startsWith(
        '.artifacts/migration-preflight/',
      )
    )
      throw Error('prepared input must be project-local preflight artifact');
    const input = await prepareCurrentInput({
      root: process.cwd(),
      candidate,
      consumer,
      guest,
      trials,
      browserLog,
      inventory,
      baseline,
      ciRun,
    });
    console.log(JSON.stringify(await writeCurrentPreparedInput(out, input)));
  } else
    throw Error(
      'usage: current-completion.js run <prepared-input> <SHA256> | verify <input> <input-SHA256> <report> <report-SHA256> | prepare <new-input> <candidate> <consumer> <guest> <trial-attempt-dir> <trial-log> <mirror-input> <baseline-artifact-dir> <ci-run-json>',
    );
}
