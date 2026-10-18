import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import { INSTALL_REALMS } from '../migration-install/coverage.js';
import { prepareSessionCoverage } from '../migration-session/coverage.js';
import { reportCoverage } from '../package/coverage.js';
import { assertCommandDistribution, COMMAND_UNIT } from './stage.js';

/**
 * Fresh U2+U3+U4 collection over all 23 first-party JS files. U4 adds three
 * real Node guest Workers (two in consumer.test, one in the public.test
 * blink.log regression) and three browser cases; each
 * completed browser aube run is expected to register 17 Worker realms, the
 * same per-run count the U2/U3 inventories use. These counts are expected
 * sets that must be observed exactly; they are never a reason to drop a realm.
 */
export const COMMAND_REALMS = Object.freeze({
  nodeWorkers: INSTALL_REALMS.nodeWorkers + 3,
  browserCases: {
    ...INSTALL_REALMS.browserCases,
    'independent installed U4 empty terminal installs, runs aube, uses builtins and resets': 17,
    'browser command competes BUSY with direct install and a failed reinstall keeps the old guest': 17,
    'browser keeps non-ASCII input, refuses shell syntax and matches direct install identity': 0,
  },
});
export const COMMAND_RUNNER_SUITES = Object.freeze([
  'package',
  'session',
  'install',
  'command',
]);
/** U4 node files collected in the same fresh session-preload process as U2/U3. */
export const COMMAND_COVERAGE_TESTS = Object.freeze([
  'parse',
  'dispatch',
  'public',
  'consumer',
]);

export function assertCommandNodeRealms(
  rows: readonly { name: string; counts: number[] }[],
): void {
  const expected = [
    'node-host',
    ...Array.from(
      { length: COMMAND_REALMS.nodeWorkers },
      (_, index) => `node-worker-${index + 1}`,
    ),
  ];
  if (
    rows.length !== expected.length ||
    new Set(rows.map((row) => row.name)).size !== rows.length ||
    JSON.stringify(rows.map((row) => row.name).sort()) !==
      JSON.stringify(expected.sort())
  )
    throw Error('U4 combined current Node realm inventory differs');
  for (const row of rows)
    if (row.counts[0] !== 1) throw Error('U4 Node realm was not registered');
}

async function rewrite(
  path: string,
  replacements: readonly [from: string, to: string][],
  label: string,
) {
  let source = await readFile(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!source.includes(from))
      throw Error(`U4 coverage boundary missing: ${label}: ${from}`);
    source = source.replaceAll(from, to);
  }
  await writeFile(path, source);
}
const BROWSER_HOOK = (label: string) =>
  `test.beforeEach(async({context})=>context.addInitScript(await coverageRead(new URL('../../coverage-browser-init.js',import.meta.url),'utf8')));
test.afterEach(async({page},info)=>{const rows=await page.evaluate(()=>globalThis.__coverageRealms?.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})));if(!rows)throw Error('missing ${label} browser realm observations');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({project:info.project.name,title:info.title,rows}));});\n`;
const NAVIGATION = 'test.beforeEach(async ({ page }';
async function addBrowserHooks(path: string, label: string) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(NAVIGATION))
    throw Error(`${label} browser collector navigation boundary missing`);
  await writeFile(
    path,
    `import {readFile as coverageRead,writeFile as coverageWrite} from 'node:fs/promises';\n${source.replace(NAVIGATION, BROWSER_HOOK(label) + NAVIGATION)}`,
  );
}
const playwrightConfig = (suite: string) =>
  `import '../../coverage-playwright-node-${suite}.mjs';
import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'consumer.spec.js',workers:1,retries:0,fullyParallel:false,timeout:840000,forbidOnly:Boolean(process.env.CI),use:{trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]});\n`;

/**
 * Same U3 test rewrites as scripts/migration-install/coverage.ts, applied to a
 * U4 candidate (that helper writes a U3 boundary and the U3 realm set).
 */
async function prepareInstallTests(out: string, root: string) {
  await cp(
    resolve(root, 'tests/migration-install'),
    resolve(out, 'tests/migration-install'),
    { recursive: true },
  );
  const archive =
    '../../.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz';
  const archiveURL = pathToFileURL(resolve(root, archive.slice(6))).href;
  for (const name of ['archive.test.js', 'consumer.test.js']) {
    const replacements: [string, string][] = [[archive, archiveURL]];
    if (name === 'consumer.test.js')
      replacements.push(
        [
          '../../node_modules/typescript/bin/tsc',
          pathToFileURL(resolve(root, 'node_modules/typescript/bin/tsc')).href,
        ],
        [
          '../../scripts/package/stage-package.js',
          pathToFileURL(resolve(root, 'scripts/package/stage-package.js')).href,
        ],
      );
    await rewrite(
      resolve(out, 'tests/migration-install', name),
      replacements,
      name,
    );
  }
  const spec = resolve(out, 'tests/migration-install/consumer.spec.js');
  await rewrite(spec, [[archive, archiveURL]], 'U3 consumer.spec.js');
  await addBrowserHooks(spec, 'U3');
  await writeFile(
    resolve(out, 'tests/migration-install/playwright.coverage.config.mjs'),
    playwrightConfig('install'),
    { flag: 'wx' },
  );
}

async function prepareCommandTests(out: string, root: string) {
  await cp(
    resolve(root, 'tests/migration-command'),
    resolve(out, 'tests/migration-command'),
    { recursive: true },
  );
  await rewrite(
    resolve(out, 'tests/migration-command/consumer.test.js'),
    [
      [
        '../../node_modules/typescript/bin/tsc',
        pathToFileURL(resolve(root, 'node_modules/typescript/bin/tsc')).href,
      ],
      [
        '../../scripts/package/stage-package.js',
        pathToFileURL(resolve(root, 'scripts/package/stage-package.js')).href,
      ],
    ],
    'U4 consumer.test.js',
  );
  // Like U3, the spec keeps its development-only digest helper import as is.
  await addBrowserHooks(
    resolve(out, 'tests/migration-command/consumer.spec.js'),
    'U4',
  );
  await writeFile(
    resolve(out, 'tests/migration-command/playwright.coverage.config.mjs'),
    playwrightConfig('command'),
    { flag: 'wx' },
  );
  // The shared generator writes package/session/install runner bootstraps.
  // The U4 runner uses the identical generation with only its suite renamed.
  const install = await readFile(
    resolve(out, 'coverage-playwright-node-install.mjs'),
    'utf8',
  );
  const marker = ',suite="install";';
  if (install.split(marker).length !== 2)
    throw Error('U4 Playwright runner bootstrap boundary missing');
  await writeFile(
    resolve(out, 'coverage-playwright-node-command.mjs'),
    install.replace(marker, ',suite="command";'),
    { flag: 'wx' },
  );
}

export async function prepareCommandCoverage(
  out: string,
  root = process.cwd(),
) {
  const input = await consumerInput();
  if (input.candidate.unit !== COMMAND_UNIT)
    throw Error('U4 coverage requires the current U4 candidate');
  assertCommandDistribution(input.candidate.distributionInventory);
  await prepareSessionCoverage(out, root);
  await prepareInstallTests(out, root);
  await prepareCommandTests(out, root);
  await writeFile(
    resolve(out, 'command-collection-boundary.json'),
    `${JSON.stringify(
      {
        schema: 'migration-command-coverage-boundary',
        version: 1,
        unit: COMMAND_UNIT,
        candidateSha256: input.candidate.tarball.sha256,
        sourceIdentity: input.candidate.sourceIdentity,
        realInstalledPackage: input.packageRoot,
        instrumentedPackage: out,
        combinedFreshRealms: COMMAND_REALMS,
        runnerSuites: COMMAND_RUNNER_SUITES,
        completedU2U3ProofImported: false,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
}

export async function reportCommandCoverage(
  out: string,
  browserResults: string,
  candidatePath: string,
) {
  assertCommandNodeRealms(
    JSON.parse(
      await readFile(resolve(out, 'coverage-session-node.json'), 'utf8'),
    ),
  );
  const boundary = JSON.parse(
    await readFile(resolve(out, 'command-collection-boundary.json'), 'utf8'),
  );
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  if (
    candidate.unit !== COMMAND_UNIT ||
    boundary.unit !== COMMAND_UNIT ||
    boundary.candidateSha256 !== candidate.tarball.sha256 ||
    boundary.sourceIdentity !== candidate.sourceIdentity ||
    boundary.completedU2U3ProofImported !== false ||
    JSON.stringify(boundary.combinedFreshRealms) !==
      JSON.stringify(COMMAND_REALMS) ||
    JSON.stringify(boundary.runnerSuites) !==
      JSON.stringify(COMMAND_RUNNER_SUITES)
  )
    throw Error('U4 coverage boundary identity changed');
  const report = await reportCoverage({
    out,
    browserResults,
    candidatePath,
    session: COMMAND_REALMS,
    runnerSuites: [...COMMAND_RUNNER_SUITES],
  });
  assertCommandDistribution(report.files.map((file) => file.path));
  return report;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, out, results, candidate, ...extra] = process.argv.slice(2);
  if (mode === 'prepare' && out && !results && !extra.length)
    await prepareCommandCoverage(resolve(out));
  else if (mode === 'report' && out && results && candidate && !extra.length)
    console.log(
      JSON.stringify(
        await reportCommandCoverage(
          resolve(out),
          resolve(results),
          resolve(candidate),
        ),
      ),
    );
  else
    throw Error(
      'usage: U4 coverage.js prepare <new-copy> | report <copy> <browser-results> <candidate>',
    );
}
