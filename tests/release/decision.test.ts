import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import {
  DIFF_CHECKS,
  decideRelease,
  RC_CHECKS,
  REGRESSION_CHECKS,
} from '../../scripts/release/decision.js';
import { saveEvidence } from '../../scripts/release/evidence.js';
import { FILES, sha256 } from '../../scripts/release/inventory.js';
import type { ReleaseEvidence } from '../../scripts/release/types.js';
import {
  approval,
  candidate,
  check,
  coverageFixture,
  fixture,
} from './fixtures.js';

async function rc(t: TestContext) {
  const f = await fixture(t, [...RC_CHECKS]);
  const entry = await saveEvidence(f.root, f.e);
  return {
    ...f,
    index: { version: 1 as const, entries: [entry] },
    approvals: [approval(f.c)],
    target: 'fixture-registry',
    channel: 'rc' as const,
    evidenceIds: [f.e.evidenceId],
    candidate: f.c,
  };
}
async function stable(t: TestContext) {
  const f = await fixture(t, [...RC_CHECKS]),
    rcEntry = await saveEvidence(f.root, f.e),
    c = candidate('0.1.0');
  const diff = {
      rcCandidateId: f.c.candidateId,
      rcTarballSha256: f.c.tarballSha256,
      stableCandidateId: c.candidateId,
      stableTarballSha256: c.tarballSha256,
      changed: ['package.version'],
      unchanged: ['fixture-source'],
    },
    bytes = JSON.stringify(diff);
  await writeFile(join(f.root, 'diff.json'), bytes);
  const preparedCoverage = coverageFixture(c),
    report = preparedCoverage.report;
  await writeFile(join(f.root, 'report.json'), JSON.stringify(report));
  await writeFile(
    join(f.root, 'inventory.json'),
    JSON.stringify(preparedCoverage.inventory),
  );
  const e: ReleaseEvidence = {
    schemaVersion: 1,
    evidenceId: 'stable-fixture',
    candidate: c,
    checks: [...RC_CHECKS, ...REGRESSION_CHECKS, ...DIFF_CHECKS].map((id) =>
      check(id, c),
    ),
    coverage: preparedCoverage.coverage,
    rcAdoption: {
      status: 'passed',
      rc: {
        evidenceId: f.e.evidenceId,
        evidenceSha256: rcEntry.sha256,
        candidateId: f.c.candidateId,
        version: '0.1.0-rc.1',
        tarballSha256: f.c.tarballSha256,
        publishedPackage: {
          version: '0.1.0-rc.1',
          tarballSha256: f.c.tarballSha256,
          registryIntegrity: 'sha512-Zml4dHVyZQ==',
        },
      },
      stable: {
        candidateId: c.candidateId,
        version: '0.1.0',
        tarballSha256: c.tarballSha256,
      },
      diff: {
        artifact: 'diff.json',
        sha256: sha256(bytes),
        validationCheckIds: [...DIFF_CHECKS],
      },
    },
  };
  if (e.coverage)
    e.checks[0].artifactDigests = {
      ...e.checks[0].artifactDigests,
      'inventory.json': sha256(JSON.stringify(preparedCoverage.inventory)),
      'report.json': sha256(
        await (await import('node:fs/promises')).readFile(
          join(f.root, 'report.json'),
        ),
      ),
    };
  const entry = await saveEvidence(f.root, e);
  return {
    ...f,
    e,
    c,
    index: { version: 1 as const, entries: [rcEntry, entry] },
    candidate: c,
    evidenceIds: [e.evidenceId],
    approvals: [approval(c)],
    target: 'fixture-registry',
    channel: 'stable' as const,
  };
}
test('RC permits complete fixture preconditions without stable adoption; performs no publishing', async (t) => {
  const f = await rc(t),
    result = await decideRelease(f);
  assert.equal(result.allowed, true);
  assert.equal(result.outcome, 'not-run');
  assert.equal(result.distTag, 'next');
});
test('missing target-bound human approval blocks RC', async (t) => {
  const f = await rc(t);
  for (const approvals of [
    [],
    [{ ...f.approvals[0], candidateId: 'wrong' }],
    [{ ...f.approvals[0], target: 'other' }],
  ])
    assert.equal((await decideRelease({ ...f, approvals })).allowed, false);
});
test('unknown ID checkId and duplicate evidence IDs block', async (t) => {
  const f = await rc(t);
  for (const evidenceIds of [
    ['unknown'],
    ['pack'],
    [f.e.evidenceId, f.e.evidenceId],
  ])
    assert.equal((await decideRelease({ ...f, evidenceIds })).allowed, false);
});
test('failed mandatory check cannot be hidden by another successful envelope', async (t) => {
  const f = await rc(t),
    e = structuredClone(f.e);
  e.evidenceId = 'failed-fixture';
  e.checks[0].status = 'failed';
  e.checks[0].exitCode = 1;
  e.checks[0].termination = 'execution-failure';
  if (e.coverage)
    e.checks[0].artifactDigests = {
      ...e.checks[0].artifactDigests,
      'report.json': sha256(
        await (await import('node:fs/promises')).readFile(
          join(f.root, 'report.json'),
        ),
      ),
    };
  const entry = await saveEvidence(f.root, e);
  assert.equal(
    (
      await decideRelease({
        ...f,
        index: { version: 1, entries: [...f.index.entries, entry] },
        evidenceIds: [f.e.evidenceId, e.evidenceId],
      })
    ).allowed,
    false,
  );
});
test('stable requires own fixed coverage and digest-bound explicit RC history', async (t) => {
  const f = await stable(t),
    result = await decideRelease(f);
  assert.equal(result.allowed, true);
  assert.equal(result.distTag, 'latest');
});
test('RC envelope direct stable adoption or relabel cannot substitute stable evidence', async (t) => {
  const f = await stable(t);
  assert.equal(
    (
      await decideRelease({
        ...f,
        evidenceIds: [f.index.entries[0].evidenceId],
      })
    ).allowed,
    false,
  );
  const e = structuredClone(f.e);
  e.evidenceId = 'no-adoption';
  delete e.rcAdoption;
  if (e.coverage)
    e.checks[0].artifactDigests = {
      ...e.checks[0].artifactDigests,
      'report.json': sha256(
        await (await import('node:fs/promises')).readFile(
          join(f.root, 'report.json'),
        ),
      ),
    };
  const entry = await saveEvidence(f.root, e);
  assert.equal(
    (
      await decideRelease({
        ...f,
        index: { version: 1, entries: [...f.index.entries, entry] },
        evidenceIds: [e.evidenceId],
      })
    ).allowed,
    false,
  );
});
test('unknown or altered RC digest public tarball and unverified diff all block stable', async (t) => {
  for (const patch of ['unknown', 'digest', 'tarball', 'diff']) {
    const f = await stable(t),
      e = structuredClone(f.e);
    e.evidenceId = `negative-${patch}`;
    if (patch === 'unknown') e.rcAdoption!.rc.evidenceId = 'unknown';
    if (patch === 'digest') e.rcAdoption!.rc.evidenceSha256 = 'b'.repeat(64);
    if (patch === 'tarball')
      e.rcAdoption!.rc.publishedPackage.tarballSha256 = 'b'.repeat(64);
    if (patch === 'diff') e.rcAdoption!.status = 'unverified';
    if (e.coverage)
      e.checks[0].artifactDigests = {
        ...e.checks[0].artifactDigests,
        'report.json': sha256(
          await (await import('node:fs/promises')).readFile(
            join(f.root, 'report.json'),
          ),
        ),
      };
    const entry = await saveEvidence(f.root, e);
    assert.equal(
      (
        await decideRelease({
          ...f,
          index: { version: 1, entries: [...f.index.entries, entry] },
          evidenceIds: [e.evidenceId],
        })
      ).allowed,
      false,
    );
  }
});
test('null coverage missing realm below floor and incomplete stable checks block', async (t) => {
  for (const kind of ['null', 'realm', 'floor', 'check']) {
    const f = await stable(t),
      e = structuredClone(f.e);
    e.evidenceId = `coverage-${kind}`;
    if (kind === 'null') e.coverage = null;
    if (kind === 'realm') e.coverage!.files[0].collection = 'missing';
    if (kind === 'floor') {
      e.coverage!.files = e.coverage!.files.map((row) => ({
        ...row,
        coveredLines: 0,
      }));
      const report = JSON.parse(
        await readFile(join(f.root, 'report.json'), 'utf8'),
      );
      report.files = FILES.map((path) => ({
        path,
        lines: { total: 1, covered: 0 },
      }));
      await writeFile(join(f.root, 'report.json'), JSON.stringify(report));
    }
    if (kind === 'check')
      e.checks = e.checks.filter((row) => row.checkId !== 'integration-ci');
    if (e.coverage)
      e.checks[0].artifactDigests = {
        ...e.checks[0].artifactDigests,
        'report.json': sha256(
          await (await import('node:fs/promises')).readFile(
            join(f.root, 'report.json'),
          ),
        ),
      };
    const entry = await saveEvidence(f.root, e);
    assert.equal(
      (
        await decideRelease({
          ...f,
          index: { version: 1, entries: [...f.index.entries, entry] },
          evidenceIds: [e.evidenceId],
        })
      ).allowed,
      false,
    );
  }
});
test('stable blocks forged realm tokens or a global one-file browser claim', async (t) => {
  for (const kind of ['tokens', 'one-file']) {
    const f = await stable(t),
      e = structuredClone(f.e);
    e.evidenceId = `forged-realms-${kind}`;
    e.coverage!.files = e.coverage!.files.map((row, index) => ({
      ...row,
      realms:
        kind === 'tokens'
          ? ['fake-node-chromium-firefox-webkit']
          : index === 0
            ? ['node', 'chromium', 'firefox', 'webkit']
            : ['unrelated-realm'],
    }));
    // A raw fixture envelope reaches decision-time validation, not save-time validation.
    const artifact = `envelopes/${e.evidenceId}.json`,
      bytes = JSON.stringify(e);
    await writeFile(join(f.root, artifact), bytes);
    const entry = { evidenceId: e.evidenceId, artifact, sha256: sha256(bytes) };
    const result = await decideRelease({
      ...f,
      index: { version: 1, entries: [...f.index.entries, entry] },
      evidenceIds: [e.evidenceId],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.outcome, 'blocked');
    assert.match(result.missing.join('\n'), /coverage|realm|receipt/i);
  }
});
