import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';
import {
  ACCEPTANCE_INPUT_DESTINATIONS,
  ACCEPTANCE_INPUTS_MANIFEST,
  type AcceptanceInputs,
  checkMainCIGuestArtifact,
  checkMainCIRuns,
  decodeSiteArchive,
  fetchAcceptanceInputs,
  inspectRestoredSite,
  MAIN_CI_PITCHFORK_FILES,
  MAIN_CI_WORKFLOW,
  MIRROR_INPUT_PATH,
  mainCIGuestArtifactPrefix,
  mainCIPitchforkFiles,
  readAcceptanceInputs,
  restoreActualSite,
  restoreMainCIPitchfork,
  SITE_ARCHIVE,
  type SiteFile,
  validateAcceptanceInputs,
} from '../../scripts/migration-command/acceptance-inputs.js';
import {
  readPreflightEvidenceId,
  requiredB1Rows,
} from '../../scripts/migration-command/b1.js';
import { checkCommandCIEvidence } from '../../scripts/migration-command/completion.js';
import {
  ACCEPTANCE_WORKFLOW,
  candidateArtifactName,
  checkArtifacts,
  checkCommit,
  checkJobs,
  checkRun,
  completionArtifactName,
  observeAcceptanceRun,
} from '../../scripts/migration-command/observe-ci.js';
import { CI_INPUT_LIMITS } from '../../scripts/migration-session/ci-inputs.js';
import { sha256 } from '../../scripts/package/stage-package.js';
import { crc32 } from '../../scripts/release/publication-assets.js';

/** Synthetic bytes exercise the checks only; they are never acceptance evidence. */
async function scratch(prefix: string) {
  await mkdir(resolve('.artifacts'), { recursive: true });
  return await mkdtemp(resolve('.artifacts', prefix));
}
function tar(members: { name: string; value: string; type?: string }[]) {
  const rows: Buffer[] = [];
  for (const member of members) {
    const bytes = Buffer.from(member.value),
      header = Buffer.alloc(512);
    header.write(member.name, 0);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write(member.type ?? '0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
    rows.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...rows, Buffer.alloc(1024)]));
}
function zip(members: { name: string; bytes: Uint8Array }[]) {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const member of members) {
    const name = Buffer.from(member.name),
      bytes = Buffer.from(member.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x0314, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc32(bytes), 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE((0x81a4 << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, bytes);
    central.push(directory, name);
    offset += header.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
interface Route {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}
/**
 * A local HTTP server stands in for GitHub; the fetcher maps every https URL
 * to `/<host><path>` on it, so no request leaves this machine.
 */
async function fakeServer(routes: Map<string, Route>) {
  const seen: { path: string; headers: IncomingHttpHeaders }[] = [];
  const server = createServer((request, response) => {
    const path = request.url ?? '';
    seen.push({ path, headers: request.headers });
    const route = routes.get(path);
    response.writeHead(route?.status ?? 404, route?.headers);
    response.end(route?.body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const fetcher = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.protocol, 'https:');
    return fetch(
      `http://127.0.0.1:${port}/${url.hostname}${url.pathname}${url.search}`,
      init,
    );
  }) as typeof fetch;
  return {
    fetcher,
    seen,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

// ---------------------------------------------------------------- inputs

async function trackedInputs() {
  return {
    manifest: JSON.parse(await readFile(ACCEPTANCE_INPUTS_MANIFEST, 'utf8')),
    mirror: JSON.parse(await readFile(MIRROR_INPUT_PATH, 'utf8')),
  };
}
test('the tracked input list is canonical and binds the official mirror rows and the pinned archive', async () => {
  const { inputs } = await readAcceptanceInputs(
    process.cwd(),
    ACCEPTANCE_INPUTS_MANIFEST,
  );
  assert.deepEqual(
    inputs.files.map((row) => [row.name, row.path]),
    Object.entries(ACCEPTANCE_INPUT_DESTINATIONS),
  );
  const site = inputs.files.find((row) => row.name === SITE_ARCHIVE.name)!;
  assert.equal(site.url, SITE_ARCHIVE.url);
  assert.equal(site.sha256, SITE_ARCHIVE.sha256);
  const { mirror } = await trackedInputs();
  for (const official of mirror.metadataProducer.official) {
    const row = inputs.files.find(
      (item) =>
        item.name === (official.tool === 'aube' ? 'aube.tar.gz' : 'biome.elf'),
    )!;
    assert.deepEqual(
      [row.url, row.bytes, row.sha256],
      [official.url, official.size, official.downloadSha256],
    );
  }
});
test('the input list refuses unknown/missing fields, missing or duplicate rows and other destinations', async () => {
  const { manifest, mirror } = await trackedInputs();
  const refuses = (value: unknown, pattern: RegExp) =>
    assert.throws(() => validateAcceptanceInputs(value, mirror), pattern);
  const clone = () => structuredClone(manifest);
  refuses({ ...clone(), extra: 1 }, /manifest unknown\/missing field/);
  const missing = clone();
  missing.files.pop();
  refuses(missing, /missing\/extra inventory/);
  const duplicate = clone();
  duplicate.files[1] = duplicate.files[0];
  refuses(duplicate, /duplicate input name/);
  const field = clone();
  field.files[0].mirror = 'x';
  refuses(field, /file unknown\/missing field/);
  const destination = clone();
  destination.files[0].path = 'dist/guests/aube';
  refuses(destination, /fixed destination/);
  refuses({ ...clone(), schema: 'migration-install-ci-inputs' }, /schema/);
});
test('the input list refuses non-release URLs, the byte limit plus one and differing digests', async () => {
  const { manifest, mirror } = await trackedInputs();
  const change = (index: number, patch: Record<string, unknown>) => {
    const value = structuredClone(manifest);
    Object.assign(value.files[index], patch);
    return () => validateAcceptanceInputs(value, mirror);
  };
  for (const url of [
    'http://github.com/aubepkg/aube/releases/download/v2.7.0/aube.tar.gz',
    'https://example.com/aubepkg/aube/releases/download/v2.7.0/aube.tar.gz',
    'https://github.com/aubepkg/aube/releases/download/v2.7.0/aube.tar.gz?x=1',
    'https://github.com/aubepkg/aube/archive/v2.7.0.tar.gz',
  ])
    assert.throws(change(0, { url }), /official GitHub release download/);
  assert.throws(change(1, { bytes: CI_INPUT_LIMITS.file + 1 }), /byte limit/);
  assert.throws(change(0, { sha256: 'f'.repeat(64) }), /official mirror input/);
  assert.throws(change(1, { bytes: 66123121 }), /official mirror input/);
  assert.throws(change(2, { sha256: 'e'.repeat(64) }), /pinned archive/);
});
test('a duplicate key in the list is refused before any validation', async () => {
  const root = await scratch('u4-acceptance-ci-keys-');
  try {
    const text = await readFile(ACCEPTANCE_INPUTS_MANIFEST, 'utf8');
    await mkdir(resolve(root, 'ci/migration-command'), { recursive: true });
    await mkdir(resolve(root, dirname(MIRROR_INPUT_PATH)), { recursive: true });
    await writeFile(
      resolve(root, MIRROR_INPUT_PATH),
      await readFile(MIRROR_INPUT_PATH),
    );
    await writeFile(
      resolve(root, ACCEPTANCE_INPUTS_MANIFEST),
      text.replace('"version": 1,', '"version": 1,\n  "version": 1,'),
    );
    await assert.rejects(
      readAcceptanceInputs(root, resolve(root, ACCEPTANCE_INPUTS_MANIFEST)),
      /canonical JSON required/,
    );
    await assert.rejects(
      readAcceptanceInputs(root, resolve(root, 'ci/other.json')),
      /manifest must be/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function syntheticInputs(contents: Record<string, Buffer>): AcceptanceInputs {
  return {
    schema: 'migration-command-acceptance-inputs',
    version: 1,
    files: Object.entries(ACCEPTANCE_INPUT_DESTINATIONS).map(
      ([name, path]) => ({
        name,
        url: `https://github.com/o/r/releases/download/t/${name}`,
        bytes: contents[name]!.length,
        sha256: sha256(contents[name]!),
        path,
      }),
    ),
  };
}
function releaseRoutes(contents: Record<string, Buffer>, served = contents) {
  const routes = new Map<string, Route>();
  for (const name of Object.keys(contents)) {
    routes.set(`/github.com/o/r/releases/download/t/${name}`, {
      status: 302,
      headers: {
        location: `https://release-assets.githubusercontent.com/${name}`,
      },
    });
    routes.set(`/release-assets.githubusercontent.com/${name}`, {
      status: 200,
      body: served[name],
    });
  }
  return routes;
}
const CONTENTS = () => ({
  'aube.tar.gz': Buffer.from('aube archive bytes'),
  'biome.elf': Buffer.from('biome elf bytes'),
  'actual-site-v2.tar.gz': Buffer.from('site archive bytes'),
});
test('fetching follows one release redirect, checks every digest and reuses identical files', async () => {
  const root = await scratch('u4-acceptance-ci-fetch-');
  const contents = CONTENTS();
  const server = await fakeServer(releaseRoutes(contents));
  try {
    const inputs = syntheticInputs(contents);
    const first = await fetchAcceptanceInputs(root, inputs, server.fetcher);
    assert.equal(first.created.length, 3);
    for (const row of inputs.files)
      assert.equal(sha256(await readFile(resolve(root, row.path))), row.sha256);
    const second = await fetchAcceptanceInputs(root, inputs, server.fetcher);
    assert.deepEqual(second.created, []);
    assert.equal(second.reused.length, 3);
    assert.equal(server.seen.length, 6);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
test('a differing digest, one byte over the size or an unknown redirect host writes nothing', async () => {
  const contents = CONTENTS();
  const cases: [Record<string, Buffer>, Map<string, Route>, RegExp][] = [
    [
      contents,
      releaseRoutes(contents, {
        ...contents,
        'biome.elf': Buffer.from('biome elf byteZ'),
      }),
      /download size\/digest differs/,
    ],
    [
      contents,
      releaseRoutes(contents, {
        ...contents,
        'biome.elf': Buffer.concat([contents['biome.elf'], Buffer.from('x')]),
      }),
      /ASSET_BYTE_LIMIT/,
    ],
    [
      contents,
      new Map<string, Route>([
        ...releaseRoutes(contents),
        [
          '/github.com/o/r/releases/download/t/biome.elf',
          {
            status: 302,
            headers: { location: 'https://evil.example/biome.elf' },
          },
        ],
      ]),
      /UNSAFE_ASSET_REDIRECT/,
    ],
  ];
  for (const [files, routes, pattern] of cases) {
    const root = await scratch('u4-acceptance-ci-refuse-');
    const server = await fakeServer(routes);
    try {
      await assert.rejects(
        fetchAcceptanceInputs(root, syntheticInputs(files), server.fetcher),
        pattern,
      );
      assert.deepEqual(await readdir(root), []);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }
});
test('an existing destination with other bytes is refused and left unchanged', async () => {
  const root = await scratch('u4-acceptance-ci-existing-');
  const contents = CONTENTS();
  const server = await fakeServer(releaseRoutes(contents));
  try {
    const inputs = syntheticInputs(contents);
    const target = resolve(root, inputs.files[0]!.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, 'someone else');
    await assert.rejects(
      fetchAcceptanceInputs(root, inputs, server.fetcher),
      /differs \(never overwritten\)/,
    );
    assert.equal(await readFile(target, 'utf8'), 'someone else');
    assert.equal(server.seen.length, 0);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------ actual site

const SITE_FILES = (): SiteFile[] => {
  const rows = [
    ['tools.json', '{"tools":[]}'],
    ['dist/builds.json', '{"builds":[]}'],
    ['dist/aube/key/guest', 'reference guest'],
  ];
  return rows.map(([path, value]) => ({
    path: path!,
    bytes: Buffer.byteLength(value!),
    sha256: sha256(value!),
  }));
};
const SITE_VALUES: Record<string, string> = {
  'tools.json': '{"tools":[]}',
  'dist/builds.json': '{"builds":[]}',
};
const REFERENCE = {
  source: 'dist/guests/aube',
  path: 'dist/aube/key/guest',
  bytes: Buffer.byteLength('reference guest'),
  sha256: sha256('reference guest'),
};
const archiveRows = () =>
  SITE_FILES().filter((row) => row.path !== REFERENCE.path);
test('the site archive refuses parent, absolute and link entries, extra or changed files', () => {
  const good = Object.entries(SITE_VALUES).map(([name, value]) => ({
    name,
    value,
  }));
  assert.equal(decodeSiteArchive(tar(good), archiveRows()).size, 2);
  for (const [members, pattern] of [
    [[...good, { name: '../evil', value: 'x' }], /UNSAFE_ASSET_PATH/],
    [[...good, { name: '/etc/evil', value: 'x' }], /UNSAFE_ASSET_PATH/],
    [
      [...good, { name: 'dist/link', value: '', type: '2' }],
      /ASSET_LINK_OR_SPECIAL/,
    ],
    [[...good, { name: 'dist/extra.json', value: '{}' }], /missing\/extra/],
    [good.slice(1), /missing\/extra/],
    [
      [{ ...good[0]!, value: '{"tools":[1]}' }, good[1]!],
      /size\/digest differs: tools\.json/,
    ],
  ] as const)
    assert.throws(
      () => decodeSiteArchive(tar([...members]), archiveRows()),
      pattern,
    );
  // The production inventory needs the ten fixed files, so this one is refused.
  assert.throws(() => decodeSiteArchive(tar(good)), /missing\/extra/);
});
async function siteRoot() {
  const root = await scratch('u4-acceptance-ci-site-');
  const archive = tar(
    Object.entries(SITE_VALUES).map(([name, value]) => ({ name, value })),
  );
  const archivePath = '.artifacts/migration-install/actual-site-v2.tar.gz';
  await mkdir(resolve(root, '.artifacts/migration-install'), {
    recursive: true,
  });
  await writeFile(resolve(root, archivePath), archive);
  await mkdir(resolve(root, 'dist/guests'), { recursive: true });
  await writeFile(resolve(root, REFERENCE.source), 'reference guest');
  const options = {
    files: SITE_FILES(),
    reference: REFERENCE,
    archive: {
      path: archivePath,
      bytes: archive.length,
      sha256: sha256(archive),
    },
    inspect: (site: string) => inspectRestoredSite(site, SITE_FILES()),
  };
  return { root, options, archivePath };
}
test('the site is restored from the archive and the reference guest, and never rewritten', async () => {
  const { root, options, archivePath } = await siteRoot();
  try {
    const site = await restoreActualSite(root, options);
    assert.equal(
      site,
      resolve(root, '.artifacts/migration-install/actual-site'),
    );
    assert.equal(
      await readFile(resolve(site, REFERENCE.path), 'utf8'),
      'reference guest',
    );
    // A second run only inspects the existing site; the archive is not read.
    await rm(resolve(root, archivePath));
    assert.equal(await restoreActualSite(root, options), site);
    await writeFile(resolve(site, 'extra'), 'x');
    await assert.rejects(restoreActualSite(root, options), /missing\/extra/);
    assert.equal(await readFile(resolve(site, 'extra'), 'utf8'), 'x');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('a changed archive or reference is refused, and U3 inspector is the default final gate', async () => {
  const { root, options } = await siteRoot();
  try {
    await assert.rejects(
      restoreActualSite(root, {
        ...options,
        archive: { ...options.archive, sha256: 'f'.repeat(64) },
      }),
      /site archive size\/digest differs/,
    );
    await assert.rejects(
      restoreActualSite(root, {
        ...options,
        reference: { ...REFERENCE, sha256: 'f'.repeat(64) },
      }),
      /reference guest size\/digest differs/,
    );
    const { inspect: _custom, ...defaults } = options;
    await assert.rejects(restoreActualSite(root, defaults), /U3 actual site/);
    await assert.rejects(
      readdir(resolve(root, '.artifacts/migration-install/actual-site')),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------- observer

const RUN_ID = 4242;
const COMMIT = 'a'.repeat(40);
const TOKEN = `test-token-${randomUUID()}`;
const PREFIX = '/api.github.com/repos/aletheia-works/formicarium';
function runBody(): Record<string, unknown> {
  return {
    id: RUN_ID,
    run_attempt: 1,
    repository: { full_name: 'aletheia-works/formicarium' },
    head_repository: { full_name: 'aletheia-works/formicarium' },
    path: ACCEPTANCE_WORKFLOW,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: COMMIT,
    status: 'completed',
    conclusion: 'success',
  };
}
function jobsBody(): Record<string, unknown> {
  return {
    total_count: 1,
    jobs: [
      {
        id: 7,
        name: 'accept',
        status: 'completed',
        conclusion: 'success',
        run_attempt: 1,
        head_sha: COMMIT,
      },
    ],
  };
}
async function scenario() {
  const preflight = await readPreflightEvidenceId(process.cwd());
  const candidate = randomUUID(),
    completion = randomUUID();
  const pack = Buffer.from('synthetic pack bytes');
  const sourceFiles = [{ path: 'runtime/command.ts', sha256: '1'.repeat(64) }];
  const manifest = {
    unit: 'u4-command',
    version: '0.3.0',
    provisional: true,
    sourceCommit: COMMIT,
    sourceFiles,
    sourceIdentity: sha256(JSON.stringify(sourceFiles)),
    files: [{ path: 'package.json', sha256: '2'.repeat(64) }],
    tarball: { path: '/ci/pack.tgz', sha256: sha256(pack) },
  };
  const b1 = Buffer.from(
    `${JSON.stringify({
      schemaVersion: 1,
      evidenceId: 'u4-b1-local-fixture',
      sourceCommit: COMMIT,
      packageVersion: '0.3.0',
      packSha256: sha256(pack),
      inventorySha256: sha256(JSON.stringify(manifest.files)),
      checks: requiredB1Rows().map((row) => ({
        ...row,
        status: 'passed',
        logSha256: 'd'.repeat(64),
      })),
      preflightEvidenceId: preflight.evidenceId,
    })}\n`,
  );
  const report = {
    unit: 'u4-command',
    status: 'local-provisional',
    localPassed: true,
    acceptancePassed: false,
    candidateSha256: sha256(pack),
    sourceCommit: COMMIT,
    sourceIdentity: manifest.sourceIdentity,
    b1: { path: '/ci/b1-acceptance.json', sha256: sha256(b1), formal: false },
    preflightEvidence: preflight,
  };
  return {
    manifest,
    pack,
    b1,
    report,
    candidateMembers: () => [
      {
        name: `candidate-${candidate}/package.manifest.json`,
        bytes: Buffer.from(JSON.stringify(manifest)),
      },
      {
        name: `candidate-${candidate}/package/aletheia-works-formicarium-0.3.0.tgz`,
        bytes: pack,
      },
      {
        name: `completion-${completion}/local-provisional-report.json`,
        bytes: Buffer.from(JSON.stringify(report)),
      },
      { name: `completion-${completion}/b1-acceptance.json`, bytes: b1 },
    ],
    completionMembers: () => [
      {
        name: `migration-command/completion-${completion}/local-provisional-report.json`,
        bytes: Buffer.from(JSON.stringify(report)),
      },
      {
        name: `migration-command/completion-${completion}/b1-acceptance.json`,
        bytes: b1,
      },
      {
        name: `migration-command/completion-${completion}/command-1.log`,
        bytes: Buffer.from('# pass 1\n'),
      },
    ],
  };
}
function githubRoutes(options: {
  run?: Record<string, unknown>;
  jobs?: Record<string, unknown>;
  verified?: boolean;
  candidateZip: Buffer;
  completionZip: Buffer;
  listedDigest?: string;
}) {
  const artifacts = [
    [11, candidateArtifactName(RUN_ID, 1), options.candidateZip],
    [12, completionArtifactName(RUN_ID, 1), options.completionZip],
  ] as const;
  const json = (value: unknown): Route => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  const routes = new Map<string, Route>([
    [`${PREFIX}/actions/runs/${RUN_ID}`, json(options.run ?? runBody())],
    [
      `${PREFIX}/actions/runs/${RUN_ID}/attempts/1/jobs?per_page=100`,
      json(options.jobs ?? jobsBody()),
    ],
    [
      `${PREFIX}/commits/${COMMIT}`,
      json({
        sha: COMMIT,
        commit: { verification: { verified: options.verified ?? true } },
      }),
    ],
    [
      `${PREFIX}/actions/runs/${RUN_ID}/artifacts?per_page=100`,
      json({
        total_count: 2,
        artifacts: artifacts.map(([id, name, bytes], index) => ({
          id,
          name,
          expired: false,
          digest:
            index === 0 && options.listedDigest
              ? options.listedDigest
              : `sha256:${sha256(bytes)}`,
          size_in_bytes: bytes.length,
          workflow_run: { id: RUN_ID, head_sha: COMMIT },
        })),
      }),
    ],
  ]);
  for (const [id, , bytes] of artifacts) {
    routes.set(`${PREFIX}/actions/artifacts/${id}/zip`, {
      status: 302,
      headers: {
        location: `https://productionresultssa1.blob.core.windows.net/${id}.zip`,
      },
    });
    routes.set(`/productionresultssa1.blob.core.windows.net/${id}.zip`, {
      status: 200,
      body: bytes,
    });
  }
  return routes;
}
test('the run, its jobs, the commit and the artifact list are each refused when they differ', () => {
  for (const patch of [
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { path: '.github/workflows/ci.yml' },
    { event: 'push' },
    { head_branch: 'feature' },
    { head_sha: 'b'.repeat(40) },
    { repository: { full_name: 'someone/formicarium' } },
    { id: RUN_ID + 1 },
  ])
    assert.throws(
      () => checkRun({ ...runBody(), ...patch }, RUN_ID, COMMIT),
      /U4 CI observation/,
    );
  assert.equal(checkRun(runBody(), RUN_ID, COMMIT), 1);
  const job = (jobsBody().jobs as Record<string, unknown>[])[0]!;
  for (const patch of [
    { conclusion: 'failure' },
    { run_attempt: 2 },
    { name: 'other' },
    { head_sha: 'b'.repeat(40) },
  ])
    assert.throws(
      () =>
        checkJobs({ total_count: 1, jobs: [{ ...job, ...patch }] }, 1, COMMIT),
      /U4 CI observation/,
    );
  assert.throws(
    () => checkJobs({ total_count: 101, jobs: [job] }, 1, COMMIT),
    /paginated/,
  );
  assert.throws(
    () =>
      checkCommit(
        { sha: COMMIT, commit: { verification: { verified: false } } },
        COMMIT,
      ),
    /signature not verified/,
  );
  const artifact = (id: number, name: string) => ({
    id,
    name,
    expired: false,
    digest: `sha256:${'c'.repeat(64)}`,
    size_in_bytes: 10,
    workflow_run: { id: RUN_ID, head_sha: COMMIT },
  });
  const both = [
    artifact(1, candidateArtifactName(RUN_ID, 1)),
    artifact(2, completionArtifactName(RUN_ID, 1)),
  ];
  assert.equal(
    checkArtifacts({ total_count: 2, artifacts: both }, RUN_ID, 1, COMMIT)
      .length,
    2,
  );
  for (const artifacts of [
    both.slice(1),
    [...both, artifact(3, 'extra')],
    [{ ...both[0]!, expired: true }, both[1]!],
    [{ ...both[0]!, digest: 'md5:x' }, both[1]!],
    [{ ...both[0]!, workflow_run: { id: 1, head_sha: COMMIT } }, both[1]!],
  ])
    assert.throws(
      () =>
        checkArtifacts(
          { total_count: artifacts.length, artifacts },
          RUN_ID,
          1,
          COMMIT,
        ),
      /U4 CI observation artifact/,
    );
});
test('a correct observation writes one record the U4 completion accepts, with no token on disk', async () => {
  const data = await scenario();
  const server = await fakeServer(
    githubRoutes({
      candidateZip: zip(data.candidateMembers()),
      completionZip: zip(data.completionMembers()),
    }),
  );
  const root = await scratch('u4-acceptance-ci-observe-');
  try {
    const out = resolve(root, `ci-${RUN_ID}`);
    const observed = await observeAcceptanceRun({
      runId: RUN_ID,
      commit: COMMIT,
      token: TOKEN,
      out,
      fetcher: server.fetcher,
    });
    const bytes = await readFile(observed.recordPath);
    assert.equal(sha256(bytes), observed.recordSha256);
    const record = JSON.parse(bytes.toString('utf8'));
    assert.equal(record.recordKind, 'observed-ci-summary');
    assert.equal(record.unit, 'u4-command');
    assert.equal(record.candidateSha256, sha256(data.pack));
    assert.equal(record.sourceIdentity, data.manifest.sourceIdentity);
    assert.equal(
      record.runURL,
      `https://github.com/aletheia-works/formicarium/actions/runs/${RUN_ID}`,
    );
    checkCommandCIEvidence(record, data.manifest);
    // The token goes to the API host only, never to the artifact storage host.
    for (const request of server.seen)
      assert.equal(
        request.headers.authorization,
        request.path.startsWith('/api.github.com/')
          ? `Bearer ${TOKEN}`
          : undefined,
      );
    const kept = await readdir(out);
    assert.ok(kept.includes(`${candidateArtifactName(RUN_ID, 1)}.zip`));
    assert.ok(kept.includes('run.json'));
    for (const name of kept)
      assert.equal(
        (await readFile(resolve(out, name))).includes(TOKEN),
        false,
        name,
      );
    await assert.rejects(
      observeAcceptanceRun({
        runId: RUN_ID,
        commit: COMMIT,
        token: TOKEN,
        out,
        fetcher: server.fetcher,
      }),
      /EEXIST/,
    );
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
test('an unverified commit, a listed digest mismatch or a broken candidate artifact writes no record', async () => {
  const data = await scenario();
  const members = data.candidateMembers();
  const cases: [Parameters<typeof githubRoutes>[0], RegExp][] = [
    [
      {
        verified: false,
        candidateZip: zip(members),
        completionZip: zip(data.completionMembers()),
      },
      /signature not verified/,
    ],
    [
      {
        listedDigest: `sha256:${'0'.repeat(64)}`,
        candidateZip: zip(members),
        completionZip: zip(data.completionMembers()),
      },
      /digest\/size differs/,
    ],
    [
      {
        candidateZip: zip(members.filter((row) => !row.name.endsWith('.tgz'))),
        completionZip: zip(data.completionMembers()),
      },
      /candidate tarball missing/,
    ],
    [
      {
        candidateZip: zip(
          members.map((row) =>
            row.name.endsWith('.tgz')
              ? { ...row, bytes: Buffer.from('another pack') }
              : row,
          ),
        ),
        completionZip: zip(data.completionMembers()),
      },
      /tarball digest differs/,
    ],
    [
      {
        candidateZip: zip([
          ...members,
          {
            name: `${members[2]!.name.split('/')[0]}/incomplete.json`,
            bytes: Buffer.from('{}'),
          },
        ]),
        completionZip: zip(data.completionMembers()),
      },
      /incomplete completion/,
    ],
    [
      {
        candidateZip: zip(
          members.map((row) =>
            row.name.endsWith('local-provisional-report.json')
              ? {
                  ...row,
                  bytes: Buffer.from(
                    JSON.stringify({ ...data.report, localPassed: false }),
                  ),
                }
              : row,
          ),
        ),
        completionZip: zip(data.completionMembers()),
      },
      /does not bind this candidate/,
    ],
    [
      {
        candidateZip: zip(members),
        completionZip: zip(
          data
            .completionMembers()
            .filter((row) => !row.name.endsWith('b1-acceptance.json')),
        ),
      },
      /B1 rows missing/,
    ],
  ];
  for (const [routes, pattern] of cases) {
    const server = await fakeServer(githubRoutes(routes));
    const root = await scratch('u4-acceptance-ci-observe-refuse-');
    try {
      await assert.rejects(
        observeAcceptanceRun({
          runId: RUN_ID,
          commit: COMMIT,
          token: TOKEN,
          out: resolve(root, 'out'),
          fetcher: server.fetcher,
        }),
        pattern,
      );
      assert.deepEqual(await readdir(root), []);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }
  await assert.rejects(
    observeAcceptanceRun({ runId: RUN_ID, commit: 'main', token: TOKEN }),
    /40-hex commit/,
  );
  await assert.rejects(
    observeAcceptanceRun({ runId: RUN_ID, commit: COMMIT, token: '' }),
    /token required/,
  );
});

// ------------------------------------------- pitchfork from main's own CI

const MAIN_CI_RUN = 5151;
function mainCIRun(): Record<string, unknown> {
  return {
    id: MAIN_CI_RUN,
    run_attempt: 1,
    path: MAIN_CI_WORKFLOW,
    event: 'push',
    head_branch: 'main',
    head_sha: COMMIT,
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: 'aletheia-works/formicarium' },
    head_repository: { full_name: 'aletheia-works/formicarium' },
  };
}
const guestName = () => `${mainCIGuestArtifactPrefix(COMMIT, MAIN_CI_RUN)}1`;
function guestArtifact(bytes: Buffer, patch: Record<string, unknown> = {}) {
  return {
    id: 77,
    name: guestName(),
    expired: false,
    digest: `sha256:${sha256(bytes)}`,
    size_in_bytes: bytes.length,
    workflow_run: { id: MAIN_CI_RUN, head_sha: COMMIT },
    ...patch,
  };
}
const guestMembers = () => [
  { name: 'guests/aube', bytes: Buffer.from('ci-built aube, never used') },
  { name: 'guests/pitchfork', bytes: Buffer.from('unpatched pitchfork') },
  {
    name: 'guests/pitchfork.build-info',
    bytes: Buffer.from('{"patches":[]}\n'),
  },
  {
    name: 'guests/pitchfork.commit',
    bytes: Buffer.from(`${'e'.repeat(40)}\n`),
  },
];
function mainCIRoutes(zipBytes: Buffer, listed = zipBytes) {
  const json = (value: unknown): Route => ({
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  return new Map<string, Route>([
    [
      `${PREFIX}/actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=${COMMIT}&status=success&per_page=100`,
      json({ total_count: 1, workflow_runs: [mainCIRun()] }),
    ],
    [
      `${PREFIX}/actions/runs/${MAIN_CI_RUN}/artifacts?per_page=100`,
      json({ total_count: 1, artifacts: [guestArtifact(listed)] }),
    ],
    [
      `${PREFIX}/actions/artifacts/77/zip`,
      {
        status: 302,
        headers: {
          location: 'https://productionresultssa1.blob.core.windows.net/77.zip',
        },
      },
    ],
    [
      '/productionresultssa1.blob.core.windows.net/77.zip',
      { status: 200, body: zipBytes },
    ],
  ]);
}

test("main's CI run must be one successful push run of ci.yml on main at the commit", () => {
  const list = (...runs: Record<string, unknown>[]) => ({
    total_count: runs.length,
    workflow_runs: runs,
  });
  assert.deepEqual(checkMainCIRuns(list(mainCIRun()), COMMIT), {
    runId: MAIN_CI_RUN,
    attempt: 1,
  });
  for (const patch of [
    { path: ACCEPTANCE_WORKFLOW },
    { event: 'workflow_dispatch' },
    { head_branch: 'feature' },
    { head_sha: 'b'.repeat(40) },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { repository: { full_name: 'someone/formicarium' } },
    { head_repository: { full_name: 'someone/formicarium' } },
  ])
    assert.throws(
      () => checkMainCIRuns(list({ ...mainCIRun(), ...patch }), COMMIT),
      /exactly one successful main CI run/,
      JSON.stringify(patch),
    );
  assert.throws(() => checkMainCIRuns(list(), COMMIT), /exactly one/);
  assert.throws(
    () =>
      checkMainCIRuns(
        list(mainCIRun(), { ...mainCIRun(), id: MAIN_CI_RUN + 1 }),
        COMMIT,
      ),
    /exactly one/,
  );
  assert.throws(
    () =>
      checkMainCIRuns(
        { total_count: 101, workflow_runs: [mainCIRun()] },
        COMMIT,
      ),
    /paginated/,
  );
});
test("main's guest artifact must be the run's one unexpired guest product with a sha256 digest", () => {
  const bytes = Buffer.from('zip');
  const list = (...artifacts: Record<string, unknown>[]) => ({
    total_count: artifacts.length,
    artifacts,
  });
  assert.equal(
    checkMainCIGuestArtifact(
      list(guestArtifact(bytes), { name: 'product-build-wasm-x' }),
      COMMIT,
      MAIN_CI_RUN,
      1,
    ).id,
    77,
  );
  for (const patch of [
    { name: `${mainCIGuestArtifactPrefix('b'.repeat(40), MAIN_CI_RUN)}1` },
    { name: `${mainCIGuestArtifactPrefix(COMMIT, MAIN_CI_RUN)}2` },
    { expired: true },
    { digest: 'md5:x' },
    { workflow_run: { id: MAIN_CI_RUN + 1, head_sha: COMMIT } },
    { workflow_run: { id: MAIN_CI_RUN, head_sha: 'b'.repeat(40) } },
  ])
    assert.throws(
      () =>
        checkMainCIGuestArtifact(
          list(guestArtifact(bytes, patch)),
          COMMIT,
          MAIN_CI_RUN,
          1,
        ),
      /main CI artifact/,
      JSON.stringify(patch),
    );
  assert.throws(
    () =>
      checkMainCIGuestArtifact(
        list(guestArtifact(bytes), guestArtifact(bytes, { id: 78 })),
        COMMIT,
        MAIN_CI_RUN,
        1,
      ),
    /missing\/duplicate/,
  );
});
test('only the three pitchfork files are taken, and each of them is required', () => {
  const files = mainCIPitchforkFiles(zip(guestMembers()));
  assert.deepEqual(
    files.map((file) => file.path),
    [...MAIN_CI_PITCHFORK_FILES],
  );
  for (const missing of MAIN_CI_PITCHFORK_FILES)
    assert.throws(
      () =>
        mainCIPitchforkFiles(
          zip(guestMembers().filter((member) => member.name !== missing)),
        ),
      new RegExp(`lacks ${missing.replace('.', '\\.')}`),
    );
});
test("pitchfork is replaced from main's CI, the rest of dist/guests is untouched, and no token is kept", async () => {
  const root = await scratch('u4-acceptance-ci-pitchfork-');
  const guests = resolve(root, 'dist/guests');
  await mkdir(guests, { recursive: true });
  for (const name of [
    'aube',
    ...MAIN_CI_PITCHFORK_FILES.map((p) => p.slice(7)),
  ])
    await writeFile(resolve(guests, name), `bundle ${name}`);
  const bytes = zip(guestMembers());
  try {
    const wrong = await fakeServer(mainCIRoutes(bytes, Buffer.from('other')));
    try {
      await assert.rejects(
        restoreMainCIPitchfork({
          commit: COMMIT,
          token: TOKEN,
          root,
          fetcher: wrong.fetcher,
        }),
        /digest\/size differs/,
      );
    } finally {
      await wrong.close();
    }
    assert.equal(
      await readFile(resolve(guests, 'pitchfork'), 'utf8'),
      'bundle pitchfork',
    );
    const server = await fakeServer(mainCIRoutes(bytes));
    try {
      const restored = await restoreMainCIPitchfork({
        commit: COMMIT,
        token: TOKEN,
        root,
        fetcher: server.fetcher,
      });
      for (const member of guestMembers().slice(1)) {
        const path = resolve(root, 'dist', member.name);
        assert.deepEqual(await readFile(path), member.bytes);
      }
      assert.equal(
        await readFile(resolve(guests, 'aube'), 'utf8'),
        'bundle aube',
      );
      const { stat } = await import('node:fs/promises');
      assert.equal(
        (await stat(resolve(guests, 'pitchfork'))).mode & 0o777,
        0o755,
      );
      assert.equal(
        (await stat(resolve(guests, 'pitchfork.build-info'))).mode & 0o777,
        0o644,
      );
      assert.deepEqual(
        restored.receipt.replaced.map((row) => row.path),
        MAIN_CI_PITCHFORK_FILES.map((path) => `dist/${path}`),
      );
      assert.equal(restored.receipt.runID, MAIN_CI_RUN);
      assert.equal((await readFile(restored.path)).includes(TOKEN), false);
      assert.deepEqual((await readdir(guests)).sort(), [
        'aube',
        'pitchfork',
        'pitchfork.build-info',
        'pitchfork.commit',
      ]);
      for (const request of server.seen)
        assert.equal(
          request.headers.authorization,
          request.path.startsWith('/api.github.com/')
            ? `Bearer ${TOKEN}`
            : undefined,
        );
    } finally {
      await server.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// -------------------------------------------------------------- workflow

const WORKFLOW_TEXT = await readFile(ACCEPTANCE_WORKFLOW, 'utf8');
const WORKFLOW = parse(WORKFLOW_TEXT);
const JOB = WORKFLOW.jobs.accept;
type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
const STEPS: Step[] = JOB.steps;
const stepIndex = (pattern: RegExp) =>
  STEPS.findIndex((step) =>
    pattern.test(`${step.run ?? ''}${step.uses ?? ''}`),
  );
test('the workflow is manual only, main of the upstream repository only, read-only and secret-free', () => {
  assert.deepEqual(Object.keys(WORKFLOW.on), ['workflow_dispatch']);
  assert.equal(WORKFLOW.on.workflow_dispatch, null);
  assert.deepEqual(Object.keys(WORKFLOW.jobs), ['accept']);
  assert.equal(
    JOB.if,
    "github.repository == 'aletheia-works/formicarium' && github.ref == 'refs/heads/main'",
  );
  assert.deepEqual(WORKFLOW.permissions, { contents: 'read' });
  // actions: read only reads main's CI run of the same commit (pitchfork).
  assert.deepEqual(JOB.permissions, { contents: 'read', actions: 'read' });
  assert.doesNotMatch(WORKFLOW_TEXT, /:\s*write\b/);
  assert.doesNotMatch(WORKFLOW_TEXT, /secrets\.|GITHUB_TOKEN/);
  // The job token reaches one step only, as an environment variable.
  const tokenSteps = STEPS.filter((step) =>
    JSON.stringify(step).includes('github.token'),
  );
  assert.equal(tokenSteps.length, 1);
  assert.deepEqual(Object.keys(tokenSteps[0]!.env ?? {}), ['GH_TOKEN']);
  assert.match(
    String(tokenSteps[0]!.env?.GH_TOKEN),
    /^\$\{\{ github\.token \}\}$/,
  );
  assert.match(
    tokenSteps[0]!.run!,
    /acceptance-inputs\.js main-ci-pitchfork "\$GITHUB_SHA"$/,
  );
  assert.equal(WORKFLOW_TEXT.split('github.token').length - 1, 1);
  assert.equal(JOB['runs-on'], 'ubuntu-24.04');
  assert.equal(JOB['timeout-minutes'], 360);
  assert.equal(WORKFLOW.concurrency['cancel-in-progress'], false);
});
test('every action is pinned to a commit SHA and no checkout keeps credentials', () => {
  const actions = STEPS.filter((step) => step.uses);
  assert.ok(actions.length >= 4);
  for (const step of actions)
    assert.match(step.uses!, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/, step.uses!);
  for (const line of WORKFLOW_TEXT.split('\n').filter((row) =>
    row.includes('uses: '),
  ))
    assert.match(line, /@[a-f0-9]{40} # v\d+\.\d+\.\d+$/, line);
  const checkouts = actions.filter((step) =>
    step.uses!.startsWith('actions/checkout@'),
  );
  assert.equal(checkouts.length, 1);
  for (const step of checkouts)
    assert.equal(step.with?.['persist-credentials'], false);
});
test('the completion runs local-provisional after the inputs, the candidate and the job-only trust', () => {
  const order = [
    /mise run install-frozen/,
    /mise run build/,
    /mise run typecheck/,
    /ci-core\.js ci\/migration-session\/inputs\.bundle\.json/,
    /acceptance-inputs\.js main-ci-pitchfork "\$GITHUB_SHA"/,
    /acceptance-inputs\.js restore ci\/migration-command\/inputs\.json/,
    /cli\.js install --with-deps chromium firefox webkit/,
    /mise run migration-command-stage/,
    /tls\.ts create/,
    /certutil -A/,
    /^mise run migration-command-completion$/,
  ].map(stepIndex);
  assert.ok(
    order.every((index) => index >= 0),
    JSON.stringify(order),
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  const completion = STEPS[order.at(-1)!]!;
  assert.deepEqual(completion.env, { FORMICARIUM_COMMAND_LOCAL_ONLY: '1' });
  assert.equal(completion.if, undefined);
  assert.doesNotMatch(
    WORKFLOW_TEXT,
    /FORMICARIUM_COMMAND_CI_EVIDENCE|TIMEOUT|THRESHOLD|--retries|--workers|retention-days: (?!7\b)/,
  );
  const stage = STEPS[order[7]!]!;
  assert.match(
    String(stage.env?.FORMICARIUM_SESSION_SOURCE),
    /^\$\{\{ github\.sha \}\}$/,
  );
  assert.match(stage.run!, /"\$RUNNER_TEMP\/formicarium-u4-consumer-/);
});
test('trust removal and both 7-day artifacts run always, named as the observer expects', () => {
  const completion = stepIndex(/^mise run migration-command-completion$/);
  const cleanup = STEPS.findIndex((step) => /certutil -D/.test(step.run ?? ''));
  assert.ok(cleanup > completion);
  assert.equal(STEPS[cleanup]!.if, 'always()');
  assert.match(STEPS[cleanup]!.run!, /rm -rf -- showcase\/\.work\/tls/);
  const uploads = STEPS.filter((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  );
  // The workflow names must give what candidateArtifactName and
  // completionArtifactName produce for the run id and attempt.
  const run =
    /^migration-acceptance-(candidate|completion)-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}$/;
  assert.deepEqual(
    uploads.map((step) => run.exec(String(step.with?.name))?.[1]),
    ['candidate', 'completion'],
  );
  assert.equal(
    completionArtifactName(1, 2),
    'migration-acceptance-completion-1-2',
  );
  assert.equal(
    candidateArtifactName(1, 2),
    'migration-acceptance-candidate-1-2',
  );
  for (const step of uploads) {
    assert.equal(step.if, 'always()');
    assert.equal(step.with?.['retention-days'], 7);
    assert.equal(step.with?.['include-hidden-files'], true);
    assert.equal(step.with?.['if-no-files-found'], 'error');
    assert.ok(STEPS.indexOf(step) > cleanup);
  }
  assert.match(
    String(uploads[0]!.with?.path),
    /candidate-\*\/package\/aletheia-works-formicarium-0\.3\.0\.tgz/,
  );
});
