import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  type AcceptanceLog,
  type AcceptanceRow,
  ENVIRONMENTS,
  judgeRow,
  mergeAcceptance,
  readAcceptanceParts,
  requireAllRows,
} from '../scripts/acceptance.ts';
import { storeAcquired } from '../scripts/acquire.ts';
import { canonicalJson } from '../scripts/build-key.ts';
import {
  assembleCandidate,
  type CandidateManifest,
  computeCandidateId,
  daysSince,
  fixtureInventorySha256,
  lastDistributableAt,
  noticesText,
  summaryMarkdown,
} from '../scripts/candidate.ts';
import { buildCatalog, placeSite } from '../scripts/catalog.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import type { PackRecord } from '../scripts/pack.ts';
import { type WorkLayout, writeJson } from '../scripts/paths.ts';
import {
  bytes,
  commit,
  fakeFetch,
  json,
  type Route,
  redirect,
} from './fixtures/github.ts';
import { officialRecord, resolutionsOf } from './fixtures/records.ts';
import { zip } from './fixtures/tar.ts';
import { withLayout } from './fixtures/work.ts';

const fixtures = [
  officialRecord('aube', '2.7.0', 'tar.gz', 1),
  officialRecord('biome', '2.5.15', 'elf', 2),
];
const tools = fixtures.map(({ record }) => ({
  tool: record.tool,
  version: record.version,
}));
const rowsFor = (list = tools): AcceptanceRow[] =>
  list.flatMap(({ tool, version }) =>
    ENVIRONMENTS.map((environment) =>
      judgeRow({
        tool,
        environment,
        expectedVersion: version,
        exitCode: 0,
        stdout: `${tool} ${version}\n`,
        installMs: 10,
        versionMs: 5,
      }),
    ),
  );
const sourceCommit = commit('head');
const manifest = (
  overrides: Partial<CandidateManifest> = {},
): Omit<CandidateManifest, 'candidateId'> => ({
  schemaVersion: 1,
  sourceCommit,
  formicariumSourceCommit: sourceCommit,
  formicariumPackSha256: 'a'.repeat(64),
  catalogSha256: 'b'.repeat(64),
  fixtureInventorySha256: 'c'.repeat(64),
  assets: [{ path: 'site/catalog.json', sha256: 'd'.repeat(64), bytes: 10 }],
  resolvedTools: fixtures.map(({ record }) => ({
    tool: record.tool,
    version: record.version,
    source: record.buildInfo.source,
    elfSha256: record.elfSha256,
    provenance: record.provenance,
  })),
  acceptanceLogSha256: 'e'.repeat(64),
  distributable: false,
  records: [{ path: 'acceptance-log.json', sha256: 'e'.repeat(64), bytes: 1 }],
  ...overrides,
});

test('the same inputs give the same candidateId; run records do not change it', () => {
  const base = computeCandidateId(manifest());
  assert.equal(computeCandidateId(manifest()), base);
  const reused = manifest();
  reused.resolvedTools = reused.resolvedTools.map((tool) => ({
    ...tool,
    provenance: {
      ...tool.provenance,
      reusedFromRun: {
        runId: 99,
        runAttempt: 3,
        workflow: '.github/workflows/showcase.yml',
      },
    },
  }));
  assert.equal(computeCandidateId(reused), base);
  assert.equal(
    computeCandidateId(
      manifest({ acceptanceLogSha256: 'f'.repeat(64), records: [] }),
    ),
    base,
  );
});

test('changing one identity input changes the candidateId', () => {
  const base = computeCandidateId(manifest());
  const changed = [
    manifest({ formicariumPackSha256: '1'.repeat(64) }),
    manifest({ catalogSha256: '1'.repeat(64) }),
    manifest({ fixtureInventorySha256: '1'.repeat(64) }),
    manifest({ distributable: true }),
    manifest({ assets: [] }),
    manifest({ resolvedTools: manifest().resolvedTools.slice(1) }),
  ].map(computeCandidateId);
  assert.ok(changed.every((id) => id !== base));
  assert.equal(new Set(changed).size, changed.length);
});

test('every tool x environment row must exist once and pass', () => {
  requireAllRows(rowsFor(), tools);
  const rows = rowsFor();
  assert.throws(
    () => requireAllRows(rows.slice(1), tools),
    (error) => causeOf(error) === 'acceptance-row-missing',
  );
  assert.throws(
    () => requireAllRows([...rows, rows[0]!], tools),
    (error) => causeOf(error) === 'acceptance-row-missing',
  );
  const failed = rowsFor();
  failed[3] = judgeRow({
    tool: 'aube',
    environment: 'webkit',
    expectedVersion: '2.7.0',
    exitCode: 1,
    stdout: '',
    installMs: 1,
    versionMs: 1,
  });
  assert.throws(
    () => requireAllRows(failed, tools),
    (error) => causeOf(error) === 'acceptance-row-missing',
  );
  assert.equal(rowsFor().length, 8);
});

async function seed(layout: WorkLayout) {
  for (const fixture of fixtures)
    await storeAcquired(layout, fixture.record, fixture.download, fixture.elf);
  await writeJson(layout.resolutions, resolutionsOf(fixtures));
  await mkdir(layout.licenses, { recursive: true });
  for (const fixture of fixtures)
    await writeFile(
      join(layout.licenses, fixture.resolution.license.file),
      'MIT\n',
    );
  await placeSite(
    layout,
    fixtures.map(({ record }) => record),
  );
  await writeFile(
    layout.catalog,
    canonicalJson(buildCatalog(fixtures.map(({ record }) => record))),
  );
  const packageRoot = join(layout.root, 'package');
  await mkdir(packageRoot, { recursive: true });
  await writeFile(join(packageRoot, 'LICENSE'), 'Apache-2.0\n');
  await writeFile(join(packageRoot, 'THIRD_PARTY_NOTICES.md'), '# notices\n');
  const pack: PackRecord = {
    schemaVersion: 1,
    mode: 'verify',
    tarball: 'p.tgz',
    packSha256: 'a'.repeat(64),
    formicariumSourceCommit: sourceCommit,
    releaseTag: null,
    evidenceSha256: null,
  };
  return { packageRoot, pack };
}
const logOf = (rows: AcceptanceRow[]): AcceptanceLog =>
  mergeAcceptance(
    [
      {
        schemaVersion: 1,
        environment: {
          environment: 'node',
          observed: { node: process.versions.node },
        },
        rows,
      },
    ],
    { runId: '1', runAttempt: '1', recordedAt: '2026-10-18T00:00:00Z' },
  );

test('verify assembles a non-distributable candidate whose id matches its manifest', async () => {
  await withLayout(async (layout) => {
    const { packageRoot, pack } = await seed(layout);
    const result = await assembleCandidate({
      layout,
      mode: 'verify',
      sourceCommit,
      pack,
      log: logOf(rowsFor()),
      packageRoot,
    });
    assert.equal(result.distributable, false);
    const written = JSON.parse(
      await readFile(join(layout.candidate, 'manifest.json'), 'utf8'),
    ) as CandidateManifest;
    assert.equal(written.candidateId, computeCandidateId(written));
    assert.equal(
      written.fixtureInventorySha256,
      await fixtureInventorySha256(),
    );
    assert.ok(
      written.assets.some((asset) => asset.path === 'site/catalog.json'),
    );
    assert.ok(
      written.assets.some(
        (asset) => asset.path === 'site/licenses/formicarium-LICENSE',
      ),
    );
    assert.deepEqual(
      written.records.map((item) => item.path),
      ['acceptance-log.json', 'resolutions.json'],
    );
    await access(
      join(
        layout.candidate,
        'site',
        'guests',
        'aube',
        '2.7.0',
        'build-info.json',
      ),
    );
  });
});

test('a missing acceptance row or a pack of another mode creates no candidate', async () => {
  await withLayout(async (layout) => {
    const { packageRoot, pack } = await seed(layout);
    await assert.rejects(
      assembleCandidate({
        layout,
        mode: 'verify',
        sourceCommit,
        pack,
        log: logOf(rowsFor().slice(1)),
        packageRoot,
      }),
      (error) => causeOf(error) === 'acceptance-row-missing',
    );
    await assert.rejects(access(layout.candidate));
    await assert.rejects(
      assembleCandidate({
        layout,
        mode: 'distribute',
        sourceCommit,
        pack,
        log: logOf(rowsFor()),
        packageRoot,
      }),
      (error) => causeOf(error) === 'b1-pack-mismatch',
    );
    await assert.rejects(
      assembleCandidate({
        layout,
        mode: 'verify',
        sourceCommit: commit('x'),
        pack,
        log: logOf(rowsFor()),
        packageRoot,
      }),
      (error) => causeOf(error) === 'b1-pack-mismatch',
    );
  });
});

test('acceptance parts are merged from per-environment files only', async () => {
  await withLayout(async (layout) => {
    await writeJson(join(layout.acceptance, 'node.json'), {
      schemaVersion: 1,
      environment: { environment: 'node', observed: {} },
      rows: rowsFor().slice(0, 1),
    });
    await writeJson(join(layout.acceptance, 'other.json'), {
      schemaVersion: 1,
      rows: [],
    });
    const parts = await readAcceptanceParts(layout.acceptance);
    assert.equal(parts.length, 1);
    assert.equal(logOf(parts[0]!.rows).safari, 'unverified');
    await writeJson(join(layout.acceptance, 'webkit.json'), {
      schemaVersion: 2,
    });
    await assert.rejects(
      readAcceptanceParts(layout.acceptance),
      (error) => causeOf(error) === 'acceptance-row-missing',
    );
  });
});

test('days since the last distributable run, and the job summary line', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince('2026-10-15T00:00:00Z', now), 3);
  assert.equal(daysSince('2026-10-19T00:00:00Z', now), 0);
  assert.throws(
    () => daysSince('not a date', now),
    (error) => causeOf(error) === 'bad-body',
  );
  const complete = { ...manifest(), candidateId: 'f'.repeat(64) };
  assert.match(summaryMarkdown(complete, null), /配布可能な候補はない/);
  assert.match(summaryMarkdown(complete, 3), /3日/);
  assert.equal(
    noticesText(resolutionsOf(fixtures)),
    noticesText(resolutionsOf(fixtures)),
  );
  assert.match(noticesText(resolutionsOf(fixtures)), /licenses\/aube-LICENSE/);
});

// ---- lastDistributableAt: previous main runs, read through a fake GitHub ----

const runsApi = 'https://api.github.com/repos/owner/repo';
const mainRun = (id: number, createdAt: string, path?: string) => ({
  id,
  path: path ?? '.github/workflows/showcase.yml',
  head_branch: 'main',
  event: 'push',
  conclusion: 'success',
  run_attempt: 1,
  created_at: createdAt,
});
/** One run per entry: its artifact listing and, when it has a ZIP, the manifest. */
function lastRoutes(
  runs: Record<string, unknown>[],
  candidates: Record<number, { expired?: boolean; distributable?: unknown }>,
) {
  const routes: Record<string, Route> = {
    [`${runsApi}/actions/runs?branch=main&status=success&per_page=50`]: () =>
      json({ workflow_runs: runs }),
  };
  for (const item of runs) {
    const id = item.id as number;
    const candidate = candidates[id];
    routes[`${runsApi}/actions/runs/${id}/artifacts?name=showcase-candidate`] =
      () =>
        json({
          artifacts: candidate
            ? [
                {
                  id: id * 10,
                  name: 'showcase-candidate',
                  expired: candidate.expired ?? false,
                },
              ]
            : [],
        });
    routes[`${runsApi}/actions/artifacts/${id * 10}/zip`] = redirect(
      `https://blob.example/${id}.zip`,
    );
    routes[`https://blob.example/${id}.zip`] = () =>
      bytes(
        zip({
          'manifest.json': JSON.stringify({
            distributable: candidate?.distributable,
          }),
        }),
      );
  }
  return routes;
}
/** downloadArtifact reads the storage URL with the global fetch. */
async function withFetch<T>(
  routes: Record<string, Route>,
  run: (fetchImpl: ReturnType<typeof fakeFetch>) => Promise<T>,
) {
  const fetchImpl = fakeFetch(routes);
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl as typeof fetch;
  try {
    return await run(fetchImpl);
  } finally {
    globalThis.fetch = original;
  }
}
const lastOf = (fetchImpl: ReturnType<typeof fakeFetch>, limit?: number) =>
  lastDistributableAt(
    createGitHubApi({ token: 'read', fetchImpl }),
    'owner/repo',
    limit,
  );

test('the newest trusted main run with a distributable candidate gives the time', async () => {
  const routes = lastRoutes(
    [
      mainRun(30, '2026-10-19T00:00:00Z'),
      mainRun(20, '2026-10-18T00:00:00Z'),
      mainRun(10, '2026-10-17T00:00:00Z'),
    ],
    {
      30: { distributable: false },
      20: { distributable: true },
      10: { distributable: true },
    },
  );
  const at = await withFetch(routes, (fetchImpl) => lastOf(fetchImpl));
  assert.equal(at, '2026-10-18T00:00:00Z');
});
test('expired, missing or non-distributable candidates and untrusted workflows give no time', async () => {
  const routes = lastRoutes(
    [
      mainRun(40, '2026-10-19T00:00:00Z', '.github/workflows/other.yml'),
      mainRun(30, '2026-10-18T00:00:00Z'),
      mainRun(20, '2026-10-17T00:00:00Z'),
      mainRun(10, '2026-10-16T00:00:00Z'),
    ],
    {
      40: { distributable: true },
      30: { expired: true, distributable: true },
      20: { distributable: 'true' },
    },
  );
  const seen = await withFetch(routes, async (fetchImpl) => ({
    at: await lastOf(fetchImpl),
    urls: fetchImpl.calls.map((call) => call.url),
  }));
  assert.equal(seen.at, null);
  // The untrusted workflow's run and the expired artifact are never downloaded.
  assert.ok(!seen.urls.some((url) => url.includes('/runs/40/')));
  assert.ok(!seen.urls.includes('https://blob.example/30.zip'));
});
test('only the first `limit` eligible runs are read', async () => {
  const routes = lastRoutes(
    [mainRun(20, '2026-10-18T00:00:00Z'), mainRun(10, '2026-10-17T00:00:00Z')],
    { 20: { distributable: false }, 10: { distributable: true } },
  );
  const at = await withFetch(routes, (fetchImpl) => lastOf(fetchImpl, 1));
  assert.equal(at, null);
});
