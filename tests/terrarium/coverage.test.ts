import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { createInstrumenter } from 'istanbul-lib-instrument';
import type { Measurement } from '../../scripts/coverage-types.js';
import {
  BROWSER_TITLES,
  CURRENT_U1_REALMS,
  componentImport,
  copyCoverageDependencies,
  executionVerifierSource,
  FILES,
  finalizeNodeMeasurement,
  HISTORICAL_U1_JS,
  mergeMeasurements,
  nodePreloadSource,
  prepareCoverage,
  REQUIRED_U1_REALMS,
  reportCoverage,
  sealCoverage,
} from '../../scripts/terrarium/coverage.js';
import { directoryIdentity, sha256 } from '../../scripts/terrarium/evidence.js';

const _require = createRequire(import.meta.url);

/** Dedicated complete report fixture: original assets/maps stay immutable. */
async function reportFixture(
  t: TestContext,
  beforeSeal?: (out: string, base: string) => Promise<void>,
) {
  const base = await realpath(
    await mkdtemp(join(tmpdir(), 'u4-copy-binding-')),
  );
  t.after(() => rm(base, { recursive: true, force: true }));
  const out = join(base, 'out');
  const originalSite = join(base, 'original-site');
  await mkdir(originalSite);
  await writeFile(join(originalSite, 'asset'), 'original candidate');
  await mkdir(join(out, 'receipts'), { recursive: true });
  await mkdir(join(out, 'browser-results'));
  const f = fixture();
  const digests = [];
  for (const row of f.inventory.digests) {
    const original = join(base, 'original-source', row.path);
    await mkdir(dirname(original), { recursive: true });
    const source = 'export function unused(){return 1;}\n';
    await writeFile(original, source);
    digests.push({ ...row, original, sourceSha256: sha256(source) });
  }
  const candidate = await directoryIdentity(originalSite);
  const reportPath = join(base, 'u1-coverage-v11', 'coverage-report.json');
  await mkdir(dirname(reportPath));
  const component = {
    candidateSha256: f.inventory.tarballSha256,
    threshold: 80,
    passed: true,
    realmNames: [...REQUIRED_U1_REALMS],
    digests: digests.slice(0, 14),
    files: f.inventory.metadata.slice(0, 14).map((file) => ({
      path: file.path,
      lines: Object.fromEntries(
        Object.values(file.statementMap).map((statement) => [
          String(statement.start.line),
          1,
        ]),
      ),
    })),
  };
  const componentBytes = JSON.stringify(component);
  await writeFile(reportPath, componentBytes);
  const inventory = {
    ...f.inventory,
    digests,
    sourceIdentity: sha256(JSON.stringify(digests)),
    candidate,
    u1Report: reportPath,
    u1ReportSha256: sha256(componentBytes),
  };
  await writeFile(join(out, 'inventory.json'), JSON.stringify(inventory));
  const module = join(
    out,
    'terrarium/packages/terrarium/src/formicarium/session.ts',
  );
  const bundle = join(out, 'site/web/terrarium.mjs');
  await mkdir(dirname(module), { recursive: true });
  await mkdir(dirname(bundle), { recursive: true });
  await writeFile(module, 'export const instrumented = 1;');
  await writeFile(bundle, 'export const bundled = 1;');
  await writeFile(join(out, 'node-preload.mjs'), 'fixture preload');
  await writeFile(join(out, 'execution-verifier.mjs'), executionVerifierSource);
  await beforeSeal?.(out, base);
  const { executionIdentity } = await sealCoverage(out);
  const coverage = Object.fromEntries(
    f.inventory.metadata.map((file) => {
      const measured = structuredClone(file);
      for (const key of Object.keys(measured.s)) measured.s[key] = 1;
      return [file.path, measured];
    }),
  );
  for (const [index, row] of f.rows.entries()) {
    const receipt = {
      ...row,
      executionIdentity,
      sourceIdentity: inventory.sourceIdentity,
      candidateSha256: candidate.sha256,
      coverage: index === 0 ? coverage : {},
    };
    const directory =
      index === 0
        ? join(out, 'receipts')
        : join(out, 'browser-results', String(index));
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, index === 0 ? 'node.json' : 'coverage-realms.json'),
      JSON.stringify(receipt),
    );
  }
  return { out, module, bundle };
}

test('owned dependency copy resolves external members, isolates source mutation and seals copied bytes', async (t) => {
  let external = '',
    measured = '';
  const f = await reportFixture(t, async (out, base) => {
    const source = join(base, 'dependencies');
    external = join(base, 'external-package/index.js');
    await mkdir(dirname(external), { recursive: true });
    await writeFile(external, 'export const dependency = 1;');
    await mkdir(join(source, '@scope'), { recursive: true });
    await symlink(dirname(external), join(source, '@scope/member'));
    const destination = join(out, 'terrarium/packages/terrarium/node_modules');
    const copied = await copyCoverageDependencies(source, destination);
    measured = join(destination, '@scope/member/index.js');
    assert.equal(copied.files.length, 1);
    assert.equal(await realpath(measured), measured);
    await assert.rejects(
      copyCoverageDependencies(source, destination),
      /EEXIST/,
    );
  });
  assert.equal((await reportCoverage(f.out)).passed, true);
  await writeFile(external, 'export const dependency = 2;');
  assert.equal(
    await readFile(measured, 'utf8'),
    'export const dependency = 1;',
  );
  assert.equal((await reportCoverage(f.out)).passed, true);
  await writeFile(measured, 'export const dependency = 3;');
  await assert.rejects(
    reportCoverage(f.out),
    /execution seal bytes or inventory changed/,
  );
});
test('dependency copy rejects cycles before creating an output', async (t) => {
  const base = await realpath(
    await mkdtemp(join(tmpdir(), 'u3-dependency-cycle-')),
  );
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'),
    target = join(base, 'copied');
  await mkdir(source);
  await symlink(source, join(source, 'cycle'));
  await assert.rejects(
    copyCoverageDependencies(source, target),
    /dependency symlink cycle/,
  );
  await assert.rejects(realpath(target), /ENOENT/);
});

test('report refuses instrumented module-only tampering with original sources and statement maps intact', async (t) => {
  const f = await reportFixture(t);
  await writeFile(f.module, 'export const instrumented = 2;');
  await assert.rejects(
    reportCoverage(f.out),
    /execution|seal|instrumented.*changed/i,
  );
});
test('report refuses final browser bundle-only tampering with original candidate intact', async (t) => {
  const f = await reportFixture(t);
  await writeFile(f.bundle, 'export const bundled = 2;');
  await assert.rejects(
    reportCoverage(f.out),
    /execution|seal|bundle.*changed/i,
  );
});
test('report refuses measured-copy drift after a successful complete report', async (t) => {
  const f = await reportFixture(t);
  const before = await reportCoverage(f.out);
  assert.equal(
    before.passed,
    true,
    'fixture must reach the full successful report path',
  );
  await writeFile(f.module, 'export const instrumented = 2;');
  await assert.rejects(
    reportCoverage(f.out),
    /execution|seal|instrumented.*changed/i,
  );
});
test('normal seal rejects resealing and missing seal or stale execution receipts', async (t) => {
  const f = await reportFixture(t);
  assert.equal((await reportCoverage(f.out)).passed, true);
  await assert.rejects(sealCoverage(f.out), { code: 'EEXIST' });
  const nodePath = join(f.out, 'receipts/node.json');
  const receipt = JSON.parse(await readFile(nodePath, 'utf8'));
  receipt.executionIdentity = 'old-execution';
  await writeFile(nodePath, JSON.stringify(receipt));
  await assert.rejects(reportCoverage(f.out), /execution receipt/);
  await rm(join(f.out, 'execution-seal.json'));
  await assert.rejects(reportCoverage(f.out), /ENOENT/);
});
test('sealed execution rejects additions omissions kind changes and escaping links', async (t) => {
  for (const mutation of ['extra', 'missing', 'kind', 'link']) {
    const f = await reportFixture(t);
    if (mutation === 'extra')
      await writeFile(join(dirname(f.module), 'extra.ts'), 'extra');
    else {
      await rm(f.module);
      if (mutation === 'kind') await mkdir(f.module);
      if (mutation === 'link')
        await symlink(join(f.out, 'inventory.json'), f.module);
    }
    await assert.rejects(
      reportCoverage(f.out),
      /execution seal|execution escaping symlink/,
    );
  }
});

function fixture() {
  const metadata = FILES.map((path) => {
    const instrumenter = createInstrumenter({ esModules: true });
    instrumenter.instrumentSync('export function unused(){return 1;}\n', path);
    return instrumenter.lastFileCoverage();
  });
  const digests = metadata.map((file) => ({
    path: file.path,
    sourceSha256: 'a'.repeat(64),
    statementMapSha256: sha256(JSON.stringify(file.statementMap)),
  }));
  const inventory = {
    files: [...FILES],
    generation: 'fresh-generation',
    digests,
    metadata,
    sourceIdentity: sha256(JSON.stringify(digests)),
    candidate: { sha256: 'b'.repeat(64) },
    tarballSha256: 'c'.repeat(64),
  };
  const bind = {
    generation: inventory.generation,
    sourceIdentity: inventory.sourceIdentity,
    candidateSha256: inventory.candidate.sha256,
  };
  const rows: Measurement[] = [
    { ...bind, realm: 'node-host', status: 'passed', coverage: {} },
  ];
  for (const project of ['chromium', 'firefox', 'webkit'])
    for (const title of BROWSER_TITLES)
      rows.push({
        ...bind,
        realm: 'browser-host',
        project,
        title,
        status: 'passed',
        expectedStatus: 'passed',
        coverage: {},
      });
  return {
    inventory,
    rows,
    component: { kind: 'immutable-component-import', coverage: {} },
  };
}
test('fixed24 preserves U1 fourteen U2 three and all seven U3 modules; never imported files stay zero', () => {
  const f = fixture(),
    result = mergeMeasurements(f.inventory, f.rows, f.component);
  assert.equal(FILES.length, 24);
  assert.equal(result.files.length, 24);
  assert.equal(result.lines.pct, 0);
  assert.equal(result.passed, false);
});
test('old generation receipts are refused even when source and statement layout are identical', () => {
  const f = fixture();
  f.rows[0].generation = 'old-generation';
  assert.throws(
    () => mergeMeasurements(f.inventory, f.rows, f.component),
    /stale generation/,
  );
});
test('same-length source or candidate replacement invalidates old receipts', () => {
  for (const field of ['sourceIdentity', 'candidateSha256'] as const) {
    const f = fixture();
    f.rows[0][field] = 'd'.repeat(64);
    assert.throws(
      () => mergeMeasurements(f.inventory, f.rows, f.component),
      /stale generation/,
    );
  }
});
test('missing node/browser or skipped measurement fails closed', () => {
  const f = fixture();
  assert.throws(
    () => mergeMeasurements(f.inventory, f.rows.slice(1), f.component),
    /Node realm/,
  );
  assert.throws(
    () => mergeMeasurements(f.inventory, f.rows.slice(0, -1), f.component),
    /browser realm/,
  );
  f.rows[1].status = 'skipped';
  assert.throws(
    () => mergeMeasurements(f.inventory, f.rows, f.component),
    /skipped/,
  );
});
test('duplicate realms inventory shrink and nonzero seed are rejected', () => {
  const f = fixture();
  assert.throws(
    () => mergeMeasurements(f.inventory, [...f.rows, f.rows[0]], f.component),
    /duplicate/,
  );
  const smaller = structuredClone(f.inventory);
  smaller.files.pop();
  assert.throws(
    () => mergeMeasurements(smaller, f.rows, f.component),
    /inventory/,
  );
  const dirty = structuredClone(f.inventory);
  dirty.metadata[0].s['0'] = 1;
  assert.throws(() => mergeMeasurements(dirty, f.rows, f.component), /nonzero/);
});
test('missing Worker component import and altered statement map fail', () => {
  const f = fixture();
  assert.throws(
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    () => mergeMeasurements(f.inventory, f.rows),
    /Worker component/,
  );
  const file = structuredClone(f.inventory.metadata[0]);
  file.statementMap['0'].start.line = 999;
  f.rows[0].coverage = { [file.path]: file };
  assert.throws(
    () => mergeMeasurements(f.inventory, f.rows, f.component),
    /source map/,
  );
});
test('re-prepare refuses existing measurement output before touching a receipt', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'u3-generation-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  await writeFile(join(out, 'old-receipt.json'), 'preserve');
  // @ts-expect-error Deliberately malformed input exercises the runtime guard.
  await assert.rejects(prepareCoverage({ out }), { code: 'EEXIST' });
});
test('immutable U1 import preserves original realm names and rejects wrong pack/source/missing realm', () => {
  const f = fixture();
  const runtime = f.inventory.metadata.slice(0, 14);
  const report = {
    candidateSha256: f.inventory.tarballSha256,
    threshold: 80,
    passed: true,
    realmNames: [...REQUIRED_U1_REALMS],
    digests: f.inventory.digests.slice(0, 14),
    files: runtime.map((file) => ({
      path: file.path,
      lines: Object.fromEntries(
        Object.values(file.statementMap).map((statement) => [
          String(statement.start.line),
          1,
        ]),
      ),
    })),
  };
  const imported = componentImport(
    { ...f.inventory, u1Report: '/record/u1-coverage-v9/coverage-report.json' },
    report,
    'e'.repeat(64),
  );
  assert.equal(imported.kind, 'immutable-component-import');
  assert.equal(imported.originalGeneration, 'u1-coverage-v9');
  assert.equal(
    componentImport(
      {
        ...f.inventory,
        u1Report: '/record/u1-coverage-v11/coverage-report.json',
      },
      report,
      'e'.repeat(64),
    ).originalGeneration,
    'u1-coverage-v11',
    'original generation follows the bound report, not a collector constant',
  );
  assert.deepEqual(imported.originalRealmNames, report.realmNames);
  const historicalU2Sixteen = structuredClone(report);
  for (const path of [
    'runtime/guest-validation.js',
    'runtime/session-port.js',
  ]) {
    historicalU2Sixteen.files.push({ ...report.files[0], path });
    historicalU2Sixteen.digests.push({ ...report.digests[0], path });
  }
  assert.throws(
    () => componentImport(f.inventory, historicalU2Sixteen, 'e'.repeat(64)),
    /denominator/,
    'historical U2 sixteen-file distribution is not historical fourteen-file proof',
  );
  const currentTwentyThree = structuredClone(historicalU2Sixteen);
  for (const name of [
    'install-catalog',
    'install-transfer',
    'install-archive',
    'install-lifecycle',
    'install',
    'command-parse',
    'command',
  ]) {
    const path = `runtime/${name}.js`;
    currentTwentyThree.files.push({ ...report.files[0], path });
    currentTwentyThree.digests.push({ ...report.digests[0], path });
  }
  assert.equal(currentTwentyThree.files.length, 23);
  assert.throws(
    () => componentImport(f.inventory, currentTwentyThree, 'e'.repeat(64)),
    /planned realm inventory/,
    'a current-generation report must also carry the migration Node Worker realm',
  );
  currentTwentyThree.realmNames = [...CURRENT_U1_REALMS];
  assert.throws(
    () => componentImport(f.inventory, currentTwentyThree, 'e'.repeat(64)),
    /planned realm inventory/,
    'a current-generation report must carry its Playwright runner realms',
  );
  currentTwentyThree.realmNames.push('playwright:package:4242');
  const sameGeneration = componentImport(
    {
      ...f.inventory,
      u1Report: '/record/u1-coverage-v11/coverage-report.json',
    },
    currentTwentyThree,
    'e'.repeat(64),
  );
  assert.deepEqual(
    Object.keys(sameGeneration.coverage).sort(),
    [...HISTORICAL_U1_JS].sort(),
    'only the historical fourteen files are imported from the same generation',
  );
  assert.deepEqual(sameGeneration.originalRealmNames, [
    ...CURRENT_U1_REALMS,
    'playwright:package:4242',
  ]);
  const historicalWithRunner = structuredClone(report);
  historicalWithRunner.realmNames.push('playwright:package:4242');
  assert.throws(
    () => componentImport(f.inventory, historicalWithRunner, 'e'.repeat(64)),
    /planned realm inventory/,
    'a historical fourteen-file report never carries runner realms',
  );
  const historicalWithMigrationRealm = structuredClone(report);
  historicalWithMigrationRealm.realmNames = [...CURRENT_U1_REALMS];
  assert.throws(
    () =>
      componentImport(
        f.inventory,
        historicalWithMigrationRealm,
        'e'.repeat(64),
      ),
    /planned realm inventory/,
    'a historical fourteen-file report never carries the migration realm',
  );
  const changedSource = structuredClone(currentTwentyThree);
  changedSource.digests[0] = {
    ...changedSource.digests[0],
    sourceSha256: 'f'.repeat(64),
  };
  assert.throws(
    () =>
      componentImport(
        {
          ...f.inventory,
          u1Report: '/record/u1-coverage-v11/coverage-report.json',
        },
        changedSource,
        'e'.repeat(64),
      ),
    /source changed/,
    'a same-generation report with differing historical source is rejected',
  );
  for (const path of [
    'runtime/guest-validation.js',
    'runtime/session-port.js',
  ]) {
    const newModule = structuredClone(report);
    newModule.files[0].path = path;
    newModule.digests[0].path = path;
    assert.throws(
      () => componentImport(f.inventory, newModule, 'e'.repeat(64)),
      /denominator/,
      'current U2 modules cannot inherit historical U1 component proof',
    );
  }
  assert.throws(
    () => componentImport(f.inventory, report, 'e'.repeat(64)),
    /original report path/,
  );
  assert.throws(
    () =>
      componentImport(
        { ...f.inventory, u1Report: 'u1-coverage-v11/coverage-report.json' },
        report,
        'e'.repeat(64),
      ),
    /original report path/,
  );
  assert.throws(
    () => componentImport(f.inventory, report, 'e'.repeat(64)),
    /original report path/,
  );
  assert.throws(
    () =>
      componentImport(
        { ...f.inventory, u1Report: 'u1-coverage-v11/coverage-report.json' },
        report,
        'e'.repeat(64),
      ),
    /original report path/,
  );
  assert.throws(
    () =>
      componentImport(f.inventory, { ...report, candidateSha256: 'wrong' }, ''),
    /identity/,
  );
  assert.throws(
    () =>
      componentImport(
        f.inventory,
        { ...report, realmNames: report.realmNames.slice(0, -1) },
        '',
      ),
    /realm inventory/,
  );
  const changed = structuredClone(report);
  changed.digests[0].sourceSha256 = 'wrong';
  assert.throws(
    () => componentImport(f.inventory, changed, ''),
    /source changed/,
  );
});

test('node raw hook requires fresh attempt and parent observed exit', () => {
  const { inventory } = fixture();
  const raw = {
    generation: inventory.generation,
    sourceIdentity: inventory.sourceIdentity,
    candidateSha256: inventory.candidate.sha256,
    attempt: 'fresh',
    realm: 'node-host',
    coverage: {},
  };
  assert.throws(
    // @ts-expect-error Deliberately malformed input exercises the runtime guard.
    () => finalizeNodeMeasurement(inventory, undefined, 'fresh', 0),
    /raw hook/,
  );
  assert.throws(
    () => finalizeNodeMeasurement(inventory, raw, 'old', 0),
    /binding/,
  );
  assert.throws(
    () => finalizeNodeMeasurement(inventory, raw, 'fresh', null),
    /observed/,
  );
  assert.equal(
    finalizeNodeMeasurement(inventory, raw, 'fresh', 1).status,
    'failed',
  );
  assert.equal(
    finalizeNodeMeasurement(inventory, raw, 'fresh', 0).status,
    'passed',
  );
  const hook = nodePreloadSource(inventory, '/tmp/current-generation');
  assert.match(hook, /import \{afterAll\} from 'bun:test'/);
  assert.doesNotMatch(hook, /status:|process.on\('exit'/);
});
