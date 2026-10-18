import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { INSTALL_REALMS } from '../../scripts/migration-install/coverage.js';
import {
  acquireCurrentLock,
  assertActualSite,
  assertCurrentCoverage,
  assertCurrentIdentity,
  assertCurrentToolchainEvidence,
  assertPassingTestOutput,
  assertSeals,
  CURRENT_PENDING,
  type CurrentCompletionInput,
  currentCompletionCommands,
  executeCurrentSequence,
  prepareActualSite,
  prepareCurrentInput,
  verifyCurrentCompletion,
  writeCurrentPreparedInput,
} from '../../scripts/migration-preflight/current-completion.js';
import { verifyCurrentRawCoverage } from '../../scripts/migration-preflight/current-coverage.js';
import {
  instrumentPackage,
  reportCoverage,
} from '../../scripts/package/coverage.js';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
  sha256,
} from '../../scripts/package/stage-package.js';

/** Synthetic maps test reconciliation only; no retained product/CI result is imported. */
async function withPlaywrightRawFixture(
  run: (
    out: string,
    candidate: { files: { path: string; sha256: string }[] },
  ) => Promise<void>,
) {
  await scratch(async (root) => {
    const source = resolve(root, 'source'),
      out = resolve(root, 'coverage');
    const files: { path: string; sha256: string }[] = [];
    for (const path of PACKAGE_FILES) {
      const bytes = FIRST_PARTY_JS.includes(path)
        ? 'export const imported = 1;'
        : path === 'package.json'
          ? '{"type":"module"}'
          : '';
      const target = resolve(source, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      files.push({ path, sha256: sha256(bytes) });
    }
    const { layout } = await instrumentPackage({ source, out });
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    for (const suite of ['package', 'session', 'install']) {
      const entry = resolve(out, `entry-${suite}.mjs`);
      await writeFile(
        entry,
        `import './coverage-playwright-node-${suite}.mjs';\n` +
          FIRST_PARTY_JS.map((path) => `import './${path}';`).join('\n'),
      );
      const child = spawn(process.execPath, [entry], {
        env,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (text) => {
        stderr += text;
      });
      const [code, signal] = await once(child, 'close');
      assert.equal(signal, null, stderr);
      assert.equal(code, 0, stderr);
    }
    const last = layout.at(-1)!;
    const size = last.offset + last.keys.length;
    // Planned host/Worker/browser fixtures deliberately have no statement hits.
    // Only the real generated Node child imports above make line coverage pass.
    const row = (name: string) => ({
      name,
      counts: [1, ...Array<number>(size - 1).fill(0)],
    });
    const inventory = JSON.parse(
      await readFile(
        resolve('scripts/package/coverage-inventory.json'),
        'utf8',
      ),
    );
    await writeFile(
      resolve(out, 'coverage-node.json'),
      JSON.stringify([
        row('node-host'),
        ...Array.from({ length: inventory.node.workers }, (_, index) =>
          row(`node-worker-${index + 1}`),
        ),
      ]),
    );
    await writeFile(
      resolve(out, 'coverage-session-node.json'),
      JSON.stringify([
        row('node-host'),
        ...Array.from({ length: INSTALL_REALMS.nodeWorkers }, (_, index) =>
          row(`node-worker-${index + 1}`),
        ),
      ]),
    );
    const cases: Record<string, number> = {
      ...inventory.browserCases,
      ...INSTALL_REALMS.browserCases,
    };
    let index = 0;
    for (const project of ['chromium', 'firefox', 'webkit'])
      for (const [title, workers] of Object.entries(cases)) {
        const folder = resolve(out, 'browser-results', `fixture-${index++}`);
        await mkdir(folder, { recursive: true });
        await writeFile(
          resolve(folder, 'coverage-realms.json'),
          JSON.stringify({
            project,
            title,
            rows: [
              row('browser-host'),
              ...Array.from({ length: workers }, (_, worker) =>
                row(`browser-worker-${worker + 1}`),
              ),
            ],
          }),
        );
      }
    const candidate = { files, tarball: { sha256: digest } };
    const candidatePath = resolve(root, 'candidate.json');
    await writeFile(candidatePath, JSON.stringify(candidate));
    const report = await reportCoverage({
      out,
      browserResults: resolve(out, 'browser-results'),
      candidatePath,
      session: INSTALL_REALMS,
      runnerSuites: ['package', 'session', 'install'],
    });
    assert.equal(report.lines.pct, 100);
    assert.equal(
      report.realmNames.filter((name) => name.startsWith('playwright:')).length,
      3,
    );
    await run(out, candidate);
  });
}

const digest = 'a'.repeat(64);
function fixture(): CurrentCompletionInput {
  const currentSource = [{ path: '/fixture/source.js', sha256: digest }];
  return {
    schemaVersion: 1,
    kind: 'current-completed-units-input',
    root: '/fixture',
    candidate: { path: '/fixture/candidate.json', sha256: digest },
    sourceIdentity: digest,
    packSha256: digest,
    currentSource,
    currentSourceIdentity: sha256(JSON.stringify(currentSource)),
    consumer: '/independent',
    guest: { path: '/fixture/aube', sha256: digest },
    actualSite: {
      path: '/fixture/site',
      files: [{ path: '/fixture/site/manifest.json', sha256: digest }],
      sha256: digest,
    },
    preflight: {
      trialsDirectory: '/fixture/attempt/trials',
      browserLog: { path: '/fixture/attempt.log', sha256: digest },
      inventory: { path: '/fixture/mirror-input.json', sha256: digest },
      baselineDirectory: '/fixture/baseline',
      ciRun: { path: '/fixture/ci-run.json', sha256: digest },
      files: [{ path: '/fixture/attempt.log', sha256: digest }],
    },
  };
}
function coverage() {
  return {
    passed: true,
    threshold: 80,
    candidateSha256: digest,
    lines: {
      total: FIRST_PARTY_JS.length,
      covered: FIRST_PARTY_JS.length,
      skipped: 0,
      pct: 100,
    },
    files: FIRST_PARTY_JS.map((path) => ({ path, lines: { '1': 1 } })),
  };
}
async function scratch(run: (root: string) => Promise<void>) {
  const parent = resolve(
    '.artifacts/migration-preflight/current-completion-tests',
  );
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'case-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('current command scope retains public API, U1, U2, real installed/Worker consumers and probe/aube regressions without U3 acceptance', () => {
  const commands = currentCompletionCommands(
    '/fixture',
    '/fixture/coverage',
    fixture(),
  );
  const text = JSON.stringify(commands);
  for (const required of [
    'migration-preflight-unit',
    'migration-session-unit',
    'migration-session-browser',
    'migration-install-unit',
    'migration-install-browser',
    'test-consumer',
    'tests/node/probe.test.js',
    'tests/node/aube-1645.test.js',
    'tests/browser/probe.spec.ts',
    'tests/browser/aube-1645.spec.ts',
    'coverage-session-node-preload.mjs',
  ])
    assert.ok(text.includes(required), required);
  assert.ok(!text.includes('--retained-evidence'));
  for (const command of commands.filter((row) => row.executable !== 'mise'))
    assert.equal(command.executable, process.execPath);
  assert.ok(!text.includes('measure.js'));
  for (const command of commands.filter(
    (row) => row.args.includes('test') && row.executable !== 'mise',
  )) {
    assert.ok(command.args.includes('--workers=1'));
    assert.ok(command.args.includes('--retries=0'));
  }
  assert.equal(commands.at(-1)!.args.at(-1), fixture().candidate.path);
});
test('real distribution site input is mandatory and cannot seal missing or empty directories', async () =>
  scratch(async (root) => {
    await assert.rejects(
      prepareActualSite(root, undefined),
      /U2_ACTUAL_SITE required/,
    );
    await assert.rejects(
      prepareActualSite(root, ''),
      /U2_ACTUAL_SITE required/,
    );
    await assert.rejects(
      prepareActualSite(root, resolve(root, 'missing')),
      /ENOENT/,
    );
    await assert.rejects(prepareActualSite(root, root), /nonempty/);
    await assert.rejects(assertActualSite(root, undefined), /missing/);
  }));
test('real distribution sealing includes nested files and detects altered bytes, omitted files and added files', async () =>
  scratch(async (root) => {
    await mkdir(resolve(root, 'assets'));
    const path = resolve(root, 'assets/guest.elf');
    await writeFile(path, 'fixed real fixture bytes');
    await writeFile(resolve(root, 'manifest.json'), '{"version":1}');
    const site = await prepareActualSite(root, root);
    assert.equal(site.files.length, 2);
    assert.equal(site.sha256, sha256(JSON.stringify(site.files)));
    await assertActualSite(root, site);
    await writeFile(path, 'changed');
    await assert.rejects(assertActualSite(root, site), /changed/);
    await writeFile(path, 'fixed real fixture bytes');
    await writeFile(resolve(root, 'unexpected.json'), '{}');
    await assert.rejects(assertActualSite(root, site), /inventory changed/);
    await rm(resolve(root, 'unexpected.json'));
    await rm(path);
    await assert.rejects(assertActualSite(root, site), /ENOENT/);
  }));
test('all current distributed JS including new install paths stay in the coverage denominator', () => {
  const report = coverage();
  assert.equal(report.files.length, 23);
  assert.ok(report.files.some((row) => row.path === 'runtime/command.js'));
  assert.doesNotThrow(() => assertCurrentCoverage(report, fixture()));
  report.files = report.files.filter((row) => !row.path.includes('install'));
  assert.throws(
    () => assertCurrentCoverage(report, fixture()),
    /whole-distribution/,
  );
});
test('current identity rejects altered source inventory, candidate source and tarball independently', () => {
  const input = fixture();
  const candidate = { sourceIdentity: digest, tarball: { sha256: digest } };
  assert.doesNotThrow(() =>
    assertCurrentIdentity(input, candidate, input.currentSource),
  );
  assert.throws(() =>
    assertCurrentIdentity(
      input,
      { ...candidate, sourceIdentity: 'b'.repeat(64) },
      input.currentSource,
    ),
  );
  assert.throws(() =>
    assertCurrentIdentity(
      input,
      { ...candidate, tarball: { sha256: 'b'.repeat(64) } },
      input.currentSource,
    ),
  );
  assert.throws(() =>
    assertCurrentIdentity(input, candidate, [
      { ...input.currentSource[0]!, sha256: 'b'.repeat(64) },
    ]),
  );
});
test('raw immutable prerequisite must exist, remain unchanged and cannot have duplicate paths', async () =>
  scratch(async (root) => {
    const path = resolve(root, 'proof.json');
    await writeFile(path, 'real bytes');
    const row = { path, sha256: sha256(await readFile(path)) };
    await assertSeals([row]);
    await assert.rejects(assertSeals([row, row]), /duplicate/);
    await writeFile(path, 'altered bytes');
    await assert.rejects(assertSeals([row]), /changed/);
    await rm(path);
    await assert.rejects(assertSeals([row]), /ENOENT/);
  }));
test('preflight acceptance evidence must come from the current Node, never an older toolchain', () => {
  assert.doesNotThrow(() =>
    assertCurrentToolchainEvidence({ environment: { node: process.version } }),
  );
  for (const node of ['v24.21.0', undefined, '', 'v26'])
    assert.throws(
      () => assertCurrentToolchainEvidence({ environment: { node } }),
      /current Node/,
    );
  assert.throws(() => assertCurrentToolchainEvidence({}), /current Node/);
});
test('report pending lists only the work that is still open', () => {
  assert.ok(CURRENT_PENDING.length > 0);
  assert.ok(CURRENT_PENDING.every((item) => !/\bU3\b/.test(item)));
  assert.ok(
    CURRENT_PENDING.includes('current same-source signed CI before merge'),
  );
});
test('child failure prevents every later required command without automatic retry', async () => {
  const commands = currentCompletionCommands(
    '/fixture',
    '/fixture/coverage',
    fixture(),
  );
  const calls: number[] = [];
  await assert.rejects(
    executeCurrentSequence(commands, async (_command, index) => {
      calls.push(index);
      if (index === 2) throw Error('actual child failure');
      return { synthetic: true };
    }),
    /actual child failure/,
  );
  assert.deepEqual(calls, [0, 1, 2]);
});
test('synthetic success sequencing returns fixture observations only, never an accepted proof', async () => {
  const result = await executeCurrentSequence(
    currentCompletionCommands('/fixture', '/fixture/coverage', fixture()),
    async () => ({ synthetic: true }),
  );
  assert.ok(result.every((row) => row.synthetic));
  assert.ok(
    result.every(
      (row) =>
        !Object.hasOwn(row, 'verified') &&
        !Object.hasOwn(row, 'acceptancePassed'),
    ),
  );
});
test('duplicate lock fails and cannot delete the existing owner lock', async () =>
  scratch(async (root) => {
    const release = await acquireCurrentLock(root);
    await assert.rejects(acquireCurrentLock(root), /EEXIST/);
    assert.equal(
      await readFile(
        resolve(root, '.artifacts/migration-preflight/current-completion.lock'),
        'utf8',
      ),
      '',
    );
    await release();
    const next = await acquireCurrentLock(root);
    await next();
  }));
test('positive real test summary is required; zero, skipped, cancelled, failed and empty runs fail closed', () => {
  const tap = '# pass 55\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.doesNotThrow(() => assertPassingTestOutput(tap));
  assert.doesNotThrow(() => assertPassingTestOutput('  9 passed (38.9s)\n'));
  for (const raw of [
    '',
    tap.replace('pass 55', 'pass 0'),
    tap.replace('skipped 0', 'skipped 1'),
    tap.replace('fail 0', 'fail 1'),
    tap.replace('cancelled 0', 'cancelled 1'),
    '1 passed 1 skipped',
    '1 passed 1 flaky',
    tap + 'ok 1 # SKIP unavailable',
  ])
    assert.throws(() => assertPassingTestOutput(raw));
});
test('observed Node24 spec summary is accepted only with positive pass and all failure/skip/cancel/TODO fields zero', () => {
  const spec =
    '✔ completed result checks (1.2ms)\nℹ tests 35\nℹ suites 0\nℹ pass 35\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 549.907\n';
  assert.doesNotThrow(() => assertPassingTestOutput(spec));
  for (const field of ['fail', 'cancelled', 'skipped', 'todo']) {
    const invalid = spec.replace(`ℹ ${field} 0`, `ℹ ${field} 1`);
    assert.throws(() => assertPassingTestOutput(invalid));
    assert.throws(() =>
      assertPassingTestOutput(invalid + '9 passed (38.9s)\n'),
    );
  }
  assert.throws(() =>
    assertPassingTestOutput(spec.replace('ℹ pass 35', 'ℹ pass 0')),
  );
  assert.throws(() =>
    assertPassingTestOutput(spec.replace('ℹ skipped 0\n', '')),
  );
});
test('fresh coverage rejects zero counters, omitted files, skipped and below80 rather than importing history', () => {
  for (const change of [
    { lines: { total: 0, covered: 0, skipped: 0, pct: 100 } },
    { lines: { total: 21, covered: 0, skipped: 0, pct: 0 } },
    { lines: { total: 21, covered: 21, skipped: 1, pct: 100 } },
    { lines: { total: 21, covered: 16, skipped: 0, pct: 76.19 } },
    { candidateSha256: 'b'.repeat(64) },
    { files: [] },
  ])
    assert.throws(() =>
      assertCurrentCoverage({ ...coverage(), ...change }, fixture()),
    );
});
test('checkpoint rejects changed prepared input before treating any report as successful', async () =>
  scratch(async (root) => {
    const path = resolve(root, 'input.json');
    await writeFile(path, JSON.stringify(fixture()));
    await assert.rejects(
      verifyCurrentCompletion(
        path,
        'b'.repeat(64),
        resolve(root, 'missing-report.json'),
        digest,
      ),
      /changed/,
    );
  }));
test('historical-only or synthetic report cannot satisfy the short current checkpoint', async () =>
  scratch(async (root) => {
    const input = resolve(root, 'input.json');
    const report = resolve(root, 'report.json');
    await writeFile(input, JSON.stringify(fixture()));
    await writeFile(
      report,
      JSON.stringify({
        verified: true,
        retainedEvidenceVerified: true,
        currentSourceVerified: false,
      }),
    );
    await assert.rejects(
      verifyCurrentCompletion(
        input,
        sha256(await readFile(input)),
        report,
        sha256(await readFile(report)),
      ),
      /historical\/synthetic/,
    );
  }));
test('checkpoint rejects altered real-report bytes before reading source or raw proof', async () =>
  scratch(async (root) => {
    const input = resolve(root, 'input.json');
    const report = resolve(root, 'report.json');
    await writeFile(input, JSON.stringify(fixture()));
    await writeFile(report, '{"verified":true}');
    const reportSHA = sha256(await readFile(report));
    await writeFile(report, '{"verified":true,"extra":1}');
    await assert.rejects(
      verifyCurrentCompletion(
        input,
        sha256(await readFile(input)),
        report,
        reportSHA,
      ),
      /changed/,
    );
  }));
test('prepared input requires every parameter before reading candidate or source', async () => {
  const options = {
    root: '/fixture',
    candidate: '/candidate',
    consumer: '/consumer',
    guest: '/guest',
    trials: '/attempt',
    browserLog: '/attempt.log',
    inventory: '/mirror-input.json',
    baseline: '/baseline',
    ciRun: '/ci-run.json',
  };
  for (const key of Object.keys(options) as (keyof typeof options)[])
    await assert.rejects(
      prepareCurrentInput({ ...options, [key]: '' }),
      /required/,
    );
});
test('prepared input writing refuses collisions and destinations outside its project artifact boundary', async () =>
  scratch(async (root) => {
    const input = { ...fixture(), root };
    const directory = resolve(root, '.artifacts/migration-preflight');
    await mkdir(directory, { recursive: true });
    const out = resolve(directory, 'input.json');
    const written = await writeCurrentPreparedInput(out, input);
    assert.equal(written.sha256, sha256(await readFile(out)));
    await assert.rejects(writeCurrentPreparedInput(out, input), /EEXIST/);
    await assert.rejects(
      writeCurrentPreparedInput(resolve(root, 'input.json'), input),
      /project-local/,
    );
  }));

test('current raw reconciliation includes actual generated Playwright Node imports from all three suites', async () => {
  await withPlaywrightRawFixture(async (out, candidate) => {
    const report = await verifyCurrentRawCoverage(out, candidate);
    assert.equal(report.passed, true);
    assert.equal(
      report.realmNames.filter((name) => name.startsWith('playwright:')).length,
      3,
    );
  });
});

test('current raw reconciliation refuses one-sided receipts, generation drift, counter changes and realm-name changes', async () => {
  await withPlaywrightRawFixture(async (out, candidate) => {
    const directory = resolve(out, 'coverage-playwright-node/package');
    const names = await readdir(directory);
    const beginPath = resolve(
      directory,
      names.find((name) => name.endsWith('.begin.json'))!,
    );
    const endPath = resolve(
      directory,
      names.find((name) => name.endsWith('.end.json'))!,
    );
    const beginBytes = await readFile(beginPath),
      endBytes = await readFile(endPath);
    for (const [path, bytes] of [
      [beginPath, beginBytes],
      [endPath, endBytes],
    ] as const) {
      await rm(path);
      try {
        await assert.rejects(
          verifyCurrentRawCoverage(out, candidate),
          /Playwright/,
        );
      } finally {
        await writeFile(path, bytes);
      }
    }
    const end = JSON.parse(endBytes.toString('utf8'));
    await writeFile(
      endPath,
      JSON.stringify({ ...end, id: 'different-generation' }),
    );
    try {
      await assert.rejects(
        verifyCurrentRawCoverage(out, candidate),
        /Playwright/,
      );
    } finally {
      await writeFile(endPath, endBytes);
    }
    const counts: number[] = [...end.counts];
    const metadata = JSON.parse(
      await readFile(resolve(out, 'coverage-metadata.json'), 'utf8'),
    );
    counts[metadata.layout[0].offset] = counts[metadata.layout[0].offset]! + 1;
    await writeFile(endPath, JSON.stringify({ ...end, counts }));
    try {
      await assert.rejects(
        verifyCurrentRawCoverage(out, candidate),
        /raw current coverage differs from aggregate/,
      );
    } finally {
      await writeFile(endPath, endBytes);
    }
    const reportPath = resolve(out, 'coverage-report.json'),
      reportBytes = await readFile(reportPath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    const index = report.realmNames.findIndex((name: string) =>
      name.startsWith('playwright:'),
    );
    assert.ok(index >= 0);
    report.realmNames[index] = 'playwright:package:forged';
    await writeFile(reportPath, JSON.stringify(report));
    try {
      await assert.rejects(
        verifyCurrentRawCoverage(out, candidate),
        /raw current coverage differs from aggregate/,
      );
    } finally {
      await writeFile(reportPath, reportBytes);
    }
    await verifyCurrentRawCoverage(out, candidate);
  });
});
