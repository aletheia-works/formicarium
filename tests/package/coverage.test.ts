import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { Worker } from 'node:worker_threads';
import type { FileCoverageData } from 'istanbul-lib-coverage';
import type { Realm } from '../../scripts/coverage-types.js';
import {
  bridgeSource,
  counterLayout,
  createRealm,
  directStatementSource,
  instrumentPackage,
  mergeRealms,
  prepareCoverage,
  readPlaywrightNodeRealms,
  reportCoverage,
} from '../../scripts/package/coverage.js';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
} from '../../scripts/package/stage-package.js';

const { createInstrumenter } = createRequire(import.meta.url)(
  'istanbul-lib-instrument',
);
const metadata = FIRST_PARTY_JS.map((path) => {
  const instrumenter = createInstrumenter({ esModules: true });
  instrumenter.instrumentSync(
    'export const value = 1;\nexport function unused() {\n return 2;\n}\n',
    path,
  );
  return instrumenter.lastFileCoverage();
});
const layout = counterLayout(metadata);
const register = (realm: Realm) => {
  Atomics.store(new Int32Array(realm.buffer), 0, 1);
  return realm;
};

test('generated Playwright configuration initializes a real Node importer and preserves begin/final runner receipts', async () => {
  await mkdir('.artifacts', { recursive: true });
  const scratch = await mkdtemp(
    join(process.cwd(), '.artifacts', 'playwright-node-red-'),
  );
  const root = join(scratch, 'root'),
    source = join(scratch, 'source'),
    out = join(scratch, 'coverage');
  const put = async (path: string, text: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  };
  try {
    for (const path of PACKAGE_FILES)
      await put(
        join(source, path),
        path === 'runtime/contracts.js'
          ? 'export const sampled = 41;\n'
          : path === 'package.json'
            ? '{"type":"module"}'
            : '',
      );
    for (const path of [
      'tests/shared',
      'scripts/package',
      '.artifacts/u1-fixture',
      'dist/guests',
    ])
      await mkdir(join(root, path), { recursive: true });
    await put(join(root, 'scripts/playwright-build-config.js'), 'export {};');
    await put(
      join(root, 'tests/package/playwright.config.ts'),
      "import './runner-helper.mjs'; export default {testMatch: '**/*.spec.ts'};\n",
    );
    await put(
      join(root, 'tests/package/runner-helper.mjs'),
      "import {sampled} from '../../runtime/contracts.js'; if(sampled!==41)throw Error('fixture import mismatch');\n",
    );
    for (const spec of [
      'browser-api.spec.js',
      'browser-worker.spec.js',
      'browser-broker.spec.js',
      'consumer.spec.js',
    ])
      await put(
        join(root, 'tests/package', spec),
        'const candidate = {};\nconst guest = {};\n',
      );
    await put(
      join(root, 'tests/package/consumer.test.js'),
      'const candidate = {};\nconst { createSession } = {};\n',
    );
    await prepareCoverage({ source, out, root });
    await put(join(out, 'package.json'), '{"type":"module"}');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(
      process.execPath,
      [join(out, 'tests/package/playwright.config.ts')],
      { env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text) => {
      stderr += text;
    });
    child.stdout.resume();
    const [code, signal] = await once(child, 'close');
    assert.equal(signal, null, stderr);
    assert.equal(
      code,
      0,
      `real generated Node collection must initialize writer before static contracts import:\n${stderr}`,
    );
    const directory = join(out, 'coverage-playwright-node', 'package');
    const begin = JSON.parse(
      await readFile(join(directory, `${child.pid}.begin.json`), 'utf8'),
    );
    const final = JSON.parse(
      await readFile(join(directory, `${child.pid}.end.json`), 'utf8'),
    );
    assert.equal(begin.suite, 'package');
    assert.equal(begin.pid, child.pid);
    assert.equal(final.suite, begin.suite);
    assert.equal(final.pid, begin.pid);
    assert.equal(final.exitCode, 0);
    assert.equal(final.counts[0], 1);
    assert.ok(
      final.counts.some(
        (count: number, index: number) => index > 0 && count > 0,
      ),
      'real instrumented contracts hit must be retained',
    );
    const retained = await readPlaywrightNodeRealms(out, ['package']);
    assert.equal(retained.length, 1);
    assert.deepEqual([...new Int32Array(retained[0]!.buffer)], final.counts);
    const worker = spawn(
      process.execPath,
      [join(out, 'tests/package/playwright.config.ts')],
      { env, stdio: 'ignore' },
    );
    const [workerCode, workerSignal] = await once(worker, 'close');
    assert.equal(workerCode, 0);
    assert.equal(workerSignal, null);
    const withWorker = await readPlaywrightNodeRealms(out, ['package']);
    assert.equal(
      withWorker.length,
      2,
      'separate real runner worker process is retained',
    );
    assert.notEqual(withWorker[0]!.name, withWorker[1]!.name);
    assert.notEqual(withWorker[0]!.buffer, withWorker[1]!.buffer);
    for (const realm of withWorker)
      assert.deepEqual([...new Int32Array(realm.buffer)], final.counts);
    for (const mutation of [
      { ...final, exitCode: 1 },
      { ...final, abnormal: true },
      { ...final, id: 'stale-generation' },
      { ...final, pid: final.pid + 1 },
      { ...final, counts: final.counts.slice(1) },
      {
        ...final,
        counts: final.counts.map((count: number, index: number) =>
          index === 0 ? 0 : count,
        ),
      },
      {
        ...final,
        counts: final.counts.map((count: number, index: number) =>
          index === 2 ? -1 : count,
        ),
      },
    ]) {
      await writeFile(
        join(directory, `${child.pid}.end.json`),
        JSON.stringify(mutation),
      );
      await assert.rejects(
        readPlaywrightNodeRealms(out, ['package']),
        /Playwright/,
      );
    }
    await writeFile(
      join(directory, `${child.pid}.end.json`),
      JSON.stringify(final),
    );
    await writeFile(join(directory, 'unexpected.json'), '{}');
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
    );
    await rm(join(directory, 'unexpected.json'));
    const killed = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(join(out, 'coverage-playwright-node-package.mjs'))});process.kill(process.pid,'SIGKILL');`,
      ],
      { env, stdio: 'ignore' },
    );
    const [, killedSignal] = await once(killed, 'close');
    assert.equal(killedSignal, 'SIGKILL');
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
    );
    await rm(join(directory, `${killed.pid}.begin.json`));
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package', 'session']),
      /Playwright/,
    );
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['unknown']),
      /Playwright/,
    );
    await rm(join(directory, `${child.pid}.end.json`));
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

/** Builds the same minimal package fixture as the real Node importer test above. */
async function preparePlaywrightNodeFixture(scratch: string) {
  const root = join(scratch, 'root'),
    source = join(scratch, 'source'),
    out = join(scratch, 'coverage');
  const put = async (path: string, text: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  };
  for (const path of PACKAGE_FILES)
    await put(
      join(source, path),
      path === 'runtime/contracts.js'
        ? 'export const sampled = 41;\n'
        : path === 'package.json'
          ? '{"type":"module"}'
          : '',
    );
  for (const path of [
    'tests/shared',
    'scripts/package',
    '.artifacts/u1-fixture',
    'dist/guests',
  ])
    await mkdir(join(root, path), { recursive: true });
  await put(join(root, 'scripts/playwright-build-config.js'), 'export {};');
  await put(
    join(root, 'tests/package/playwright.config.ts'),
    "import './runner-helper.mjs'; export default {testMatch: '**/*.spec.ts'};\n",
  );
  await put(
    join(root, 'tests/package/runner-helper.mjs'),
    "import {sampled} from '../../runtime/contracts.js'; if(sampled!==41)throw Error('fixture import mismatch');\n",
  );
  for (const spec of [
    'browser-api.spec.js',
    'browser-worker.spec.js',
    'browser-broker.spec.js',
    'consumer.spec.js',
  ])
    await put(
      join(root, 'tests/package', spec),
      'const candidate = {};\nconst guest = {};\n',
    );
  await put(
    join(root, 'tests/package/consumer.test.js'),
    'const candidate = {};\nconst { createSession } = {};\n',
  );
  await prepareCoverage({ source, out, root });
  await put(join(out, 'package.json'), '{"type":"module"}');
  return out;
}

/** Spawns synchronously so callers mapping over it start every process at once. */
async function runNodeProcess(args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (text: string) => {
    stderr += text;
  });
  const [code, signal] = await once(child, 'close');
  assert.ok(child.pid, `spawned Node process has a pid:\n${stderr}`);
  return { pid: child.pid, code, signal, stderr };
}

test('independent launch ledger matches every concurrent Playwright Node runner and refuses a runner missing both receipts', async () => {
  await mkdir('.artifacts', { recursive: true });
  const scratch = await mkdtemp(
    join(process.cwd(), '.artifacts', 'playwright-ledger-red-'),
  );
  const stash = join(scratch, 'stash');
  try {
    const out = await preparePlaywrightNodeFixture(scratch);
    await mkdir(stash, { recursive: true });
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const config = join(out, 'tests/package/playwright.config.ts');
    const runs = await Promise.all(
      Array.from({ length: 4 }, () => runNodeProcess([config], env)),
    );
    for (const run of runs) {
      assert.equal(run.signal, null, run.stderr);
      assert.equal(run.code, 0, run.stderr);
    }
    const pids = runs.map((run) => run.pid);
    const sortedPids = [...pids].sort((a, b) => a - b);
    assert.equal(new Set(pids).size, 4, 'four distinct concurrent runners');
    const directory = join(out, 'coverage-playwright-node', 'package');
    const ledgerPath = join(directory, 'launches.jsonl');
    const receipt = (pid: number, kind: 'begin' | 'end') =>
      join(directory, `${pid}.${kind}.json`);
    const stashed = (pid: number, kind: 'begin' | 'end') =>
      join(stash, `${pid}.${kind}.json`);
    const finals = new Map<number, { counts: number[] }>();
    for (const pid of pids)
      finals.set(pid, JSON.parse(await readFile(receipt(pid, 'end'), 'utf8')));
    const retained = await readPlaywrightNodeRealms(out, ['package']);
    assert.equal(retained.length, 4, 'every concurrent runner realm retained');
    assert.deepEqual(
      retained.map((realm) => realm.name).sort(),
      pids.map((pid) => `playwright:package:${pid}`).sort(),
    );
    for (const realm of retained) {
      const pid = Number(realm.name.split(':')[2]);
      assert.deepEqual(
        [...new Int32Array(realm.buffer)],
        finals.get(pid)?.counts,
        'raw final counts are preserved per runner',
      );
    }

    // Intended RED: a launched runner whose begin and end are both absent.
    const hidden = pids[0]!;
    for (const kind of ['begin', 'end'] as const)
      await rename(receipt(hidden, kind), stashed(hidden, kind));
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
      'a launched runner missing both begin and end receipts must be refused',
    );
    for (const kind of ['begin', 'end'] as const)
      await rename(stashed(hidden, kind), receipt(hidden, kind));

    const generation = JSON.parse(
      await readFile(join(out, 'coverage-playwright-generation.json'), 'utf8'),
    ) as Record<string, unknown>;
    const record = (pid: number, change: Record<string, unknown> = {}) =>
      JSON.stringify({
        ...generation,
        suite: 'package',
        pid,
        ppid: process.pid,
        ...change,
      });
    const ledger = await readFile(ledgerPath, 'utf8');
    assert.ok(ledger.endsWith('\n'), 'ledger ends with a complete record');
    const lines = ledger.slice(0, -1).split('\n');
    assert.equal(lines.length, 4, 'one ledger record per launched runner');
    const ledgerPids: number[] = [];
    for (const line of lines) {
      const parsed = JSON.parse(line) as { pid: number };
      assert.equal(
        line,
        record(parsed.pid),
        'each ledger line is one unmixed generation identity record',
      );
      ledgerPids.push(parsed.pid);
      const begin = JSON.parse(
        await readFile(receipt(parsed.pid, 'begin'), 'utf8'),
      ) as { ppid: number };
      assert.equal(begin.ppid, process.pid, 'begin ppid matches ledger ppid');
    }
    assert.deepEqual(
      [...ledgerPids].sort((a, b) => a - b),
      sortedPids,
      'ledger pid set equals the spawned runner pid set',
    );

    const target = pids[1]!;
    const first = JSON.parse(lines[0]!) as { pid: number };
    const beginText = await readFile(receipt(target, 'begin'), 'utf8');
    const restoreLedger = () => writeFile(ledgerPath, ledger);
    const withFirst = (change: Record<string, unknown>) =>
      `${[record(first.pid, change), ...lines.slice(1)].join('\n')}\n`;
    const refuse = async (
      label: string,
      mutate: () => Promise<unknown>,
      restore: () => Promise<unknown> = restoreLedger,
    ) => {
      await mutate();
      try {
        await assert.rejects(
          readPlaywrightNodeRealms(out, ['package']),
          /Playwright/,
          label,
        );
      } finally {
        await restore();
      }
    };
    for (const kind of ['begin', 'end'] as const)
      await refuse(
        `${kind} receipt alone missing`,
        () => rename(receipt(target, kind), stashed(target, kind)),
        () => rename(stashed(target, kind), receipt(target, kind)),
      );
    await refuse(
      'ledger missing',
      () => rename(ledgerPath, join(stash, 'launches.jsonl')),
      () => rename(join(stash, 'launches.jsonl'), ledgerPath),
    );
    await refuse(
      'ledger symlink',
      async () => {
        await rename(ledgerPath, join(stash, 'launches.jsonl'));
        await symlink(join(stash, 'launches.jsonl'), ledgerPath);
      },
      async () => {
        await rm(ledgerPath);
        await rename(join(stash, 'launches.jsonl'), ledgerPath);
      },
    );
    await refuse('ledger empty', () => writeFile(ledgerPath, ''));
    await refuse('duplicate ledger record', () =>
      writeFile(ledgerPath, `${ledger}${lines[0]}\n`),
    );
    await refuse('unknown ledger pid without receipts', () =>
      writeFile(ledgerPath, `${ledger}${record(999999)}\n`),
    );
    await refuse(
      'receipt pair absent from ledger',
      async () => {
        await writeFile(receipt(999998, 'begin'), record(999998));
        await writeFile(
          receipt(999998, 'end'),
          JSON.stringify({
            ...JSON.parse(record(999998)),
            exitCode: 0,
            abnormal: false,
            counts: finals.get(target)?.counts,
          }),
        );
      },
      async () => {
        await rm(receipt(999998, 'begin'));
        await rm(receipt(999998, 'end'));
      },
    );
    await refuse('ledger generation id altered', () =>
      writeFile(ledgerPath, withFirst({ id: 'stale-generation' })),
    );
    await refuse('ledger ppid altered', () =>
      writeFile(ledgerPath, withFirst({ ppid: process.pid + 1 })),
    );
    await refuse('ledger out altered', () =>
      writeFile(ledgerPath, withFirst({ out: join(scratch, 'other') })),
    );
    await refuse('ledger metadataSha256 altered', () =>
      writeFile(ledgerPath, withFirst({ metadataSha256: 'f'.repeat(64) })),
    );
    await refuse('ledger record with extra field', () =>
      writeFile(ledgerPath, withFirst({ extra: true })),
    );
    await refuse('truncated final ledger line without newline', () =>
      writeFile(ledgerPath, ledger.slice(0, -10)),
    );
    await refuse('invalid JSON ledger line', () =>
      writeFile(ledgerPath, `${ledger}{"version":1,\n`),
    );
    await refuse(
      'begin ppid differs from ledger ppid',
      () =>
        writeFile(
          receipt(target, 'begin'),
          JSON.stringify({ ...JSON.parse(beginText), ppid: process.pid + 1 }),
        ),
      () => writeFile(receipt(target, 'begin'), beginText),
    );
    assert.equal(
      (await readPlaywrightNodeRealms(out, ['package'])).length,
      4,
      'restored ledger and receipts are accepted again',
    );

    const killed = await runNodeProcess(
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(join(out, 'coverage-playwright-node-package.mjs'))});process.kill(process.pid,'SIGKILL');`,
      ],
      env,
    );
    assert.equal(killed.signal, 'SIGKILL');
    assert.equal(
      await readFile(ledgerPath, 'utf8'),
      `${ledger}${record(killed.pid)}\n`,
      'killed runner is registered in the ledger before its product import',
    );
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
      'ledger-registered SIGKILL runner without end receipt',
    );
    await rm(receipt(killed.pid, 'begin'));
    await assert.rejects(
      readPlaywrightNodeRealms(out, ['package']),
      /Playwright/,
      'ledger-registered SIGKILL runner with no receipts at all',
    );
    await restoreLedger();
    assert.equal((await readPlaywrightNodeRealms(out, ['package'])).length, 4);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('direct generated counter expressions preserve prefix/postfix return values at saturation and reject unsupported shapes', () => {
  const instrumenter = createInstrumenter({
    compact: false,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
  });
  const generated = instrumenter.instrumentSync(
    'globalThis.result = 1;',
    'counter-fixture.js',
  );
  const file = instrumenter.lastFileCoverage() as FileCoverageData;
  const rows = counterLayout([file]);
  const name = /function (cov_\w+)\(/.exec(generated)![1]!;
  const key = Object.keys(file.s)[0]!;
  const appended =
    generated +
    `\nglobalThis.step=()=>[${name}().s[${key}]++,++${name}().s[${key}]];`;
  const run = (text: string) => {
    const realm = createRealm(rows, 'counter-fixture');
    const state = runInNewContext(
      bridgeSource(rows) +
        text +
        `\n({step:globalThis.step,file:globalThis.__coverage__['counter-fixture.js']})`,
      { __coverageCounters: new Int32Array(realm.buffer) },
    );
    state.file.s[key] = 2147483647;
    return JSON.parse(JSON.stringify(state.step()));
  };
  assert.deepEqual(run(directStatementSource(appended, file)), run(appended));
  assert.deepEqual(
    run(directStatementSource(appended, file)),
    [2147483647, 2147483648],
  );
  for (const expression of [
    `${name}().s[${key}]--`,
    `${name}().s[${key}] += 2`,
    `${name}().s[999999]++`,
    `${name}().s['${key}']++`,
    `${name}()['s'][${key}]++`,
  ])
    assert.throws(
      () => directStatementSource(generated + '\n' + expression, file),
      /unsupported coverage statement/,
    );
  assert.throws(
    () => directStatementSource('function cov_wrong(){}', file),
    /unsupported coverage statement bootstrap/,
  );
  assert.throws(
    () => directStatementSource(generated + '\ncov_wrong().s[0]++;', file),
    /unsupported coverage getter mismatch/,
  );
  assert.throws(
    () =>
      runInNewContext(
        bridgeSource(rows) +
          "globalThis.__coverageStatementWriter('unknown-file.js')",
        {
          __coverageCounters: new Int32Array(
            createRealm(rows, 'unknown').buffer,
          ),
        },
      ),
    /unregistered coverage statement writer/,
  );
});

test('extra planned Node Workers must be a nonnegative integer before any evidence is read', async () => {
  for (const extraNodeWorkers of [-1, 0.5, Number.NaN])
    await assert.rejects(
      reportCoverage({
        out: '/nonexistent-coverage-out',
        browserResults: '/nonexistent-browser-results',
        candidatePath: '/nonexistent-candidate.json',
        extraNodeWorkers,
      }),
      /extra Node Worker count must be a nonnegative integer/,
    );
  await assert.rejects(
    reportCoverage({
      out: '/nonexistent-coverage-out',
      browserResults: '/nonexistent-browser-results',
      candidatePath: '/nonexistent-candidate.json',
      extraNodeWorkers: 1,
    }),
    { code: 'ENOENT' },
  );
});

test('direct generated counters run without a coverage bridge and keep their return values', () => {
  // Release-candidate browser specs import instrumented modules into pages
  // that never load the bridge; stock istanbul discards those counts.
  const instrumenter = createInstrumenter({
    compact: false,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
  });
  const generated = instrumenter.instrumentSync(
    'globalThis.result = 41 + 1;',
    'unbridged-fixture.js',
  );
  const file = instrumenter.lastFileCoverage() as FileCoverageData;
  const name = /function (cov_\w+)\(/.exec(generated)![1]!;
  const key = Object.keys(file.s)[0]!;
  const appended =
    generated +
    `\nglobalThis.step=()=>[${name}().s[${key}]++,++${name}().s[${key}]];`;
  const state = runInNewContext(
    `${directStatementSource(appended, file)}\n({result:globalThis.result,step:globalThis.step()})`,
    {},
  );
  assert.equal(state.result, 42);
  assert.deepEqual(JSON.parse(JSON.stringify(state.step)), [1, 3]);
});

test('actual direct instrumented Worker publishes every final hit without sharing realm state', async () => {
  const instrumenter = createInstrumenter({
    compact: false,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
  });
  const raw = instrumenter.instrumentSync(
    'globalThis.work = function(){ for(let i=0;i<32;i++){ globalThis.last=i; } return globalThis.last; };',
    'worker-counter.js',
  );
  const file = instrumenter.lastFileCoverage() as FileCoverageData;
  const rows = counterLayout([file]);
  const text = directStatementSource(raw, file);
  const realm = createRealm(rows, 'direct-worker');
  const untouched = createRealm(rows, 'separate-host');
  const control = new SharedArrayBuffer(4);
  const worker = new Worker(
    `const {parentPort,workerData}=require('node:worker_threads');
globalThis.__coverageCounters=new Int32Array(workerData.buffer);
${bridgeSource(rows)}
${text}
parentPort.postMessage({result:globalThis.work(),counts:[...globalThis.__coverageCounters],f:globalThis.__coverage__['worker-counter.js'].f,b:globalThis.__coverage__['worker-counter.js'].b});
Atomics.wait(new Int32Array(workerData.control),0,0);`,
    { eval: true, execArgv: [], workerData: { buffer: realm.buffer, control } },
  );
  try {
    const [message] = await once(worker, 'message');
    const expectedRealm = createRealm(rows, 'reference');
    const expected = runInNewContext(
      bridgeSource(rows) +
        raw +
        `\nglobalThis.work();globalThis.__coverage__['worker-counter.js'];`,
      { __coverageCounters: new Int32Array(expectedRealm.buffer) },
    );
    assert.equal(message.result, 31);
    assert.deepEqual(message.counts, [...new Int32Array(expectedRealm.buffer)]);
    assert.deepEqual(message.f, JSON.parse(JSON.stringify(expected.f)));
    assert.deepEqual(message.b, JSON.parse(JSON.stringify(expected.b)));
    await worker.terminate();
    assert.deepEqual(
      [...new Int32Array(realm.buffer)],
      message.counts,
      'host retains every published hit after termination',
    );
    assert.ok(
      [...new Int32Array(untouched.buffer)].every((value) => value === 0),
      'independent realm remains untouched',
    );
  } finally {
    await worker.terminate();
  }
});

test('actual instrumented statement hits avoid repeated statement property reads while preserving writes and expression semantics', async () => {
  await mkdir('.artifacts', { recursive: true });
  const scratch = await mkdtemp(
    join(process.cwd(), '.artifacts', 'coverage-direct-red-'),
  );
  const fixturePath = FIRST_PARTY_JS[0]!;
  const source = `globalThis.exercise = function(mode) {
    const order = []; let value = 2;
    const before = value++; order.push('post:' + before + ':' + value);
    const after = ++value; order.push('pre:' + after + ':' + value);
    function choose(flag) { return flag ? value : -value; }
    try { if (mode === 'throw') throw Error('fixture'); order.push(choose(mode === 'yes')); }
    catch (error) { order.push(error.message); }
    finally { order.push('finally'); }
    return {before, after, value, order};
  };`;
  try {
    for (const path of PACKAGE_FILES) {
      const target = join(scratch, 'source', path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, path === fixturePath ? source : '');
    }
    const generated = await instrumentPackage({
      source: join(scratch, 'source'),
      out: join(scratch, 'out'),
    });
    const actualText = await readFile(
      join(scratch, 'out', fixturePath),
      'utf8',
    );
    const original = createInstrumenter({
      esModules: true,
      compact: false,
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false,
    });
    const originalText = original.instrumentSync(source, fixturePath);
    const run = (text: string, saturated: boolean) => {
      const realm = createRealm(generated.layout, 'fixture');
      const counters = new Int32Array(realm.buffer);
      const writes: number[][] = [];
      const context = {
        __coverageCounters: counters,
        Atomics: {
          load: Atomics.load,
          store(array: Int32Array, index: number, value: number) {
            writes.push([index, value]);
            return Atomics.store(array, index, value);
          },
        },
      };
      const state = runInNewContext(
        generated.bridge +
          '\n' +
          text +
          '\n({file:globalThis.__coverage__[' +
          JSON.stringify(fixturePath) +
          '], exercise:globalThis.exercise})',
        context,
      );
      if (saturated)
        for (const key of Object.keys(state.file.s))
          state.file.s[key] = 2147483646;
      let reads = 0;
      state.file.s = new Proxy(state.file.s, {
        get(target, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
          return Reflect.get(target, key, receiver);
        },
      });
      const values = ['yes', 'no', 'throw', 'yes'].map((mode) =>
        state.exercise(mode),
      );
      const executionReads = reads;
      return {
        values: JSON.parse(JSON.stringify(values)),
        writes,
        counts: [...counters],
        f: JSON.parse(JSON.stringify(state.file.f)),
        b: JSON.parse(JSON.stringify(state.file.b)),
        reads: executionReads,
      };
    };
    for (const saturated of [false, true]) {
      const expected = run(originalText, saturated);
      const actual = run(actualText, saturated);
      assert.ok(
        expected.reads > 0,
        'reference fixture must execute real Istanbul statement increments',
      );
      assert.deepEqual(
        actual.values,
        expected.values,
        'prefix/postfix results, order, caught exceptions and finally',
      );
      assert.deepEqual(
        actual.writes,
        expected.writes,
        'every Atomic publication including saturation',
      );
      assert.deepEqual(
        actual.counts,
        expected.counts,
        'all statement hits and registration',
      );
      assert.deepEqual(actual.f, expected.f, 'function counts');
      assert.deepEqual(actual.b, expected.b, 'branch counts');
      assert.equal(
        actual.reads,
        0,
        'direct statement hits must bypass repeated coverage-file statement property access',
      );
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('coverage fixed23 inventory includes all unimported files at zero', () => {
  const result = mergeRealms(
    metadata,
    layout,
    [register(createRealm(layout, 'host'))],
    ['host'],
  );
  assert.equal(result.map.files().length, 23);
  assert.ok(result.map.files().includes('runtime/guest-validation.js'));
  assert.ok(result.map.files().includes('runtime/session-port.js'));
  for (const name of [
    'install',
    'install-catalog',
    'install-transfer',
    'install-archive',
    'install-lifecycle',
    'command',
    'command-parse',
  ])
    assert.ok(result.map.files().includes(`runtime/${name}.js`));
  assert.equal(result.lines.pct, 0);
  assert.equal(result.passed, false);
});
test('coverage refuses incomplete inventory instead of shrinking denominator', () => {
  assert.throws(
    () => mergeRealms(metadata.slice(1), layout, [], []),
    /inventory/,
  );
});
test('coverage missing required realm fails even when other realm has counters', () => {
  assert.throws(
    () =>
      mergeRealms(
        metadata,
        layout,
        [register(createRealm(layout, 'host'))],
        ['host', 'worker'],
      ),
    /missing coverage realm/,
  );
});
test('coverage unregistered and duplicate realms fail', () => {
  const realm = createRealm(layout, 'worker');
  assert.throws(
    () => mergeRealms(metadata, layout, [realm], ['worker']),
    /missing coverage realm/,
  );
  register(realm);
  assert.throws(
    () => mergeRealms(metadata, layout, [realm, realm], ['worker']),
    /duplicate/,
  );
});
test('coverage line union aggregates statement counters across realm boundaries', () => {
  const a = register(createRealm(layout, 'host'));
  const b = register(createRealm(layout, 'worker'));
  for (const row of layout)
    for (let index = 0; index < row.keys.length; index++) {
      Atomics.store(
        new Int32Array(index % 2 ? a.buffer : b.buffer),
        row.offset + index,
        1,
      );
    }
  const result = mergeRealms(metadata, layout, [a, b], ['host', 'worker']);
  assert.equal(result.lines.pct, 100);
  assert.equal(result.passed, true);
});
test('coverage proxy bridge guards fixed statement map and bootstrap registration', () => {
  const source = bridgeSource(layout);
  assert.match(source, /coverage statement map mismatch/);
  assert.match(source, /unexpected coverage file/);
  assert.match(source, /Atomics.store\(globalThis.__coverageCounters,0,1\)/);
});

function bridgedCounter(atomics?: object, initialValue = 0) {
  const realm = createRealm(layout, 'host');
  const counters = new Int32Array(realm.buffer);
  Atomics.store(counters, layout[0]!.offset, initialValue);
  const bridge = runInNewContext(
    bridgeSource(layout) + '\nglobalThis.__coverage__;',
    {
      __coverageCounters: counters,
      ...(atomics ? { Atomics: atomics } : {}),
    },
  ) as Record<string, FileCoverageData>;
  const file = structuredClone(metadata[0]) as FileCoverageData;
  bridge[file.path] = file;
  const row = layout[0]!;
  return { realm, counters, file, key: row.keys[0]!, index: row.offset };
}
test('single-writer bridge preserves every published count without Atomic loads on repeated getter increments', () => {
  let loads = 0;
  const writes: { index: number; value: number }[] = [];
  const observedAtomics = {
    load(counters: Int32Array, index: number) {
      loads++;
      return Atomics.load(counters, index);
    },
    store(counters: Int32Array, index: number, value: number) {
      writes.push({ index, value });
      return Atomics.store(counters, index, value);
    },
  };
  const { counters, file, key, index } = bridgedCounter(observedAtomics);
  const initialLoads = loads;
  for (let count = 1; count <= 2048; count++) {
    file.s[key]!++;
    assert.equal(counters[index], count);
  }
  assert.equal(file.s[key], 2048);
  assert.deepEqual(
    writes.filter((write) => write.index === index).map((write) => write.value),
    Array.from({ length: 2048 }, (_, i) => i + 1),
    'every setter still publishes its exact count through Atomics.store',
  );
  assert.equal(
    loads - initialLoads,
    0,
    'repeated getters must use the single-writer realm value',
  );
});
test('actual counter bridge saturates at MAX_INT32 before signed overflow', () => {
  const { counters, file, key, index } = bridgedCounter();
  file.s[key] = 2147483646;
  assert.equal(counters[index], 2147483646);
  file.s[key]!++;
  assert.equal(counters[index], 2147483647);
  file.s[key]!++;
  assert.equal(counters[index], 2147483647);
  assert.equal(file.s[key], 2147483647);
});
test('repeated increments and huge safe counts cannot wrap saturated counters negative or zero', () => {
  const { counters, file, key, index } = bridgedCounter();
  file.s[key] = 2147483647;
  for (let repeat = 0; repeat < 1000; repeat++) file.s[key]!++;
  assert.equal(counters[index], 2147483647);
  file.s[key] = Number.MAX_SAFE_INTEGER;
  assert.equal(counters[index], 2147483647);
});
test('actual counter bridge preserves unexecuted zero and ordinary positive counts', () => {
  const { counters, file, key, index } = bridgedCounter();
  assert.equal(file.s[key], 0);
  file.s[key] = 0;
  assert.equal(counters[index], 0);
  file.s[key]!++;
  assert.equal(counters[index], 1);
  file.s[key] = 42;
  assert.equal(counters[index], 42);
  file.s[key] = 0;
  assert.equal(counters[index], 0);
});
test('actual counter bridge rejects negative fractional unsafe and nonnumeric writes without altering counts', () => {
  const { counters, file, key, index } = bridgedCounter();
  file.s[key] = 7;
  for (const value of [
    -1,
    -2147483648,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
    1n,
    null,
    undefined,
  ]) {
    assert.throws(
      () => Reflect.set(file.s, key, value),
      /nonnegative safe integer/,
    );
    assert.equal(counters[index], 7);
  }
});
test('saturated statement counts merge with zero realms without changing covered lines or denominator', () => {
  const { realm, file, key } = bridgedCounter();
  const zero = register(createRealm(layout, 'unexecuted-worker'));
  file.s[key] = 2147483648;
  const saturated = mergeRealms(
    metadata,
    layout,
    [realm, zero],
    ['host', 'unexecuted-worker'],
  );
  file.s[key] = 1;
  const once = mergeRealms(
    metadata,
    layout,
    [realm, zero],
    ['host', 'unexecuted-worker'],
  );
  assert.equal(saturated.map.files().length, 23);
  assert.equal(saturated.map.fileCoverageFor(file.path).s[key], 2147483647);
  assert.deepEqual(saturated.lines, once.lines);
  assert.equal(saturated.lines.total, once.lines.total);
  assert.ok(saturated.lines.covered > 0);
  assert.ok(saturated.lines.pct < 80);
  assert.equal(saturated.passed, false);
});
test('aggregate refuses negative raw counters even if every other statement would pass coverage', () => {
  const realm = register(createRealm(layout, 'host'));
  const counters = new Int32Array(realm.buffer);
  for (const row of layout)
    for (let index = 0; index < row.keys.length; index++)
      Atomics.store(counters, row.offset + index, 1);
  assert.equal(mergeRealms(metadata, layout, [realm], ['host']).passed, true);
  for (const invalid of [-1, -2147483648, -739875136]) {
    Atomics.store(counters, layout[0]!.offset, invalid);
    assert.throws(
      () => mergeRealms(metadata, layout, [realm], ['host']),
      /negative coverage counter/,
    );
  }
});
test('single-writer getter initializes from a nonzero published counter and keeps rejected writes unchanged', () => {
  const { counters, file, key, index } = bridgedCounter(undefined, 37);
  assert.equal(file.s[key], 37);
  file.s[key]!++;
  assert.equal(file.s[key], 38);
  assert.equal(Atomics.load(counters, index), 38);
  for (const invalid of [
    -1,
    NaN,
    Infinity,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    '39',
  ]) {
    assert.throws(
      () => Reflect.set(file.s, key, invalid),
      /nonnegative safe integer/,
    );
    assert.equal(file.s[key], 38);
    assert.equal(Atomics.load(counters, index), 38);
  }
});
test('single-writer bridge matches the former atomic read/write count sequence including saturation and resets', () => {
  const actual = bridgedCounter();
  const former = new Int32Array(new SharedArrayBuffer(4));
  const sequence = [
    0,
    7,
    'increment',
    'increment',
    0,
    2147483646,
    'increment',
    'increment',
    'increment',
    Number.MAX_SAFE_INTEGER,
    12,
    'increment',
  ] as const;
  const actualCounts: number[] = [],
    formerCounts: number[] = [];
  for (const operation of sequence) {
    if (operation === 'increment') actual.file.s[actual.key]!++;
    else actual.file.s[actual.key] = operation;
    const value =
      operation === 'increment' ? Atomics.load(former, 0) + 1 : operation;
    Atomics.store(former, 0, Math.min(value, 2147483647));
    actualCounts.push(Atomics.load(actual.counters, actual.index));
    formerCounts.push(Atomics.load(former, 0));
    assert.equal(actual.file.s[actual.key], Atomics.load(former, 0));
  }
  assert.deepEqual(actualCounts, formerCounts);
});
test('separate single-writer realms never share their cached value or shared buffer', () => {
  const first = bridgedCounter();
  const second = bridgedCounter();
  assert.notEqual(first.realm.buffer, second.realm.buffer);
  first.file.s[first.key] = 11;
  second.file.s[second.key] = 29;
  for (let index = 0; index < 100; index++) first.file.s[first.key]!++;
  assert.equal(first.file.s[first.key], 111);
  assert.equal(second.file.s[second.key], 29);
  assert.equal(Atomics.load(first.counters, first.index), 111);
  assert.equal(Atomics.load(second.counters, second.index), 29);
});
test('host sees every final atomic publication after terminating the single writer Worker', async () => {
  const realm = createRealm(layout, 'worker');
  const counters = new Int32Array(realm.buffer);
  const control = new SharedArrayBuffer(4);
  const file = structuredClone(metadata[0]) as FileCoverageData;
  const key = layout[0]!.keys[0]!,
    index = layout[0]!.offset;
  const worker = new Worker(
    `
const {parentPort,workerData}=require('node:worker_threads');
globalThis.__coverageCounters=new Int32Array(workerData.buffer);
${bridgeSource(layout)}
const file=workerData.file;globalThis.__coverage__[file.path]=file;
for(let count=0;count<4096;count++)file.s[workerData.key]++;
parentPort.postMessage('published');
Atomics.wait(new Int32Array(workerData.control),0,0);
`,
    {
      eval: true,
      execArgv: [],
      workerData: { buffer: realm.buffer, control, file, key },
    },
  );
  try {
    const [message] = await once(worker, 'message');
    assert.equal(message, 'published');
    assert.equal(Atomics.load(counters, 0), 1);
    assert.equal(Atomics.load(counters, layout[0]!.registeredOffset), 1);
    assert.equal(Atomics.load(counters, index), 4096);
    await worker.terminate();
    assert.equal(Atomics.load(counters, index), 4096);
    const merged = mergeRealms(metadata, layout, [realm], ['worker']);
    assert.equal(merged.map.fileCoverageFor(file.path).s[key], 4096);
    assert.equal(merged.map.files().length, 23);
    assert.equal(merged.passed, false);
  } finally {
    await worker.terminate();
  }
});
