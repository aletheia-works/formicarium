import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  type ApiAcceptance,
  assembleB1,
  B1_HOST,
  B1_PER_ENVIRONMENT,
  B1_SOURCES,
  type ObservedCommand,
  readPreflightEvidenceId,
  requiredB1Rows,
  validateB1,
} from '../../scripts/migration-command/b1.js';
import {
  COMMAND_BRANCH,
  mapCommandCICommand,
  validateCommandCIContext,
} from '../../scripts/migration-command/ci.js';
import { COMMAND_INPUT_POLICY } from '../../scripts/migration-command/ci-inputs.js';
import {
  checkCommandCandidate,
  checkCommandCIEvidence,
  commandCompletionCommands,
  isCommandTestCommand,
  verifyCommandLog,
} from '../../scripts/migration-command/completion.js';
import {
  assertCommandNodeRealms,
  COMMAND_REALMS,
  COMMAND_RUNNER_SUITES,
} from '../../scripts/migration-command/coverage.js';
import {
  COMMAND_MEASURE_OPTIONS,
  measureCommand,
} from '../../scripts/migration-command/measure.js';
import * as commandStage from '../../scripts/migration-command/stage.js';
import {
  assertCommandDistribution,
  COMMAND_JS,
  commandSourceInventory,
} from '../../scripts/migration-command/stage.js';
import { INSTALL_REALMS } from '../../scripts/migration-install/coverage.js';
import { validateCIInputManifest } from '../../scripts/migration-session/ci-inputs.js';
import { readPlaywrightNodeRealms } from '../../scripts/package/coverage.js';
import { FIRST_PARTY_JS, sha256 } from '../../scripts/package/stage-package.js';

/** Synthetic fixtures exercise validators only; they are never B1 evidence. */
const identity = {
  sourceCommit: 'a'.repeat(40),
  packSha256: 'b'.repeat(64),
  inventorySha256: 'c'.repeat(64),
  preflightEvidenceId: 'u1-real-browser-ci-attempt-2',
};
function synthetic(): ApiAcceptance {
  return {
    schemaVersion: 1,
    evidenceId: 'u4-b1-validator-fixture',
    ...identity,
    packageVersion: '0.3.0',
    checks: requiredB1Rows().map((row) => ({
      ...row,
      status: 'passed',
      logSha256: 'd'.repeat(64),
    })),
  };
}
const refuses = (value: unknown, pattern: RegExp) =>
  assert.throws(() => validateB1(value, identity), pattern);
const NODE_SUMMARY =
  '# tests 3\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
const PLAYWRIGHT_SUMMARY = [
  '  ✓  1 [chromium] › consumer.spec.ts:1:1 › case (1.0s)',
  '  ✓  2 [firefox] › consumer.spec.ts:1:1 › case (1.0s)',
  '  ✓  3 [webkit] › consumer.spec.ts:1:1 › case (1.0s)',
  '',
  '  3 passed (3.0s)',
  '',
].join('\n');

test('B1 required set is six checks for each of four environments plus seven host checks', () => {
  const rows = requiredB1Rows();
  assert.equal(rows.length, 6 * 4 + 7);
  assert.equal(
    new Set(rows.map((row) => `${row.name}@${row.environment}`)).size,
    31,
  );
  for (const name of B1_PER_ENVIRONMENT)
    for (const environment of ['node', 'chromium', 'firefox', 'webkit'])
      assert.ok(
        rows.some(
          (row) => row.name === name && row.environment === environment,
        ),
      );
  for (const name of B1_HOST)
    assert.ok(
      rows.some((row) => row.name === name && row.environment === 'host'),
    );
  for (const name of [...B1_PER_ENVIRONMENT, ...B1_HOST])
    assert.ok(B1_SOURCES[name], name);
});
test('B1 validator accepts the complete passed record with every named C06 field', () => {
  assert.equal(validateB1(synthetic(), identity).checks.length, 31);
});
test('B1 validator refuses each missing named field and any unknown field', () => {
  for (const field of [
    'schemaVersion',
    'evidenceId',
    'sourceCommit',
    'packageVersion',
    'packSha256',
    'inventorySha256',
    'checks',
    'preflightEvidenceId',
  ]) {
    const value: Record<string, unknown> = { ...synthetic() };
    delete value[field];
    refuses(value, /named field/);
  }
  refuses({ ...synthetic(), extra: true }, /named field/);
});
test('B1 validator refuses missing, duplicate, failed, unverified and unknown rows', () => {
  const base = synthetic();
  refuses({ ...base, checks: base.checks.slice(1) }, /required check missing/);
  refuses(
    { ...base, checks: [...base.checks, base.checks[0]] },
    /duplicate check/,
  );
  for (const status of ['failed', 'unverified', 'skipped'])
    refuses(
      {
        ...base,
        checks: base.checks.map((row, index) =>
          index === 3 ? { ...row, status } : row,
        ),
      },
      /not passed/,
    );
  for (const environment of ['safari', 'Node', 'ubuntu'])
    refuses(
      {
        ...base,
        checks: base.checks.map((row, index) =>
          index === 0 ? { ...row, environment } : row,
        ),
      },
      /unknown environment/,
    );
  refuses(
    {
      ...base,
      checks: base.checks.map((row, index) =>
        index === 0 ? { ...row, name: 'pwd-builtin' } : row,
      ),
    },
    /unknown check/,
  );
  // A host row cannot replace a per-environment row.
  refuses(
    {
      ...base,
      checks: base.checks.map((row, index) =>
        index === 0 ? { ...row, environment: 'host' } : row,
      ),
    },
    /unknown check/,
  );
  refuses(
    {
      ...base,
      checks: base.checks.map((row, index) => {
        if (index !== 0) return row;
        const { logSha256, ...rest } = row;
        void logSha256;
        return rest;
      }),
    },
    /check field/,
  );
});
test('B1 validator refuses a different candidate, version, preflight or malformed digest', () => {
  const base = synthetic();
  refuses({ ...base, sourceCommit: 'e'.repeat(40) }, /sourceCommit/);
  refuses({ ...base, packSha256: 'e'.repeat(64) }, /packSha256/);
  refuses({ ...base, inventorySha256: 'E'.repeat(64) }, /inventorySha256/);
  refuses({ ...base, packageVersion: '0.2.1' }, /packageVersion/);
  refuses({ ...base, preflightEvidenceId: 'u3-install' }, /preflight/);
  refuses(
    {
      ...base,
      checks: base.checks.map((row, index) =>
        index === 5 ? { ...row, logSha256: 'not-a-digest' } : row,
      ),
    },
    /log digest/,
  );
});

async function scratch(t: import('node:test').TestContext) {
  await mkdir(resolve('.artifacts'), { recursive: true });
  const root = await mkdtemp(resolve('.artifacts', 'u4-acceptance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
/** Writes one plausible raw log per planned command inside `output`. */
async function observedRun(output: string) {
  const planned = commandCompletionCommands(
    process.cwd(),
    resolve(output, 'coverage'),
    resolve(output, 'measurement'),
  );
  const markers = Object.values(B1_SOURCES)
    .map((source) => source.marker)
    .filter(Boolean)
    .join('\n');
  const observed: ObservedCommand[] = [];
  for (const [index, { label, command }] of planned.entries()) {
    const path = resolve(output, `command-${index + 1}.log`);
    const body = command.args.some((arg) => arg.endsWith('cli.js'))
      ? `${markers}\n${PLAYWRIGHT_SUMMARY}`
      : label === 'coverage-report'
        ? '{"passed":true}\n'
        : `${markers}\n${NODE_SUMMARY}`;
    await writeFile(path, body);
    observed.push({
      ...command,
      label,
      rawLogPath: path,
      rawLogSha256: sha256(body),
      exitCode: 0,
    });
  }
  return { planned, observed };
}
test('B1 rows are assembled only from this run’s existing logs and their real digests', async (t) => {
  const output = await scratch(t);
  const { planned, observed } = await observedRun(output);
  const acceptance = await assembleB1({
    evidenceId: 'u4-b1-assembly-fixture',
    identity,
    observed,
    expectedCommands: planned,
    output,
  });
  for (const check of acceptance.checks) {
    const source = B1_SOURCES[check.name]!;
    const label =
      check.environment === 'host'
        ? source.host
        : check.environment === 'node'
          ? source.node
          : source.browser;
    const row = observed.find((item) => item.label === label)!;
    assert.equal(check.logSha256, sha256(await readFile(row.rawLogPath)));
  }
});
test('B1 assembly refuses a tampered, missing, failed, foreign or outside log', async (t) => {
  const output = await scratch(t);
  const attempt = async (
    mutate: (observed: ObservedCommand[]) => Promise<void> | void,
    pattern: RegExp,
  ) => {
    const run = await observedRun(output);
    await mutate(run.observed);
    await assert.rejects(
      assembleB1({
        evidenceId: 'u4-b1-assembly-fixture',
        identity,
        observed: run.observed,
        expectedCommands: run.planned,
        output,
      }),
      pattern,
    );
  };
  await attempt(async (rows) => {
    await writeFile(rows[4]!.rawLogPath, `${NODE_SUMMARY}tampered\n`);
  }, /log\/exit differs/);
  await attempt((rows) => {
    rows.splice(
      rows.findIndex((row) => row.label === 'command-browser'),
      1,
    );
  }, /missing log command-browser/);
  await attempt((rows) => {
    rows[1]!.exitCode = 1;
  }, /log\/exit differs/);
  await attempt((rows) => {
    rows.push({ ...rows[0]! });
  }, /duplicate log/);
  await attempt((rows) => {
    // A U3 completion command cannot stand in for a U4 suite.
    const row = rows.find((item) => item.label === 'command-unit')!;
    row.executable = process.execPath;
    row.args = ['scripts/migration-install/completion.js'];
  }, /does not come from the U4 command/);
  await attempt(async (rows) => {
    const outside = resolve(output, '..', `outside-${Date.now()}.log`);
    await writeFile(outside, NODE_SUMMARY);
    t.after(() => rm(outside, { force: true }));
    const row = rows.find((item) => item.label === 'session-unit')!;
    row.rawLogPath = outside;
    row.rawLogSha256 = sha256(NODE_SUMMARY);
  }, /outside this completion output/);
  await attempt(async (rows) => {
    const row = rows.find((item) => item.label === 'command-browser')!;
    const body = (await readFile(row.rawLogPath, 'utf8')).replace(
      '[webkit]',
      '[safari]',
    );
    await writeFile(row.rawLogPath, body);
    row.rawLogSha256 = sha256(body);
  }, /marker missing: \[webkit\]/);
});
test('exit 0 logs with skips, failures, TODO or an empty summary are refused for U4 tasks', async (t) => {
  const output = await scratch(t);
  const command = {
    executable: 'mise',
    args: ['run', 'migration-command-unit'],
    cwd: process.cwd(),
  };
  assert.equal(isCommandTestCommand(command), true);
  assert.equal(
    isCommandTestCommand({
      ...command,
      args: ['run', 'migration-command-browser'],
    }),
    true,
  );
  assert.equal(
    isCommandTestCommand({ ...command, args: ['run', 'build'] }),
    false,
  );
  const check = async (body: string) => {
    const path = resolve(output, `log-${sha256(body)}.log`);
    await writeFile(path, body);
    return verifyCommandLog(command, {
      rawLogPath: path,
      rawLogSha256: sha256(body),
      exitCode: 0,
    });
  };
  await check(NODE_SUMMARY);
  for (const body of [
    '',
    'no summary at all\n',
    NODE_SUMMARY.replace('# skipped 0', '# skipped 1'),
    NODE_SUMMARY.replace('# fail 0', '# fail 1'),
    NODE_SUMMARY.replace('# todo 0', '# todo 2'),
    NODE_SUMMARY.replace('# pass 3', '# pass 2'),
    `${NODE_SUMMARY}not ok 4 - hidden\n`,
    PLAYWRIGHT_SUMMARY.replace('3 passed', '2 passed\n  1 skipped'),
    PLAYWRIGHT_SUMMARY.replace('3 passed', '0 passed'),
  ])
    await assert.rejects(check(body), /U3 /);
  const build = { ...command, args: ['run', 'build'] };
  const path = resolve(output, 'build.log');
  await writeFile(path, 'built\n');
  await verifyCommandLog(build, {
    rawLogPath: path,
    rawLogSha256: sha256('built\n'),
    exitCode: 0,
  });
  await assert.rejects(
    verifyCommandLog(build, {
      rawLogPath: path,
      rawLogSha256: sha256('other'),
      exitCode: 0,
    }),
    /log\/exit differs/,
  );
});
test('a U3 candidate manifest is refused before any U4 completion command runs', async (t) => {
  const output = await scratch(t);
  for (const unit of ['u3-install', 'u2-session-guest-api', undefined]) {
    const path = resolve(output, `${unit ?? 'none'}.manifest.json`);
    await writeFile(
      path,
      JSON.stringify({
        unit,
        version: '0.3.0',
        provisional: true,
        sourceCommit: 'a'.repeat(40),
      }),
    );
    await assert.rejects(
      checkCommandCandidate(path, process.cwd()),
      /U4 candidate identity missing/,
    );
  }
});
test('U3 or mismatching CI evidence cannot become U4 CI evidence', () => {
  const candidate = {
    sourceIdentity: 'f'.repeat(64),
    sourceCommit: 'a'.repeat(40),
    tarball: { sha256: 'b'.repeat(64) },
  };
  const valid = {
    recordKind: 'observed-ci-summary',
    unit: 'u4-command',
    conclusion: 'success',
    sourceIdentity: candidate.sourceIdentity,
    candidateSha256: candidate.tarball.sha256,
    sourceCommit: candidate.sourceCommit,
  };
  checkCommandCIEvidence(valid, candidate);
  for (const change of [
    { unit: 'u3-install' },
    { conclusion: 'failure' },
    { candidateSha256: 'c'.repeat(64) },
    { sourceIdentity: 'e'.repeat(64) },
    { sourceCommit: 'b'.repeat(40) },
    { recordKind: 'ci-job-observations' },
  ])
    assert.throws(
      () => checkCommandCIEvidence({ ...valid, ...change }, candidate),
      /U4 same-source\/same-pack/,
    );
  assert.throws(() => checkCommandCIEvidence(null, candidate), /U4 same/);
});
test('completion is sequential U2/U3/U4 suites, regressions, fresh coverage and formal36', () => {
  const root = process.cwd();
  const planned = commandCompletionCommands(root, '/x/coverage', '/x/measure');
  assert.deepEqual(
    planned.map((item) => item.label),
    [
      'build',
      'typecheck',
      'test-light',
      'acceptance',
      'session-unit',
      'install-unit',
      'command-unit',
      'session-browser',
      'install-browser',
      'command-browser',
      'test-consumer',
      'node-regression',
      'browser-regression',
      'coverage-prepare',
      'coverage-package-node',
      'coverage-session-node',
      'coverage-package',
      'coverage-session',
      'coverage-install',
      'coverage-command',
      'coverage-report',
      'measure',
    ],
  );
  for (const { command } of planned) {
    assert.equal(
      command.args.some((arg) =>
        /migration-install\/completion\.js$/.test(arg),
      ),
      false,
    );
    if (command.args.includes('test') && command.args[0]?.endsWith('cli.js')) {
      assert.ok(command.args.includes('--workers=1'));
      assert.ok(command.args.includes('--retries=0'));
    }
  }
  for (const label of [
    'session-browser',
    'install-browser',
    'command-browser',
    'browser-regression',
  ])
    assert.ok(
      planned
        .find((item) => item.label === label)
        ?.command.args.includes('--reporter=list'),
      label,
    );
  const sessionNode = planned.find(
    (item) => item.label === 'coverage-session-node',
  )!.command.args;
  for (const name of ['parse', 'dispatch', 'public', 'consumer'])
    assert.ok(
      sessionNode.includes(
        `/x/coverage/tests/migration-command/${name}.test.js`,
      ),
      name,
    );
  assert.deepEqual(
    planned.find((item) => item.label === 'measure')?.command.args,
    ['scripts/migration-command/measure.js', '/x/measure'],
  );
});
test('U4 CI context requires the dedicated U4 branch and refuses the U3 branch', () => {
  const env = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'Marukome0743/formicarium',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: COMMAND_BRANCH,
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '1',
    GITHUB_RUN_ATTEMPT: '1',
  };
  assert.equal(validateCommandCIContext(env).head, 'a'.repeat(40));
  for (const ref of [
    'refs/heads/codex/terrarium-migration-u3',
    'refs/heads/main',
    'refs/pull/1/merge',
  ])
    assert.throws(() => validateCommandCIContext({ ...env, GITHUB_REF: ref }));
  assert.throws(() =>
    validateCommandCIContext({ ...env, GITHUB_EVENT_NAME: 'pull_request' }),
  );
});
test('U4 CI maps only its scoped unit task and refuses unknown tasks, escapes and executables', () => {
  const root = process.cwd();
  const unit = mapCommandCICommand(
    { executable: 'mise', args: ['run', 'migration-command-unit'], cwd: root },
    root,
  );
  assert.equal(unit.executable, process.execPath);
  assert.deepEqual(
    unit.args.filter((arg) => arg.startsWith('tests/')),
    [
      'runner-ready',
      'parse',
      'dispatch',
      'public',
      'consumer',
      'acceptance',
    ].map((name) => `tests/migration-command/${name}.test.js`),
  );
  for (const command of [
    { executable: 'mise', args: ['run', 'migration-command-stage'], cwd: root },
    { executable: 'mise', args: ['run', 'migration-command-unit'], cwd: '/' },
    { executable: '/bin/sh', args: ['-c', 'true'], cwd: root },
    {
      executable: process.execPath,
      args: ['scripts/migration-command/coverage.js', 'prepare', '/etc/x'],
      cwd: root,
    },
    {
      executable: process.execPath,
      args: ['scripts/migration-command/measure.js', '/etc/x'],
      cwd: root,
    },
  ])
    assert.throws(() => mapCommandCICommand(command, root), /refused|escapes/);
});
test('every U4 completion step, including the U4 measure entry, is accepted by the U4 CI mapping', () => {
  const root = process.cwd();
  const planned = commandCompletionCommands(
    root,
    resolve(root, '.artifacts/migration-command/x/coverage'),
    resolve(root, '.artifacts/migration-command/x/measure'),
  );
  for (const item of planned)
    assert.doesNotThrow(
      () => mapCommandCICommand(item.command, root),
      item.label,
    );
  const measure = planned.find((item) => item.label === 'measure')!.command;
  assert.deepEqual(mapCommandCICommand(measure, root).args, measure.args);
  assert.equal(measure.args[0], 'scripts/migration-command/measure.js');
});
test('the U4 workflow keeps U3 safety: read-only, own branch, serial, 360 min, 7-day raw evidence', async () => {
  const [u4, u3] = await Promise.all(
    [
      '.github/workflows/migration-command-u4.yml',
      '.github/workflows/migration-install-u3.yml',
    ].map((path) => readFile(resolve(path), 'utf8')),
  );
  assert.match(u4, /^permissions:\n {2}contents: read\n/m);
  assert.match(u4, /branches: \[codex\/terrarium-migration-b1\]/);
  assert.match(u4, /refs\/heads\/codex\/terrarium-migration-b1'/);
  assert.match(u4, /cancel-in-progress: false/);
  assert.match(u4, /timeout-minutes: 360/);
  assert.match(u4, /retention-days: 7/);
  assert.match(u4, /persist-credentials: false/);
  assert.equal(/write|secrets\.|NPM_TOKEN|id-token/.test(u4), false);
  for (const path of [
    'completion-*/b1-acceptance.json',
    'completion-*/*.log',
    'coverage-playwright-node/**/*.jsonl',
    'measurement/trials/*.json',
  ])
    assert.ok(u4.includes(path), path);
  const pins = (text: string) =>
    [...text.matchAll(/uses: (\S+@[a-f0-9]{40})/g)].map((row) => row[1]).sort();
  assert.deepEqual(pins(u4), pins(u3));
  assert.equal(u4.includes('codex/terrarium-migration-u3'), false);
});
test('U4 realms extend U3 by three Node Workers and three browser cases without dropping any', () => {
  // One more real Worker comes from the real-guest blink.log regression in public.test.
  assert.equal(COMMAND_REALMS.nodeWorkers, INSTALL_REALMS.nodeWorkers + 3);
  for (const [title, workers] of Object.entries(INSTALL_REALMS.browserCases))
    assert.equal(
      (COMMAND_REALMS.browserCases as Record<string, number>)[title],
      workers,
    );
  assert.equal(
    Object.keys(COMMAND_REALMS.browserCases).length,
    Object.keys(INSTALL_REALMS.browserCases).length + 3,
  );
  assert.deepEqual(COMMAND_RUNNER_SUITES, [
    'package',
    'session',
    'install',
    'command',
  ]);
  const rows = [
    { name: 'node-host', counts: [1] },
    ...Array.from({ length: COMMAND_REALMS.nodeWorkers }, (_, index) => ({
      name: `node-worker-${index + 1}`,
      counts: [1],
    })),
  ];
  assertCommandNodeRealms(rows);
  assert.throws(() => assertCommandNodeRealms(rows.slice(1)), /differs/);
  assert.throws(
    () => assertCommandNodeRealms([...rows.slice(1), rows[1]!]),
    /differs/,
  );
  assert.throws(
    () =>
      assertCommandNodeRealms(
        rows.map((row, index) => (index === 2 ? { ...row, counts: [0] } : row)),
      ),
    /not registered/,
  );
});
test('the fixed distribution is exactly the U3 twenty-one plus the two U4 modules', () => {
  assertCommandDistribution();
  assert.equal(FIRST_PARTY_JS.length, 23);
  for (const path of COMMAND_JS) assert.ok(FIRST_PARTY_JS.includes(path));
  assert.throws(
    () =>
      assertCommandDistribution(
        FIRST_PARTY_JS.filter((path) => !COMMAND_JS.includes(path)),
      ),
    /23/,
  );
  assert.throws(
    () =>
      assertCommandDistribution([...FIRST_PARTY_JS.slice(1), COMMAND_JS[0]!]),
    /23/,
  );
});
test('preflightEvidenceId is read from the structurally re-assessed U1 record', async () => {
  const preflight = await readPreflightEvidenceId(process.cwd());
  assert.equal(preflight.evidenceId, 'u1-real-browser-ci-attempt-2');
  assert.match(preflight.sha256, /^[a-f0-9]{64}$/);
});
test('the U4 input bundle refuses self-referencing sources under its own directory', () => {
  assert.equal(COMMAND_INPUT_POLICY.sourcePrefix, 'ci/migration-command/');
  const files = COMMAND_INPUT_POLICY.paths.map((path) => ({
    path,
    bytes: 1,
    sha256: 'a'.repeat(64),
  }));
  const manifest = (sourceFiles: { path: string; sha256: string }[]) => ({
    schema: COMMAND_INPUT_POLICY.schema,
    version: 1,
    producer: 'main-session-observed-inputs',
    files,
    sourceFiles,
  });
  validateCIInputManifest(
    manifest([{ path: 'runtime/command.ts', sha256: 'a'.repeat(64) }]),
    COMMAND_INPUT_POLICY,
  );
  assert.throws(
    () =>
      validateCIInputManifest(
        manifest([
          {
            path: 'ci/migration-command/inputs.bundle.json',
            sha256: 'a'.repeat(64),
          },
        ]),
        COMMAND_INPUT_POLICY,
      ),
    /self reference/,
  );
});
test('the U4 measure entry runs the U3 measurement with the U4 source inventory', () => {
  assert.equal(typeof measureCommand, 'function');
  assert.deepEqual(Object.keys(COMMAND_MEASURE_OPTIONS), [
    'commandSourceInventory',
  ]);
  assert.equal(
    COMMAND_MEASURE_OPTIONS.commandSourceInventory,
    commandSourceInventory,
  );
});
test('U4 keeps no copy of the U3 acceptance rules, so U3 stays their only owner', () => {
  for (const name of ['INSTALL_REGRESSION_UNITS', 'candidateSourceInventory'])
    assert.equal(name in commandStage, false, name);
});
test('the shared Playwright runner reader accepts the U4 command suite and still refuses unknown suites', async () => {
  const out = resolve('.artifacts', 'u4-suite-check-absent');
  // An absent output is refused later; only the suite list check is under test.
  await assert.rejects(
    readPlaywrightNodeRealms(out, [...COMMAND_RUNNER_SUITES]),
    (error: Error) => error.message !== 'invalid Playwright expected suites',
  );
  for (const suites of [[], ['package', 'other'], ['command', 'command']])
    await assert.rejects(
      readPlaywrightNodeRealms(out, suites),
      /invalid Playwright expected suites/,
    );
});
