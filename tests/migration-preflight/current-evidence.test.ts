import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { BaselineInputs } from '../../scripts/migration-preflight/baseline.js';
import {
  BASELINE_COMMIT,
  BASELINE_REPOSITORY,
  baselineBuilderHash,
  baselineKey,
  runBaseline,
} from '../../scripts/migration-preflight/baseline.js';
import { assemblePreflightEvidence } from '../../scripts/migration-preflight/current-evidence.js';
import {
  BROWSERS,
  PHASES,
  TOOLS,
} from '../../scripts/migration-preflight/evidence.js';

const SOURCE = 'a'.repeat(40);
const VIVARIUM = 'b'.repeat(40);
const RUN = 'https://github.com/Marukome0743/vivarium/actions/runs/123';
const PLAYWRIGHT = (
  JSON.parse(
    await readFile('node_modules/@playwright/test/package.json', 'utf8'),
  ) as { version: string }
).version;
const ELF = { aube: 'c'.repeat(64), biome: 'd'.repeat(64) };
const STDOUT = { aube: 'e'.repeat(64), biome: 'f'.repeat(64) };

function baselineInputs(): BaselineInputs {
  const value: BaselineInputs = {
    schemaVersion: 1,
    tool: 'biome',
    versionOrName: 'fixture-baseline',
    repository: BASELINE_REPOSITORY,
    commit: BASELINE_COMMIT,
    target: 'x86_64-unknown-linux-musl',
    builderInventory: { 'fixture-script': 'a'.repeat(64) },
    builderHash: 'b'.repeat(64),
    image: `example.org/fixture@sha256:${'c'.repeat(64)}`,
    rustc: 'rustc fixture',
    cargo: 'cargo fixture',
    cargoLockSha256: 'd'.repeat(64),
    sourceFileDigests: {
      'Cargo.lock': 'd'.repeat(64),
      'Cargo.toml': 'e'.repeat(64),
      'rust-toolchain.toml': 'f'.repeat(64),
      '.cargo/config.toml': 'a'.repeat(64),
    },
    dependencies: [],
    sourcePatches: [],
    cargoArgs: [
      'build',
      '--locked',
      '--release',
      '--target',
      'x86_64-unknown-linux-musl',
      '--package',
      'biome_cli',
    ],
    environment: { RUSTUP_TOOLCHAIN: 'fixture', CARGO_INCREMENTAL: '0' },
  };
  value.builderHash = baselineBuilderHash(value);
  return value;
}
function elf(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(120);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 2, true);
  view.setUint16(18, 62, true);
  view.setUint32(20, 1, true);
  view.setBigUint64(32, 64n, true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint32(64, 1, true);
  return bytes;
}
function environment(browser: string): Record<string, string> {
  return {
    browserVersion: `${browser}-1`,
    userAgent: `agent ${browser}`,
    isolated: 'true',
    cache: 'new context per trial',
    coverage: 'uninstrumented performance path',
    origin: 'https://localhost:4182',
    certificateFingerprint: '1'.repeat(64),
    tlsProtocol: 'TLS 1.3',
    tlsIssuer: browser === 'webkit' ? 'not-TLS' : 'fixture-issuer',
    tlsSubject: 'fixture-subject',
    condition: 'HTTPS mirror',
    coreMetadataSha256: '2'.repeat(64),
    coreOriginalInfoSha256: '3'.repeat(64),
    coreLoaderSha256: '4'.repeat(64),
    coreWasmSha256: '5'.repeat(64),
    coreCommit: '6'.repeat(40),
    coreInputCondition: 'fixed core bytes',
    node: process.version,
    playwright: PLAYWRIGHT,
  };
}
function trial(tool: 'aube' | 'biome', browser: string, index: number) {
  return {
    schemaVersion: 1,
    sourceCommit: SOURCE,
    trial: {
      tool,
      browser,
      trial: index,
      version: tool === 'aube' ? '2.7.0' : '2.4.0',
      url: `https://localhost:4182/mirror/${tool}`,
      finalUrl: `https://localhost:4182/mirror/${tool}`,
      digest: ELF[tool],
      cors: 'passed',
      exitCode: 0,
      stdoutDigest: STDOUT[tool],
      phasesMs: Object.fromEntries(PHASES.map((phase) => [phase, 10])),
    },
    stdout: '',
    stderr: '',
    environment: environment(browser),
  };
}
async function fixture(root: string) {
  const trials = resolve(root, 'trials');
  await mkdir(trials);
  for (const tool of TOOLS)
    for (const browser of BROWSERS)
      for (let index = 0; index < 6; index++)
        await writeFile(
          resolve(trials, `${tool}.${browser}.${index}.json`),
          JSON.stringify(trial(tool, browser, index)),
        );
  const inventory = resolve(root, 'mirror-input.json');
  await writeFile(
    inventory,
    JSON.stringify({ schemaVersion: 1, sourceCommit: SOURCE, assets: [] }),
  );
  const baseline = resolve(root, 'baseline');
  const cache = resolve(baseline, 'cache');
  await mkdir(cache, { recursive: true });
  const inputs = baselineInputs();
  const build = async (staging: string) => {
    const file = resolve(staging, 'fixture-elf');
    await writeFile(file, elf());
    return { elf: file, versionExitCode: 0 };
  };
  const remote = (receipt: object) => ({
    ...receipt,
    schemaVersion: 1,
    recordedAt: '2026-10-17T00:00:00.000Z',
    source: { repository: inputs.repository, commit: inputs.commit },
    sourceCommit: VIVARIUM,
    ciRunUrl: RUN,
  });
  const first = await runBaseline({ inputs, cache, build });
  const reuse = await runBaseline({
    inputs,
    cache,
    build,
    checkVersion: async () => 0,
  });
  await writeFile(
    resolve(baseline, 'actual-inputs.json'),
    JSON.stringify(inputs),
  );
  await writeFile(
    resolve(baseline, 'first-receipt.json'),
    JSON.stringify(remote(first)),
  );
  await writeFile(
    resolve(baseline, 'reuse-receipt.json'),
    JSON.stringify(remote(reuse)),
  );
  const ciRun = resolve(root, 'ci-run.json');
  await writeFile(
    ciRun,
    JSON.stringify({
      id: 123,
      status: 'completed',
      conclusion: 'success',
      html_url: RUN,
      head_sha: VIVARIUM,
    }),
  );
  const browserLog = resolve(root, 'trials.log');
  await writeFile(browserLog, trialLog());
  return {
    trialsDirectory: trials,
    browserLogPath: browserLog,
    inventoryPath: inventory,
    baselineDirectory: baseline,
    ciRunPath: ciRun,
  };
}
function trialLog(skip = ''): string {
  const lines: string[] = [];
  let n = 0;
  for (const browser of BROWSERS)
    for (const tool of TOOLS)
      for (let index = 0; index < 6; index++) {
        n++;
        const title = `${tool} official trial ${index}`;
        if (`${browser}/${title}` === skip) continue;
        lines.push(
          `  ✓  ${n} [${browser}] › tests/migration-preflight/consumer.spec.ts:30:5 › ${title} (1.0s)`,
        );
      }
  return `${lines.join('\n')}\n\n  36 passed (40.0s)\n`;
}
async function scratch(run: (root: string) => Promise<void>) {
  const parent = resolve(
    '.artifacts/migration-preflight/current-evidence-tests',
  );
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, 'case-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const options = {
  evidenceId: 'u1-current-test',
  recordedAt: '2026-10-17T00:00:00.000Z',
};
// biome-ignore lint/suspicious/noExplicitAny: tests mutate parsed fixture JSON in place
type Json = Record<string, any>;
const rewrite = async (path: string, change: (value: Json) => void) => {
  const value = JSON.parse(await readFile(path, 'utf8'));
  change(value);
  await writeFile(path, JSON.stringify(value));
};

test('current trials and current-Node baseline assemble into C01 evidence', async () =>
  scratch(async (root) => {
    const input = await fixture(root);
    const result = await assemblePreflightEvidence(input, options);
    const evidence = result.evidence;
    assert.equal(evidence.trials.length, 36);
    assert.equal(evidence.sourceCommit, SOURCE);
    assert.equal(evidence.environment.node, process.version);
    assert.equal(evidence.environment['firefox.browserVersion'], 'firefox-1');
    assert.equal(evidence.environment['webkit.tlsIssuer'], 'not-TLS');
    assert.equal(evidence.environment.origin, 'https://localhost:4182');
    assert.equal(evidence.baseline.ciRunUrl, RUN);
    assert.equal(evidence.baseline.compileSkipped, true);
    assert.equal(
      evidence.baseline.buildKey,
      baselineKey(result.baselineInputs),
    );
    assert.equal(result.first.compileSkipped, false);
    assert.equal(
      result.accepted.elfSha256,
      createHash('sha256').update(elf()).digest('hex'),
    );
  }));
test('missing, extra, failed and mismatched trial files are refused', async () => {
  for (const damage of [
    (dir: string) => rm(resolve(dir, 'aube.chromium.5.json')),
    (dir: string) =>
      writeFile(resolve(dir, 'aube.chromium.5.failure.json'), '{}'),
    (dir: string) => writeFile(resolve(dir, 'notes.txt'), 'x'),
    (dir: string) =>
      rewrite(resolve(dir, 'biome.webkit.2.json'), (v) => {
        v.trial.trial = 3;
      }),
    (dir: string) =>
      rewrite(resolve(dir, 'biome.webkit.2.json'), (v) => {
        v.sourceCommit = 'c'.repeat(40);
      }),
    (dir: string) =>
      writeFile(
        resolve(dir, 'aube.firefox.1.json'),
        '{"schemaVersion":1,"schemaVersion":1}',
      ),
  ])
    await scratch(async (root) => {
      const input = await fixture(root);
      await damage(input.trialsDirectory);
      await assert.rejects(assemblePreflightEvidence(input, options));
    });
});
test('browser version, TLS or core identity must be the same in every trial of a run', async () => {
  for (const [file, field, value] of [
    ['aube.webkit.2.json', 'node', 'v26.0.0'],
    ['aube.firefox.4.json', 'browserVersion', 'firefox-0'],
    ['biome.chromium.0.json', 'certificateFingerprint', '7'.repeat(64)],
    ['biome.webkit.5.json', 'coreWasmSha256', '8'.repeat(64)],
  ] as const)
    await scratch(async (root) => {
      const input = await fixture(root);
      await rewrite(resolve(input.trialsDirectory, file), (v) => {
        v.environment[field] = value;
      });
      await assert.rejects(
        assemblePreflightEvidence(input, options),
        /identity differs/,
      );
    });
});
test('baseline built with another Node or changed receipts and CI run are refused', async () =>
  scratch(async (root) => {
    const input = await fixture(root);
    const actual = resolve(input.baselineDirectory, 'actual-inputs.json');
    const original = await readFile(actual, 'utf8');
    await writeFile(
      actual,
      await readFile(
        'docs/results/terrarium-migration-preflight-evidence/ci-attempt-2/actual-inputs.json',
        'utf8',
      ),
    );
    await assert.rejects(
      assemblePreflightEvidence(input, options),
      /builder inventory\/full input digest mismatch/,
    );
    await writeFile(actual, original);
    const reuse = resolve(input.baselineDirectory, 'reuse-receipt.json');
    await rewrite(reuse, (v) => {
      v.compileSkipped = false;
    });
    await assert.rejects(assemblePreflightEvidence(input, options));
    await rewrite(reuse, (v) => {
      v.compileSkipped = true;
    });
    for (const change of [
      (v: Json) => {
        v.conclusion = 'failure';
      },
      (v: Json) => {
        v.html_url = `${RUN}9`;
      },
    ]) {
      const before = await readFile(input.ciRunPath, 'utf8');
      await rewrite(input.ciRunPath, change);
      await assert.rejects(assemblePreflightEvidence(input, options), /CI run/);
      await writeFile(input.ciRunPath, before);
    }
    assert.equal(
      (await assemblePreflightEvidence(input, options)).evidence.trials.length,
      36,
    );
  }));
test('a C01 median over 3000ms is still refused after assembly', async () =>
  scratch(async (root) => {
    const input = await fixture(root);
    for (let index = 1; index < 6; index++)
      await rewrite(
        resolve(input.trialsDirectory, `biome.firefox.${index}.json`),
        (v) => {
          v.trial.phasesMs.run = 3001;
        },
      );
    await assert.rejects(
      assemblePreflightEvidence(input, options),
      /median exceeds 3000ms/,
    );
  }));
test('trial records must carry the current Node and Playwright versions, identical in every trial', async () => {
  for (const [field, value] of [
    ['node', 'v24.21.0'],
    ['node', undefined],
    ['playwright', '1.63.0'],
    ['playwright', undefined],
  ] as const)
    await scratch(async (root) => {
      const input = await fixture(root);
      for (const name of await readdir(input.trialsDirectory))
        await rewrite(resolve(input.trialsDirectory, name), (v) => {
          if (value === undefined) delete v.environment[field];
          else v.environment[field] = value;
        });
      await assert.rejects(assemblePreflightEvidence(input, options));
    });
  await scratch(async (root) => {
    const input = await fixture(root);
    const evidence = (await assemblePreflightEvidence(input, options)).evidence;
    assert.equal(evidence.environment.node, process.version);
    assert.equal(evidence.environment.playwright, PLAYWRIGHT);
  });
});
test('the browser log must list exactly the 36 passing trials that the trial files record', async () => {
  for (const log of [
    trialLog('firefox/biome official trial 3'),
    `${trialLog()}  ✓  37 [webkit] › tests/migration-preflight/consumer.spec.ts:30:5 › aube official trial 6 (1.0s)\n`,
    trialLog().replace('[webkit] ›', '[chromium] ›'),
  ])
    await scratch(async (root) => {
      const input = await fixture(root);
      await writeFile(input.browserLogPath, log);
      await assert.rejects(
        assemblePreflightEvidence(input, options),
        /browser log/,
      );
    });
});
