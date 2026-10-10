import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  prepareCoverage as prepareU1,
  reportCoverage as reportU1,
} from '../package/coverage.js';
import {
  FILES,
  prepareCoverage as prepareU3,
  REQUIRED_U1_REALMS,
  reportCoverage as reportU3,
  sealCoverage,
} from '../terrarium/coverage.js';
import { validatePayloadInventory } from './bundle.js';
import { bootstrapCoreSource } from './core-source.js';
import {
  type CheckResult,
  createFreshResultsDirectory,
  hash,
  type InputManifest,
  parseTestSummary,
  provisionPreparedResolver,
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
export async function runVerification(
  validateInput: typeof validateManifest = validateManifest,
) {
  await createFreshResultsDirectory(output); // Fresh output only; never reuse an earlier successful generation.
  const inputRoot = resolve(root, '.ci-inputs');
  const manifest = JSON.parse(
    await readFile(resolve(inputRoot, 'manifest.json'), 'utf8'),
  ) as InputManifest;
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
      !/^(assets\/|dist\/(guests|blink)\/|fixtures\/|\.artifacts\/(ci-candidate|u1-fixture)\/)/.test(
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
  if (
    candidate.tarball.sha256 !==
      hash(await readFile(resolve(root, manifest.tarball))) ||
    candidate.blinkCommit !== manifest.coreCommit ||
    candidate.blinkSourceDirty !== false
  )
    throw Error('package/core manifest differs');
  for (const row of candidate.files)
    if (
      hash(await readFile(resolve(installedPackage, safePath(row.path)))) !==
      row.sha256
    )
      throw Error(`installed package differs: ${row.path}`);
  const coreInfo = JSON.parse(
    await readFile(resolve(root, 'assets/build-info.json'), 'utf8'),
  );
  if (
    coreInfo.blinkCommit !== manifest.coreCommit ||
    coreInfo.blinkSourceDirty !== false
  )
    throw Error('asset core provenance differs');
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
  process.env.TERRARIUM_BUN = bun;
  process.env.FORMICARIUM_INPUTS_ROOT = resolve(
    root,
    '.artifacts/ci-candidate/inputs',
  );
  results.push(
    await command('release', [
      node,
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      ...['evidence', 'decision', 'collect'].map(
        (name) => `tests/release/${name}.test.js`,
      ),
    ]),
  );
  await bootstrapCoreSource(root, manifest, command);
  await command('core-source-provenance', ['bash', 'scripts/fetch-blink.sh']);
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
  results.push(
    await command('browser-regression', [
      node,
      playwright,
      'test',
      'tests/browser/probe.spec.ts',
      'tests/browser/aube-1645.spec.ts',
      'tests/browser/pitchfork-basic.spec.ts',
      '--workers=1',
      '--retries=0',
      '--output',
      resolve(output, 'regression-browser'),
    ]),
  );
  // A fresh remote checkout may write native baselines, then must match the supplied originals.
  for (const session of ['aube-1645', 'pitchfork-basic']) {
    const baseline = resolve(root, `fixtures/baseline/${session}.native.txt`);
    const before = hash(await readFile(baseline));
    results.push(
      await command(
        session === 'aube-1645' ? 'native-aube' : 'native-pitchfork',
        ['bash', 'scripts/native-baseline.sh', session, '--check-reproducible'],
        { native: true },
      ),
    );
    if (hash(await readFile(baseline)) !== before)
      throw Error(`native baseline differs: ${session}`);
  }
  const u1 = resolve(root, '.artifacts/u1-coverage-v1000001');
  await prepareU1({ source: installedPackage, out: u1 });
  results.push(
    await command('u1-node', [
      node,
      '--import',
      resolve(u1, 'coverage-node-preload.mjs'),
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
      ].map((name) => resolve(u1, `tests/package/${name}.test.js`)),
    ]),
  );
  results.push(
    await command(
      'u1-browser',
      [
        node,
        playwright,
        'test',
        '--config',
        'playwright.config.ts',
        '--workers=1',
        '--retries=0',
        '--output',
        resolve(u1, 'browser-results'),
      ],
      { cwd: resolve(u1, 'tests/package') },
    ),
  );
  await reportU1({
    out: u1,
    browserResults: resolve(u1, 'browser-results'),
    candidatePath: process.env.FORMICARIUM_CANDIDATE,
  });
  const u3 = resolve(root, '.artifacts/ci-coverage-fixed24');
  const prepared = await prepareU3({
    out: u3,
    site: resolve(root, manifest.site),
    terrarium: resolve(root, manifest.terrarium),
    packageRoot: installedPackage,
    tarball: resolve(root, manifest.tarball),
    u1Report: resolve(u1, 'coverage-report.json'),
  });
  await provisionPreparedResolver(root, manifest.files, u3);
  await command('coverage-bundle', [
    bun,
    'build',
    resolve(prepared.workspace, 'src/index.ts'),
    '--outfile',
    resolve(prepared.instrumentedSite, 'web/terrarium.mjs'),
    '--format',
    'esm',
    '--target',
    'browser',
    '--define',
    '__TERRARIUM_VERSION__="u3-coverage"',
  ]);
  await sealCoverage(u3);
  results.push(
    await command('u3-node', [
      node,
      'scripts/terrarium/coverage.js',
      'node',
      u3,
      bun,
    ]),
  );
  process.env.TERRARIUM_SITE_DIR = prepared.instrumentedSite;
  results.push(
    await command(
      'u3-browser',
      [
        node,
        resolve(prepared.workspace, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        'playwright.formicarium.config.ts',
        '--workers=1',
        '--retries=0',
      ],
      { cwd: prepared.workspace },
    ),
  );
  await reportU3(u3);
  const coverage = JSON.parse(
    await readFile(resolve(u3, 'report.json'), 'utf8'),
  );
  validateCoverage(coverage, {
    files: FILES,
    tarballSha256: hash(await readFile(resolve(root, manifest.tarball))),
    u1Realms: REQUIRED_U1_REALMS,
  });
  validateChecks(results);
  await verifyPins(resolve(inputRoot, 'payload'), manifest.files);
  await verifyPins(root, manifest.sourceFiles);
  await writeFile(
    resolve(output, 'acceptance.json'),
    JSON.stringify(
      {
        passed: true,
        context,
        manifestSha256: hash(
          await readFile(resolve(inputRoot, 'manifest.json')),
        ),
        checks: results,
        coverage,
        limits:
          'Local/fresh CI verification only; no RC adoption or publication approval.',
      },
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await runVerification();
