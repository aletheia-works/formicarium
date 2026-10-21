import assert from 'node:assert/strict';
import { access, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import {
  resolveEvidence,
  saveEvidence,
  validateEvidence,
} from '../../scripts/release/evidence.js';
import { REQUIRED_U1_REALMS, sha256 } from '../../scripts/release/inventory.js';
import { coverageFixture, fixture } from './fixtures.js';

async function boundCoverage(t: TestContext) {
  const f = await fixture(t);
  const { binding, inventory, report, coverage } = coverageFixture(f.c);
  f.e.coverage = coverage;
  const inventoryBytes = JSON.stringify(inventory);
  await writeFile(join(f.root, 'inventory.json'), inventoryBytes);
  f.e.checks[0].artifactDigests = {
    ...f.e.checks[0].artifactDigests,
    'inventory.json': sha256(inventoryBytes),
  };
  async function saveReport(value: unknown) {
    const bytes = JSON.stringify(value);
    await writeFile(join(f.root, 'report.json'), bytes);
    f.e.checks[0].artifactDigests = {
      ...f.e.checks[0].artifactDigests,
      'report.json': sha256(bytes),
    };
  }
  await saveReport(report);
  return { ...f, binding, report, saveReport };
}

test('saving evidence whose artifact digest differs leaves no immutable envelope or index', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'stdout.txt'), 'changed');
  await assert.rejects(saveEvidence(f.root, f.e), /digest/);
  await assert.rejects(
    access(join(f.root, 'envelopes', `${f.e.evidenceId}.json`)),
    { code: 'ENOENT' },
  );
  await assert.rejects(
    access(join(f.root, 'indexes', `${f.e.evidenceId}.json`)),
    { code: 'ENOENT' },
  );
});
test('immutable envelope resolves by evidenceId and duplicate save refuses overwrite', async (t) => {
  const f = await fixture(t),
    entry = await saveEvidence(f.root, f.e);
  assert.deepEqual(
    await resolveEvidence(
      f.root,
      { version: 1, entries: [entry] },
      f.e.evidenceId,
    ),
    f.e,
  );
  await assert.rejects(saveEvidence(f.root, f.e), { code: 'EEXIST' });
});
test('unknown ID checkId substitution and duplicate index IDs fail', async (t) => {
  const f = await fixture(t),
    entry = await saveEvidence(f.root, f.e),
    index = { version: 1 as const, entries: [entry] };
  for (const id of ['unknown', 'pack'])
    await assert.rejects(
      resolveEvidence(f.root, index, id),
      /unknown evidenceId/,
    );
  await assert.rejects(
    resolveEvidence(
      f.root,
      { version: 1, entries: [entry, entry] },
      entry.evidenceId,
    ),
    /duplicate/,
  );
});
test('envelope byte tampering invalidates saved index', async (t) => {
  const f = await fixture(t),
    entry = await saveEvidence(f.root, f.e);
  await writeFile(join(f.root, entry.artifact), '{}');
  await assert.rejects(
    resolveEvidence(f.root, { version: 1, entries: [entry] }, entry.evidenceId),
    /digest/,
  );
});
test('different candidate or tarball and duplicate check IDs are refused', async (t) => {
  for (const field of ['candidateId', 'tarballSha256'] as const) {
    const f = await fixture(t);
    f.e.checks[0][field] = 'wrong';
    await assert.rejects(validateEvidence(f.root, f.e), /identity/);
  }
  const f = await fixture(t);
  f.e.checks = [f.e.checks[0], f.e.checks[0]];
  await assert.rejects(validateEvidence(f.root, f.e), /duplicate/);
});
test('passed status cannot conceal nonzero timeout unverified or missing logs', async (t) => {
  for (const patch of [
    { exitCode: 1 },
    { termination: 'timeout' as const },
    { unverified: ['missing'] },
    { stdoutArtifact: null },
  ]) {
    const f = await fixture(t);
    Object.assign(f.e.checks[0], patch);
    await assert.rejects(validateEvidence(f.root, f.e), /passed/);
  }
});
test('log modification and traversal/symlink artifacts fail', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, 'stdout.txt'), 'changed');
  await assert.rejects(validateEvidence(f.root, f.e), /digest/);
  await writeFile(join(f.root, 'stdout.txt'), 'stdout');
  f.e.checks[0].artifactDigests = {
    ...f.e.checks[0].artifactDigests,
    '../escape': 'a'.repeat(64),
  };
  await assert.rejects(validateEvidence(f.root, f.e), /unsafe/);
  await symlink('/etc/hosts', join(f.root, 'alias'));
  delete (f.e.checks[0].artifactDigests as Record<string, string>)['../escape'];
  f.e.checks[0].artifactDigests = {
    ...f.e.checks[0].artifactDigests,
    alias: 'a'.repeat(64),
  };
  await assert.rejects(validateEvidence(f.root, f.e), /symlink/);
});
test('fixed source denominator cannot omit or duplicate modules; null coverage remains explicit', async (t) => {
  const f = await fixture(t);
  assert.equal((await validateEvidence(f.root, f.e)).coverage, null);
  f.e.candidate.firstPartyJs = f.e.candidate.firstPartyJs.slice(1);
  await assert.rejects(validateEvidence(f.root, f.e), /inventory/);
});
test('coverage rejects separately hashed report from another generation source site or execution', async (t) => {
  for (const key of [
    'generation',
    'sourceIdentity',
    'candidateSha256',
    'executionIdentity',
  ] as const) {
    const f = await boundCoverage(t);
    await validateEvidence(f.root, f.e);
    const changed = {
      ...f.report,
      [key]: key === 'generation' ? 'other-generation' : 'd'.repeat(64),
    };
    await f.saveReport(changed);
    assert.equal(
      f.binding[key],
      f.report[key],
      'independent expected binding remains unchanged',
    );
    await assert.rejects(
      validateEvidence(f.root, f.e),
      /coverage.*binding|coverage.*identity/i,
    );
  }
});
test('coverage rejects realm substring impersonation despite complete counts and log digests', async (t) => {
  const f = await boundCoverage(t);
  await validateEvidence(f.root, f.e);
  const changed = {
    ...f.report,
    freshReceipts: f.report.freshReceipts.map((row) => ({
      ...row,
      realm: `fake-${row.realm}`,
      project: 'fake-chromium-firefox-webkit',
    })),
  };
  await f.saveReport(changed);
  await assert.rejects(
    validateEvidence(f.root, f.e),
    /coverage.*realm|coverage.*receipt/i,
  );
});
test('coverage rejects global one-realm substitution and missing imported realm without reducing files', async (t) => {
  for (const kind of ['one-realm', 'missing-imported']) {
    const f = await boundCoverage(t);
    await validateEvidence(f.root, f.e);
    const changed =
      kind === 'one-realm'
        ? { ...f.report, freshReceipts: [f.report.freshReceipts[0]] }
        : {
            ...f.report,
            componentImport: {
              originalRealmNames: REQUIRED_U1_REALMS.slice(1),
            },
          };
    await f.saveReport(changed);
    assert.equal(changed.files.length, 24);
    await assert.rejects(
      validateEvidence(f.root, f.e),
      /coverage.*realm|coverage.*receipt/i,
    );
  }
});
