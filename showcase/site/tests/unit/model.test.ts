import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSha256 } from '../../../scripts/build-key.ts';
import {
  type AcceptanceEvidence,
  type CheckRow,
  evidenceIdOf,
  identityDigest,
  REQUIRED_ROWS,
  requireRows,
  type SiteEvidenceIdentity,
  validateEvidence,
} from '../../src/model/evidence.ts';
import {
  checkFixturePath,
  FIXTURE_LIMITS,
  type FixtureEntry,
  validateFixtureIndex,
} from '../../src/model/fixture-index.ts';
import {
  type InventoryFile,
  inventorySha256,
  siteInventory,
  validateSiteInventory,
} from '../../src/model/inventory.ts';
import { ModelError } from '../../src/model/model-error.ts';
import {
  sameSiteIdentity,
  siteIdentityText,
  validateSiteIdentity,
} from '../../src/model/site-identity.ts';

const SHA = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const rejects = (code: string, run: () => unknown, pattern?: RegExp) =>
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ModelError);
    assert.equal(error.code, code);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });

const fileEntry = (path: string, mode = 0o644): FixtureEntry => ({
  path,
  type: 'file',
  mode,
  sha256: SHA,
  size: 2,
  bytes: 'e30=',
});
const index = (entries: unknown[]) => ({
  schemaVersion: 1,
  fixture: 'aube-local-deps',
  entries,
});

test('fixture index: the app and the outside directories pass in path order', () => {
  const value = index([
    { path: 'app', type: 'dir', mode: 0o755 },
    fileEntry('app/package.json'),
    fileEntry('app/run.sh', 0o755),
    { path: 'outside', type: 'dir', mode: 0o755 },
    { path: 'outside/linked', type: 'dir', mode: 0o755 },
    fileEntry('outside/linked/package.json'),
  ]);
  assert.deepEqual(validateFixtureIndex(value), value);
});

test('fixture index: `..`, absolute, empty segments, `.` and NUL are refused', () => {
  for (const path of [
    '../app',
    'app/../x',
    '/work/app',
    'app//x',
    'app/',
    './app',
    'a\0b',
    'a\\b',
    '',
  ])
    rejects('fixture-index-invalid', () => checkFixturePath(path));
  assert.equal(checkFixturePath('app/日本語.txt'), 'app/日本語.txt');
});

test('fixture index: 4096 entries and 4096-byte paths pass, one more fails', () => {
  const dirs = (count: number) =>
    Array.from({ length: count }, (_, number) => ({
      path: `d${String(number).padStart(5, '0')}`,
      type: 'dir',
      mode: 0o755,
    }));
  assert.equal(
    validateFixtureIndex(index(dirs(FIXTURE_LIMITS.maxEntries))).entries.length,
    4096,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index(dirs(4097))),
    /more than 4096/,
  );
  assert.equal(checkFixturePath('x'.repeat(4096)).length, 4096);
  rejects(
    'fixture-index-invalid',
    () => checkFixturePath('x'.repeat(4097)),
    /4096 bytes/,
  );
  // Multi-byte: 1366 x 3 bytes = 4098 bytes although only 1366 code units.
  rejects('fixture-index-invalid', () => checkFixturePath('あ'.repeat(1366)));
});

test('fixture index: only normalised modes, known types and fields are accepted', () => {
  rejects(
    'fixture-index-invalid',
    () =>
      validateFixtureIndex(index([{ path: 'a', type: 'dir', mode: 0o700 }])),
    /directory mode/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([fileEntry('a', 0o600)])),
    /file mode/,
  );
  rejects(
    'fixture-index-invalid',
    () =>
      validateFixtureIndex(
        index([{ path: 'a', type: 'symlink', target: 'b' }]),
      ),
    /type refused/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([{ ...fileEntry('a'), extra: 1 }])),
    /unknown field/,
  );
  rejects(
    'fixture-index-invalid',
    () =>
      validateFixtureIndex(
        index([{ ...fileEntry('a'), bytes: 'not base64!' }]),
      ),
    /base64/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([{ ...fileEntry('a'), sha256: 'x' }])),
    /sha256/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex({ ...index([fileEntry('a')]), fixture: '../x' }),
    /fixture name/,
  );
});

test('fixture index: order, duplicates and missing parents are refused', () => {
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([fileEntry('b'), fileEntry('a')])),
    /order/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([fileEntry('a'), fileEntry('a')])),
    /duplicated/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([fileEntry('app/x')])),
    /parent directory missing/,
  );
  rejects(
    'fixture-index-invalid',
    () => validateFixtureIndex(index([])),
    /empty/,
  );
});

test('site identity: canonical bytes, comparison and refusal of extra fields', () => {
  const identity = {
    schemaVersion: 1 as const,
    runNumber: 12,
    sourceCommit: COMMIT,
    candidateId: SHA,
  };
  assert.equal(
    siteIdentityText(identity),
    `{"candidateId":"${SHA}","runNumber":12,"schemaVersion":1,"sourceCommit":"${COMMIT}"}`,
  );
  assert.ok(sameSiteIdentity(identity, { ...identity }));
  assert.ok(!sameSiteIdentity(identity, { ...identity, runNumber: 13 }));
  rejects(
    'identity-invalid',
    () => validateSiteIdentity({ ...identity, siteInventorySha256: SHA }),
    /unknown field/,
  );
  rejects('identity-invalid', () =>
    validateSiteIdentity({ ...identity, runNumber: 0 }),
  );
  rejects('identity-invalid', () =>
    validateSiteIdentity({ ...identity, sourceCommit: 'main' }),
  );
});

test('inventory: path order, digest of the canonical file list, duplicates refused', () => {
  const files: InventoryFile[] = [
    { path: '.nojekyll', sha256: SHA, bytes: 0 },
    { path: 'index.html', sha256: SHA, bytes: 10 },
    { path: 'site-identity.json', sha256: SHA, bytes: 3 },
  ];
  const inventory = siteInventory(files);
  assert.equal(inventory.sha256, canonicalSha256(files));
  assert.equal(inventorySha256(files), inventory.sha256);
  assert.deepEqual(
    validateSiteInventory(JSON.parse(JSON.stringify(inventory))),
    inventory,
  );
  rejects(
    'inventory-invalid',
    () => siteInventory([files[1]!, files[0]!]),
    /order/,
  );
  rejects(
    'inventory-invalid',
    () => siteInventory([files[0]!, files[0]!]),
    /duplicated/,
  );
  rejects(
    'inventory-invalid',
    () => validateSiteInventory({ ...inventory, sha256: SHA }),
    /recorded sha256/,
  );
  rejects('inventory-invalid', () =>
    siteInventory([{ path: '../x', sha256: SHA, bytes: 1 }]),
  );
});

const identity: SiteEvidenceIdentity = {
  sourceCommit: COMMIT,
  formicariumSourceCommit: COMMIT,
  formicariumPackSha256: SHA,
  candidateId: SHA,
  catalogSha256: SHA,
  fixtureInventorySha256: SHA,
  siteInventorySha256: 'c'.repeat(64),
};
const allPassed = (): CheckRow[] =>
  REQUIRED_ROWS.map((row) => ({ ...row, status: 'passed', logSha256: SHA }));
function evidence(extra: Partial<AcceptanceEvidence> = {}): AcceptanceEvidence {
  const body = {
    schemaVersion: 1 as const,
    unit: 'u8-showcase-site' as const,
    sourceCommit: COMMIT,
    recordedAt: '2026-10-19T21:00:00+09:00',
    identity,
    checks: allPassed(),
    outputs: [
      { path: 'site-inventory.json', digest: identity.siteInventorySha256 },
    ],
    ...extra,
  };
  return { ...body, evidenceId: evidenceIdOf(body) };
}

test('evidence: the U8 profile has 27 required rows and a complete set passes', () => {
  assert.equal(REQUIRED_ROWS.length, 27);
  assert.equal(requireRows(allPassed()).length, 27);
  assert.ok(validateEvidence(evidence(), { deployed: false }));
  assert.match(identityDigest(identity), /^[a-f0-9]{64}$/);
  const deployed = evidence({ deployedIdentity: identity.siteInventorySha256 });
  assert.ok(validateEvidence(deployed, { deployed: true }));
});

test('evidence: missing, duplicate, failed and unverified rows are refused', () => {
  rejects(
    'evidence-invalid',
    () => requireRows(allPassed().slice(1)),
    /missing tool-aube-version\/node/,
  );
  rejects(
    'evidence-invalid',
    () => requireRows([...allPassed(), allPassed()[0]!]),
    /duplicate/,
  );
  for (const status of ['failed', 'unverified'] as const) {
    const rows = allPassed();
    rows[26] = { ...rows[26]!, status };
    rejects(
      'evidence-invalid',
      () => requireRows(rows),
      new RegExp(`${status} coverage-80/host`),
    );
  }
  // An extra row is recorded but never replaces a required one.
  const extra = [
    ...allPassed().slice(1),
    {
      name: 'safari-device',
      environment: 'host' as const,
      status: 'unverified' as const,
      logSha256: SHA,
    },
  ];
  rejects('evidence-invalid', () => requireRows(extra), /missing/);
});

test('evidence: deployedIdentity, outputs, time offset and evidenceId are checked', () => {
  rejects(
    'evidence-invalid',
    () => validateEvidence(evidence(), { deployed: true }),
    /needs deployedIdentity/,
  );
  rejects(
    'evidence-invalid',
    () =>
      validateEvidence(evidence({ deployedIdentity: SHA }), { deployed: true }),
    /differs/,
  );
  rejects(
    'evidence-invalid',
    () =>
      validateEvidence(
        evidence({ deployedIdentity: identity.siteInventorySha256 }),
        { deployed: false },
      ),
    /must not carry/,
  );
  rejects(
    'evidence-invalid',
    () => validateEvidence(evidence({ outputs: [] }), { deployed: false }),
    /outputs/,
  );
  rejects(
    'evidence-invalid',
    () =>
      validateEvidence(evidence({ recordedAt: '2026-10-19 21:00' }), {
        deployed: false,
      }),
    /offset/,
  );
  rejects(
    'evidence-invalid',
    () =>
      validateEvidence({ ...evidence(), evidenceId: SHA }, { deployed: false }),
    /evidenceId/,
  );
  rejects(
    'evidence-invalid',
    () =>
      validateEvidence(
        { ...evidence(), identity: { ...identity, candidateId: 'x' } },
        { deployed: false },
      ),
    /candidateId/,
  );
});
