import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import {
  BROWSER_TITLES,
  FILES,
  REQUIRED_U1_REALMS,
  sha256,
} from './inventory.ts';
import { ASSET_LIMITS, readBoundedFile } from './publication-assets.ts';
import type { ReleaseEvidence } from './types.ts';

export const hex = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
export function requireCondition(
  value: unknown,
  message: string,
): asserts value {
  if (!value) throw new Error(message);
}
export function unique(values: readonly string[], label: string) {
  requireCondition(
    new Set(values).size === values.length,
    `duplicate ${label}`,
  );
}
export async function artifactBytes(
  root: string,
  path: string,
  limit?: number,
) {
  requireCondition(
    typeof path === 'string' &&
      path.length > 0 &&
      !isAbsolute(path) &&
      !path.split(/[\\/]/).some((p) => p === '..' || p === '.' || p === '') &&
      !path.includes('\\'),
    'unsafe artifact path',
  );
  const base = await realpath(root),
    target = resolve(base, path);
  requireCondition(target.startsWith(base + sep), 'artifact escapes root');
  let current = base;
  for (const part of path.split('/')) {
    current = join(current, part);
    requireCondition(
      !(await lstat(current)).isSymbolicLink(),
      'artifact symlink refused',
    );
  }
  requireCondition((await lstat(target)).isFile(), 'artifact must be a file');
  const maximum =
    limit ?? (path.endsWith('.json') ? ASSET_LIMITS.metadataBytes : undefined);
  return maximum === undefined
    ? readFile(target)
    : readBoundedFile(target, maximum);
}
export async function validateEvidence(
  root: string,
  evidence: ReleaseEvidence,
) {
  requireCondition(
    evidence?.schemaVersion === 1 &&
      /^[a-zA-Z0-9_-]+$/.test(evidence.evidenceId),
    'invalid evidence schema/id',
  );
  const c = evidence.candidate;
  requireCondition(
    c?.candidateId &&
      c.version &&
      c.sourceCommit &&
      hex(c.tarballSha256) &&
      c.core?.dirty === false &&
      c.core.sourceCommit &&
      hex(c.core.buildInfoSha256),
    'invalid candidate/core identity',
  );
  requireCondition(
    Array.isArray(c.firstPartyJs) &&
      c.firstPartyJs.length === FILES.length &&
      c.firstPartyJs.every(
        (row) => FILES.includes(row.path) && hex(row.sha256),
      ),
    'fixed candidate inventory differs',
  );
  unique(
    c.firstPartyJs.map((row) => row.path),
    'source paths',
  );
  requireCondition(
    Array.isArray(c.exclusions) &&
      c.exclusions.every((row) => row.path && row.reason),
    'exclusions missing',
  );
  requireCondition(Array.isArray(evidence.checks), 'checks missing');
  unique(
    evidence.checks.map((row) => row.checkId),
    'checkId',
  );
  for (const check of evidence.checks) {
    requireCondition(
      check.checkId &&
        check.candidateId === c.candidateId &&
        check.tarballSha256 === c.tarballSha256 &&
        check.command?.trim() &&
        check.environment?.trim(),
      'check identity differs',
    );
    requireCondition(
      ['passed', 'failed', 'unverified'].includes(check.status) &&
        [
          'exit',
          'init-failure',
          'execution-failure',
          'timeout',
          'aborted',
          'not-run',
        ].includes(check.termination),
      'check result invalid',
    );
    requireCondition(
      check.exitCode === null || Number.isInteger(check.exitCode),
      'exit code invalid',
    );
    if (check.status === 'passed')
      requireCondition(
        check.exitCode === 0 &&
          check.termination === 'exit' &&
          check.unverified.length === 0 &&
          check.stdoutArtifact &&
          check.stderrArtifact,
        'unobserved passed check',
      );
    requireCondition(
      Array.isArray(check.guestBuilds) &&
        check.guestBuilds.every(
          (row: {
            tool: string;
            ref: string;
            sourceCommit: string;
            sha256: string;
          }) => row.tool && row.ref && row.sourceCommit && hex(row.sha256),
        ),
      'guest identity invalid',
    );
    for (const path of [check.stdoutArtifact, check.stderrArtifact].filter(
      (p): p is string => p !== null,
    ))
      requireCondition(hex(check.artifactDigests[path]), 'log digest missing');
    for (const [path, digest] of Object.entries(check.artifactDigests))
      requireCondition(
        hex(digest) && sha256(await artifactBytes(root, path)) === digest,
        'artifact digest differs',
      );
    const acceptance =
      /^(terrarium|iframe)-(node|chromium|firefox|webkit)$/.test(check.checkId);
    if (check.terrarium || (acceptance && check.status === 'passed')) {
      const integration = check.terrarium;
      requireCondition(
        integration &&
          typeof integration.baselineCommit === 'string' &&
          integration.baselineCommit.trim() &&
          typeof integration.integrationCommit === 'string' &&
          integration.integrationCommit.trim() &&
          integration.installedVersion === c.version &&
          typeof integration.diffArtifact === 'string' &&
          integration.diffArtifact.trim() &&
          hex(integration.diffSha256),
        'terrarium integration metadata invalid',
      );
      requireCondition(
        check.artifactDigests[integration.diffArtifact] ===
          integration.diffSha256 &&
          sha256(await artifactBytes(root, integration.diffArtifact)) ===
            integration.diffSha256,
        'terrarium integration diff digest differs',
      );
    }
  }
  if (evidence.coverage) {
    const v = evidence.coverage;
    requireCondition(
      v.candidateId === c.candidateId &&
        v.tarballSha256 === c.tarballSha256 &&
        hex(v.inventorySha256) &&
        v.commands.length > 0,
      'coverage identity differs',
    );
    requireCondition(
      v.files.length === FILES.length &&
        v.files.every((row) => FILES.includes(row.path)),
      'coverage denominator differs',
    );
    unique(
      v.files.map((row) => row.path),
      'coverage paths',
    );
    for (const row of v.files)
      requireCondition(
        Number.isInteger(row.totalLines) &&
          Number.isInteger(row.coveredLines) &&
          row.totalLines >= 0 &&
          row.coveredLines >= 0 &&
          row.coveredLines <= row.totalLines &&
          ['measured', 'not-executed', 'missing'].includes(row.collection) &&
          (row.collection !== 'not-executed' || row.coveredLines === 0),
        'coverage counters invalid',
      );
    const bytes = await artifactBytes(
      root,
      v.reportArtifact,
      ASSET_LIMITS.metadataBytes,
    );
    const reportDigest = sha256(bytes);
    requireCondition(
      evidence.checks.some(
        (check) => check.artifactDigests[v.reportArtifact] === reportDigest,
      ),
      'coverage report digest missing',
    );
    const report = JSON.parse(bytes.toString());
    requireCondition(
      report.sourceIdentity &&
        report.candidateSha256 &&
        hex(report.executionIdentity) &&
        report.files?.length === FILES.length &&
        report.passed === true,
      'coverage report not bound',
    );
    const expected = v.binding;
    requireCondition(
      expected?.generation &&
        hex(expected.sourceIdentity) &&
        hex(expected.candidateSha256) &&
        hex(expected.executionIdentity),
      'coverage binding missing',
    );
    for (const key of [
      'generation',
      'sourceIdentity',
      'candidateSha256',
      'executionIdentity',
    ] as const)
      requireCondition(
        report[key] === expected[key],
        'coverage report binding differs',
      );
    const inventoryBytes = await artifactBytes(
      root,
      v.inventoryArtifact,
      ASSET_LIMITS.metadataBytes,
    );
    requireCondition(
      evidence.checks.some(
        (check) =>
          check.artifactDigests[v.inventoryArtifact] === sha256(inventoryBytes),
      ),
      'coverage inventory artifact digest missing',
    );
    const inventory = JSON.parse(inventoryBytes.toString());
    requireCondition(
      inventory.generation === expected.generation &&
        inventory.sourceIdentity === expected.sourceIdentity &&
        inventory.candidate?.sha256 === expected.candidateSha256 &&
        inventory.tarballSha256 === c.tarballSha256 &&
        sha256(JSON.stringify(inventory.digests)) === expected.sourceIdentity,
      'coverage source/candidate binding differs',
    );
    requireCondition(
      Array.isArray(inventory.digests) &&
        inventory.digests.length === FILES.length,
      'coverage source inventory differs',
    );
    unique(
      inventory.digests.map((row: { path: string }) => row.path),
      'coverage source paths',
    );
    for (const row of c.firstPartyJs)
      requireCondition(
        inventory.digests.find(
          (file: { path: string; sourceSha256: string }) =>
            file.path === row.path,
        )?.sourceSha256 === row.sha256,
        'coverage candidate source digest differs',
      );
    requireCondition(
      Array.isArray(report.freshReceipts),
      'coverage receipt realms missing',
    );
    const receipts = report.freshReceipts;
    const projects = ['chromium', 'firefox', 'webkit'];
    requireCondition(
      receipts.length === 1 + projects.length * BROWSER_TITLES.length &&
        receipts.filter((row: { realm: string }) => row.realm === 'node-host')
          .length === 1,
      'coverage receipt realm set differs',
    );
    const allowedRealms = new Set<string>(['node-host']);
    for (const project of projects)
      for (const title of BROWSER_TITLES) {
        requireCondition(
          receipts.filter(
            (row: { realm: string; project?: string; title?: string }) =>
              row.realm === 'browser-host' &&
              row.project === project &&
              row.title === title,
          ).length === 1,
          'coverage browser realm missing or duplicate',
        );
        allowedRealms.add(`browser-host:${project}:${title}`);
      }
    for (const row of receipts) {
      requireCondition(
        row.status === 'passed' &&
          (row.realm === 'node-host'
            ? row.exitCode === 0
            : row.realm === 'browser-host' && row.expectedStatus === 'passed'),
        'coverage receipt realm result differs',
      );
      for (const key of [
        'generation',
        'sourceIdentity',
        'candidateSha256',
        'executionIdentity',
      ] as const)
        requireCondition(
          row[key] === expected[key],
          'coverage receipt binding differs',
        );
    }
    const imported = report.componentImport?.originalRealmNames;
    requireCondition(
      Array.isArray(imported) &&
        imported.length === REQUIRED_U1_REALMS.length &&
        new Set(imported).size === imported.length &&
        JSON.stringify([...imported].sort()) ===
          JSON.stringify([...REQUIRED_U1_REALMS].sort()),
      'coverage imported realm set differs',
    );
    for (const realm of imported) allowedRealms.add(realm);
    for (const row of v.files)
      requireCondition(
        Array.isArray(row.realms) &&
          new Set(row.realms).size === row.realms.length &&
          row.realms.every((realm) => allowedRealms.has(realm)) &&
          (row.collection !== 'measured' || row.realms.length > 0),
        'coverage file realm differs',
      );
    requireCondition(
      sha256(JSON.stringify(report.fixedInventory)) === v.inventorySha256,
      'coverage inventory digest differs',
    );
    for (const row of v.files) {
      const measured = report.files.find(
        (f: { path: string }) => f.path === row.path,
      );
      requireCondition(
        measured?.lines.total === row.totalLines &&
          measured.lines.covered === row.coveredLines,
        'coverage report counters differ',
      );
    }
  }
  return evidence;
}
export interface EvidenceIndex {
  version: 1;
  entries: { evidenceId: string; artifact: string; sha256: string }[];
}
export async function saveEvidence(root: string, evidence: ReleaseEvidence) {
  await validateEvidence(root, evidence);
  const artifact = `envelopes/${evidence.evidenceId}.json`,
    bytes = JSON.stringify(evidence, null, 2) + '\n';
  await mkdir(join(root, 'envelopes'), { recursive: true });
  await writeFile(join(root, artifact), bytes, { flag: 'wx' });
  const entry = {
    evidenceId: evidence.evidenceId,
    artifact,
    sha256: sha256(bytes),
  };
  // One immutable index per envelope avoids non-atomic shared index updates.
  await mkdir(join(root, 'indexes'), { recursive: true });
  await writeFile(
    join(root, 'indexes', `${evidence.evidenceId}.json`),
    JSON.stringify({ version: 1, entries: [entry] }),
    { flag: 'wx' },
  );
  return entry;
}
export async function resolveEvidence(
  root: string,
  index: EvidenceIndex,
  id: string,
) {
  requireCondition(
    index?.version === 1 && Array.isArray(index.entries),
    'invalid evidence index',
  );
  unique(
    index.entries.map((e) => e.evidenceId),
    'evidenceId',
  );
  const entry = index.entries.find((e) => e.evidenceId === id);
  requireCondition(entry && hex(entry.sha256), 'unknown evidenceId');
  const bytes = await artifactBytes(
    root,
    entry.artifact,
    ASSET_LIMITS.metadataBytes,
  );
  requireCondition(sha256(bytes) === entry.sha256, 'envelope digest differs');
  const evidence = JSON.parse(bytes.toString()) as ReleaseEvidence;
  requireCondition(evidence.evidenceId === id, 'envelope ID differs');
  return validateEvidence(root, evidence);
}
