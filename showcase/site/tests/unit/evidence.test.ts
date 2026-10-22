import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../../scripts/build-key.ts';
import { siteLayout } from '../../scripts/common.ts';
import {
  ACCEPT_ROWS,
  assembleEvidence,
  BROWSERS,
  LOGS,
  playwrightSpecs,
} from '../../scripts/evidence.ts';
import { validateEvidence } from '../../src/model/evidence.ts';
import { siteInventory } from '../../src/model/inventory.ts';
import { packRecord, writeCandidate } from './candidate-fixture.ts';
import { COMMIT, SHA, tempDir, writeFiles } from './helpers.ts';

const inventory = siteInventory([
  { path: 'index.html', sha256: SHA, bytes: 1 },
]);
const report = (failing?: string) => ({
  suites: [
    {
      title: 'site.spec.ts',
      specs: [],
      suites: [
        {
          title: 'acceptance',
          specs: Object.values(ACCEPT_ROWS)
            .flat()
            .flatMap((group) =>
              Array.from({ length: group.count }, (_, index) => {
                const title = `${group.tag} case ${index}`;
                const passed = title !== failing;
                return {
                  title,
                  ok: passed,
                  tests: [
                    {
                      projectName: 'x',
                      status: passed ? 'expected' : 'unexpected',
                    },
                  ],
                };
              }),
            ),
        },
      ],
    },
  ],
});

async function work(changes: Record<string, string | null> = {}) {
  const root = await tempDir('evidence');
  const { manifest } = await writeCandidate(join(root, 'inputs'));
  const files: Record<string, string> = {
    [LOGS.pack]: JSON.stringify(packRecord()),
    [LOGS.inventory]: JSON.stringify(inventory),
    [LOGS.verifyCandidate]: JSON.stringify({
      schemaVersion: 1,
      mode: 'verify',
      candidateId: manifest.candidateId,
      lines: [
        { item: '1-candidate-id', ok: true },
        { item: '6-pack', ok: null },
        { item: '7-fixtures', ok: true },
      ],
    }),
    [LOGS.boundary]: 'boundary: no violation\n',
    [LOGS.fixtures]: JSON.stringify({
      indexes: ['aube-local-deps', 'biome-basic', 'pitchfork-basic'].map(
        (name) => ({ source: `showcase/fixtures/${name}` }),
      ),
    }),
    [LOGS.workflowTest]: 'TAP version 13\n# tests 12\n# pass 12\n# fail 0\n',
    [LOGS.inventoryBuild]: JSON.stringify({ actual: inventory.sha256 }),
    [LOGS.inventoryDeploy]: JSON.stringify({ actual: inventory.sha256 }),
    [LOGS.deployGuard]: JSON.stringify({
      allowed: true,
      runNumber: 9,
      newestDeployed: null,
    }),
    [LOGS.coverage]: JSON.stringify({
      linesPct: 86.5,
      threshold: 80,
      missing: [],
    }),
  };
  for (const browser of BROWSERS) {
    files[LOGS.inventoryAccept(browser)] = JSON.stringify({
      actual: inventory.sha256,
    });
    files[LOGS.accept(browser)] = JSON.stringify(report());
  }
  for (const [path, body] of Object.entries(changes))
    if (body !== null) files[path] = body;
  await writeFiles(root, files);
  for (const [path, body] of Object.entries(changes))
    if (body === null) await rm(join(root, path), { force: true });
  return { layout: siteLayout(root), manifest };
}

test('playwrightSpecs walks nested suites and needs every test expected', () => {
  const specs = playwrightSpecs(report('[tool-page] case 2'));
  assert.equal(specs.length, 16);
  assert.deepEqual(
    specs.filter((spec) => !spec.passed).map((spec) => spec.title),
    ['[tool-page] case 2'],
  );
  assert.deepEqual(playwrightSpecs(null), []);
});

test('complete logs give the 27-row site evidence without deployedIdentity', async () => {
  const { layout, manifest } = await work();
  const { evidence, directory } = await assembleEvidence({
    layout,
    stage: 'pre',
    sourceCommit: COMMIT,
    recordedAt: '2026-10-19T12:00:00Z',
  });
  assert.equal(evidence.checks.length, 27);
  assert.ok(evidence.checks.every((row) => row.status === 'passed'));
  assert.equal(evidence.deployedIdentity, undefined);
  assert.equal(evidence.identity.candidateId, manifest.candidateId);
  assert.equal(evidence.identity.siteInventorySha256, inventory.sha256);
  const record = await readFile(
    join(directory, 'checks', 'coverage-80--host.json'),
    'utf8',
  );
  assert.equal(
    sha256(record),
    evidence.checks.find((row) => row.name === 'coverage-80')!.logSha256,
  );
  assert.match(record, /"identityDigest":"[a-f0-9]{64}"/);
  validateEvidence(
    JSON.parse(await readFile(join(directory, 'evidence.json'), 'utf8')),
    { deployed: false },
  );
});

test('the deployed evidence adds the deploy logs and deployedIdentity', async () => {
  const { layout } = await work();
  const pre = await assembleEvidence({
    layout,
    stage: 'pre',
    sourceCommit: COMMIT,
  });
  const deployed = await assembleEvidence({
    layout,
    stage: 'deployed',
    sourceCommit: COMMIT,
  });
  assert.equal(deployed.evidence.deployedIdentity, inventory.sha256);
  const log = (evidence: typeof pre.evidence, name: string) =>
    evidence.checks.find((row) => row.name === name)!.logSha256;
  assert.notEqual(
    log(deployed.evidence, 'site-inventory'),
    log(pre.evidence, 'site-inventory'),
  );
  assert.notEqual(
    log(deployed.evidence, 'previous-site-preserved'),
    log(pre.evidence, 'previous-site-preserved'),
  );
  assert.equal(
    log(deployed.evidence, 'coverage-80'),
    log(pre.evidence, 'coverage-80'),
  );
});

test('a failed browser test fails its row and the evidence is refused', async () => {
  const { layout } = await work({
    [LOGS.accept('webkit')]: JSON.stringify(
      report('[adversarial-output] case 0'),
    ),
  });
  await assert.rejects(
    assembleEvidence({ layout, stage: 'pre', sourceCommit: COMMIT }),
    /evidence-invalid: failed ui-states-keyboard\/webkit/,
  );
});

test('a missing log makes its row unverified and the evidence is refused', async () => {
  const { layout } = await work({ [LOGS.boundary]: null });
  await assert.rejects(
    assembleEvidence({ layout, stage: 'pre', sourceCommit: COMMIT }),
    /unverified public-import-boundary\/host/,
  );
});

test('a different inventory in an acceptance log, low coverage or a refused guard fail', async () => {
  const cases: [Record<string, string>, RegExp, 'pre' | 'deployed'][] = [
    [
      {
        [LOGS.inventoryAccept('firefox')]: JSON.stringify({
          actual: 'f'.repeat(64),
        }),
      },
      /failed site-inventory\/host/,
      'pre',
    ],
    [
      {
        [LOGS.coverage]: JSON.stringify({
          linesPct: 79.99,
          threshold: 80,
          missing: [],
        }),
      },
      /failed coverage-80\/host/,
      'pre',
    ],
    [
      {
        [LOGS.coverage]: JSON.stringify({
          linesPct: 90,
          threshold: 80,
          missing: ['src/terminal/keys.ts'],
        }),
      },
      /failed coverage-80\/host/,
      'pre',
    ],
    [
      { [LOGS.deployGuard]: JSON.stringify({ allowed: false }) },
      /failed previous-site-preserved\/host/,
      'deployed',
    ],
  ];
  for (const [changes, pattern, stage] of cases) {
    const { layout } = await work(changes);
    await assert.rejects(
      assembleEvidence({ layout, stage, sourceCommit: COMMIT }),
      pattern,
    );
  }
});

test('a log of another candidate cannot pass candidate-identity', async () => {
  const { layout } = await work();
  const path = join(layout.work, LOGS.verifyCandidate);
  const value = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(
    path,
    JSON.stringify({ ...value, candidateId: 'f'.repeat(64) }),
  );
  await assert.rejects(
    assembleEvidence({ layout, stage: 'pre', sourceCommit: COMMIT }),
    /failed candidate-identity\/host/,
  );
});
