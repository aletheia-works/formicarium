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
import { canonicalJson, sha256 } from '../scripts/build-key.ts';
import {
  assembleCandidate,
  type CandidateManifest,
  computeCandidateId,
  daysSince,
  fixtureInventorySha256,
  lastDistributableAt,
  noticesText,
  resolvedTools,
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
import {
  CA_BODY,
  caBundleOf,
  officialRecord,
  resolutionsOf,
} from './fixtures/records.ts';
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
  caBundle: { path: 'ca/cacert.pem', sha256: '9'.repeat(64), spdx: 'MPL-2.0' },
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
    manifest({
      caBundle: {
        path: 'ca/cacert.pem',
        sha256: '8'.repeat(64),
        spdx: 'MPL-2.0',
      },
    }),
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
  // Real Safari is required: the WebKit rows do not stand in for it.
  assert.throws(
    () =>
      requireAllRows(
        rows.filter((row) => row.environment !== 'safari'),
        tools,
      ),
    (error) => causeOf(error) === 'acceptance-row-missing',
  );
  assert.equal(rowsFor().length, 10);
});

async function seed(layout: WorkLayout) {
  for (const fixture of fixtures)
    await storeAcquired(layout, fixture.record, fixture.download, fixture.elf);
  await writeJson(layout.resolutions, resolutionsOf(fixtures));
  await mkdir(join(layout.caBundle, '..'), { recursive: true });
  await writeFile(layout.caBundle, CA_BODY);
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
    npmVersion: null,
    integrity: null,
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
    // The site's one CA bundle, with the digest resolve recorded.
    assert.deepEqual(written.caBundle, {
      path: 'ca/cacert.pem',
      sha256: sha256(CA_BODY),
      spdx: 'MPL-2.0',
    });
    assert.equal(
      await readFile(
        join(layout.candidate, 'site', 'ca', 'cacert.pem'),
        'utf8',
      ),
      CA_BODY,
    );
    assert.ok(
      written.assets.some(
        (asset) =>
          asset.path === 'site/ca/cacert.pem' &&
          asset.sha256 === sha256(CA_BODY),
      ),
    );
    assert.match(
      await readFile(join(layout.candidate, 'site', 'NOTICES.md'), 'utf8'),
      new RegExp(
        `CA certificates: ca/cacert.pem \\(sha256 ${sha256(CA_BODY)}, from https://curl\\.se/ca/cacert\\.pem\\): MPL-2\\.0`,
      ),
    );
    assert.match(summaryMarkdown(result, null), /CA bundle: `ca\/cacert\.pem`/);
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

test('a CA bundle that differs from resolve creates no candidate', async () => {
  for (const body of [`${CA_BODY}x`, CA_BODY.replace('AAAA', 'BBBB')])
    await withLayout(async (layout) => {
      const { packageRoot, pack } = await seed(layout);
      await writeFile(layout.caBundle, body);
      await assert.rejects(
        assembleCandidate({
          layout,
          mode: 'verify',
          sourceCommit,
          pack,
          log: logOf(rowsFor()),
          packageRoot,
        }),
        (error) => causeOf(error) === 'checksum-mismatch',
      );
    });
  assert.equal(caBundleOf().sha256, sha256(CA_BODY));
});

/**
 * biome's resolution as if built from a signed GPL tarball with an X11
 * library and an LGPL one whose signature is an `.asc` (not a `.sig`).
 * With `license` the tool's own license is another one.
 */
async function withGnuSources(
  layout: WorkLayout,
  tarballBody = 'tarball',
  license = 'GPL-3.0-or-later',
) {
  const resolutions = resolutionsOf(fixtures);
  const biome = resolutions.tools.find((item) => item.tool === 'biome')!;
  biome.license = { ...biome.license, spdx: license };
  const tarball = (name: string, signature?: string) => ({
    name: `${name}-1.0.tar.gz`,
    url: `https://ftp.gnu.org/gnu/${name}/${name}-1.0.tar.gz`,
    sha256: sha256('tarball'),
    size: 7,
    signatureUrl: `https://ftp.gnu.org/gnu/${name}/${signature ?? `${name}-1.0.tar.gz.sig`}`,
    signatureSha256: sha256('sig'),
    ...(signature ? { signatureName: signature } : {}),
    signer: 'A'.repeat(40),
  });
  const library = (name: string, spdx: string, signature?: string) => ({
    package: name,
    repository: `https://github.com/example/${name}`,
    tag: 'v1.0',
    version: '1.0',
    commit: commit(name),
    tarball: tarball(name, signature),
    license: {
      path: 'COPYING',
      file: `${name}-COPYING`,
      sha256: sha256(`${spdx}\n`),
      spdx,
    },
  });
  biome.gnu = {
    tarball: tarball('biome'),
    libraries: [
      library('ncurses', 'X11'),
      library('libfoo', 'LGPL-2.1-or-later', 'libfoo-1.0.tar.gz.asc'),
    ],
  };
  await writeJson(layout.resolutions, resolutions);
  await writeFile(join(layout.licenses, 'ncurses-COPYING'), 'X11\n');
  await writeFile(
    join(layout.licenses, 'libfoo-COPYING'),
    'LGPL-2.1-or-later\n',
  );
  await mkdir(layout.tarballs, { recursive: true });
  for (const [name, signature] of [
    ['biome', 'biome-1.0.tar.gz.sig'],
    ['ncurses', 'ncurses-1.0.tar.gz.sig'],
    ['libfoo', 'libfoo-1.0.tar.gz.asc'],
  ]) {
    await writeFile(join(layout.tarballs, `${name}-1.0.tar.gz`), tarballBody);
    await writeFile(join(layout.tarballs, signature!), 'sig');
  }
  return resolutions;
}

test('a GPL guest brings its library licenses and the signed sources of all its packages', async () => {
  await withLayout(async (layout) => {
    const { packageRoot, pack } = await seed(layout);
    const resolutions = await withGnuSources(layout);
    await assembleCandidate({
      layout,
      mode: 'verify',
      sourceCommit,
      pack,
      log: logOf(rowsFor()),
      packageRoot,
    });
    const site = join(layout.candidate, 'site');
    for (const path of [
      'licenses/ncurses-COPYING',
      'licenses/libfoo-COPYING',
      'sources/biome/biome-1.0.tar.gz',
      'sources/biome/biome-1.0.tar.gz.sig',
      'sources/biome/libfoo-1.0.tar.gz',
      'sources/biome/libfoo-1.0.tar.gz.asc',
      // The X11 library is linked into the GPL guest: its source comes too.
      'sources/biome/ncurses-1.0.tar.gz',
      'sources/biome/ncurses-1.0.tar.gz.sig',
    ])
      await access(join(site, path));
    const notices = noticesText(resolutions);
    assert.equal(await readFile(join(site, 'NOTICES.md'), 'utf8'), notices);
    assert.match(
      notices,
      / {2}- with ncurses 1\.0 .+ X11 — licenses\/ncurses-COPYING/,
    );
    assert.match(
      notices,
      / {2}- source: sources\/biome\/libfoo-1\.0\.tar\.gz and its signature libfoo-1\.0\.tar\.gz\.asc /,
    );
    assert.match(
      notices,
      /sources\/biome\/ncurses-1\.0\.tar\.gz and its signature ncurses-1\.0\.tar\.gz\.sig/,
    );
  });
  // A guest under a permissive license serves only the license files.
  await withLayout(async (layout) => {
    const { packageRoot, pack } = await seed(layout);
    const resolutions = await withGnuSources(layout, 'tarball', 'MIT');
    await assembleCandidate({
      layout,
      mode: 'verify',
      sourceCommit,
      pack,
      log: logOf(rowsFor()),
      packageRoot,
    });
    const site = join(layout.candidate, 'site');
    await access(join(site, 'licenses/libfoo-COPYING'));
    await assert.rejects(access(join(site, 'sources')));
    assert.doesNotMatch(noticesText(resolutions), /source: /);
  });
  await withLayout(async (layout) => {
    const { packageRoot, pack } = await seed(layout);
    await withGnuSources(layout, 'changed');
    await assert.rejects(
      assembleCandidate({
        layout,
        mode: 'verify',
        sourceCommit,
        pack,
        log: logOf(rowsFor()),
        packageRoot,
      }),
      (error) => causeOf(error) === 'checksum-mismatch',
    );
  });
});

test('NOTICES name a library without a repository by its signed tarball, with no commit', async () => {
  await withLayout(async (layout) => {
    await seed(layout);
    const resolutions = await withGnuSources(layout);
    const biome = resolutions.tools.find((item) => item.tool === 'biome')!;
    const library = biome.gnu!.libraries[1]!;
    biome.gnu!.libraries[1] = {
      ...library,
      repository: null,
      tag: null,
      commit: null,
    };
    const notices = noticesText(resolutions);
    assert.match(
      notices,
      new RegExp(
        `- with libfoo 1\\.0 \\(no repository; signed tarball ${library.tarball.url.replaceAll('.', '\\.')}, sha256 ${library.tarball.sha256}, signer ${library.tarball.signer}\\): LGPL`,
      ),
    );
    assert.doesNotMatch(notices, /libfoo 1\.0 \(.*@/);
  });
});

test('a companion is no tool of its own, but must match the tool it belongs to', () => {
  const resolutions = resolutionsOf(fixtures);
  const extra = officialRecord('biome-extra', '2.5.15', 'elf', 3).record;
  const companion = {
    ...extra,
    companionOf: 'biome',
    buildInfo: {
      ...extra.buildInfo,
      source: { ...fixtures[1]!.record.buildInfo.source },
    },
  };
  const records = fixtures.map(({ record }) => record);
  assert.deepEqual(
    resolvedTools([...records, companion], resolutions).map(
      (item) => item.tool,
    ),
    ['aube', 'biome'],
  );
  for (const other of [
    { ...companion, companionOf: 'jj' },
    { ...companion, version: '2.5.14' },
    {
      ...companion,
      buildInfo: {
        ...companion.buildInfo,
        source: { ...companion.buildInfo.source, commit: commit('other') },
      },
    },
  ])
    assert.throws(
      () => resolvedTools([...records, other], resolutions),
      (error) => causeOf(error) === 'config-invalid',
    );
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
      (error) => causeOf(error) === 'pack-mismatch',
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
      (error) => causeOf(error) === 'pack-mismatch',
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
    await writeJson(join(layout.acceptance, 'safari.json'), {
      schemaVersion: 1,
      environment: { environment: 'safari', observed: {} },
      rows: rowsFor().slice(1, 2),
    });
    await writeJson(join(layout.acceptance, 'other.json'), {
      schemaVersion: 1,
      rows: [],
    });
    const parts = await readAcceptanceParts(layout.acceptance);
    assert.deepEqual(
      parts.map((part) => part.environment.environment),
      ['node', 'safari'],
    );
    assert.equal('safari' in logOf(parts[0]!.rows), false);
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
