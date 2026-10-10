import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { deflateRawSync, gzipSync } from 'node:zlib';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { BYTE_LIMIT, crc32 } from '../../scripts/maintenance/archive.js';
import {
  GitHubApi,
  type HttpTransport,
} from '../../scripts/maintenance/github.js';
import type {
  DependencyRequest,
  FormatRequest,
  TrustedPolicy,
} from '../../scripts/maintenance/input.js';
import {
  executeMaintenance,
  observeProtection,
  preparationFrom,
} from '../../scripts/maintenance/operations.js';
import {
  type AcquisitionPolicy,
  acquireMaintenance,
  REQUIRED_JOBS,
} from '../../scripts/maintenance/receipt.js';
import {
  executeCommand,
  reproduceDependency,
  reproduceFormat,
} from '../../scripts/maintenance/reproduce.js';

const encode = (value: string) => new TextEncoder().encode(value);
function zip(
  members: {
    name: string;
    bytes: Uint8Array;
    mode?: number;
    method?: number;
  }[],
): Uint8Array {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const member of members) {
    const name = Buffer.from(member.name),
      bytes = Buffer.from(member.bytes);
    const method = member.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(bytes) : bytes;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x0314, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(crc32(bytes), 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(((member.mode ?? 0x81a4) << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, compressed);
    central.push(directory, name);
    offset += header.length + name.length + compressed.length;
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
const json = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), { headers });
function fixture() {
  const head = 'a'.repeat(40),
    base = 'b'.repeat(40),
    workflow = new TextEncoder().encode('trusted CI workflow');
  const policy: AcquisitionPolicy = {
    repository: 'owner/repo',
    workflowId: 11,
    workflowPath: '.github/workflows/ci.yml',
    workflowDigest: digest(workflow),
    producerAppId: 22,
    toolchainRevision: 'bun1.4.2-node24.21.0',
    protectedPaths: ['.github/workflows/ci.yml', 'scripts/release'],
    archiveRedirectHosts: ['archive.blob.core.windows.net'],
    updateActorId: 33,
    updateActorType: 'Bot',
  };
  const run = {
    id: 123,
    run_attempt: 1,
    repository: { full_name: policy.repository, id: 44 },
    workflow_id: 11,
    path: policy.workflowPath,
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    head_sha: head,
    check_suite_id: 55,
    pull_requests: [{ number: 7 }],
  };
  const pr = {
    number: 7,
    state: 'open',
    merged: false,
    head: { sha: head, ref: 'update', repo: { full_name: policy.repository } },
    base: { sha: base, repo: { full_name: policy.repository } },
    user: { id: 33, type: 'Bot' },
  };
  const jobs = REQUIRED_JOBS.map((name, index) => ({
    name,
    status: 'completed',
    conclusion: 'success',
    run_id: 123,
    run_attempt: 1,
    check_run_url: `https://api.github.com/repos/owner/repo/check-runs/${100 + index}`,
  }));
  const checks = REQUIRED_JOBS.map((name, index) => ({
    name,
    id: 100 + index,
    head_sha: head,
    status: 'completed',
    conclusion: 'success',
    app: { id: 22 },
    check_suite: { id: 55 },
  }));
  const receipt = {
    schemaVersion: 1,
    repository: policy.repository,
    sourceSha: head,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: policy.workflowPath,
    workflowRef: `owner/repo/${policy.workflowPath}@refs/pull/7/merge`,
    purpose: 'ordinary-ci',
    receiptNodeVersion: '24.21.0',
    expectedToolchain: {
      node: '24.21.0',
      bun: '1.4.2',
      lockDigest: 'c'.repeat(64),
    },
    observedJobs: REQUIRED_JOBS.slice(0, 2).map((name) => ({
      name,
      state: 'success',
      sourceSha: head,
      runId: '123',
    })),
  };
  const archive = zip([
    {
      name: 'receipt.json',
      bytes: new TextEncoder().encode(JSON.stringify(receipt)),
      method: 8,
    },
  ]);
  const transport: HttpTransport = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/actions/runs/123')) return json(run);
    if (path.endsWith('/pulls/7')) return json(pr);
    if (path.includes('/contents/'))
      return json({
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(workflow).toString('base64'),
        size: workflow.length,
      });
    if (path.endsWith('/pulls/7/files'))
      return json([
        {
          filename: 'scripts/example.ts',
          status: 'modified',
          sha: 'd'.repeat(40),
        },
      ]);
    if (path.endsWith('/attempts/1/jobs')) return json({ jobs });
    if (path.endsWith('/check-runs')) return json({ check_runs: checks });
    if (path.endsWith('/artifacts'))
      return json({
        artifacts: [
          {
            id: 66,
            name: `ordinary-ci-${head}-123-1`,
            expired: false,
            workflow_run: { id: 123, repository_id: 44, head_sha: head },
          },
        ],
      });
    if (path.endsWith('/artifacts/66/zip'))
      return new Response(Buffer.from(archive));
    throw Error('unexpected fixture endpoint');
  };
  return {
    head,
    base,
    policy,
    run,
    pr,
    jobs,
    checks,
    receipt,
    archive,
    transport,
  };
}
async function operationFixture(dependency = false) {
  const f = fixture();
  Object.assign(f.pr, {
    mergeable: true,
    mergeable_state: 'clean',
    draft: false,
  });
  Object.assign(f.pr.base, { ref: 'main' });
  const original = new TextEncoder().encode('const x=1;\n'),
    replacement = new TextEncoder().encode('const x = 1;\n');
  const calls: { url: string; init: RequestInit; body: unknown }[] = [];
  let handler: HttpTransport | undefined;
  const transport: HttpTransport = async (url, init) => {
    const path = new URL(url).pathname;
    if (init.method !== 'GET') {
      calls.push({ url, init, body: JSON.parse(String(init.body)) });
      if (handler) return handler(url, init);
      return dependency
        ? json({ merged: true, sha: 'e'.repeat(40) })
        : json({
            data: { createCommitOnBranch: { commit: { oid: 'e'.repeat(40) } } },
          });
    }
    if (path.endsWith('/branches/main/protection'))
      return json({
        enforce_admins: { enabled: true },
        required_status_checks: { contexts: [...REQUIRED_JOBS], strict: true },
        allow_force_pushes: { enabled: false },
      });
    if (path.endsWith('/rulesets')) return json([]);
    if (path.endsWith('/pulls/7/files') && dependency)
      return json(
        ['package.json', 'bun.lock'].map((filename) => ({
          filename,
          status: 'modified',
          sha: 'd'.repeat(40),
        })),
      );
    if (path.includes('/contents/scripts/example.ts'))
      return json({
        type: 'file',
        encoding: 'base64',
        content: Buffer.from(original).toString('base64'),
        size: original.length,
      });
    return f.transport(url, init);
  };
  const acquired = await acquireMaintenance(
    new GitHubApi('read', transport),
    123,
    f.policy,
  );
  const policy: TrustedPolicy = {
    revision: 'trusted-base',
    repository: 'owner/repo',
    allowedFormatPaths: ['scripts'],
    allowedDevDependencies: ['typescript'],
    requiredCheckProducers: acquired.observation.requiredChecks,
    formatterRevision: 'biome-2.5.15',
    formatterConfigDigest: 'f'.repeat(64),
  };
  const changes = [
    {
      path: 'scripts/example.ts',
      originalDigest: digest(original),
      replacementBase64: Buffer.from(replacement).toString('base64'),
    },
  ];
  const diffDigest = digest(
    JSON.stringify(
      changes.map((item) => ({
        path: item.path,
        originalDigest: item.originalDigest,
        replacement: item.replacementBase64,
      })),
    ),
  );
  const context = {
    repository: acquired.repository,
    prNumber: 7,
    headSha: acquired.headSha,
    currentHeadSha: acquired.headSha,
    sameRepository: true,
    prOpen: true,
    trustedWorkflow: true,
    evidence: acquired.evidence,
  };
  const request: FormatRequest | DependencyRequest = dependency
    ? {
        schemaVersion: 1,
        operation: 'dependency-merge',
        context,
        authenticatedUpdateBot: true,
        directUpdates: [
          { name: 'typescript', from: '7.0.2', to: '7.0.3', kind: 'patch' },
        ],
        devDependenciesOnly: true,
        mixedOrProtectedChanges: false,
        expectedLockDigest: 'c'.repeat(64),
        reproducedLockDigest: 'c'.repeat(64),
        protectedMain: true,
        mergeable: true,
      }
    : {
        schemaVersion: 1,
        operation: 'format-push',
        context,
        changedPaths: changes.map((item) => item.path),
        proposedDiffDigest: diffDigest,
        reproducedDiffDigest: diffDigest,
        trustedFormatterRevision: policy.formatterRevision,
        trustedConfigDigest: policy.formatterConfigDigest,
        reproducible: true,
        formattingOnly: true,
        emptyDiff: false,
      };
  const prepared = preparationFrom(
    request,
    dependency ? [] : changes,
    f.base,
    456,
    1,
  );
  return {
    ...f,
    acquired,
    policy,
    acquisitionPolicy: f.policy,
    prepared,
    calls,
    transport,
    setHandler(value: HttpTransport) {
      handler = value;
    },
  };
}

async function bunPath(): Promise<string> {
  if (process.env.BUN_EXECUTABLE) return process.env.BUN_EXECUTABLE;
  const roots = [
    join(homedir(), '.local/share/mise/installs/bun'),
    join(homedir(), 'AppData/Local/mise/installs/bun'),
  ];
  for (const root of roots) {
    let entries: string[] = [];
    try {
      entries = await readdir(root);
    } catch {
      continue;
    }
    for (const version of entries)
      for (const path of [
        join(root, version, 'bin/bun'),
        join(root, version, 'bun'),
      ]) {
        try {
          await access(path);
          if (
            Buffer.from(
              await executeCommand({
                executable: path,
                args: ['--version'],
                cwd: process.cwd(),
                env: { PATH: process.env.PATH ?? '' },
              }),
            )
              .toString()
              .trim() === '1.4.2'
          )
            return path;
        } catch {
          /* Try other installed executables, never a shim. */
        }
      }
  }
  throw Error('fixed Bun1.4.2 executable unavailable');
}
function tarball(version: string): Buffer {
  const rows = [
    ['package/package.json', JSON.stringify({ name: 'fixture-dep', version })],
    ['package/index.js', 'export {};\n'],
  ];
  const chunks: Buffer[] = [];
  for (const [name, value] of rows) {
    const bytes = Buffer.from(value ?? ''),
      header = Buffer.alloc(512);
    header.write(name ?? '', 0);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write('0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    chunks.push(
      header,
      bytes,
      Buffer.alloc((512 - (bytes.length % 512)) % 512),
    );
  }
  return gzipSync(Buffer.concat([...chunks, Buffer.alloc(1024)]));
}
async function packageFixture(
  to: string,
  callback: (data: {
    manifest: Uint8Array;
    candidate: Uint8Array;
    lock: Uint8Array;
    candidateLock: Uint8Array;
    bun: string;
    registry: string;
  }) => Promise<void>,
) {
  const workspace = await mkdtemp(
    join(tmpdir(), 'formicarium-registry-fixture-'),
  );
  const versions = ['1.0.0', '1.0.1', '1.1.0'];
  const tarballs = new Map(
    versions.map((version) => [version, tarball(version)]),
  );
  let registry = '';
  const server = createServer((request, response) => {
    if (request.url === '/fixture-dep') {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          name: 'fixture-dep',
          'dist-tags': { latest: '1.1.0' },
          versions: Object.fromEntries(
            versions.map((version) => {
              const bytes = tarballs.get(version) ?? Buffer.alloc(0);
              return [
                version,
                {
                  name: 'fixture-dep',
                  version,
                  dist: {
                    tarball: `${registry}fixture-dep/-/${version}.tgz`,
                    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
                  },
                },
              ];
            }),
          ),
        }),
      );
    } else {
      const version = request.url?.match(
        /^\/fixture-dep\/-\/(1\.[01]\.[01])\.tgz$/,
      )?.[1];
      const bytes = version ? tarballs.get(version) : undefined;
      if (!bytes) {
        response.statusCode = 404;
        response.end();
      } else {
        response.setHeader('Content-Type', 'application/octet-stream');
        response.end(bytes);
      }
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  registry = `http://127.0.0.1:${address.port}/`;
  try {
    const bun = await bunPath();
    const manifest = encode(
      JSON.stringify(
        {
          name: 'passive-fixture',
          version: '1.0.0',
          private: true,
          trustedDependencies: [],
          scripts: { postinstall: 'this-must-never-execute' },
          devDependencies: { 'fixture-dep': '1.0.0' },
        },
        null,
        2,
      ) + '\n',
    );
    const candidate = encode(
      Buffer.from(manifest)
        .toString()
        .replace('"fixture-dep": "1.0.0"', `"fixture-dep": "${to}"`),
    );
    const env = {
      PATH: process.env.PATH ?? '',
      HOME: workspace,
      BUN_INSTALL_CACHE_DIR: join(workspace, 'cache'),
    };
    await writeFile(join(workspace, '.npmrc'), `registry=${registry}\n`);
    await writeFile(join(workspace, 'package.json'), manifest);
    await executeCommand({
      executable: bun,
      args: ['install', '--lockfile-only', '--ignore-scripts'],
      cwd: workspace,
      env,
    });
    const lock = await readFile(join(workspace, 'bun.lock'));
    await writeFile(join(workspace, 'package.json'), candidate);
    await executeCommand({
      executable: bun,
      args: ['install', '--lockfile-only', '--ignore-scripts'],
      cwd: workspace,
      env,
    });
    const candidateLock = await readFile(join(workspace, 'bun.lock'));
    await callback({ manifest, candidate, lock, candidateLock, bun, registry });
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    await rm(workspace, { recursive: true, force: true });
  }
}

const biome = resolve('node_modules/@biomejs/biome/bin/biome');
async function reproducedFormat() {
  const f = await operationFixture();
  const config = encode(
    JSON.stringify({
      formatter: { enabled: true, indentStyle: 'space', indentWidth: 2 },
      javascript: { formatter: { quoteStyle: 'single' } },
      vcs: { enabled: false },
    }),
  );
  f.policy.formatterConfigDigest = digest(config);
  const result = await reproduceFormat(
    f.acquired,
    [
      {
        path: 'scripts/example.ts',
        status: 'modified',
        mode: '100644',
        originalBytes: encode('const x=1;\n'),
      },
    ],
    f.policy,
    config,
    biome,
  );
  const changes = result.changes.map((item) => ({
    path: item.path,
    originalDigest: item.originalDigest,
    replacementBase64: Buffer.from(item.replacementBytes).toString('base64'),
  }));
  return {
    ...f,
    result,
    prepared: preparationFrom(result.request, changes, f.base, 456, 1),
  };
}
test('bounded ZIP receipt through real formatter and C2/C3 reaches one atomic format commit', async () => {
  const f = await reproducedFormat();
  assert.equal(f.result.decision.outcome, 'allow');
  const result = await executeMaintenance(
    new GitHubApi('writer', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'success');
  assert.equal(f.calls.length, 1);
  const body = f.calls[0]?.body as {
    variables: {
      input: { expectedHeadOid: string; fileChanges: { additions: unknown } };
    };
  };
  assert.equal(body.variables.input.expectedHeadOid, f.head);
  assert.deepEqual(
    body.variables.input.fileChanges.additions,
    f.prepared.changes.map((item) => ({
      path: item.path,
      contents: item.replacementBase64,
    })),
  );
});
test('actual passive Bun dependency reproduction reaches one conditional squash merge', async () => {
  await packageFixture('1.0.1', async (data) => {
    const f = await operationFixture(true);
    f.policy.allowedDevDependencies = ['fixture-dep'];
    const receipt = {
      ...f.receipt,
      expectedToolchain: {
        ...f.receipt.expectedToolchain,
        lockDigest: digest(data.candidateLock),
      },
    };
    const bytes = zip([
      {
        name: 'receipt.json',
        bytes: encode(JSON.stringify(receipt)),
        method: 8,
      },
    ]);
    const transport: HttpTransport = async (url, init) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/artifacts/66/zip'))
        return new Response(Buffer.from(bytes));
      return f.transport(url, init);
    };
    const acquired = await acquireMaintenance(
      new GitHubApi('read', transport),
      123,
      f.acquisitionPolicy,
    );
    let protectionReads = 0;
    const deniedProtection: HttpTransport = async (url, init) => {
      if (new URL(url).pathname.endsWith('/branches/main/protection')) {
        protectionReads++;
        return new Response('permission denied', { status: 403 });
      }
      return transport(url, init);
    };
    await assert.rejects(
      observeProtection(
        new GitHubApi('insufficient-read-token', deniedProtection),
        acquired,
      ),
    );
    assert.equal(protectionReads, 1);
    assert.equal(f.calls.length, 0);
    acquired.protectedMain = true;
    acquired.mergeable = true;
    const reproduction = await reproduceDependency(
      acquired,
      f.policy,
      data.manifest,
      data.lock,
      data.candidate,
      data.candidateLock,
      data.bun,
      executeCommand,
      data.registry,
    );
    assert.equal(reproduction.decision.outcome, 'allow');
    const prepared = preparationFrom(reproduction.request, [], f.base, 456, 1);
    const result = await executeMaintenance(
      new GitHubApi('merge', transport),
      prepared,
      f.policy,
      f.acquisitionPolicy,
      f.base,
    );
    assert.equal(result.status, 'success');
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0]?.body, {
      sha: f.head,
      merge_method: 'squash',
      commit_title: 'chore(deps): apply verified dependency update',
    });
  });
});
test('stale final head after successful reproduction refuses before writing', async () => {
  const f = await reproducedFormat();
  f.pr.head.sha = 'e'.repeat(40);
  const result = await executeMaintenance(
    new GitHubApi('writer', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'reject');
  assert.equal(f.calls.length, 0);
});
test('independent producer and artifact tampering cannot become a writer request', async (t) => {
  for (const boundary of ['producer', 'archive'])
    await t.test(boundary, async () => {
      const f = await reproducedFormat();
      if (boundary === 'producer') f.checks[0]!.app.id = 999;
      const transport: HttpTransport = async (url, init) => {
        if (
          boundary === 'archive' &&
          new URL(url).pathname.endsWith('/artifacts/66/zip')
        )
          return new Response(new Uint8Array(BYTE_LIMIT + 1));
        return f.transport(url, init);
      };
      const result = await executeMaintenance(
        new GitHubApi('writer', transport),
        f.prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      );
      assert.equal(result.status, 'reject');
      assert.equal(f.calls.length, 0);
    });
});
test('mixed source and passive dependency changes refuse with zero external writes', async () => {
  const f = await reproducedFormat();
  const transport: HttpTransport = async (url, init) => {
    if (new URL(url).pathname.endsWith('/pulls/7/files'))
      return json([
        { filename: 'package.json', status: 'modified', sha: f.head },
        { filename: 'scripts/example.ts', status: 'modified', sha: f.head },
      ]);
    return f.transport(url, init);
  };
  const result = await executeMaintenance(
    new GitHubApi('writer', transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'reject');
  assert.equal(f.calls.length, 0);
});
test('unknown write outcome is read-only reconciled and never resent', async () => {
  const f = await reproducedFormat();
  f.setHandler(async () => {
    throw Error('connection lost after request');
  });
  const result = await executeMaintenance(
    new GitHubApi('writer', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'unknown');
  assert.equal(f.calls.length, 1);
});
test('a later delivery after successful commit refuses stale prepared head', async () => {
  const f = await reproducedFormat();
  const first = await executeMaintenance(
    new GitHubApi('writer', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(first.status, 'success');
  f.pr.head.sha = 'e'.repeat(40);
  const second = await executeMaintenance(
    new GitHubApi('writer', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(second.status, 'reject');
  assert.equal(f.calls.length, 1);
});
