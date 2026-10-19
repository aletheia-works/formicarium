import assert from 'node:assert/strict';
import { appendFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { mismatches, verifyCandidate } from '../../scripts/verify-candidate.ts';
import { PACK_SHA, packRecord, writeCandidate } from './candidate-fixture.ts';
import { tempDir } from './helpers.ts';

async function setup(options?: Parameters<typeof writeCandidate>[1]) {
  return writeCandidate(await tempDir('candidate'), options);
}
const items = (result: Awaited<ReturnType<typeof verifyCandidate>>) =>
  mismatches(result).map((line) => line.item);

test('a consistent verify candidate passes; items 2 and 6 are only logged', async () => {
  const { candidateDir, fixturesDir } = await setup();
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord('f'.repeat(64)),
  });
  assert.deepEqual(items(result), []);
  const logged = result.lines
    .filter((line) => line.ok === null)
    .map((line) => line.item);
  assert.deepEqual(logged, [
    '2-job-candidate-id',
    '2-job-distributable',
    '6-pack',
  ]);
  const pack = result.lines.find((line) => line.item === '6-pack')!;
  assert.equal(pack.expected, PACK_SHA);
  assert.equal(pack.actual, 'f'.repeat(64));
});

test('(1) a candidateId that differs from the recomputed one fails', async () => {
  const { candidateDir, fixturesDir, manifest } = await setup();
  await writeFile(
    join(candidateDir, 'manifest.json'),
    JSON.stringify({ ...manifest, candidateId: 'f'.repeat(64) }),
  );
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.deepEqual(items(result), ['1-candidate-id']);
});

test('(2) and (6) are judged in distribute mode', async () => {
  const { candidateDir, fixturesDir, manifest } = await setup({
    distributable: true,
  });
  const ok = await verifyCandidate({
    mode: 'distribute',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
    jobOutputs: { candidateId: manifest.candidateId, distributable: 'true' },
  });
  assert.deepEqual(items(ok), []);
  const bad = await verifyCandidate({
    mode: 'distribute',
    candidateDir,
    fixturesDir,
    pack: packRecord('f'.repeat(64)),
    jobOutputs: { candidateId: 'f'.repeat(64), distributable: 'false' },
  });
  assert.deepEqual(items(bad), [
    '2-job-candidate-id',
    '2-job-distributable',
    '6-pack',
  ]);
});

test('(3) an extra, changed or missing site file and a changed catalog fail', async () => {
  const { candidateDir, fixturesDir } = await setup();
  await writeFile(join(candidateDir, 'site', 'extra.js'), 'x');
  await appendFile(join(candidateDir, 'site', 'catalog.json'), ' ');
  await rm(join(candidateDir, 'site', 'NOTICES.md'));
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.deepEqual(
    mismatches(result).map((line) => `${line.item} ${line.path}`),
    [
      '3-asset site/catalog.json',
      '3-asset site/extra.js',
      '3-asset site/NOTICES.md',
      '3-catalog site/catalog.json',
    ],
  );
});

test('(4) a failed, missing or other-version log row fails, and so does the log digest', async () => {
  const { candidateDir, fixturesDir } = await setup({
    logRows: (rows) => [
      { ...rows[0], status: 'failed' },
      ...rows.slice(1, 5),
      { ...rows[5], expectedVersion: '0.0.1' },
      ...rows.slice(7),
    ],
  });
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.deepEqual(
    mismatches(result).map((line) => line.path),
    [
      'acceptance-log.json#aube/chromium',
      'acceptance-log.json#biome/node',
      'acceptance-log.json#biome/firefox',
    ],
  );
  await appendFile(join(candidateDir, 'acceptance-log.json'), ' ');
  const changed = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.ok(items(changed).includes('4-log-sha256'));
});

test('(5) a catalog default that is not the accepted version fails', async () => {
  const { candidateDir, fixturesDir } = await setup({
    catalogDefaults: { aube: '2.7.1', biome: '2.5.15', pitchfork: '2.32.0' },
  });
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.deepEqual(
    mismatches(result).map((line) => line.path),
    ['site/catalog.json#defaults.aube'],
  );
});

test('(7) a changed demo fixture fails, and a distributable verify candidate fails', async () => {
  const { candidateDir, fixturesDir } = await setup({ distributable: true });
  await appendFile(join(fixturesDir, 'biome-basic', 'app', 'index.js'), '//');
  const result = await verifyCandidate({
    mode: 'verify',
    candidateDir,
    fixturesDir,
    pack: packRecord(),
  });
  assert.deepEqual(items(result), ['7-fixtures', 'mode-distributable']);
});

test('a candidate without its manifest fails at once', async () => {
  const { candidateDir, fixturesDir } = await setup();
  await rm(join(candidateDir, 'manifest.json'));
  await assert.rejects(
    verifyCandidate({
      mode: 'verify',
      candidateDir,
      fixturesDir,
      pack: packRecord(),
    }),
    /candidate-mismatch: candidate file missing: manifest\.json/,
  );
});
