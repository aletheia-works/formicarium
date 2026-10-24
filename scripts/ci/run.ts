import { spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CORE_PACKAGE } from '../../runtime/core.js';
import {
  prepareCoverage as preparePackageCoverage,
  reportCoverage as reportPackageCoverage,
} from '../package/coverage.js';
import { FIRST_PARTY_JS } from '../release/inventory.js';
import { validatePayloadInventory } from './bundle.js';
import {
  CANDIDATE_PARTS,
  type CandidatePart,
  type CheckResult,
  createFreshResultsDirectory,
  hash,
  type InputManifest,
  parseTestSummary,
  partChecks,
  REQUIRED_CHECKS,
  safePath,
  validateChecks,
  validateCoverage,
  validateManifest,
  verifyPins,
} from './verification.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, '.artifacts/ci-results');
const node = process.execPath;
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
const results: CheckResult[] = [];
/** Real guest runs in command-public start one more Node Worker. */
const COMMAND_COVERAGE_NODE_WORKERS: number = JSON.parse(
  await readFile(
    new URL('../package/coverage-inventory.json', import.meta.url),
    'utf8',
  ),
).node.commandWorkers;
async function command(
  id: string,
  args: string[],
  options: { cwd?: string; timeout?: number; native?: boolean } = {},
) {
  const started = new Date().toISOString();
  let stdout = '',
    stderr = '',
    timedOut = false;
  const executable = args[0]!;
  const exitCode = await new Promise<number | null>((accept, reject) => {
    const child = spawn(executable, args.slice(1), {
      cwd: options.cwd ?? root,
      env: process.env,
      detached: process.platform !== 'win32',
    });
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== 'win32') process.kill(-child.pid!, 'SIGKILL');
      else child.kill('SIGKILL');
    }, options.timeout ?? 7_200_000);
    child.stdout.on('data', (bytes) => {
      stdout += bytes;
      process.stdout.write(bytes);
    });
    child.stderr.on('data', (bytes) => {
      stderr += bytes;
      process.stderr.write(bytes);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      accept(code);
    });
  });
  const { passed, skipped } =
    options.native || !REQUIRED_CHECKS.includes(id)
      ? { passed: exitCode === 0 ? 1 : 0, skipped: 0 }
      : parseTestSummary(stdout, stderr);
  const result = { id, exitCode, timedOut, skipped, passed, command: args };
  await writeFile(resolve(output, `${id}.stdout.txt`), stdout);
  await writeFile(resolve(output, `${id}.stderr.txt`), stderr);
  await writeFile(
    resolve(output, `${id}.json`),
    JSON.stringify(
      {
        ...result,
        started,
        finished: new Date().toISOString(),
        stdoutSha256: hash(stdout),
        stderrSha256: hash(stderr),
      },
      null,
      2,
    ),
  );
  if (exitCode !== 0 || timedOut || skipped !== 0)
    throw Error(`CI command failed: ${id}`);
  return result;
}
const coverageOut = resolve(root, '.artifacts/package-coverage');
const partsRoot = resolve(root, '.artifacts/candidate-parts');

/** Materialize and check the pinned inputs, install the candidate and copy it for coverage. */
async function prepareWorkspace(validateInput: typeof validateManifest) {
  await createFreshResultsDirectory(output); // Fresh output only; never reuse an earlier successful generation.
  results.length = 0;
  const inputRoot = resolve(root, '.ci-inputs');
  const manifestBytes = await readFile(resolve(inputRoot, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString()) as InputManifest;
  const context = {
    repository: process.env.GITHUB_REPOSITORY ?? '',
    commit: process.env.GITHUB_SHA ?? '',
    event: process.env.GITHUB_EVENT_NAME ?? '',
    ref: process.env.GITHUB_REF ?? '',
  };
  validateInput(manifest, context);
  await verifyPins(root, manifest.sourceFiles);
  await validatePayloadInventory(
    resolve(inputRoot, 'payload'),
    manifest.files.map((row) => row.path),
  );
  await verifyPins(resolve(inputRoot, 'payload'), manifest.files);
  for (const row of manifest.files) {
    if (
      !/^(dist\/guests\/|fixtures\/|\.artifacts\/(ci-candidate|u1-fixture)\/)/.test(
        row.path,
      )
    )
      throw Error(`unsupported materialization path: ${row.path}`);
    const destination = resolve(root, row.path);
    await mkdir(dirname(destination), { recursive: true });
    let previous: Uint8Array | undefined;
    try {
      previous = await readFile(destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (previous) {
      if (hash(previous) !== row.sha256)
        throw Error(`existing destination differs: ${row.path}`);
    } else
      await cp(resolve(inputRoot, 'payload', row.path), destination, {
        recursive: false,
        force: false,
        errorOnExist: true,
      });
  }
  // All fixture/consumer inputs are copied bytes, never an npm rebuild or re-pack.
  const consumer = await mkdtemp(resolve(tmpdir(), 'formicarium-ci-consumer-'));
  await writeFile(
    resolve(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await command(
    'install-consumer',
    [
      'npm',
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      resolve(root, manifest.tarball),
    ],
    { cwd: consumer },
  );
  const installedPackage = resolve(
    consumer,
    'node_modules/@aletheia-works/formicarium',
  );
  process.env.FORMICARIUM_CONSUMER = consumer;
  process.env.FORMICARIUM_CANDIDATE = resolve(
    root,
    safePath(manifest.packageManifest),
  );
  process.env.CI = 'true';
  process.env.FORMICARIUM_CONTAINER = 'docker';
  const candidate = JSON.parse(
    await readFile(process.env.FORMICARIUM_CANDIDATE, 'utf8'),
  );
  const tarballSha256 = hash(await readFile(resolve(root, manifest.tarball)));
  if (
    candidate.tarball.sha256 !== tarballSha256 ||
    candidate.core?.package !== CORE_PACKAGE
  )
    throw Error('package/core manifest differs');
  for (const row of candidate.files)
    if (
      hash(await readFile(resolve(installedPackage, safePath(row.path)))) !==
      row.sha256
    )
      throw Error(`installed package differs: ${row.path}`);
  for (const name of ['aube', 'pitchfork'] as const) {
    const info = JSON.parse(
      await readFile(
        resolve(root, `.artifacts/ci-candidate/provenance/${name}.json`),
        'utf8',
      ),
    );
    if (
      info.ref !== manifest.guests[name] ||
      info.evidence.guestSha256 !==
        hash(await readFile(resolve(root, `dist/guests/${name}`)))
    )
      throw Error(`guest build provenance differs: ${name}`);
  }
  candidate.tarball.path = resolve(root, manifest.tarball);
  candidate.stagedDirectory = installedPackage;
  await writeFile(
    process.env.FORMICARIUM_CANDIDATE,
    JSON.stringify(candidate, null, 2),
  );
  const bun = process.env.FORMICARIUM_CI_BUN;
  if (!bun) throw Error('absolute Bun executable required');
  process.env.FORMICARIUM_INPUTS_ROOT = resolve(
    root,
    '.artifacts/ci-candidate/inputs',
  );
  await preparePackageCoverage({ source: installedPackage, out: coverageOut });
  return {
    manifest,
    context,
    inputRoot,
    bun,
    tarballSha256,
    manifestSha256: hash(manifestBytes),
  };
}

type Workspace = Awaited<ReturnType<typeof prepareWorkspace>>;

async function nodeChecks() {
  results.push(
    await command('release', [
      node,
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      ...['evidence', 'decision'].map(
        (name) => `tests/release/${name}.test.js`,
      ),
    ]),
  );
  results.push(
    await command('node-regression', [
      node,
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      ...[
        'build',
        'runner',
        'probe',
        'session',
        'aube-1645',
        'pitchfork-basic',
      ].map((name) => `tests/node/${name}.test.js`),
    ]),
  );
  // A fresh remote checkout may write native baselines, then must match the supplied originals.
  for (const session of ['aube-1645', 'pitchfork-basic']) {
    const baseline = resolve(root, `fixtures/baseline/${session}.native.txt`);
    const before = hash(await readFile(baseline));
    results.push(
      await command(
        session === 'aube-1645' ? 'native-aube' : 'native-pitchfork',
        [
          'bash',
          'mise-tasks/build/native-baseline.sh',
          session,
          '--check-reproducible',
        ],
        { native: true },
      ),
    );
    if (hash(await readFile(baseline)) !== before)
      throw Error(`native baseline differs: ${session}`);
  }
  results.push(
    await command('package-coverage-node', [
      node,
      '--import',
      resolve(coverageOut, 'coverage-node-preload.mjs'),
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
        'session-fixture',
        'guest-validation',
        'session-reservation',
        'install-catalog',
        'install-hash-regression',
        'install-lifecycle',
        'install-public',
        'install-transfer',
        'command-dispatch',
        'command-parse',
        'command-public',
      ].map((name) => resolve(coverageOut, `tests/package/${name}.test.js`)),
    ]),
  );
}

async function browserChecks(project: string, bun: string) {
  results.push(
    await command(`browser-regression-${project}`, [
      bun,
      playwright,
      'test',
      'tests/browser/probe.spec.ts',
      'tests/browser/aube-1645.spec.ts',
      'tests/browser/pitchfork-basic.spec.ts',
      `--project=${project}`,
      '--workers=1',
      '--retries=0',
      '--output',
      resolve(output, 'regression-browser'),
    ]),
  );
  results.push(
    await command(
      `package-coverage-browser-${project}`,
      [
        // Playwright cannot load these compiled coverage specs under Bun 1.4.3.
        // Node is required here; ordinary browser suites continue to use Bun.
        node,
        playwright,
        'test',
        '--config',
        'playwright.config.ts',
        `--project=${project}`,
        '--workers=1',
        '--retries=0',
        '--output',
        resolve(coverageOut, 'browser-results'),
      ],
      { cwd: resolve(coverageOut, 'tests/package') },
    ),
  );
}

/** Run one part's checks and record them for the merge (part.json). */
export async function runPart(
  part: CandidatePart,
  validateInput: typeof validateManifest = validateManifest,
) {
  if (!CANDIDATE_PARTS.includes(part))
    throw Error(`unknown candidate part: ${part}`);
  const workspace = await prepareWorkspace(validateInput);
  if (part === 'node') await nodeChecks();
  else await browserChecks(part, workspace.bun);
  await verifyPins(
    resolve(workspace.inputRoot, 'payload'),
    workspace.manifest.files,
  );
  await verifyPins(root, workspace.manifest.sourceFiles);
  await writeFile(
    resolve(output, 'part.json'),
    JSON.stringify(
      {
        part,
        context: workspace.context,
        manifestSha256: workspace.manifestSha256,
        tarballSha256: workspace.tarballSha256,
        checks: results,
      },
      null,
      2,
    ),
  );
}

async function readPart(
  partsDir: string,
  part: CandidatePart,
  workspace: Workspace,
) {
  const record = JSON.parse(
    await readFile(resolve(partsDir, part, 'ci-results/part.json'), 'utf8'),
  ) as {
    part: string;
    context: Workspace['context'];
    manifestSha256: string;
    tarballSha256: string;
    checks: CheckResult[];
  };
  if (
    record.part !== part ||
    JSON.stringify(record.context) !== JSON.stringify(workspace.context) ||
    record.manifestSha256 !== workspace.manifestSha256 ||
    record.tarballSha256 !== workspace.tarballSha256 ||
    JSON.stringify(record.checks.map((check) => check.id)) !==
      JSON.stringify(partChecks(part))
  )
    throw Error(`candidate part measured other inputs: ${part}`);
  return record.checks;
}

/**
 * Combine the parts' checks and coverage into one acceptance record. The
 * merge prepares the same coverage copy itself, so a part counts only if it
 * measured byte-identical instrumentation of the same candidate.
 */
export async function mergeParts(
  partsDir: string = partsRoot,
  validateInput: typeof validateManifest = validateManifest,
) {
  const workspace = await prepareWorkspace(validateInput);
  const checks: CheckResult[] = [];
  for (const part of CANDIDATE_PARTS)
    checks.push(...(await readPart(partsDir, part, workspace)));
  const nodeCoverage = resolve(partsDir, 'node/package-coverage');
  if (
    (await readFile(
      resolve(nodeCoverage, 'coverage-metadata.json'),
      'utf8',
    )) !==
    (await readFile(resolve(coverageOut, 'coverage-metadata.json'), 'utf8'))
  )
    throw Error('node part measured other instrumentation');
  await cp(
    resolve(nodeCoverage, 'coverage-node.json'),
    resolve(coverageOut, 'coverage-node.json'),
    { errorOnExist: true, force: false },
  );
  const browserParts = CANDIDATE_PARTS.filter((part) => part !== 'node').map(
    (project) => ({
      project,
      out: resolve(partsDir, project, 'package-coverage'),
      browserResults: resolve(
        partsDir,
        project,
        'package-coverage/browser-results',
      ),
    }),
  );
  const coverage = await reportPackageCoverage({
    out: coverageOut,
    browserResults: resolve(coverageOut, 'browser-results'),
    browserParts,
    candidatePath: process.env.FORMICARIUM_CANDIDATE!,
    extraNodeWorkers: COMMAND_COVERAGE_NODE_WORKERS,
  });
  validateCoverage(coverage, {
    files: FIRST_PARTY_JS,
    tarballSha256: workspace.tarballSha256,
  });
  validateChecks(checks);
  await verifyPins(
    resolve(workspace.inputRoot, 'payload'),
    workspace.manifest.files,
  );
  await verifyPins(root, workspace.manifest.sourceFiles);
  await writeFile(
    resolve(output, 'acceptance.json'),
    JSON.stringify(
      {
        passed: true,
        context: workspace.context,
        manifestSha256: workspace.manifestSha256,
        checks,
        coverage,
        limits:
          'Local/fresh CI verification only; no RC adoption or publication approval.',
      },
      null,
      2,
    ),
  );
}

/** Every part in turn, then the merge: what the parallel CI jobs do, on one machine. */
export async function runVerification(
  validateInput: typeof validateManifest = validateManifest,
) {
  await mkdir(partsRoot);
  for (const part of CANDIDATE_PARTS) {
    await runPart(part, validateInput);
    await mkdir(resolve(partsRoot, part));
    await rename(output, resolve(partsRoot, part, 'ci-results'));
    await rename(coverageOut, resolve(partsRoot, part, 'package-coverage'));
  }
  await mergeParts(partsRoot, validateInput);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await runVerification();
