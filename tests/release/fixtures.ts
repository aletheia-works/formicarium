import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type {
  CandidateIdentity,
  CheckEvidence,
  CoverageEvidence,
  ReleaseApproval,
  ReleaseEvidence,
} from '../../scripts/release/types.js';
import {
  BROWSER_TITLES,
  FILES,
  REQUIRED_U1_REALMS,
} from '../../scripts/terrarium/coverage.js';
import { sha256 } from '../../scripts/terrarium/evidence.js';
export const digest = 'a'.repeat(64);
export function coverageFixture(c: CandidateIdentity) {
  const digests = c.firstPartyJs.map((row) => ({
    path: row.path,
    sourceSha256: row.sha256,
    statementMapSha256: digest,
  }));
  const binding = {
    generation: 'fixture-generation',
    sourceIdentity: sha256(JSON.stringify(digests)),
    candidateSha256: c.tarballSha256,
    executionIdentity: 'c'.repeat(64),
  };
  const inventory = {
    ...binding,
    candidate: { sha256: binding.candidateSha256 },
    tarballSha256: c.tarballSha256,
    digests,
  };
  const report = {
    ...binding,
    fixedInventory: [...FILES],
    passed: true,
    files: FILES.map((path) => ({ path, lines: { total: 1, covered: 1 } })),
    freshReceipts: [
      { ...binding, realm: 'node-host', status: 'passed', exitCode: 0 },
      ...['chromium', 'firefox', 'webkit'].flatMap((project) =>
        BROWSER_TITLES.map((title) => ({
          ...binding,
          realm: 'browser-host',
          project,
          title,
          status: 'passed',
          expectedStatus: 'passed',
        })),
      ),
    ],
    componentImport: { originalRealmNames: [...REQUIRED_U1_REALMS] },
  };
  const coverage: CoverageEvidence = {
    candidateId: c.candidateId,
    tarballSha256: c.tarballSha256,
    inventorySha256: sha256(JSON.stringify(FILES)),
    binding,
    inventoryArtifact: 'inventory.json',
    reportArtifact: 'report.json',
    commands: ['fixture sealed coverage'],
    files: FILES.map((path) => ({
      path,
      totalLines: 1,
      coveredLines: 1,
      realms: ['node-host'],
      collection: 'measured',
    })),
  };
  return { binding, inventory, report, coverage };
}
export function candidate(version = '0.1.0-rc.1'): CandidateIdentity {
  return {
    candidateId: `fixture-${version}`,
    version,
    sourceCommit: 'fixture-source-commit',
    tarballSha256: digest,
    core: {
      sourceCommit: 'fixture-core-commit',
      dirty: false,
      buildInfoSha256: digest,
    },
    firstPartyJs: FILES.map((path) => ({ path, sha256: digest })),
    exclusions: [{ path: 'third-party', reason: 'verified separately' }],
  };
}
export function check(id: string, c = candidate()): CheckEvidence {
  return {
    checkId: id,
    candidateId: c.candidateId,
    tarballSha256: c.tarballSha256,
    command: 'fixture observed command',
    environment: 'fixture environment',
    status: 'passed',
    exitCode: 0,
    termination: 'exit',
    stdoutArtifact: 'stdout.txt',
    stderrArtifact: 'stderr.txt',
    artifactDigests: {
      'stdout.txt': sha256('stdout'),
      'stderr.txt': sha256('stderr'),
      'terrarium-integration.diff': sha256(
        'fixture terrarium integration diff',
      ),
    },
    guestBuilds: [
      {
        tool: 'aube',
        ref: 'fixture-ref',
        sourceCommit: 'fixture-guest',
        sha256: digest,
      },
    ],
    browser: id.includes('node') ? null : 'fixture-browser',
    terrarium: {
      baselineCommit: 'fixture-baseline',
      integrationCommit: 'fixture-integration',
      diffArtifact: 'terrarium-integration.diff',
      diffSha256: sha256('fixture terrarium integration diff'),
      installedVersion: c.version,
    },
    unverified: [],
  };
}
export function approval(c = candidate()): ReleaseApproval {
  return {
    approvalId: 'fixture-approval',
    humanInput: 'fixture-only explicit approval',
    operation: c.version === '0.1.0' ? 'publish-stable' : 'publish-rc',
    target: 'fixture-registry',
    candidateId: c.candidateId,
    version: c.version,
    sourceCommit: c.sourceCommit,
    approvedAt: '2026-10-08T00:00:00Z',
  };
}
export async function fixture(
  t: TestContext,
  ids = ['pack'],
  version = '0.1.0-rc.1',
) {
  const root = await mkdtemp(join(tmpdir(), 'u4-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'stdout.txt'), 'stdout');
  await writeFile(join(root, 'stderr.txt'), 'stderr');
  await writeFile(
    join(root, 'terrarium-integration.diff'),
    'fixture terrarium integration diff',
  );
  const c = candidate(version),
    e: ReleaseEvidence = {
      schemaVersion: 1,
      evidenceId: `fixture-${version.replaceAll('.', '-')}`,
      candidate: c,
      checks: ids.map((id) => check(id, c)),
      coverage: null,
    };
  return { root, c, e };
}
