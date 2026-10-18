import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import {
  prepareSessionCoverage,
  SESSION_REALMS,
} from '../migration-session/coverage.js';
import { reportCoverage } from '../package/coverage.js';
import { INSTALL_REGRESSION_UNITS } from './stage.js';

/** Fresh U2+U3 collection, never an import of a completed U2 coverage result. */
export const INSTALL_REALMS = Object.freeze({
  nodeWorkers: SESSION_REALMS.nodeWorkers + 2,
  browserCases: {
    ...SESSION_REALMS.browserCases,
    'independent installed U3 ELF and real archive install with controlled HTTPS transport and real guest run': 34,
    'browser factory, digest failure and preabort preserve seed and refuse forged session': 0,
    'browser same reservation rejects reentry and owner reset/dispose cancel install': 0,
  },
});
export function assertInstallNodeRealms(
  rows: readonly { name: string; counts: number[] }[],
): void {
  const expected = [
    'node-host',
    ...Array.from(
      { length: INSTALL_REALMS.nodeWorkers },
      (_, index) => `node-worker-${index + 1}`,
    ),
  ];
  if (
    rows.length !== expected.length ||
    JSON.stringify(rows.map((row) => row.name).sort()) !==
      JSON.stringify(expected.sort())
  )
    throw Error('U3 combined current Node realm inventory differs');
  for (const row of rows)
    if (row.counts[0] !== 1) throw Error('U3 Node realm was not registered');
}
export async function prepareInstallCoverage(
  out: string,
  root = process.cwd(),
) {
  const input = await consumerInput();
  if (!INSTALL_REGRESSION_UNITS.includes(input.candidate.unit))
    throw Error('U3 coverage requires current U3 candidate');
  await prepareSessionCoverage(out, root);
  await cp(
    resolve(root, 'tests/migration-install'),
    resolve(out, 'tests/migration-install'),
    { recursive: true },
  );
  const archiveURL = pathToFileURL(
    resolve(
      root,
      '.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
    ),
  ).href;
  for (const name of [
    'archive.test.js',
    'consumer.test.js',
    'consumer.spec.js',
  ]) {
    const path = resolve(out, 'tests/migration-install', name);
    let source = await readFile(path, 'utf8');
    const archive =
      '../../.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz';
    if (!source.includes(archive))
      throw Error(`U3 real archive boundary missing: ${name}`);
    source = source.replaceAll(archive, archiveURL);
    if (name === 'consumer.test.js') {
      const compiler = '../../node_modules/typescript/bin/tsc';
      if (!source.includes(compiler))
        throw Error('U3 independent type fixture compiler boundary missing');
      source = source.replace(
        compiler,
        pathToFileURL(resolve(root, 'node_modules/typescript/bin/tsc')).href,
      );
      // The inventory checker is development code; it must not become product code.
      source = source.replace(
        '../../scripts/package/stage-package.js',
        pathToFileURL(resolve(root, 'scripts/package/stage-package.js')).href,
      );
    }
    if (name === 'consumer.spec.js') {
      const navigation = 'test.beforeEach(async ({ page })';
      if (!source.includes(navigation))
        throw Error('U3 browser collector navigation boundary missing');
      const hooks = `test.beforeEach(async({context})=>context.addInitScript(await coverageRead(new URL('../../coverage-browser-init.js',import.meta.url),'utf8')));
test.afterEach(async({page},info)=>{const rows=await page.evaluate(()=>globalThis.__coverageRealms?.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})));if(!rows)throw Error('missing U3 browser realm observations');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({project:info.project.name,title:info.title,rows}));});\n`;
      source = `import {readFile as coverageRead,writeFile as coverageWrite} from 'node:fs/promises';\n${source.replace(navigation, hooks + navigation)}`;
    }
    await writeFile(path, source);
  }
  await writeFile(
    resolve(out, 'tests/migration-install/playwright.coverage.config.mjs'),
    `import '../../coverage-playwright-node-install.mjs';
import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'consumer.spec.js',workers:1,retries:0,fullyParallel:false,timeout:840000,forbidOnly:Boolean(process.env.CI),use:{trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]});\n`,
    { flag: 'wx' },
  );
  await writeFile(
    resolve(out, 'install-collection-boundary.json'),
    `${JSON.stringify({ schema: 'migration-install-coverage-boundary', version: 1, unit: 'u3-install', candidateSha256: input.candidate.tarball.sha256, sourceIdentity: input.candidate.sourceIdentity, realInstalledPackage: input.packageRoot, instrumentedPackage: out, combinedFreshRealms: INSTALL_REALMS, originalCompletedU2ProofImported: false }, null, 2)}\n`,
    { flag: 'wx' },
  );
}
export async function reportInstallCoverage(
  out: string,
  browserResults: string,
  candidatePath: string,
) {
  assertInstallNodeRealms(
    JSON.parse(
      await readFile(resolve(out, 'coverage-session-node.json'), 'utf8'),
    ),
  );
  const boundary = JSON.parse(
    await readFile(resolve(out, 'install-collection-boundary.json'), 'utf8'),
  );
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  if (
    !INSTALL_REGRESSION_UNITS.includes(candidate.unit) ||
    !INSTALL_REGRESSION_UNITS.includes(boundary.unit) ||
    boundary.candidateSha256 !== candidate.tarball.sha256 ||
    boundary.sourceIdentity !== candidate.sourceIdentity ||
    boundary.originalCompletedU2ProofImported !== false ||
    JSON.stringify(boundary.combinedFreshRealms) !==
      JSON.stringify(INSTALL_REALMS)
  )
    throw Error('U3 coverage boundary identity changed');
  return await reportCoverage({
    out,
    browserResults,
    candidatePath,
    session: INSTALL_REALMS,
    runnerSuites: ['package', 'session', 'install'],
  });
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, out, results, candidate, ...extra] = process.argv.slice(2);
  if (mode === 'prepare' && out && !results && !extra.length)
    await prepareInstallCoverage(resolve(out));
  else if (mode === 'report' && out && results && candidate && !extra.length)
    console.log(
      JSON.stringify(
        await reportInstallCoverage(
          resolve(out),
          resolve(results),
          resolve(candidate),
        ),
      ),
    );
  else
    throw Error(
      'usage: U3 coverage.js prepare <new-copy> | report <copy> <browser-results> <candidate>',
    );
}
