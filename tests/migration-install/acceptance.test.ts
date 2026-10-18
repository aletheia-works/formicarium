import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  mapInstallCICommand,
  validateInstallCIContext,
} from '../../scripts/migration-install/ci.js';
import {
  decodeInstallSiteArchive,
  INSTALL_ACTUAL_SITE_FILES,
  INSTALL_INPUT_POLICY,
  INSTALL_SITE_ARCHIVE,
  INSTALL_SITE_REFERENCE,
  inspectInstallActualSite,
  readInstallSiteReference,
  requireInstallActualSite,
  validateInstallSiteBudget,
  validateInstallSiteEntry,
  validateInstallSiteReferenceManifest,
} from '../../scripts/migration-install/ci-inputs.js';
import {
  assertInstallTestOutput,
  checkInstallCandidate,
  executeInstallCommand,
  installCompletionCommands,
  installReportScope,
  isInstallTestCommand,
  verifyInstallCommandLog,
} from '../../scripts/migration-install/completion.js';
import {
  assertInstallNodeRealms,
  INSTALL_REALMS,
} from '../../scripts/migration-install/coverage.js';
import type { InstallTrial } from '../../scripts/migration-install/measure.js';
import {
  INSTALL_CONTEXT_OPTIONS,
  installBrowserLaunch,
  resolveInstallFirefoxProfile,
  summarizeInstallTrials,
} from '../../scripts/migration-install/measure.js';
import {
  INSTALL_REGRESSION_UNITS,
  installCandidateInventory,
  installSourceInventory,
} from '../../scripts/migration-install/stage.js';
import {
  CI_INPUT_PATHS,
  validateCIInputManifest,
} from '../../scripts/migration-session/ci-inputs.js';
import {
  instrumentPackage,
  readPlaywrightNodeRealms,
} from '../../scripts/package/coverage.js';
import { PACKAGE_FILES, sha256 } from '../../scripts/package/stage-package.js';

/** Synthetic unit fixtures test validators; these are never acceptance evidence. */
test('all three generated Playwright Node bootstraps capture real static product imports and refuse absent suite evidence', async () => {
  const scratch = await mkdtemp(resolve('.artifacts', 'u3-runner-real-'));
  try {
    const source = resolve(scratch, 'source'),
      out = resolve(scratch, 'coverage');
    for (const path of PACKAGE_FILES) {
      const target = resolve(source, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(
        target,
        path === 'runtime/contracts.js' ? 'export const imported = 1;' : '',
      );
    }
    await instrumentPackage({ source, out });
    await writeFile(resolve(out, 'package.json'), '{"type":"module"}');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const launched = new Map<string, number>();
    for (const suite of ['package', 'session', 'install']) {
      const entry = resolve(out, `entry-${suite}.mjs`);
      await writeFile(
        entry,
        `import './coverage-playwright-node-${suite}.mjs';\nimport {imported} from './runtime/contracts.js';if(imported!==1)throw Error('actual product import missing');`,
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
      assert.ok(child.pid, stderr);
      launched.set(suite, child.pid);
    }
    const realms = await readPlaywrightNodeRealms(out, [
      'package',
      'session',
      'install',
    ]);
    assert.equal(realms.length, 3);
    for (const realm of realms)
      assert.ok(
        [...new Int32Array(realm.buffer)].some(
          (count, index) => index > 0 && count > 0,
        ),
      );
    const generation = JSON.parse(
      await readFile(
        resolve(out, 'coverage-playwright-generation.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    for (const [suite, pid] of launched)
      assert.equal(
        await readFile(
          resolve(out, 'coverage-playwright-node', suite, 'launches.jsonl'),
          'utf8',
        ),
        `${JSON.stringify({ ...generation, suite, pid, ppid: process.pid })}\n`,
        `${suite} ledger holds exactly its launched runner identity`,
      );
    const installLedger = resolve(
      out,
      'coverage-playwright-node/install/launches.jsonl',
    );
    const stashedLedger = resolve(scratch, 'install-launches.jsonl');
    await rename(installLedger, stashedLedger);
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package', 'session', 'install']),
      /Playwright/,
      'a suite without its launch ledger must be refused',
    );
    await rename(stashedLedger, installLedger);
    assert.equal(
      (await readPlaywrightNodeRealms(out, ['package', 'session', 'install']))
        .length,
      3,
    );
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package', 'session']),
      /Playwright/,
    );
    await writeFile(
      resolve(out, 'coverage-playwright-node/package/999999.end.json'),
      '{}',
    );
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package', 'session', 'install']),
      /Playwright/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('U3 Firefox profile is optional, resolved to a real absolute directory with cert9.db, and refused before measurement otherwise', async () => {
  await mkdir('.artifacts', { recursive: true });
  const scratch = await mkdtemp(resolve('.artifacts', 'u3-firefox-profile-'));
  try {
    const variable = 'FORMICARIUM_INSTALL_FIREFOX_PROFILE';
    assert.equal(await resolveInstallFirefoxProfile({}), undefined);
    const profile = resolve(scratch, 'profile');
    await mkdir(profile);
    await writeFile(resolve(profile, 'cert9.db'), '');
    assert.equal(
      await resolveInstallFirefoxProfile({ [variable]: profile }),
      await realpath(profile),
      'valid profile resolves to its real absolute path',
    );
    const linked = resolve(scratch, 'linked-profile');
    await symlink(profile, linked);
    const plainFile = resolve(scratch, 'plain-file');
    await writeFile(plainFile, '');
    const withoutDatabase = resolve(scratch, 'without-database');
    await mkdir(withoutDatabase);
    const databaseDirectory = resolve(scratch, 'database-directory');
    await mkdir(resolve(databaseDirectory, 'cert9.db'), { recursive: true });
    const databaseLink = resolve(scratch, 'database-link');
    await mkdir(databaseLink);
    await symlink(
      resolve(profile, 'cert9.db'),
      resolve(databaseLink, 'cert9.db'),
    );
    for (const [label, value] of [
      ['empty string', ''],
      ['relative path', 'relative/profile'],
      ['missing path', resolve(scratch, 'missing')],
      ['symlink to profile directory', linked],
      ['regular file instead of directory', plainFile],
      ['cert9.db missing', withoutDatabase],
      ['cert9.db is a directory', databaseDirectory],
      ['cert9.db is a symlink', databaseLink],
    ] as const)
      await assert.rejects(
        resolveInstallFirefoxProfile({ [variable]: value }),
        /U3 Firefox profile/,
        label,
      );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('U3 browser launch switches Firefox to the persistent profile only when given and keeps TLS verification on', () => {
  const firefoxUserPrefs = { 'security.enterprise_roots.enabled': true };
  assert.deepEqual(installBrowserLaunch('firefox', undefined), {
    kind: 'launch',
    options: { firefoxUserPrefs },
  });
  assert.deepEqual(installBrowserLaunch('firefox', '/job/firefox-profile'), {
    kind: 'persistent',
    userDataDir: '/job/firefox-profile',
    options: { firefoxUserPrefs, ignoreHTTPSErrors: false },
  });
  for (const browserName of ['chromium', 'webkit'] as const)
    for (const profile of [undefined, '/job/firefox-profile'])
      assert.deepEqual(
        installBrowserLaunch(browserName, profile),
        { kind: 'launch', options: {} },
        `${browserName} never uses the Firefox profile`,
      );
  assert.deepEqual(INSTALL_CONTEXT_OPTIONS, { ignoreHTTPSErrors: false });
  assert.ok(Object.isFrozen(INSTALL_CONTEXT_OPTIONS));
});

function trials(): InstallTrial[] {
  return ['aube', 'biome'].flatMap((tool) =>
    ['chromium', 'firefox', 'webkit'].flatMap((browser) =>
      Array.from({ length: 6 }, (_, trial) => ({
        tool,
        browser,
        trial,
        version: tool === 'aube' ? '2.7.0' : '2.5.15',
        url: `https://localhost:4182/mirror/${tool === 'aube' ? 'aube.tar.gz' : 'biome.elf'}`,
        finalUrl: `https://localhost:4182/mirror/${tool === 'aube' ? 'aube.tar.gz' : 'biome.elf'}`,
        digest: 'a'.repeat(64),
        stdoutDigest: 'b'.repeat(64),
        cors: 'passed' as const,
        exitCode: 0,
        phasesMs: {
          fetch: 5000,
          extract: 100,
          digest: 100,
          validate: 100,
          register: 100,
          run: 100,
        },
      })),
    ),
  );
}
test('formal36 requires six distinct trials in each of all six tool/browser combinations', () => {
  assert.equal(summarizeInstallTrials(trials()).length, 6);
  assert.throws(() => summarizeInstallTrials(trials().slice(1)), /36/);
});
test('duplicate trial cannot replace missing environment despite unchanged count', () => {
  const rows = trials();
  rows[1] = { ...rows[0]! };
  assert.throws(() => summarizeInstallTrials(rows), /duplicate/);
});
test('performance median excludes fetch but includes digest and all remaining actual phases', () => {
  const rows = trials();
  rows[0]!.phasesMs.run = 10000;
  assert.equal(summarizeInstallTrials(rows)[0]!.medianMs, 500);
  for (let i = 1; i <= 5; i++) rows[i]!.phasesMs.digest = 2700;
  assert.throws(() => summarizeInstallTrials(rows), /3000ms/);
});
test('median accepts3000 and rejects3000.001 without changing individual deadlines', () => {
  const rows = trials();
  for (const row of rows) row.phasesMs.run = 2600;
  assert.equal(summarizeInstallTrials(rows)[0]!.medianMs, 3000);
  for (const row of rows) row.phasesMs.run = 2600.001;
  assert.throws(() => summarizeInstallTrials(rows), /3000ms/);
});
test('unknown version, wrong URL, failed output and nonfinite phase cannot pass formal summary', () => {
  for (const change of [
    { version: 'latest' },
    { url: 'http://localhost:4182/x' },
    { exitCode: 1 },
    { digest: 'wrong' },
    { phasesMs: { ...trials()[0]!.phasesMs, validate: NaN } },
  ]) {
    const rows = trials();
    Object.assign(rows[0]!, change);
    assert.throws(() => summarizeInstallTrials(rows), /failed trial/);
  }
});
function realms() {
  return [
    'node-host',
    ...Array.from(
      { length: INSTALL_REALMS.nodeWorkers },
      (_, i) => `node-worker-${i + 1}`,
    ),
  ].map((name) => ({ name, counts: [1] }));
}
test('fresh combined U2U3 collector requires host and all seven actual Node Workers', () => {
  assertInstallNodeRealms(realms());
  assert.equal(INSTALL_REALMS.nodeWorkers, 7);
  assert.throws(() => assertInstallNodeRealms(realms().slice(1)), /inventory/);
});
test('duplicate, unknown and unregistered realms cannot be replaced with zero coverage', () => {
  for (const mutation of ['duplicate', 'unknown', 'unregistered']) {
    const rows = realms();
    if (mutation === 'duplicate') rows[1] = rows[0]!;
    else if (mutation === 'unknown') rows[1]!.name = 'fake';
    else rows[1]!.counts[0] = 0;
    assert.throws(() => assertInstallNodeRealms(rows), /inventory|registered/);
  }
});
function manifest() {
  return {
    schema: 'migration-install-ci-inputs',
    version: 1,
    producer: 'main-session-observed-inputs',
    files: INSTALL_INPUT_POLICY.paths.map((path) => ({
      path,
      bytes: 1,
      sha256: 'a'.repeat(64),
    })),
    sourceFiles: [{ path: 'runtime/install.js', sha256: 'b'.repeat(64) }],
  };
}
test('U3 CI input admission refuses a manifest without the required actual distribution site', () => {
  const withoutSite = manifest();
  withoutSite.files = withoutSite.files.filter(
    (entry) => entry.path !== INSTALL_SITE_ARCHIVE,
  );
  assert.throws(
    () => validateCIInputManifest(withoutSite, INSTALL_INPUT_POLICY),
    /inventory|site|missing/,
  );
});
test('U3 admits the new versioned site archive while preserving every existing logical input row', () => {
  const updated = manifest();
  const archive = updated.files.find((row) =>
    row.path.includes('/actual-site'),
  )!;
  archive.path = '.artifacts/migration-install/actual-site-v2.tar.gz';
  assert.doesNotThrow(() =>
    validateCIInputManifest(updated, INSTALL_INPUT_POLICY),
  );
  assert.equal(
    updated.files.filter((row) => row.path === 'dist/guests/aube').length,
    1,
  );
  assert.equal(
    updated.files.filter(
      (row) => row.path === '.artifacts/u2-release-inputs/aube-v2.7.0/aube',
    ).length,
    1,
  );
});
test('U3 archive admission rejects the guest supplied only by the fixed existing CI reference', () => {
  const referencedGuest =
    'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest';
  assert.throws(
    () => validateInstallSiteEntry(referencedGuest, 36948544),
    /reference|excluded|archive/,
  );
});
test('U3 fixed reference manifest permits exactly the existing source identity and no fallback aliases', () => {
  const row = {
    path: INSTALL_SITE_REFERENCE.source,
    bytes: INSTALL_SITE_REFERENCE.bytes,
    sha256: INSTALL_SITE_REFERENCE.sha256,
  };
  assert.doesNotThrow(() => validateInstallSiteReferenceManifest([row]));
  for (const rows of [
    [],
    [{ ...row, path: '.artifacts/u2-release-inputs/aube-v2.7.0/aube' }],
    [{ ...row, bytes: row.bytes + 1 }],
    [{ ...row, sha256: '0'.repeat(64) }],
    [row, row],
  ])
    assert.throws(
      () => validateInstallSiteReferenceManifest(rows),
      /fixed reference source missing\/differs/,
    );
});
test('U3 fixed source reader requires its one path, refuses same-size mutation and symlinks, and reads actual accepted bytes', async () => {
  const scratch = resolve('.artifacts/migration-install');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(resolve(scratch, 'acceptance-reference-'));
  try {
    await mkdir(resolve(directory, 'dist/guests'), { recursive: true });
    // A same-identity alias is deliberately present but cannot supply the fixed path.
    const alias = resolve(
      directory,
      '.artifacts/u2-release-inputs/aube-v2.7.0/aube',
    );
    await mkdir(dirname(alias), { recursive: true });
    await copyFile(resolve(INSTALL_SITE_REFERENCE.source), alias);
    await assert.rejects(readInstallSiteReference(directory), /ENOENT/);
    const source = resolve(directory, INSTALL_SITE_REFERENCE.source);
    await writeFile(source, Buffer.alloc(INSTALL_SITE_REFERENCE.bytes));
    await assert.rejects(
      readInstallSiteReference(directory),
      /fixed reference source size\/digest mismatch/,
    );
    await rm(source);
    await symlink(alias, source);
    await assert.rejects(
      readInstallSiteReference(directory),
      /symlink\/special/,
    );
    await rm(source);
    await copyFile(alias, source);
    const bytes = await readInstallSiteReference(directory);
    assert.equal(bytes.length, INSTALL_SITE_REFERENCE.bytes);
    assert.equal(sha256(bytes), INSTALL_SITE_REFERENCE.sha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const reporter of ['tap', 'spec']) {
  for (const incomplete of ['skip', 'todo']) {
    test(`U3 real child exit0 with ${reporter} ${incomplete} cannot become acceptance evidence`, async () => {
      const scratch = resolve('.artifacts/migration-install');
      await mkdir(scratch, { recursive: true });
      const directory = await mkdtemp(resolve(scratch, 'acceptance-red-'));
      const inheritedTestContext = process.env.NODE_TEST_CONTEXT;
      try {
        const fixture = resolve(directory, 'required.test.mjs');
        await writeFile(
          fixture,
          `import test from 'node:test';\ntest('executed', () => {});\ntest('required actual distribution', { ${incomplete}: true }, () => {});\n`,
        );
        // A nested Node test runner inherits a recursion marker from the parent.
        // Remove only that marker for this sequential child, restoring it below.
        delete process.env.NODE_TEST_CONTEXT;
        let rejected: unknown;
        try {
          await executeInstallCommand(
            {
              executable: process.execPath,
              cwd: process.cwd(),
              args: ['--test', `--test-reporter=${reporter}`, fixture],
            },
            resolve(directory, 'raw.log'),
            { forwardOutput: false },
          );
        } catch (error) {
          rejected = error;
        }
        const raw = await readFile(resolve(directory, 'raw.log'), 'utf8');
        assert.doesNotMatch(raw, /recursively within a test file/);
        assert.match(raw, /(?:#|ℹ) tests 2\b/);
        assert.match(raw, /(?:#|ℹ) pass 1\b/);
        assert.match(raw, /(?:#|ℹ) fail 0\b/);
        assert.match(
          raw,
          new RegExp(
            `(?:#|ℹ) ${incomplete === 'skip' ? 'skipped' : 'todo'} 1\\b`,
          ),
        );
        assert.ok(
          rejected instanceof Error,
          'exit0 incomplete child must be rejected',
        );
        assert.match(rejected.message, /skip|todo|incomplete|summary/i);
      } finally {
        if (inheritedTestContext === undefined)
          delete process.env.NODE_TEST_CONTEXT;
        else process.env.NODE_TEST_CONTEXT = inheritedTestContext;
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
test('U3 input schema adds both accepted mirror assets and rejects old U2 schema/default policy substitution', () => {
  assert.equal(
    validateCIInputManifest(manifest(), INSTALL_INPUT_POLICY).files.length,
    CI_INPUT_PATHS.length + 3,
  );
  assert.throws(() => validateCIInputManifest(manifest()), /schema/);
  const old = manifest();
  old.schema = 'migration-session-ci-inputs';
  assert.throws(
    () => validateCIInputManifest(old, INSTALL_INPUT_POLICY),
    /schema/,
  );
});
test('U3 input omissions and duplicate/unknown destination reject before writes', () => {
  for (const mutation of ['missing', 'duplicate', 'unknown']) {
    const row = manifest();
    if (mutation === 'missing') row.files.pop();
    else if (mutation === 'duplicate') row.files[1] = row.files[0]!;
    else row.files[0]!.path = 'secrets/key';
    assert.throws(
      () => validateCIInputManifest(row, INSTALL_INPUT_POLICY),
      /inventory|duplicate|unknown/,
    );
  }
});
test('U3 input source self-reference, wrong producer, byte overflow and unsorted sources reject', () => {
  for (const mutation of ['self', 'producer', 'bytes', 'unsorted']) {
    const row = manifest();
    if (mutation === 'self')
      row.sourceFiles[0]!.path = 'ci/migration-install/inputs.bundle.json';
    else if (mutation === 'producer') row.producer = 'fabricated';
    else if (mutation === 'bytes') row.files[0]!.bytes = 134217729;
    else row.sourceFiles.push({ path: 'a.js', sha256: 'a'.repeat(64) });
    assert.throws(
      () => validateCIInputManifest(row, INSTALL_INPUT_POLICY),
      /self|schema|limit|sorted/,
    );
  }
});
test('completion declares U2U3/regressions/all three fresh browser collections/formal measurement sequentially', () => {
  const commands = installCompletionCommands(
    '/workspace',
    '/workspace/coverage',
    '/workspace/measure',
  );
  assert.equal(commands.length, 19);
  assert.ok(
    commands.some((command) => command.args.includes('migration-install-unit')),
  );
  assert.ok(
    commands.some((command) =>
      command.args.includes('tests/node/probe.test.js'),
    ),
  );
  assert.ok(
    commands.some((command) =>
      command.args.includes('tests/migration-install/acceptance.test.js'),
    ),
  );
  assert.equal(
    commands.at(-1)!.args[0],
    'scripts/migration-install/measure.js',
  );
  assert.equal(
    commands.filter((command) =>
      command.args.includes('playwright.coverage.config.mjs'),
    ).length,
    3,
  );
});
test('U3 CI context requires exact dedicated branch, actual event, repository and numeric run attempt', () => {
  const env = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'Marukome0743/formicarium',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/codex/terrarium-migration-u3',
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '1',
    GITHUB_RUN_ATTEMPT: '1',
  };
  assert.equal(validateInstallCIContext(env).head, env.GITHUB_SHA);
  for (const change of [
    { GITHUB_REF: 'refs/heads/codex/terrarium-migration-u2' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REPOSITORY: 'untrusted/formicarium' },
    { GITHUB_SHA: 'short' },
    { GITHUB_RUN_ATTEMPT: '0' },
    { GITHUB_ACTIONS: 'false' },
  ])
    assert.throws(
      () => validateInstallCIContext({ ...env, ...change }),
      /context refused/,
    );
});
test('U3 CI maps only scoped unit/browser tasks and refuses escaping cwd or arbitrary executable', () => {
  const root = '/workspace';
  const unit = mapInstallCICommand(
    { executable: 'mise', cwd: root, args: ['run', 'migration-install-unit'] },
    root,
  );
  assert.equal(
    unit.args.at(-1),
    'tests/migration-install/hash-regression.test.js',
  );
  assert.equal(unit.args.filter((arg) => arg.endsWith('.test.js')).length, 8);
  const browser = mapInstallCICommand(
    {
      executable: 'mise',
      cwd: root,
      args: ['run', 'migration-install-browser'],
    },
    root,
  );
  assert.ok(browser.args.includes('--workers=1'));
  assert.ok(browser.args.includes('--retries=0'));
  assert.deepEqual(
    browser.args.filter((arg) => arg.endsWith('.spec.ts')),
    [
      'tests/migration-install/consumer.spec.ts',
      'tests/migration-install/hash-regression.spec.ts',
    ],
  );
  for (const command of [
    { executable: 'bash', cwd: root, args: ['anything'] },
    {
      executable: 'mise',
      cwd: '/outside',
      args: ['run', 'migration-install-unit'],
    },
    { executable: 'mise', cwd: root, args: ['run', 'publish'] },
  ])
    assert.throws(() => mapInstallCICommand(command, root), /refused/);
});

const completeTap =
  '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
test('U3 accepts complete TAP, spec and Playwright summaries and all concatenated Node suites', () => {
  for (const raw of [
    completeTap,
    completeTap.replace(/^# /gm, 'ℹ '),
    completeTap + completeTap,
    '  45 passed (42.2s)\n',
  ])
    assert.doesNotThrow(() => assertInstallTestOutput(raw));
});
test('U3 rejects zero, missing and malformed test summaries including incomplete Node counts', () => {
  for (const raw of [
    '',
    'exit0',
    '0 passed',
    completeTap.replaceAll('2', '0'),
    completeTap.replace('# tests 2', '# tests 3'),
    completeTap.replace('# todo 0\n', ''),
    completeTap + '# pass 1\n',
  ])
    assert.throws(() => assertInstallTestOutput(raw), /summary|incomplete/);
});
test('U3 rejects each positive Node incomplete count and TAP skip/TODO directives', () => {
  for (const field of ['fail', 'cancelled', 'skipped', 'todo'])
    assert.throws(
      () =>
        assertInstallTestOutput(
          completeTap.replace(`# ${field} 0`, `# ${field} 1`),
        ),
      /skip|TODO|incomplete/,
    );
  for (const directive of ['SKIP', 'TODO'])
    assert.throws(
      () =>
        assertInstallTestOutput(
          completeTap + `ok 3 - required # ${directive}\n`,
        ),
      /skip|TODO|incomplete/,
    );
});
test('U3 rejects Playwright skipped, failed, flaky, interrupted and not-run rows despite passed tests', () => {
  for (const field of [
    'skipped',
    'failed',
    'flaky',
    'interrupted',
    'did not run',
  ])
    assert.throws(
      () => assertInstallTestOutput(`1 ${field}\n45 passed (1s)\n`),
      /skip|TODO|incomplete/,
    );
});
test('U3 log replay rejects retained exit0 skip and digest tampering without requiring summaries for builds', async () => {
  const scratch = resolve('.artifacts/migration-install');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(resolve(scratch, 'acceptance-log-'));
  try {
    const path = resolve(directory, 'raw.log');
    const raw = completeTap.replace('# skipped 0', '# skipped 1');
    await writeFile(path, raw);
    const command = {
      executable: process.execPath,
      cwd: process.cwd(),
      args: ['--test', 'required.test.js'],
    };
    const execution = {
      rawLogPath: path,
      rawLogSha256: sha256(raw),
      exitCode: 0,
    };
    await assert.rejects(
      verifyInstallCommandLog(command, execution),
      /skip|TODO|incomplete/,
    );
    await writeFile(path, completeTap);
    await assert.rejects(
      verifyInstallCommandLog(command, execution),
      /log\/exit differs/,
    );
    const build = { ...command, args: ['scripts/ci/tasks.ts', 'build'] };
    assert.equal(isInstallTestCommand(build), false);
    await writeFile(path, 'build completed\n');
    await assert.doesNotReject(
      verifyInstallCommandLog(build, {
        ...execution,
        rawLogSha256: sha256('build completed\n'),
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('U3 restored actual site is mandatory before completion tests and cannot use an arbitrary caller path', async () => {
  const before = process.env.U2_ACTUAL_SITE;
  try {
    delete process.env.U2_ACTUAL_SITE;
    await assert.rejects(
      requireInstallActualSite(process.cwd()),
      /required restored path/,
    );
    process.env.U2_ACTUAL_SITE = '/arbitrary/site';
    await assert.rejects(
      requireInstallActualSite(process.cwd()),
      /required restored path/,
    );
  } finally {
    if (before === undefined) delete process.env.U2_ACTUAL_SITE;
    else process.env.U2_ACTUAL_SITE = before;
  }
});
test('U3 site file/metadata/total/entry limits include the exact boundary and refuse +1 and unsafe integers', () => {
  const metadata = INSTALL_ACTUAL_SITE_FILES.find((row) =>
    row.path.endsWith('.json'),
  )!.path;
  const guest = INSTALL_ACTUAL_SITE_FILES.find((row) =>
    row.path.endsWith('/guest'),
  )!.path;
  assert.doesNotThrow(() => validateInstallSiteEntry(metadata, 1048576));
  assert.throws(
    () => validateInstallSiteEntry(metadata, 1048577),
    /metadata limit/,
  );
  assert.doesNotThrow(() => validateInstallSiteEntry(guest, 134217728));
  assert.throws(
    () => validateInstallSiteEntry(guest, 134217729),
    /file byte limit/,
  );
  assert.doesNotThrow(() => validateInstallSiteBudget(268435456, 4096));
  assert.throws(
    () => validateInstallSiteBudget(268435457, 4096),
    /total limit/,
  );
  assert.throws(() => validateInstallSiteBudget(1, 4097), /entry limit/);
  for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateInstallSiteEntry(guest, value), /limit/);
    assert.throws(() => validateInstallSiteBudget(value, 1), /limit/);
  }
});
function siteTarMember(path: string, size = 0, type = 48) {
  const header = Buffer.alloc(512);
  const slash = path.lastIndexOf('/');
  header.write(path.length <= 100 ? path : path.slice(slash + 1), 0, 100);
  if (path.length > 100) header.write(path.slice(0, slash), 345, 155);
  header.write(size.toString(8).padStart(11, '0') + '\0', 124);
  header.fill(32, 148, 156);
  header[156] = type;
  header.write('ustar\0', 257);
  header.write(
    header
      .reduce((sum, byte) => sum + byte, 0)
      .toString(8)
      .padStart(6, '0') + '\0 ',
    148,
  );
  return header;
}
test('U3 site archive refuses gzip corruption, missing inventory, unknown/traversal paths, links and duplicate files', () => {
  const known = INSTALL_ACTUAL_SITE_FILES[0]!.path;
  assert.throws(() => decodeInstallSiteArchive(new Uint8Array([1, 2, 3])));
  assert.throws(
    () => decodeInstallSiteArchive(gzipSync(Buffer.alloc(1024))),
    /missing inventory/,
  );
  for (const path of [
    'unknown.json',
    '../escape',
    '/absolute',
    'dist/../escape',
  ])
    assert.throws(
      () =>
        decodeInstallSiteArchive(
          gzipSync(Buffer.concat([siteTarMember(path), Buffer.alloc(1024)])),
        ),
      /unknown path|UNSAFE_ASSET_PATH/,
    );
  assert.throws(
    () =>
      decodeInstallSiteArchive(
        gzipSync(
          Buffer.concat([siteTarMember(known, 0, 50), Buffer.alloc(1024)]),
        ),
      ),
    /symlink\/special/,
  );
  assert.throws(
    () =>
      decodeInstallSiteArchive(
        gzipSync(
          Buffer.concat([
            siteTarMember(known),
            siteTarMember(known),
            Buffer.alloc(1024),
          ]),
        ),
      ),
    /duplicate path/,
  );
});
test('U3 archive rejects oversized metadata/file headers, broken checksum and missing complete terminator', () => {
  const metadata = INSTALL_ACTUAL_SITE_FILES.find((row) =>
    row.path.endsWith('.json'),
  )!.path;
  const guest = INSTALL_ACTUAL_SITE_FILES.find((row) =>
    row.path.endsWith('/guest'),
  )!.path;
  for (const [path, bytes, reason] of [
    [metadata, 1048577, /metadata limit/],
    [guest, 134217729, /file byte limit/],
  ] as const)
    assert.throws(
      () => decodeInstallSiteArchive(gzipSync(siteTarMember(path, bytes))),
      reason,
    );
  const broken = siteTarMember(metadata);
  broken[0] = broken[0]! ^ 1;
  assert.throws(() => decodeInstallSiteArchive(gzipSync(broken)), /checksum/);
  assert.throws(
    () =>
      decodeInstallSiteArchive(
        gzipSync(Buffer.concat([siteTarMember(metadata), Buffer.alloc(512)])),
      ),
    /end\/trailing/,
  );
});
test('U3 actual site inspection refuses missing/extra files, empty extra directories, same-size mutation and symlinks', async () => {
  const scratch = resolve('.artifacts/migration-install');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(resolve(scratch, 'acceptance-site-'));
  const site = resolve(directory, 'site');
  const first = INSTALL_ACTUAL_SITE_FILES[0]!;
  try {
    for (const row of INSTALL_ACTUAL_SITE_FILES) {
      await mkdir(dirname(resolve(site, row.path)), { recursive: true });
      // Deliberately untrusted files: exact inventory and the first file's real
      // byte count are insufficient without its digest. No production evidence.
      await writeFile(
        resolve(site, row.path),
        Buffer.alloc(row.path === first.path ? first.bytes : 0),
      );
    }
    await assert.rejects(
      inspectInstallActualSite(site),
      /size\/digest mismatch/,
    );
    await writeFile(resolve(site, 'unknown'), 'extra');
    await assert.rejects(inspectInstallActualSite(site), /unknown file/);
    await rm(resolve(site, 'unknown'));
    await mkdir(resolve(site, 'extra-directory'));
    await assert.rejects(inspectInstallActualSite(site), /extra directory/);
    await rm(resolve(site, 'extra-directory'), { recursive: true });
    const tools = resolve(site, 'tools.json');
    await rm(tools);
    await assert.rejects(
      inspectInstallActualSite(site),
      /missing\/extra inventory/,
    );
    await writeFile(resolve(directory, 'external'), 'untrusted');
    await symlink(resolve(directory, 'external'), tools);
    await assert.rejects(inspectInstallActualSite(site), /symlink entry/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('U3 acceptance entries import no U4 module, so the dependency stays U4 to U3', async () => {
  for (const name of ['stage', 'completion', 'coverage', 'measure'])
    for (const extension of ['ts', 'js']) {
      const text = await readFile(
        new URL(
          `../../scripts/migration-install/${name}.${extension}`,
          import.meta.url,
        ),
        'utf8',
      );
      assert.equal(
        /migration-command\//.test(text),
        false,
        `${name}.${extension} imports a U4 module`,
      );
    }
});
test('U3 binds U3 candidates to its own inventory and needs a caller inventory for U4 candidates', async () => {
  assert.deepEqual(INSTALL_REGRESSION_UNITS, ['u3-install', 'u4-command']);
  const root = resolve('.');
  const own = await installSourceInventory(root);
  assert.deepEqual(await installCandidateInventory('u3-install', root), own);
  // A supplied U4 inventory cannot redirect a U3 candidate.
  assert.deepEqual(
    await installCandidateInventory('u3-install', root, {
      commandSourceInventory: async () => [],
    }),
    own,
  );
  await assert.rejects(
    installCandidateInventory('u4-command', root),
    /no source inventory/,
  );
  const supplied = [{ path: 'x', sha256: 'a'.repeat(64) }];
  assert.deepEqual(
    await installCandidateInventory('u4-command', root, {
      commandSourceInventory: async (at) => {
        assert.equal(at, root);
        return supplied;
      },
    }),
    supplied,
  );
  for (const unit of ['u2-session-guest-api', 'u5-toolbuild', undefined, 7])
    await assert.rejects(
      installCandidateInventory(unit, root, {
        commandSourceInventory: async () => supplied,
      }),
      /no source inventory/,
    );
});
test('U3 candidate check refuses a U4 candidate without a caller inventory and other units first', async () => {
  const scratch = await mkdtemp(resolve('.artifacts', 'u3-candidate-unit-'));
  try {
    const write = async (unit: string) => {
      const path = resolve(scratch, `${unit}.json`);
      await writeFile(
        path,
        JSON.stringify({
          unit,
          version: '0.3.0',
          provisional: true,
          sourceCommit: 'a'.repeat(40),
        }),
      );
      return path;
    };
    await assert.rejects(
      checkInstallCandidate(await write('u4-command'), resolve('.')),
      /no source inventory/,
    );
    await assert.rejects(
      checkInstallCandidate(await write('u2-session-guest-api'), resolve('.')),
      /current U3 candidate identity missing/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
test('U3 report names the candidate unit and its later acceptance', () => {
  assert.deepEqual(installReportScope('u3-install'), {
    unit: 'u3-install',
    laterUnits: 'U4 command/B1未受入',
  });
  assert.deepEqual(installReportScope('u4-command'), {
    unit: 'u4-command',
    laterUnits: 'U4 B1未受入（U4候補でのU3回帰）',
  });
  assert.throws(() => installReportScope('u2-session-guest-api'), /unit/);
});
