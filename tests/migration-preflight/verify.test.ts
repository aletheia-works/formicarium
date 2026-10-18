import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BASELINE_COMMIT,
  BASELINE_REPOSITORY,
  type BaselineInputs,
  baselineBuilderHash,
  baselineKey,
} from '../../scripts/migration-preflight/baseline.js';
import {
  BROWSERS,
  type PreflightEvidence,
  TOOLS,
  type Trial,
} from '../../scripts/migration-preflight/evidence.js';
import {
  checkAcceptance,
  parseUniqueJSON,
  verifyFile,
} from '../../scripts/migration-preflight/verify.js';
import { FIRST_PARTY_JS } from '../../scripts/package/stage-package.js';

// Synthetic acceptance data is used only by these unit tests, never by the CLI.
function baseFixture(): Omit<
  Parameters<typeof checkAcceptance>[0],
  'inventory'
> & {
  inventory: Omit<
    Parameters<typeof checkAcceptance>[0]['inventory'],
    'metadataProducer' | 'mirror'
  >;
} {
  const baselineInputs: BaselineInputs = {
    schemaVersion: 1,
    tool: 'biome',
    versionOrName: 'fixture',
    repository: BASELINE_REPOSITORY,
    commit: BASELINE_COMMIT,
    target: 'x86_64-unknown-linux-musl',
    builderInventory: { fixture: 'a'.repeat(64) },
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
  baselineInputs.builderHash = baselineBuilderHash(baselineInputs);
  const buildKey = baselineKey(baselineInputs);
  const evidence: PreflightEvidence = {
    schemaVersion: 1,
    evidenceId: 'unit-fixture',
    sourceCommit: 'a'.repeat(40),
    recordedAt: '2026-10-12T12:00:00Z',
    environment: {
      cache: 'fresh fixture',
      coverage: 'uninstrumented performance path',
      origin: 'https://localhost:4182',
      certificateFingerprint: 'a'.repeat(64),
      coreMetadataSha256: 'b'.repeat(64),
    },
    trials: TOOLS.flatMap((tool) =>
      BROWSERS.flatMap((browser) =>
        Array.from({ length: 6 }, (_, trial) => ({
          tool,
          browser,
          trial: trial as Trial['trial'],
          version: '1.0.0',
          url: `https://localhost:4182/${tool}`,
          finalUrl: `https://localhost:4182/${tool}`,
          digest: 'b'.repeat(64),
          cors: 'passed' as const,
          exitCode: 0,
          stdoutDigest: 'c'.repeat(64),
          phasesMs: {
            fetch: 100,
            extract: 1,
            digest: 1,
            validate: 1,
            register: 1,
            run: 10,
          },
        })),
      ),
    ),
    baseline: {
      source: { repository: BASELINE_REPOSITORY, commit: BASELINE_COMMIT },
      buildKey,
      firstDigest: 'e'.repeat(64),
      reusedDigest: 'e'.repeat(64),
      compileSkipped: true,
      versionExitCode: 0,
      ciRunUrl: 'https://github.com/example/vivarium/actions/runs/123',
    },
  };
  const accepted = {
    buildKey,
    elfSha256: 'e'.repeat(64),
    buildInfoSha256: 'f'.repeat(64),
    compileSkipped: true,
    versionExitCode: 0,
  };
  const receipt = {
    ...accepted,
    schemaVersion: 1,
    source: { ...evidence.baseline.source },
    sourceCommit: 'a'.repeat(40),
    ciRunUrl: evidence.baseline.ciRunUrl,
    recordedAt: evidence.recordedAt,
  };
  return {
    evidence,
    baselineInputs,
    accepted,
    first: { ...receipt, compileSkipped: false },
    reuse: receipt,
    inventory: {
      schemaVersion: 1,
      sourceCommit: evidence.sourceCommit,
      assets: TOOLS.map((tool) => ({
        tool,
        version: '1.0.0',
        url: `https://localhost:4182/${tool}`,
        elfSha256: 'b'.repeat(64),
        downloadSha256: 'd'.repeat(64),
      })),
    },
    coverage: {
      passed: true,
      threshold: 80,
      candidateSha256: 'a'.repeat(64),
      lines: {
        total: FIRST_PARTY_JS.length,
        covered: FIRST_PARTY_JS.length,
        skipped: 0,
        pct: 100,
      },
      files: FIRST_PARTY_JS.map((path) => ({ path, lines: { '1': 1 } })),
      digests: FIRST_PARTY_JS.map((path) => ({
        path,
        sourceSha256: 'b'.repeat(64),
      })),
      realmNames: ['node-host'],
    },
    candidate: {
      tarball: { sha256: 'a'.repeat(64) },
      files: FIRST_PARTY_JS.map((path) => ({ path, sha256: 'b'.repeat(64) })),
    },
  };
}
function fixture(): Parameters<typeof checkAcceptance>[0] {
  const base = baseFixture();
  const value = {
    ...base,
    inventory: {
      ...base.inventory,
      metadataProducer: {
        official: base.inventory.assets.map((asset) => ({
          ...asset,
          url: `https://github.com/example/releases/${asset.tool}`,
        })),
      },
      mirror: {
        origin: 'https://localhost:4182',
        entries: base.inventory.assets.map((asset) => ({
          tool: asset.tool,
          originalUrl: `https://github.com/example/releases/${asset.tool}`,
          mirrorUrl: asset.url,
          sha256: asset.downloadSha256,
        })),
      },
    },
  };
  Object.assign(value.evidence.environment, {
    coreOriginalInfoSha256: 'a'.repeat(64),
    coreLoaderSha256: 'b'.repeat(64),
    coreWasmSha256: 'c'.repeat(64),
    coreCommit: 'd'.repeat(40),
    coreInputCondition: 'fixture derived input',
  });
  value.inventory.metadataProducer = {
    official: value.inventory.assets.map((asset) => ({
      ...asset,
      url: `https://github.com/example/releases/${asset.tool}`,
    })),
  };
  value.inventory.mirror = {
    origin: 'https://localhost:4182',
    entries: value.inventory.assets.map((asset) => ({
      tool: asset.tool,
      originalUrl: `https://github.com/example/releases/${asset.tool}`,
      mirrorUrl: asset.url,
      sha256: asset.downloadSha256,
    })),
  };
  return value;
}
test('complete synthetic acceptance satisfies all checks', () =>
  checkAcceptance(fixture()));
test('duplicate escaped/nested keys and trailing JSON reject', () => {
  for (const raw of [
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"x":[{"b":1,"b":2}]}',
    '{} null',
  ])
    assert.throws(() => parseUniqueJSON(raw));
  assert.deepEqual(parseUniqueJSON('{"a":[{},null,"escaped\\"value"]}'), {
    a: [{}, null, 'escaped"value'],
  });
});
test('a whole browser group changing output or inventory identity rejects', () => {
  for (const field of ['stdoutDigest', 'digest', 'version'] as const) {
    const value = fixture();
    for (const row of value.evidence.trials)
      if (row.browser === 'firefox' && row.tool === 'aube')
        row[field] = field === 'version' ? '2.0.0' : 'f'.repeat(64);
    assert.throws(() => checkAcceptance(value), /cross-browser/);
  }
});
test('missing and duplicate inventory tools reject', () => {
  const value = fixture();
  value.inventory.assets[1] = value.inventory.assets[0]!;
  assert.throws(() => checkAcceptance(value), /uniqueness/);
});
test('local receipts, different CI run and false compile reuse reject', () => {
  for (const change of [
    { ciRunUrl: '' },
    { buildKey: 'f'.repeat(64) },
    { compileSkipped: false },
  ]) {
    const value = fixture();
    Object.assign(value.reuse, change);
    assert.throws(() => checkAcceptance(value), /receipt|reuse/);
  }
});
test('reduced denominator, modified source and dishonest percentage reject', () => {
  const missing = fixture();
  missing.coverage.files.pop();
  assert.throws(() => checkAcceptance(missing), /denominator/);
  const changed = fixture();
  changed.coverage.digests[0]!.sourceSha256 = 'f'.repeat(64);
  assert.throws(() => checkAcceptance(changed), /candidate identity/);
  const uncovered = fixture();
  for (const row of uncovered.coverage.files) row.lines['1'] = 0;
  uncovered.coverage.lines.covered = 0;
  assert.throws(() => checkAcceptance(uncovered), /coverage acceptance/);
});
test('missing TLS/core environment and instrumentation reject', () => {
  const missingTls: Record<string, string> = {
    ...fixture().evidence.environment,
  };
  delete missingTls.certificateFingerprint;
  const environments: Readonly<Record<string, string>>[] = [
    { ...fixture().evidence.environment, coverage: 'instrumented' },
    missingTls,
  ];
  for (const environment of environments) {
    const value = fixture();
    value.evidence.environment = environment;
    assert.throws(() => checkAcceptance(value), /environment/);
  }
});
test('real entry never substitutes fixtures for missing files', async () => {
  await assert.rejects(
    verifyFile(
      '.artifacts/migration-preflight/nonexistent-verification-input.json',
    ),
    /ENOENT/,
  );
});
