import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import { prepareCoverage, reportCoverage } from '../package/coverage.js';

/** Additive realm inventory: the original 25 Node Workers and 33 cases remain. */
export const SESSION_REALMS = Object.freeze({
  nodeWorkers: 5,
  browserCases: {
    'same installed U2 pack validates official guest and runs owned copy after mutation': 17,
    'browser guest, fixture and forged handle refusals preserve session state': 0,
    'browser registration and direct run share BUSY, reset cancels and dispose is terminal': 17,
  },
});

export function assertSessionNodeRealms(
  rows: readonly { name: string; counts: number[] }[],
) {
  const expected = [
    'node-host',
    ...Array.from(
      { length: SESSION_REALMS.nodeWorkers },
      (_, index) => `node-worker-${index + 1}`,
    ),
  ];
  if (
    rows.length !== expected.length ||
    new Set(rows.map((row) => row.name)).size !== rows.length ||
    JSON.stringify(rows.map((row) => row.name).sort()) !==
      JSON.stringify(expected.sort())
  )
    throw Error('U2 exact Node realm inventory differs');
  for (const row of rows)
    if (row.counts[0] !== 1)
      throw Error(`U2 unregistered Node realm: ${row.name}`);
}

export async function prepareSessionCoverage(
  out: string,
  root = process.cwd(),
) {
  // This checks the real archive/installed bytes before selecting a separate,
  // explicitly instrumented copy. Instrumented bytes are not pack evidence.
  const input = await consumerInput();
  const guestPath = resolve(root, process.env.FORMICARIUM_SESSION_GUEST!);
  await prepareCoverage({ source: input.packageRoot, out, root });
  await cp(
    resolve(root, 'tests/migration-session'),
    resolve(out, 'tests/migration-session'),
    { recursive: true },
  );
  const helper = `import {readFile} from 'node:fs/promises';
export async function consumerInput(){return {packageRoot:${JSON.stringify(out)},consumerRoot:${JSON.stringify(input.consumerRoot)},candidate:${JSON.stringify(input.candidate)},bytes:new Uint8Array(await readFile(${JSON.stringify(guestPath)})),expected:${JSON.stringify(input.expected)}};}
`;
  await writeFile(
    resolve(out, 'tests/migration-session/consumer-input.js'),
    helper,
  );
  const consumerPath = resolve(out, 'tests/migration-session/consumer.test.js');
  const consumer = await readFile(consumerPath, 'utf8');
  const foreignImport = "await import('../../runtime/public.js')";
  if (!consumer.includes(foreignImport))
    throw Error('U2 foreign-instance coverage boundary missing');
  await writeFile(
    consumerPath,
    consumer.replace(
      foreignImport,
      `await import(${JSON.stringify(pathToFileURL(resolve(input.packageRoot, 'runtime/public.js')).href)})`,
    ),
  );
  const publicPath = resolve(out, 'tests/migration-session/public.test.js');
  const publicTest = await readFile(publicPath, 'utf8');
  if (
    !publicTest.includes('../../node_modules/typescript/bin/tsc') ||
    !publicTest.includes('tests/migration-session/tsconfig.json')
  )
    throw Error('U2 type fixture coverage boundary missing');
  await writeFile(
    publicPath,
    publicTest
      .replace(
        '../../node_modules/typescript/bin/tsc',
        pathToFileURL(resolve(root, 'node_modules/typescript/bin/tsc')).href,
      )
      .replace(
        'tests/migration-session/tsconfig.json',
        resolve(root, 'tests/migration-session/tsconfig.json'),
      ),
  );
  const nodePreload = await readFile(
    resolve(out, 'coverage-node-preload.mjs'),
    'utf8',
  );
  await writeFile(
    resolve(out, 'coverage-session-node-preload.mjs'),
    nodePreload.replace(
      "'./coverage-node.json'",
      "'./coverage-session-node.json'",
    ),
    { flag: 'wx' },
  );
  const specPath = resolve(out, 'tests/migration-session/consumer.spec.js');
  const spec = await readFile(specPath, 'utf8');
  const hook = `test.beforeEach(async({context})=>context.addInitScript(await coverageRead(new URL('../../coverage-browser-init.js',import.meta.url),'utf8')));
test.afterEach(async({page},info)=>{const rows=await page.evaluate(()=>globalThis.__coverageRealms?.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})));if(!rows)throw Error('missing U2 browser coverage');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({project:info.project.name,title:info.title,rows}));});
`;
  const navigation = 'test.beforeEach(async ({ page })';
  if (!spec.includes(navigation))
    throw Error('U2 browser coverage navigation boundary missing');
  await writeFile(
    specPath,
    `import {readFile as coverageRead,writeFile as coverageWrite} from 'node:fs/promises';\n${spec.replace(navigation, hook + navigation)}`,
  );
  // The verified package server must expose the collector's bootstrap files.
  // They reside in the instrumented root and are not part of npm inventory.
  await writeFile(
    resolve(out, 'tests/migration-session/playwright.coverage.config.mjs'),
    `import '../../coverage-playwright-node-session.mjs';
import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'consumer.spec.js',workers:1,retries:0,fullyParallel:false,timeout:840000,forbidOnly:Boolean(process.env.CI),use:{trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}]});\n`,
    { flag: 'wx' },
  );
  await writeFile(
    resolve(out, 'tests/package/playwright.coverage.config.mjs'),
    await readFile(resolve(out, 'tests/package/playwright.config.ts')),
    { flag: 'wx' },
  );
  await writeFile(
    resolve(out, 'session-collection-boundary.json'),
    JSON.stringify(
      {
        version: 1,
        candidateSha256: input.candidate.tarball.sha256,
        realInstalledPackage: input.packageRoot,
        instrumentedPackage: out,
        sessionRealms: SESSION_REALMS,
        originalInventory: resolve(
          root,
          'scripts/package/coverage-inventory.json',
        ),
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [command, out, results, candidate] = process.argv.slice(2);
  if (command === 'prepare' && out) await prepareSessionCoverage(resolve(out));
  else if (command === 'report' && out && results && candidate) {
    assertSessionNodeRealms(
      JSON.parse(
        await readFile(resolve(out, 'coverage-session-node.json'), 'utf8'),
      ),
    );
    console.log(
      JSON.stringify(
        await reportCoverage({
          out: resolve(out),
          browserResults: resolve(results),
          candidatePath: resolve(candidate),
          session: SESSION_REALMS,
        }),
      ),
    );
  } else
    throw Error(
      'usage: migration-session/coverage.js prepare <new-copy> | report <copy> <browser-results> <manifest>',
    );
}
