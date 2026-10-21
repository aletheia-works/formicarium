import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FileCoverageData } from 'istanbul-lib-coverage';
import coverageLibrary from 'istanbul-lib-coverage';
import type {
  Component,
  ComponentReport,
  CoverageInventory,
  Measurement,
} from '../coverage-types.js';
import { directoryIdentity, sha256 } from './evidence.js';

const { createCoverageMap } = coverageLibrary;

import instrumentLibrary from 'istanbul-lib-instrument';

const { createInstrumenter } = instrumentLibrary;

const root = fileURLToPath(new URL('../../', import.meta.url));
// Historical Terrarium component: these fourteen files belong to the original
// U1 proof, never to the current distribution denominator.
export const HISTORICAL_U1_JS = Object.freeze([
  'runtime/contracts.js',
  'runtime/public.js',
  'runtime/errors.js',
  'runtime/validation.js',
  'runtime/state.js',
  'runtime/lifecycle.js',
  'runtime/protocol.js',
  'runtime/worker-execution.js',
  'runtime/core.js',
  'runtime/guest-io.js',
  'runtime/node/api.js',
  'runtime/node/package-worker.js',
  'runtime/web/api.js',
  'runtime/web/package-worker.js',
]);
export const U2_FILES = ['manifest', 'fixtures', 'resolver'].map(
  (name) => `integration/guest-distribution/${name}.js`,
);
export const U3_FILES = [
  'formicarium-session',
  'catalog',
  'terminal',
  'session',
  'index',
  'npm',
]
  .map((name) => `terrarium/packages/terrarium/src/${name}.ts`)
  .concat('terrarium/web/terminal.mjs');
export const FILES = Object.freeze([
  ...HISTORICAL_U1_JS,
  ...U2_FILES,
  ...U3_FILES,
]);
export const BROWSER_TITLES = Object.freeze([
  'latest aube ready fields, events and actual Worker version',
  'latest pitchfork uses common runtime actual Worker version',
  'nested cwd keeps /work sibling before and after actual guest',
  'empty fixture and empty command have no added exit event',
  'normal nonzero exit and unsupported syntax error once; queue recovers',
  'run attributes and concurrent calls retain serial command order',
  'keyboard focus deletion arrows history and Ctrl-C preserve terminal controls',
  'tool switch resets attributes and suppresses prior queued run notifications',
  'disconnect invalidates old work and reconnect creates independent session',
  'boot error rejects ready once without creating any guest Worker',
  ...['same-origin', 'cross-origin', 'missing-isolation'].map(
    (condition) =>
      `iframe condition ${condition}: exact origins and guest marker oracle`,
  ),
  'invalid opaque wildcard and unknown parent origins never connect or notify',
  'unapproved parent origin cannot run or receive notifications even when syntax is valid',
]);
const PROJECTS = ['chromium', 'firefox', 'webkit'];
const u1Inventory = JSON.parse(
  await readFile(
    new URL('../package/coverage-inventory.json', import.meta.url),
    'utf8',
  ),
);
export const REQUIRED_U1_REALMS = Object.freeze([
  'node-host',
  ...Array.from(
    { length: u1Inventory.node.workers },
    (_, index) => `node-worker-${index + 1}`,
  ),
  ...PROJECTS.flatMap((project) =>
    Object.entries(u1Inventory.browserCases).flatMap(([title, workers]) => [
      `${project}:${title}:browser-host`,
      ...Array.from(
        { length: Number(workers) },
        (_, index) => `${project}:${title}:browser-worker-${index + 1}`,
      ),
    ]),
  ),
]);
// The same-generation U1 report also covers the current package files, the
// Node Workers started by the migration unit tests and the Playwright runner
// processes (named by pid); only the historical fourteen files are imported.
const CURRENT_U1_JS = Object.freeze([...u1Inventory.files] as string[]);
export const CURRENT_U1_REALMS = Object.freeze([
  ...REQUIRED_U1_REALMS,
  ...Array.from(
    { length: u1Inventory.node.migrationWorkers },
    (_, index) => `node-worker-${u1Inventory.node.workers + index + 1}`,
  ),
]);
const sameSet = (values: readonly string[], expected: readonly string[]) =>
  values.length === expected.length &&
  new Set(values).size === expected.length &&
  values.every((value) => expected.includes(value));
const save = (filename: string, value: unknown) =>
  writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
const json = async (filename: string) =>
  JSON.parse(await readFile(filename, 'utf8'));
function binding(inventory: CoverageInventory) {
  return {
    generation: inventory.generation,
    sourceIdentity: inventory.sourceIdentity,
    candidateSha256: inventory.candidate?.sha256,
  };
}

// Self-contained verifier is part of the sealed bytes; it never embeds its own hash.
export const executionVerifierSource = `import {lstat,readdir,readFile,readlink,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,sep} from 'node:path';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function executionInventory(out){
 const rows=[]; const active=new Set();
 async function walk(actual,path,boundary){
  const stat=await lstat(actual);
  if(stat.isSymbolicLink()){
   const target=await readlink(actual),canonical=await realpath(actual);
   if(path==='terrarium/packages/terrarium/node_modules'){
    rows.push({path,kind:'dependency-link',target,canonical});
    await walk(canonical,path+'/@dependency',canonical);return;
   }
   if(!canonical.startsWith(boundary+sep))throw Error('execution escaping symlink: '+path);
   rows.push({path,kind:'symlink',target});
   await walk(canonical,path+'/@target',boundary);return;
  }
  if(stat.isDirectory()){
   const canonical=await realpath(actual);if(active.has(canonical))throw Error('execution symlink cycle');
   active.add(canonical);rows.push({path,kind:'directory'});
   for(const name of (await readdir(actual)).sort())await walk(join(actual,name),path+'/'+name,boundary);
   active.delete(canonical);
  }else if(stat.isFile()){const bytes=await readFile(actual);rows.push({path,kind:'file',size:bytes.length,sha256:hash(bytes)});}
  else throw Error('execution special file');
 }
 for(const path of ['site','terrarium','node-preload.mjs','execution-verifier.mjs'])await walk(join(out,path),path,resolve(out));
 return rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export async function verifyExecution(out){
 const seal=JSON.parse(await readFile(join(out,'execution-seal.json'),'utf8'));
 const inventory=JSON.parse(await readFile(join(out,'inventory.json'),'utf8'));
 const rows=await executionInventory(out);
 const identity=hash(JSON.stringify({generation:inventory.generation,sourceIdentity:inventory.sourceIdentity,candidateSha256:inventory.candidate.sha256,rows}));
 if(identity!==seal.executionIdentity||JSON.stringify(rows)!==JSON.stringify(seal.rows))throw Error('execution seal bytes or inventory changed');
 return identity;
}
`;
async function executionHelper(out: string) {
  return import(
    pathToFileURL(join(resolve(out), 'execution-verifier.mjs')).href
  ) as Promise<{
    executionInventory(out: string): Promise<unknown[]>;
    verifyExecution(out: string): Promise<string>;
  }>;
}
export async function sealCoverage(out: string) {
  out = resolve(out);
  const inventory = await json(join(out, 'inventory.json'));
  validateInventory(inventory);
  const helperBytes = await readFile(
    join(out, 'execution-verifier.mjs'),
    'utf8',
  );
  if (helperBytes !== executionVerifierSource)
    throw new Error('execution verifier changed');
  const rows = await (await executionHelper(out)).executionInventory(out);
  const executionIdentity = sha256(
    JSON.stringify({ ...binding(inventory), rows }),
  );
  await writeFile(
    join(out, 'execution-seal.json'),
    JSON.stringify({
      version: 1,
      ...binding(inventory),
      executionIdentity,
      rows,
    }),
    { flag: 'wx' },
  );
  return { executionIdentity };
}
export async function verifyExecution(out: string) {
  if (
    (await readFile(join(out, 'execution-verifier.mjs'), 'utf8')) !==
    executionVerifierSource
  )
    throw new Error('execution verifier changed');
  return (await executionHelper(out)).verifyExecution(resolve(out));
}

function validateInventory(inventory: CoverageInventory) {
  if (
    JSON.stringify(inventory.files) !== JSON.stringify(FILES) ||
    !inventory.generation ||
    inventory.sourceIdentity !== sha256(JSON.stringify(inventory.digests))
  )
    throw new Error('fixed inventory/source identity differs');
  for (const field of ['metadata', 'digests'] as const) {
    if (
      !Array.isArray(inventory[field]) ||
      inventory[field].length !== FILES.length ||
      new Set(inventory[field].map((row) => row.path)).size !== FILES.length ||
      !inventory[field].every((row) => FILES.includes(row.path))
    )
      throw new Error('fixed denominator differs');
  }
  for (const file of inventory.metadata) {
    if (
      Object.values(file.s).some((value) => value !== 0) ||
      Object.values(file.f).some((value) => value !== 0) ||
      Object.values(file.b).some((values) =>
        values.some((value) => value !== 0),
      )
    )
      throw new Error('nonzero inventory seed');
    const row = inventory.digests.find((row) => row.path === file.path);
    if (row?.statementMapSha256 !== sha256(JSON.stringify(file.statementMap)))
      throw new Error('statement map changed');
  }
}

/** Import old component coverage explicitly; never pretend it ran in this generation. */
export function componentImport(
  inventory: CoverageInventory,
  report: ComponentReport,
  reportSha256: string,
) {
  if (
    report.candidateSha256 !== inventory.tarballSha256 ||
    report.threshold !== 80 ||
    !report.passed ||
    !Array.isArray(report.realmNames) ||
    new Set(report.realmNames).size !== report.realmNames.length
  )
    throw new Error('U1 component evidence identity differs');
  for (const prefix of [
    'node-host',
    'node-worker-',
    ...PROJECTS.map((project) => `${project}:`),
  ]) {
    if (!report.realmNames.some((name) => name.startsWith(prefix)))
      throw new Error('U1 component realm missing');
  }
  const paths = report.files.map((file) => file.path);
  const generation = sameSet(paths, HISTORICAL_U1_JS)
    ? { files: HISTORICAL_U1_JS, realms: REQUIRED_U1_REALMS, runners: false }
    : sameSet(paths, CURRENT_U1_JS)
      ? { files: CURRENT_U1_JS, realms: CURRENT_U1_REALMS, runners: true }
      : undefined;
  if (
    !generation ||
    !sameSet(
      report.digests.map((file) => file.path),
      generation.files,
    )
  )
    throw new Error('U1 denominator differs');
  const runner = (name: string) =>
    /^playwright:package:[1-9][0-9]*$/.test(name);
  const runners = report.realmNames.filter(runner);
  if (
    !sameSet(
      report.realmNames.filter((name) => !runner(name)),
      generation.realms,
    ) ||
    (generation.runners ? runners.length === 0 : runners.length !== 0)
  )
    throw new Error('U1 planned realm inventory differs');
  const coverage: Record<string, FileCoverageData> = {};
  for (const path of HISTORICAL_U1_JS) {
    const file = structuredClone(
      inventory.metadata.find((row) => row.path === path)!,
    );
    const source = inventory.digests.find((row) => row.path === path)!;
    const old = report.digests.find((row) => row.path === path);
    const counts = report.files.find((row) => row.path === path)?.lines;
    if (
      !old ||
      !counts ||
      old.sourceSha256 !== source.sourceSha256 ||
      old.statementMapSha256 !== source.statementMapSha256
    )
      throw new Error('U1 component source changed');
    for (const [key, statement] of Object.entries(file.statementMap)) {
      const count = counts[String(statement.start.line)]!;
      if (!Number.isInteger(count) || count < 0)
        throw new Error('U1 component line counter missing');
      file.s[key] = count;
    }
    coverage[path] = file;
  }
  const originalReport = inventory.u1Report;
  if (
    typeof originalReport !== 'string' ||
    !isAbsolute(originalReport) ||
    basename(originalReport) !== 'coverage-report.json' ||
    !/^u1-coverage-v[0-9]+$/.test(basename(dirname(originalReport)))
  )
    throw new Error('U1 component original report path is missing or invalid');
  return {
    kind: 'immutable-component-import',
    originalReportSha256: reportSha256,
    originalReportPath: originalReport,
    originalGeneration: basename(dirname(originalReport)),
    originalSourceIdentity: sha256(JSON.stringify(report.digests)),
    originalTarballSha256: report.candidateSha256,
    originalRealmNames: report.realmNames,
    originalCommandFamily:
      'U1 fixed-inventory Node/three-browser coverage; original native report retained',
    coverage,
  };
}

export function mergeMeasurements(
  inventory: CoverageInventory,
  rows: Measurement[],
  component: Component,
) {
  validateInventory(inventory);
  const expected = binding(inventory);
  for (const row of rows) {
    if (
      Object.keys(expected).some(
        (key) =>
          row[key as keyof typeof expected] !==
          expected[key as keyof typeof expected],
      )
    )
      throw new Error('stale generation/source/candidate receipt');
    if (
      row.status !== 'passed' ||
      (row.realm === 'browser-host' && row.expectedStatus !== 'passed')
    )
      throw new Error('unsuccessful or skipped measurement');
  }
  if (rows.filter((row) => row.realm === 'node-host').length !== 1)
    throw new Error('Node realm missing or duplicate');
  for (const project of PROJECTS)
    for (const title of BROWSER_TITLES) {
      if (
        rows.filter(
          (row) =>
            row.realm === 'browser-host' &&
            row.project === project &&
            row.title === title,
        ).length !== 1
      )
        throw new Error(
          `browser realm missing or duplicate: ${project}/${title}`,
        );
    }
  if (rows.length !== 1 + PROJECTS.length * BROWSER_TITLES.length)
    throw new Error('unexpected measurement receipt');
  if (component?.kind !== 'immutable-component-import')
    throw new Error('U1 Worker component import missing');
  const map = createCoverageMap({});
  for (const file of inventory.metadata)
    map.addFileCoverage(structuredClone(file));
  for (const measurement of [...rows, component]) {
    for (const [path, file] of Object.entries(measurement.coverage ?? {})) {
      const expected = inventory.metadata.find((row) => row.path === path);
      if (
        !expected ||
        JSON.stringify(expected.statementMap) !==
          JSON.stringify(file.statementMap)
      )
        throw new Error('measurement source map differs');
      map.merge({ [path]: file });
    }
  }
  const lines = map.getCoverageSummary().lines;
  return {
    map,
    lines,
    passed: typeof lines.pct === 'number' && lines.pct >= 80,
    files: FILES.map((path) => ({
      path,
      lines: map.fileCoverageFor(path).toSummary().lines,
    })),
  };
}

/** Resolve authorized dependency links into owned bytes without weakening execution sealing. */
export async function copyCoverageDependencies(
  source: string,
  destination: string,
) {
  const sourceRoot = await realpath(source),
    target = resolve(destination);
  if (target === sourceRoot || target.startsWith(`${sourceRoot}${sep}`))
    throw new Error('dependency copy destination overlaps source');
  async function inventory() {
    const rows: { path: string; size: number; sha256: string }[] = [];
    const active = new Set<string>();
    async function walk(path: string, relative: string): Promise<void> {
      const canonical = await realpath(path),
        stat = await lstat(canonical);
      if (stat.isDirectory()) {
        if (active.has(canonical)) throw new Error('dependency symlink cycle');
        active.add(canonical);
        for (const name of (await readdir(canonical)).sort())
          await walk(
            join(canonical, name),
            relative ? `${relative}/${name}` : name,
          );
        active.delete(canonical);
      } else if (stat.isFile()) {
        const bytes = await readFile(canonical);
        rows.push({
          path: relative,
          size: bytes.length,
          sha256: sha256(bytes),
        });
      } else throw new Error('dependency special file refused');
    }
    await walk(sourceRoot, '');
    return rows.sort((a, b) => a.path.localeCompare(b.path));
  }
  const before = await inventory();
  await mkdir(target);
  for (const name of (await readdir(sourceRoot)).sort())
    await cp(join(sourceRoot, name), join(target, name), {
      recursive: true,
      dereference: true,
      errorOnExist: true,
      force: false,
    });
  const after = await inventory(),
    copied = await directoryIdentity(target);
  if (
    JSON.stringify(before) !== JSON.stringify(after) ||
    JSON.stringify(before) !== JSON.stringify(copied.files)
  )
    throw new Error('dependency copy identity drift');
  return {
    sourceRoot,
    files: copied.files,
    sha256: copied.sha256,
    scope:
      'owned dereferenced dependency snapshot; execution seal remains strict',
  };
}

export async function prepareCoverage({
  out,
  site,
  terrarium,
  packageRoot,
  tarball,
  u1Report,
}: {
  out: string;
  site: string;
  terrarium: string;
  packageRoot: string;
  tarball: string;
  u1Report: string;
}) {
  // EEXIST is intentional: old results can never be adopted by re-preparing.
  out = resolve(out);
  await mkdir(out);
  const candidate = await directoryIdentity(site);
  const metadata = [],
    digests = [];
  const instrumentedSite = join(out, 'site');
  await cp(site, instrumentedSite, { recursive: true });
  const workspace = join(out, 'terrarium/packages/terrarium');
  await mkdir(workspace, { recursive: true });
  for (const name of ['src', 'tests', 'e2e'])
    await cp(
      join(terrarium, 'packages/terrarium', name),
      join(workspace, name),
      { recursive: true },
    );
  await cp(join(terrarium, 'scripts'), join(out, 'terrarium/scripts'), {
    recursive: true,
  });
  await copyCoverageDependencies(
    join(terrarium, 'packages/terrarium/node_modules'),
    join(workspace, 'node_modules'),
  );
  await cp(
    join(terrarium, 'packages/terrarium/package.json'),
    join(workspace, 'package.json'),
  );
  for (const path of FILES) {
    const original = path.startsWith('terrarium/')
      ? join(terrarium, path.slice('terrarium/'.length))
      : U2_FILES.includes(path)
        ? join(root, path)
        : join(packageRoot, path);
    const bytes = await readFile(original);
    const compiled = path.endsWith('.ts')
      ? stripTypeScriptTypes(bytes.toString(), { mode: 'strip' })
      : bytes.toString();
    const instrumenter = createInstrumenter({
      esModules: true,
      compact: false,
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
    });
    const text = instrumenter.instrumentSync(compiled, path);
    const file = instrumenter.lastFileCoverage();
    metadata.push(file);
    digests.push({
      path,
      original,
      sourceSha256: sha256(bytes),
      compiledSha256: sha256(compiled),
      statementMapSha256: sha256(JSON.stringify(file.statementMap)),
    });
    if (U3_FILES.includes(path) && path.endsWith('.ts'))
      await writeFile(join(out, path), text);
    else if (U3_FILES.includes(path))
      await writeFile(join(instrumentedSite, 'web/terminal.mjs'), text);
    else if (U2_FILES.includes(path))
      await writeFile(
        join(
          instrumentedSite,
          'web/formicarium-guest-distribution',
          path.split('/').at(-1)!,
        ),
        text,
      );
    // U1 maps stay zero until the immutable same-pack component evidence is imported.
  }
  const inventory: CoverageInventory = {
    generation: randomUUID(),
    files: FILES,
    metadata,
    digests,
    sourceIdentity: sha256(JSON.stringify(digests)),
    candidate,
    tarballSha256: sha256(await readFile(tarball)),
    u1Report: resolve(u1Report),
    exclusions: {
      thirdParty: 'xterm and generated blink loader/wasm, verified separately',
      tests: 'verification-only',
      scripts: 'development-only',
      types: 'declarations checked separately',
      guests: 'external ELF verified/executed separately',
    },
  };
  const componentBytes = await readFile(u1Report);
  inventory.u1ReportSha256 = sha256(componentBytes);
  componentImport(
    inventory,
    JSON.parse(componentBytes.toString()),
    sha256(componentBytes),
  );
  await save(join(out, 'inventory.json'), inventory);
  await mkdir(join(out, 'receipts'));
  await writeFile(join(out, 'execution-verifier.mjs'), executionVerifierSource);
  const identity = JSON.stringify(binding(inventory));
  await writeFile(
    join(out, 'node-preload.mjs'),
    nodePreloadSource(inventory, out),
  );
  const assetTest = join(workspace, 'tests/formicarium-assets.test.ts');
  await writeFile(
    assetTest,
    (await readFile(assetTest, 'utf8')).replace(
      "path.resolve(import.meta.dir, '../../../../formicarium/integration/terrarium/guest-distribution')",
      JSON.stringify(join(root, 'integration/guest-distribution')),
    ),
  );
  for (const name of [
    'formicarium-terminal.spec.ts',
    'formicarium-iframe.spec.ts',
  ]) {
    const filename = join(workspace, 'e2e', name),
      source = await readFile(filename, 'utf8');
    await writeFile(
      filename,
      `import {writeFile as u3CoverageWrite} from 'node:fs/promises';\nimport {verifyExecution as u4Verify} from ${JSON.stringify(join(out, 'execution-verifier.mjs'))};\n${source}\ntest.beforeAll(async()=>{await u4Verify(${JSON.stringify(out)});});\ntest.afterEach(async({page},info)=>{const executionIdentity=await u4Verify(${JSON.stringify(out)});const coverage={};for(const frame of page.frames()){const measured=await frame.evaluate(()=>globalThis.__coverage__??{});for(const [path,file]of Object.entries(measured)){if(coverage[path])throw Error('duplicate measured module realm; separate merging required');coverage[path]=file;}}await u3CoverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({...${identity},executionIdentity,realm:'browser-host',project:info.project.name,title:info.title,status:info.status,expectedStatus:info.expectedStatus,coverage}));});\n`,
    );
  }
  const config = await readFile(
    join(terrarium, 'packages/terrarium/playwright.formicarium.config.ts'),
    'utf8',
  );
  await writeFile(
    join(workspace, 'playwright.formicarium.config.ts'),
    config
      .replace(
        "testDir: 'e2e'",
        `outputDir: ${JSON.stringify(join(out, 'browser-results'))}, testDir: 'e2e'`,
      )
      .replaceAll('../../.site', instrumentedSite),
  );
  return {
    out,
    workspace,
    instrumentedSite,
    generation: inventory.generation,
    mainBundleRequired: `Bun build ${join(workspace, 'src/index.ts')} --outfile ${join(instrumentedSite, 'web/terrarium.mjs')} --format esm --target browser --define __TERRARIUM_VERSION__="u3-coverage"`,
    mainNodeTests:
      'Node scripts/terrarium/coverage.js node <out> <absolute-Bun-executable>',
    status: 'prepared, measurements/threshold/CI unverified',
  };
}

export function nodePreloadSource(inventory: CoverageInventory, out: string) {
  return `import {afterAll} from 'bun:test';\nimport {writeFileSync} from 'node:fs';\nimport {verifyExecution} from ${JSON.stringify(join(out, 'execution-verifier.mjs'))};\nawait verifyExecution(${JSON.stringify(out)});\nafterAll(async()=>{const executionIdentity=await verifyExecution(${JSON.stringify(out)});if(!process.env.U3_NODE_ATTEMPT)throw Error('main collector attempt missing');writeFileSync(${JSON.stringify(join(out, 'node-raw.json'))},JSON.stringify({...${JSON.stringify(binding(inventory))},executionIdentity,attempt:process.env.U3_NODE_ATTEMPT,coverage:globalThis.__coverage__??{}}));});\n`;
}
export function finalizeNodeMeasurement(
  inventory: CoverageInventory,
  raw: Measurement,
  attempt: string,
  exitCode: number | null,
) {
  if (
    !raw ||
    raw.attempt !== attempt ||
    Object.entries(binding(inventory)).some(
      ([key, value]) => raw[key as keyof Measurement] !== value,
    )
  )
    throw new Error('fresh raw hook missing or binding differs');
  if (!Number.isInteger(exitCode))
    throw new Error('observed process exit missing');
  return {
    ...binding(inventory),
    executionIdentity: raw.executionIdentity,
    realm: 'node-host',
    status: exitCode === 0 ? 'passed' : 'failed',
    attempt,
    exitCode,
    coverage: raw.coverage,
  };
}
export async function collectNodeMeasurement(out: string, executable: string) {
  out = resolve(out);
  const inventory = await json(join(out, 'inventory.json'));
  validateInventory(inventory);
  const attempt = randomUUID();
  const executionIdentity = await verifyExecution(out);
  const workspace = join(out, 'terrarium/packages/terrarium');
  const args = [
    'test',
    '--preload',
    join(out, 'node-preload.mjs'),
    ...['session', 'catalog', 'assets'].map((name) =>
      join(workspace, `tests/formicarium-${name}.test.ts`),
    ),
  ];
  const exitCode = await new Promise<number | null>((accept, reject) => {
    const child = spawn(executable, args, {
      stdio: 'inherit',
      env: { ...process.env, U3_NODE_ATTEMPT: attempt },
    });
    child.once('error', reject);
    child.once('exit', (code) => accept(code));
  });
  let raw: Measurement;
  try {
    raw = await json(join(out, 'node-raw.json'));
  } catch {
    throw new Error('fresh raw hook missing');
  }
  const receipt = finalizeNodeMeasurement(inventory, raw, attempt, exitCode);
  if (
    (await verifyExecution(out)) !== executionIdentity ||
    receipt.executionIdentity !== executionIdentity
  )
    throw new Error('execution receipt differs');
  await save(join(out, 'receipts/node.json'), {
    ...receipt,
    command: [executable, ...args],
  });
  if (exitCode !== 0)
    throw new Error(`Node measurement child failed: ${exitCode}`);
  return receipt;
}

async function receipts(directory: string): Promise<Measurement[]> {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...(await receipts(filename)));
    else if (
      entry.name === 'coverage-realms.json' ||
      entry.name === 'node.json'
    )
      rows.push(await json(filename));
  }
  return rows;
}
export async function reportCoverage(out: string) {
  out = resolve(out);
  const executionIdentity = await verifyExecution(out);
  const inventory = await json(join(out, 'inventory.json'));
  validateInventory(inventory);
  if (
    (await directoryIdentity(inventory.candidate.root)).sha256 !==
    inventory.candidate.sha256
  )
    throw new Error('candidate changed after preparation');
  for (const row of inventory.digests)
    if (sha256(await readFile(row.original)) !== row.sourceSha256)
      throw new Error('source changed after preparation');
  const componentBytes = await readFile(inventory.u1Report);
  if (sha256(componentBytes) !== inventory.u1ReportSha256)
    throw new Error('immutable U1 component report changed');
  const component = componentImport(
    inventory,
    JSON.parse(componentBytes.toString()),
    sha256(componentBytes),
  );
  const rows = [
    ...(await receipts(join(out, 'receipts'))),
    ...(await receipts(join(out, 'browser-results'))),
  ];
  if (rows.some((row) => row.executionIdentity !== executionIdentity))
    throw new Error('execution receipt missing or stale');
  const result = mergeMeasurements(inventory, rows, component);
  await verifyExecution(out);
  await save(join(out, 'coverage-final.json'), result.map.toJSON());
  await save(join(out, 'report.json'), {
    ...binding(inventory),
    executionIdentity,
    lines: result.lines,
    files: result.files,
    passed: result.passed,
    fixedInventory: FILES,
    freshReceipts: rows.map(({ coverage, ...identity }) => identity),
    componentImport: { ...component, coverage: undefined },
    exclusions: inventory.exclusions,
    ci: 'unverified; U4 must execute before integration',
    pages: 'local Pages-like host only; real Pages unverified',
  });
  if (!result.passed)
    throw new Error(
      `fixed24 line coverage ${result.lines.pct}% is below unchanged 80%`,
    );
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [command, input] = process.argv.slice(2);
  if (command === 'prepare' && input)
    console.log(JSON.stringify(await prepareCoverage(await json(input))));
  else if (command === 'seal' && input)
    console.log(JSON.stringify(await sealCoverage(input)));
  else if (command === 'node' && input && process.argv[4]) {
    const { coverage, ...receipt } = await collectNodeMeasurement(
      input,
      process.argv[4],
    );
    console.log(JSON.stringify(receipt));
  } else if (command === 'report' && input) {
    const { lines, passed } = await reportCoverage(input);
    console.log(JSON.stringify({ lines, passed }));
  } else
    throw new Error(
      'usage: coverage.js prepare <input.json> | seal <fresh-output-dir> | node <fresh-output-dir> <absolute-Bun> | report <fresh-output-dir>',
    );
}
