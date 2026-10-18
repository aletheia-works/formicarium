import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
  sha256,
} from '../package/stage-package.js';
import { sessionSourceInventory } from './stage.js';

export interface Command {
  executable: string;
  args: string[];
  cwd: string;
}
export type Executor = (command: Command) => Promise<void>;
export async function sequential(
  commands: readonly Command[],
  execute: Executor,
) {
  for (const command of commands) await execute(command);
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
        : reject(
            Error(
              `U2 child failed: ${command.args.join(' ')} (${signal ?? code})`,
            ),
          ),
    );
  });

/** Reject stale source, incomplete inventory and a pack that changed after staging. */
export async function checkSessionCandidate(
  candidatePath: string,
  root: string,
) {
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  const sourceFiles = await sessionSourceInventory(root);
  if (
    candidate.unit !== 'u2-session-guest-api' ||
    candidate.provisional !== true ||
    candidate.version !== '0.3.0' ||
    !/^[0-9a-f]{40}$/.test(candidate.sourceCommit)
  )
    throw Error('U2 provisional source identity missing');
  if (
    JSON.stringify(candidate.sourceFiles) !== JSON.stringify(sourceFiles) ||
    candidate.sourceIdentity !== sha256(JSON.stringify(sourceFiles))
  )
    throw Error('U2 current source differs from staged candidate');
  if (
    JSON.stringify([...candidate.distributionInventory].sort()) !==
      JSON.stringify([...FIRST_PARTY_JS].sort()) ||
    JSON.stringify(
      candidate.files.map((row: { path: string }) => row.path).sort(),
    ) !== JSON.stringify([...PACKAGE_FILES].sort())
  )
    throw Error('U2 fixed distribution inventory differs');
  if (
    sha256(await readFile(candidate.tarball.path)) !== candidate.tarball.sha256
  )
    throw Error('U2 archive digest differs');
  return candidate;
}

export async function runSessionCompletion(
  options: { root?: string; execute?: Executor } = {},
) {
  const root = resolve(options.root ?? process.cwd());
  const candidatePath = process.env.FORMICARIUM_CANDIDATE;
  if (
    !candidatePath ||
    !process.env.FORMICARIUM_CONSUMER ||
    !process.env.FORMICARIUM_SESSION_GUEST
  )
    throw Error('U2 completion candidate/consumer/guest inputs required');
  const candidate = await checkSessionCandidate(candidatePath, root);
  const input = await consumerInput();
  const localOnly = process.env.FORMICARIUM_SESSION_LOCAL_ONLY === '1';
  const ciPath = process.env.FORMICARIUM_SESSION_CI_EVIDENCE;
  const ciSHA = process.env.FORMICARIUM_SESSION_CI_SHA256;
  let ci: unknown = null;
  if (ciPath && ciSHA) {
    const bytes = await readFile(ciPath);
    if (sha256(bytes) !== ciSHA)
      throw Error('U2 observed CI evidence digest differs');
    const row = JSON.parse(bytes.toString('utf8'));
    if (
      row.recordKind !== 'observed-ci-summary' ||
      row.conclusion !== 'success' ||
      row.sourceCommit !== candidate.sourceCommit ||
      row.sourceIdentity !== candidate.sourceIdentity ||
      row.candidateSha256 !== candidate.tarball.sha256 ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+$/.test(
        row.runURL,
      )
    )
      throw Error('U2 CI evidence must match current source/pack');
    ci = row;
  }
  if (!localOnly && !ci)
    throw Error(
      'U2 integration CI evidence required before final completion; use explicitly provisional local mode only for local verification',
    );
  const scratch = resolve(root, '.artifacts/migration-session');
  await mkdir(scratch, { recursive: true });
  const lock = resolve(scratch, 'completion.lock');
  const handle = await open(lock, 'wx');
  const output = resolve(scratch, `completion-${randomUUID()}`);
  await mkdir(output);
  const coverage = resolve(output, 'coverage');
  const node = process.execPath;
  const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
  const command = (args: string[], cwd = root): Command => ({
    executable: node,
    args,
    cwd,
  });
  const task = (name: string): Command => ({
    executable: 'mise',
    args: ['run', name],
    cwd: root,
  });
  const run = options.execute ?? execute;
  const commands: Command[] = [
    task('build'),
    task('typecheck'),
    task('test-light'),
    task('migration-session-unit'),
    task('migration-session-browser'),
    task('test-consumer'),
    command([
      '--test',
      '--test-concurrency=1',
      'tests/node/build.test.js',
      'tests/node/probe.test.js',
      'tests/node/aube-1645.test.js',
    ]),
    command([
      playwright,
      'test',
      'tests/browser/probe.spec.ts',
      'tests/browser/aube-1645.spec.ts',
      '--workers=1',
      '--retries=0',
    ]),
    command(['scripts/migration-session/coverage.js', 'prepare', coverage]),
    command([
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
    command([
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
    ]),
    command(
      [
        playwright,
        'test',
        'browser-api.spec',
        'browser-worker.spec',
        'browser-broker.spec',
        'consumer.spec',
        '--config',
        'playwright.coverage.config.mjs',
        '--workers=1',
        '--retries=0',
        '--output',
        resolve(coverage, 'browser-results/package'),
      ],
      resolve(coverage, 'tests/package'),
    ),
    command(
      [
        playwright,
        'test',
        '--config',
        'playwright.coverage.config.mjs',
        '--workers=1',
        '--retries=0',
        '--output',
        resolve(coverage, 'browser-results/session'),
      ],
      resolve(coverage, 'tests/migration-session'),
    ),
    command([
      'scripts/migration-session/coverage.js',
      'report',
      coverage,
      resolve(coverage, 'browser-results'),
      resolve(candidatePath),
    ]),
  ];
  const observed: Command[] = [];
  try {
    await sequential(commands, async (value) => {
      await run(value);
      observed.push(value);
    });
    await checkSessionCandidate(candidatePath, root);
    const report = JSON.parse(
      await readFile(resolve(coverage, 'coverage-report.json'), 'utf8'),
    );
    if (
      !report.passed ||
      report.threshold !== 80 ||
      report.candidateSha256 !== candidate.tarball.sha256 ||
      report.files.length !== 16
    )
      throw Error('U2 current candidate coverage incomplete');
    const receipt = {
      schemaVersion: 1,
      unit: 'u2-session-guest-api',
      provisional: true,
      status: localOnly ? 'local-provisional' : 'verified-with-ci',
      assembledAt: new Date().toISOString(),
      candidatePath: resolve(candidatePath),
      candidateSha256: candidate.tarball.sha256,
      sourceCommit: candidate.sourceCommit,
      sourceCommitKind: candidate.sourceCommitKind,
      sourceIdentity: candidate.sourceIdentity,
      distributionInventory: FIRST_PARTY_JS,
      installedPackage: input.packageRoot,
      localPassed: true,
      acceptancePassed: !localOnly && ci !== null,
      ci,
      blockers: ci ? [] : ['統合前CI未検証'],
      coverageReport: resolve(coverage, 'coverage-report.json'),
      commands: observed.map((row) => ({
        ...row,
        exitCode: 0,
        recordKind: 'observed-command-summary',
      })),
      realSafari: '未検証',
      laterUnits: 'U3 install/U4 command/B1未受入',
    };
    const receiptPath = resolve(
      output,
      localOnly ? 'local-provisional-report.json' : 'completion-report.json',
    );
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {
      flag: 'wx',
    });
    console.log(receiptPath);
    return receiptPath;
  } catch (error) {
    await writeFile(
      resolve(output, 'incomplete.json'),
      JSON.stringify(
        {
          unit: 'u2-session-guest-api',
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
    await handle.close();
    await rm(lock, { force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  await runSessionCompletion();
