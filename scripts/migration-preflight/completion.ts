import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseUniqueJSON,
  type VerificationInput,
  verifyFile,
} from './verify.js';

export interface CompletionCommand {
  executable: string;
  args: string[];
  cwd: string;
}
export type CompletionExecutor = (command: CompletionCommand) => Promise<void>;
export async function executeSequential(
  commands: readonly CompletionCommand[],
  execute: CompletionExecutor,
): Promise<void> {
  for (const command of commands) await execute(command);
}
const execute: CompletionExecutor = async (command) => {
  await new Promise<void>((done, reject) => {
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
              `completion child failed: ${command.executable} ${command.args.join(' ')} (${signal ?? code})`,
            ),
          ),
    );
  });
};
export async function runCompletion(
  options: {
    root?: string;
    environment?: NodeJS.ProcessEnv;
    execute?: CompletionExecutor;
    verify?: typeof verifyFile;
  } = {},
): Promise<string> {
  const root = resolve(options.root ?? process.cwd());
  const environment = options.environment ?? process.env;
  const required = (name: string) => {
    const value = environment[name];
    if (!value) throw Error(`completion required input: ${name}`);
    return resolve(root, value);
  };
  const verification = required('FORMICARIUM_PREFLIGHT_VERIFICATION');
  const candidate = required('FORMICARIUM_CANDIDATE');
  const consumer = required('FORMICARIUM_CONSUMER');
  const installed = resolve(
    consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  const manifest = parseUniqueJSON(
    await readFile(verification, 'utf8'),
  ) as VerificationInput;
  const pinned = parseUniqueJSON(await readFile(candidate, 'utf8')) as {
    tarball: { sha256: string };
  };
  const expected = parseUniqueJSON(
    await readFile(resolve(root, manifest.candidateManifest), 'utf8'),
  ) as typeof pinned;
  if (
    !pinned.tarball?.sha256 ||
    pinned.tarball.sha256 !== expected.tarball?.sha256
  )
    throw Error('completion candidate identity mismatch');
  for (const file of [
    'runtime/node/api.js',
    'runtime/web/api.js',
    'assets/blink.mjs',
    'assets/blink.wasm',
  ])
    await stat(resolve(installed, file));
  for (const field of [
    'evidence',
    'inventory',
    'baselineInputs',
    'firstReceipt',
    'reuseReceipt',
  ] as const)
    await stat(resolve(root, manifest[field]));
  await stat(resolve(root, manifest.baselineDirectory, 'biome'));
  const scratch = resolve(root, '.artifacts/migration-preflight');
  await mkdir(scratch, { recursive: true });
  const lock = resolve(scratch, 'completion.lock');
  const handle = await open(lock, 'wx');
  const coverage = resolve(scratch, `completion-coverage-${randomUUID()}`);
  try {
    const node = process.execPath;
    const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
    const command = (args: string[], cwd = root): CompletionCommand => ({
      executable: node,
      args,
      cwd,
    });
    const task = (name: string): CompletionCommand => ({
      executable: 'mise',
      args: ['run', name],
      cwd: root,
    });
    const commands = [
      task('build'),
      task('typecheck'),
      task('migration-preflight-unit'),
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
      command(['scripts/package/coverage.js', 'prepare', installed, coverage]),
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
          resolve(coverage, 'browser-results'),
        ],
        resolve(coverage, 'tests/package'),
      ),
      command([
        resolve(root, 'scripts/package/coverage.js'),
        'report',
        coverage,
        resolve(coverage, 'browser-results'),
        candidate,
      ]),
    ];
    await executeSequential(commands.slice(0, 7), options.execute ?? execute);
    // Use only the collector's transformed config; adjacent emitted .js is not
    // the instrumented-copy configuration and can change test discovery.
    await writeFile(
      resolve(coverage, 'tests/package/playwright.coverage.config.mjs'),
      await readFile(resolve(coverage, 'tests/package/playwright.config.ts')),
      { flag: 'wx' },
    );
    await executeSequential(commands.slice(7), options.execute ?? execute);
    const clone = {
      ...manifest,
      coverageReport: resolve(coverage, 'coverage-report.json'),
      candidateManifest: candidate,
    };
    // Resolve original references before moving the clone into a new directory.
    for (const field of [
      'evidence',
      'inventory',
      'baselineInputs',
      'firstReceipt',
      'reuseReceipt',
      'baselineDirectory',
    ] as const)
      clone[field] = resolve(root, manifest[field]);
    clone.suites = manifest.suites.map((row) => ({
      ...row,
      record: resolve(root, row.record),
    }));
    const output = resolve(coverage, 'verification-input.json');
    await writeFile(output, JSON.stringify(clone, null, 2) + '\n', {
      flag: 'wx',
    });
    await (options.verify ?? verifyFile)(output);
    return output;
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  console.log(await runCompletion());
