import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FileCoverageData } from 'istanbul-lib-coverage';
import coverageLibrary from 'istanbul-lib-coverage';
import type {
  CoverageInventory,
  DigestRow,
  Measurement,
} from '../coverage-types.js';
import { compiledTestConfig } from '../playwright-build-config.js';

const { createCoverageMap } = coverageLibrary;

import instrumentLibrary from 'istanbul-lib-instrument';

const { createInstrumenter } = instrumentLibrary;

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
export const FILES = ['manifest', 'fixtures', 'resolver'].map(
  (name) => `integration/guest-distribution/${name}.js`,
);
const PROJECTS = ['chromium', 'firefox', 'webkit'];
const NODE_TESTS = [
  'manifest',
  'fixtures',
  'resolver',
  'stage',
  'integration',
].map((name) => `tests/guest-distribution/${name}.test.js`);
const TITLES = [
  'synthetic two-ref contract returns distinct bytes/provenance with valid fixture/cwd',
  'synthetic default ref with explicitly empty seed keeps /work cwd',
  'unknown selections, 404, digest tamper and redirect never execute guest',
  'actual official aube two-release supply is distinct from synthetic fixtures',
  'actual latest pitchfork patched musl supply keeps selected provenance and fixture',
];
const save = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

async function candidateIdentity(site: string | undefined) {
  if (!site)
    throw new Error(
      'coverage requires U2_ACTUAL_SITE for actual supply identity',
    );
  const path = resolve(site),
    files: { path: string; size: number; sha256: string }[] = [];
  async function walk(directory: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory())
        await walk(join(directory, entry.name), relative);
      else if (entry.isFile()) {
        const bytes = await readFile(join(directory, entry.name));
        files.push({ path: relative, size: bytes.length, sha256: hash(bytes) });
      } else
        throw new Error('candidate identity refuses symlinks or special files');
    }
  }
  await walk(path);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (
    !files.some((file) => file.path === 'tools.json') ||
    !files.some((file) => file.path === 'dist/builds.json')
  )
    throw new Error('candidate identity missing catalogue');
  return { path, files, sha256: hash(JSON.stringify(files)) };
}

/** Fixed inventory, owned zero maps and separate instrumented workspace. */
export async function prepareCoverage(output: string) {
  const out = resolve(output),
    workspace = join(out, 'workspace');
  const candidate = await candidateIdentity(process.env.U2_ACTUAL_SITE);
  // A preparation owns its receipts for life; never adopt an earlier run.
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out);
  const generation = randomUUID();
  await mkdir(workspace, { recursive: true });
  for (const path of [
    'tests/guest-distribution',
    'tests/shared',
    'scripts/guest-distribution',
    'scripts/playwright-build-config.js',
  ]) {
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await cp(join(root, path), join(workspace, path), { recursive: true });
  }
  const metadata = [],
    digests = [];
  for (const path of FILES) {
    const source = await readFile(join(root, path));
    const instrumenter = createInstrumenter({
      esModules: true,
      compact: false,
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
    });
    const text = instrumenter.instrumentSync(source.toString('utf8'), path);
    const file = instrumenter.lastFileCoverage();
    metadata.push(file);
    digests.push({
      path,
      sourceSha256: hash(source),
      instrumentedSha256: hash(text),
      statementMapSha256: hash(JSON.stringify(file.statementMap)),
    });
    await mkdir(dirname(join(workspace, path)), { recursive: true });
    await writeFile(join(workspace, path), text);
  }
  await cp(
    join(root, 'integration/guest-distribution/index.d.ts'),
    join(workspace, 'integration/guest-distribution/index.d.ts'),
  );
  await cp(
    join(root, 'integration/guest-distribution/resolver.d.ts'),
    join(workspace, 'integration/guest-distribution/resolver.d.ts'),
  );
  await cp(join(root, 'package.json'), join(workspace, 'package.json'));
  const identity = hash(JSON.stringify(digests));
  const binding = {
    generation,
    sourceIdentity: identity,
    candidateSha256: candidate.sha256,
  };
  await mkdir(join(out, 'node'), { recursive: true });
  const preload = `import {writeFileSync} from 'node:fs';\nimport {relative,resolve} from 'node:path';\nprocess.on('exit',(code)=>{const coverage=globalThis.__coverage__;if(coverage&&Object.keys(coverage).length)writeFileSync(${JSON.stringify(join(out, 'node'))}+'/node-'+process.pid+'.json',JSON.stringify({...${JSON.stringify(binding)},realm:'node-host',testFile:relative(${JSON.stringify(workspace)},resolve(process.argv[1]??'')).replaceAll('\\\\','/'),actualSite:resolve(process.env.U2_ACTUAL_SITE??''),exitCode:code,coverage}));});\n`;
  await writeFile(join(out, 'node-preload.mjs'), preload);
  const specPath = join(workspace, 'tests/guest-distribution/consumer.spec.js');
  const original = await readFile(specPath, 'utf8');
  const hook = `\ntest.afterEach(async({page},info)=>{const coverage=await page.evaluate(()=>globalThis.__coverage__);if(!coverage)throw Error('missing browser host coverage');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({...${JSON.stringify(binding)},realm:'browser-host',project:info.project.name,title:info.title,status:info.status,expectedStatus:info.expectedStatus,actualSite:process.env.U2_ACTUAL_SITE,coverage}));});\n`;
  await writeFile(
    specPath,
    `import {writeFile as coverageWrite} from 'node:fs/promises';\n${original.replace('test.beforeEach', `${hook}\ntest.beforeEach`)}`,
  );
  const configPath = join(
    workspace,
    'tests/guest-distribution/playwright.config.ts',
  );
  const config = await readFile(configPath, 'utf8');
  await writeFile(
    configPath,
    compiledTestConfig(config, join(out, 'browser-results')),
  );
  await save(join(out, 'inventory.json'), {
    version: 1,
    generation,
    files: FILES,
    metadata,
    digests,
    sourceIdentity: identity,
    candidate,
    expectedRealms: ['node-host', ...PROJECTS.map((p) => `${p}:browser-host`)],
    expectedBrowserTitles: TITLES,
    expectedNodeTests: NODE_TESTS,
    exclusions: {
      producer: 'development-only staging/coverage scripts',
      types: 'declarations checked separately',
      tests: 'verification-only',
      elf: 'guest asset integrity/execution checked separately',
    },
    u1Union:
      'Preserve U1 fixed14 inventory/results unchanged; U4 combines fixed17 first-party JS.',
  });
  return { output: out, workspace, sourceIdentity: identity };
}

async function findReceipts(path: string): Promise<Measurement[]> {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await findReceipts(name)));
    else if (
      entry.name === 'coverage-realms.json' ||
      /^node-\d+\.json$/.test(entry.name)
    )
      result.push(JSON.parse(await readFile(name, 'utf8')));
  }
  return result;
}

function validateInventory(inventory: CoverageInventory) {
  if (JSON.stringify(inventory.files) !== JSON.stringify(FILES))
    throw new Error('coverage inventory differs');
  for (const field of ['metadata', 'digests'] as const) {
    if (
      !Array.isArray(inventory[field]) ||
      inventory[field].length !== FILES.length ||
      new Set(inventory[field].map((row) => row.path)).size !== FILES.length ||
      !inventory[field].every((row) => FILES.includes(row.path))
    )
      throw new Error(`coverage ${field} fixed path set differs`);
  }
  for (const file of inventory.metadata) {
    if (
      !file.s ||
      !file.f ||
      !file.b ||
      Object.values(file.s).some((value) => value !== 0) ||
      Object.values(file.f).some((value) => value !== 0) ||
      Object.values(file.b).some(
        (values) =>
          !Array.isArray(values) || values.some((value) => value !== 0),
      )
    ) {
      throw new Error(
        'coverage inventory seed must contain only zero counters',
      );
    }
    const digest = inventory.digests.find((row) => row.path === file.path);
    if (
      !['sourceSha256', 'instrumentedSha256', 'statementMapSha256'].every(
        (field) =>
          typeof digest?.[field as keyof DigestRow] === 'string' &&
          /^[a-f0-9]{64}$/.test(String(digest?.[field as keyof DigestRow])),
      ) ||
      digest?.statementMapSha256 !== hash(JSON.stringify(file.statementMap))
    )
      throw new Error('coverage inventory digest differs');
  }
}

export function mergeMeasurements(
  inventory: CoverageInventory,
  rows: Measurement[],
) {
  validateInventory(inventory);
  if (
    !inventory.generation ||
    !inventory.sourceIdentity ||
    !inventory.candidate?.sha256
  )
    throw new Error('coverage preparation identity missing');
  if (
    rows.some(
      (row) =>
        row.generation !== inventory.generation ||
        row.sourceIdentity !== inventory.sourceIdentity ||
        row.candidateSha256 !== inventory.candidate?.sha256,
    )
  )
    throw new Error(
      'coverage measurement generation/source/candidate identity differs',
    );
  for (const testFile of NODE_TESTS) {
    const matches = rows.filter(
      (row) => row.realm === 'node-host' && row.testFile === testFile,
    );
    if (matches.length !== 1 || matches[0]?.exitCode !== 0)
      throw new Error(`missing or unsuccessful Node file realm: ${testFile}`);
  }
  if (
    rows.some(
      (row) =>
        row.realm === 'node-host' && !NODE_TESTS.includes(row.testFile ?? ''),
    )
  )
    throw new Error('unexpected Node file realm');
  for (const project of PROJECTS)
    for (const title of TITLES) {
      const matches = rows.filter(
        (row) => row.project === project && row.title === title,
      );
      if (
        matches.length !== 1 ||
        matches[0]?.realm !== 'browser-host' ||
        matches[0]?.status !== 'passed' ||
        matches[0]?.expectedStatus !== 'passed'
      ) {
        throw new Error(
          `missing or unsuccessful browser realm/case: ${project}/${title}`,
        );
      }
    }
  const map = createCoverageMap({});
  for (const file of inventory.metadata)
    map.addFileCoverage(structuredClone(file));
  for (const row of rows) {
    if (row.realm === 'node-host' && row.exitCode !== 0)
      throw new Error('unsuccessful Node coverage process');
    for (const [path, coverage] of Object.entries(row.coverage ?? {})) {
      const expected = inventory.metadata.find(
        (item: FileCoverageData) => item.path === path,
      );
      if (
        !expected ||
        JSON.stringify(expected.statementMap) !==
          JSON.stringify(coverage.statementMap)
      )
        throw new Error('coverage source/statement map differs');
      map.merge({ [path]: coverage });
    }
  }
  // Never-imported files retain their seeded zero maps in the denominator.
  const files = FILES.map((path) => ({
    path,
    lines: map.fileCoverageFor(path).toSummary().lines,
  }));
  const lines = map.getCoverageSummary().lines;
  return {
    map,
    files,
    lines,
    passed: typeof lines.pct === 'number' && lines.pct >= 80,
  };
}

export async function reportCoverage(output: string) {
  const out = resolve(output),
    inventory = JSON.parse(await readFile(join(out, 'inventory.json'), 'utf8'));
  validateInventory(inventory);
  const currentCandidate = await candidateIdentity(process.env.U2_ACTUAL_SITE);
  if (
    currentCandidate.path !== inventory.candidate?.path ||
    currentCandidate.sha256 !== inventory.candidate.sha256 ||
    inventory.candidate.sha256 !==
      hash(JSON.stringify(inventory.candidate.files))
  )
    throw new Error('coverage actual candidate identity changed');
  if (inventory.sourceIdentity !== hash(JSON.stringify(inventory.digests)))
    throw new Error('coverage source identity digest differs');
  for (const row of inventory.digests) {
    const metadata = inventory.metadata.find(
      (item: FileCoverageData) => item.path === row.path,
    );
    if (
      !metadata ||
      row.statementMapSha256 !== hash(JSON.stringify(metadata.statementMap))
    )
      throw new Error('coverage statement map digest differs');
    if (
      hash(await readFile(join(root, row.path))) !== row.sourceSha256 ||
      hash(await readFile(join(out, 'workspace', row.path))) !==
        row.instrumentedSha256
    )
      throw new Error('coverage source identity changed');
  }
  const rows = [
    ...(await findReceipts(join(out, 'node'))),
    ...(await findReceipts(join(out, 'browser-results'))),
  ];
  if (rows.some((row) => row.actualSite !== currentCandidate.path))
    throw new Error('coverage measurement actual site differs');
  const result = mergeMeasurements(inventory, rows);
  await save(join(out, 'coverage-final.json'), result.map.toJSON());
  await save(join(out, 'report.json'), {
    generation: inventory.generation,
    sourceIdentity: inventory.sourceIdentity,
    digests: inventory.digests,
    candidate: inventory.candidate,
    files: result.files,
    lines: result.lines,
    passed: result.passed,
    realms: rows.map(({ coverage: _coverage, ...identity }) => identity),
    fixedInventory: FILES,
    ci: 'Unverified; U4 must run combined fixed17 inventory before integration.',
    worker:
      'U2 resolver executes in host only; U1 Worker evidence remains separately required.',
  });
  if (!result.passed)
    throw new Error(`coverage below unchanged 80% floor: ${result.lines.pct}%`);
  return {
    lines: result.lines,
    files: result.files,
    sourceIdentity: inventory.sourceIdentity,
    passed: result.passed,
  };
}

async function selfTest() {
  const instrumenter = createInstrumenter({ esModules: true });
  const metadata = FILES.map((path) => {
    instrumenter.instrumentSync('export function unused(){return 1;}\n', path);
    return instrumenter.lastFileCoverage();
  });
  const inventory = {
    generation: 'regression-generation-current',
    sourceIdentity: '2'.repeat(64),
    candidate: { sha256: '3'.repeat(64) },
    files: FILES,
    metadata,
    digests: metadata.map((file) => ({
      path: file.path,
      sourceSha256: '0'.repeat(64),
      instrumentedSha256: '1'.repeat(64),
      statementMapSha256: hash(JSON.stringify(file.statementMap)),
    })),
  };
  const rows: Measurement[] = NODE_TESTS.map((testFile) => ({
    generation: inventory.generation,
    sourceIdentity: inventory.sourceIdentity,
    candidateSha256: inventory.candidate.sha256,
    realm: 'node-host',
    testFile,
    exitCode: 0,
    coverage: {},
  }));
  for (const project of PROJECTS)
    for (const title of TITLES)
      rows.push({
        generation: inventory.generation,
        sourceIdentity: inventory.sourceIdentity,
        candidateSha256: inventory.candidate.sha256,
        realm: 'browser-host',
        project,
        title,
        status: 'passed',
        expectedStatus: 'passed',
        coverage: {},
      });
  const zero = mergeMeasurements(inventory, rows);
  assert.equal(zero.lines.pct, 0);
  assert.equal(zero.files.length, 3);
  assert.equal(zero.passed, false);
  assert.throws(
    () => mergeMeasurements(inventory, rows.slice(0, -1)),
    /missing.*browser/,
  );
  assert.throws(
    () => mergeMeasurements(inventory, rows.slice(1)),
    /Node file realm/,
  );
  assert.throws(
    () => mergeMeasurements(inventory, [...rows, rows[0]!]),
    /Node file realm/,
  );
  const changed = structuredClone(rows);
  changed[NODE_TESTS.length]!.status = 'skipped';
  assert.throws(() => mergeMeasurements(inventory, changed), /unsuccessful/);
  for (const field of ['metadata', 'digests'] as const) {
    const missing = structuredClone(inventory);
    missing[field].pop();
    assert.throws(() => mergeMeasurements(missing, rows), /fixed path set/);
    const duplicate = structuredClone(inventory);
    duplicate[field][1] = structuredClone(duplicate[field][0]!);
    assert.throws(() => mergeMeasurements(duplicate, rows), /fixed path set/);
  }
  const nonzero = structuredClone(inventory);
  nonzero.metadata[0]!.s[Object.keys(nonzero.metadata[0]!.s)[0]!] = 1;
  assert.throws(() => mergeMeasurements(nonzero, rows), /only zero counters/);
  // A matching statement map alone cannot certify a different preparation.
  for (const field of [
    'generation',
    'sourceIdentity',
    'candidateSha256',
  ] as const) {
    for (const realmIndex of [0, NODE_TESTS.length]) {
      const stale = structuredClone(rows);
      stale[realmIndex]![field] = 'stale-identity';
      assert.throws(
        () => mergeMeasurements(inventory, stale),
        /identity|generation|candidate|binding/,
        `stale ${field} in ${stale[realmIndex]!.realm} must be refused`,
      );
      const missing = structuredClone(rows);
      delete missing[realmIndex]![field];
      assert.throws(
        () => mergeMeasurements(inventory, missing),
        /identity|generation|candidate|binding/,
        `missing ${field} must not adopt old receipts`,
      );
    }
  }
  const directory = await mkdtemp(join(tmpdir(), 'u2-coverage-regression-'));
  const priorSite = process.env.U2_ACTUAL_SITE;
  try {
    const site = join(directory, 'site');
    await mkdir(join(site, 'dist'), { recursive: true });
    await save(join(site, 'tools.json'), { aube: { default: 'main' } });
    await save(join(site, 'dist/builds.json'), { builds: {} });
    process.env.U2_ACTUAL_SITE = site;
    const used = join(directory, 'measurement');
    await prepareCoverage(used);
    assert.deepEqual(
      await readFile(join(used, 'workspace/tests/shared/assertions.js')),
      await readFile(join(root, 'tests/shared/assertions.js')),
      'instrumented tests retain their compiled shared dependency',
    );
    await save(join(used, 'node/node-1.json'), rows[0]);
    const originalInventory = await readFile(join(used, 'inventory.json'));
    await writeFile(join(site, 'changed-candidate'), 'new bytes');
    await assert.rejects(
      prepareCoverage(used),
      /exist|used|fresh|prepar/,
      're-preparing after candidate change must not retain old receipts',
    );
    assert.deepEqual(
      await readFile(join(used, 'inventory.json')),
      originalInventory,
    );
    await assert.rejects(reportCoverage(used), /candidate.*changed|identity/);
  } finally {
    if (priorSite === undefined) delete process.env.U2_ACTUAL_SITE;
    else process.env.U2_ACTUAL_SITE = priorSite;
    await rm(directory, { recursive: true, force: true });
  }
  console.log(
    'coverage self-test: 3 never-imported files retained at 0%; missing Node/browser case and skipped case refused',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [command, output, ...extra] = process.argv.slice(2);
  if (extra.length)
    throw new Error('usage: coverage.js prepare|report <output> | self-test');
  if (command === 'self-test') await selfTest();
  else if (command === 'prepare' && output)
    console.log(JSON.stringify(await prepareCoverage(output)));
  else if (command === 'report' && output)
    console.log(JSON.stringify(await reportCoverage(output)));
  else
    throw new Error('usage: coverage.js prepare|report <output> | self-test');
}
