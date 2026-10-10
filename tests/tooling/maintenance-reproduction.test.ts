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
import { gzipSync } from 'node:zlib';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { BYTE_LIMIT } from '../../scripts/maintenance/archive.js';
import type { TrustedPolicy } from '../../scripts/maintenance/input.js';
import {
  type Acquisition,
  producerIdentity,
  REQUIRED_JOBS,
} from '../../scripts/maintenance/receipt.js';
import {
  type Command,
  type CommandExecutor,
  executeCommand,
  reproduceDependency,
  reproduceFormat,
  type SourceFile,
} from '../../scripts/maintenance/reproduce.js';

const encode = (value: string) => new TextEncoder().encode(value);
function fixture() {
  const head = 'a'.repeat(40),
    hash = 'b'.repeat(64),
    artifactBytes = encode('independent-ci');
  const producer = producerIdentity({
    producerAppId: 22,
    workflowId: 11,
    workflowPath: '.github/workflows/ci.yml',
  } as Parameters<typeof producerIdentity>[0]);
  const checks = REQUIRED_JOBS.map((name) => ({
    name,
    sourceSha: head,
    state: 'success' as const,
    runId: '123',
    producerIdentity: producer,
  }));
  const evidence = {
    schemaVersion: 1 as const,
    repository: 'owner/repo',
    sourceSha: head,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: '.github/workflows/ci.yml',
    purpose: 'ordinary-ci' as const,
    checks,
    artifactDigest: digest(artifactBytes),
    toolchainRevision: 'tools',
  };
  const observation = {
    repository: evidence.repository,
    sourceSha: head,
    runId: '123',
    runAttempt: 1,
    workflowIdentity: evidence.workflowIdentity,
    purpose: evidence.purpose,
    checks: structuredClone(checks),
    artifactBytes,
    toolchainRevision: 'tools',
    requiredChecks: checks.map((check) => ({
      name: check.name,
      producerIdentity: producer,
    })),
  };
  const config = encode(
    JSON.stringify({
      formatter: { enabled: true, indentStyle: 'space', indentWidth: 2 },
      javascript: { formatter: { quoteStyle: 'single' } },
      vcs: { enabled: false },
    }),
  );
  const policy: TrustedPolicy = {
    revision: 'base-policy',
    repository: 'owner/repo',
    allowedFormatPaths: ['runtime', 'scripts', 'tests', 'index.ts'],
    allowedDevDependencies: ['fixture-dep'],
    requiredCheckProducers: observation.requiredChecks,
    formatterRevision: 'biome-2.5.15',
    formatterConfigDigest: digest(config),
  };
  const acquisition: Acquisition = {
    repository: 'owner/repo',
    prNumber: 7,
    headSha: head,
    branch: 'update',
    baseSha: hash.slice(0, 40),
    runId: '123',
    runAttempt: 1,
    authenticatedUpdateBot: true,
    protectedMain: true,
    mergeable: true,
    files: [{ path: 'scripts/example.ts', status: 'modified', sha: head }],
    evidence,
    observation,
    receiptLockDigest: hash,
    artifactId: 66,
  };
  return { policy, acquisition, config };
}
const file = (source = 'const x={a:1};\n'): SourceFile => ({
  path: 'scripts/example.ts',
  status: 'modified',
  mode: '100644',
  originalBytes: encode(source),
});
const biome = resolve('node_modules/@biomejs/biome/bin/biome');
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
test('fixed Biome reproduces exactly formatting-only bytes with no write credentials', async (t) => {
  const secretKeys = [
    'MAINTENANCE_TOKEN',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'MAINTENANCE_READ_APP_PRIVATE_KEY',
  ];
  const previous = secretKeys.map((key) => process.env[key]);
  for (const key of secretKeys) process.env[key] = `fixture-secret-${key}`;
  t.after(() => {
    for (const [index, key] of secretKeys.entries()) {
      const value = previous[index];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const f = fixture(),
    commands: Command[] = [];
  const execute: CommandExecutor = async (command) => {
    commands.push(command);
    return executeCommand(command);
  };
  const result = await reproduceFormat(
    f.acquisition,
    [file()],
    f.policy,
    f.config,
    biome,
    execute,
  );
  assert.equal(result.decision.outcome, 'allow');
  assert.equal(result.changes.length, 1);
  assert.notEqual(
    Buffer.from(result.changes[0]?.replacementBytes ?? []).toString(),
    Buffer.from(file().originalBytes).toString(),
  );
  assert.equal(
    result.request.proposedDiffDigest,
    result.request.reproducedDiffDigest,
  );
  assert.ok(commands.some((command) => command.args[0] === 'format'));
  for (const command of commands) {
    assert.equal(command.env.GITHUB_TOKEN, undefined);
    assert.equal(command.env.NPM_TOKEN, undefined);
    for (const key of secretKeys) assert.equal(command.env[key], undefined);
    assert.doesNotMatch(JSON.stringify(result), /fixture-secret-/);
    assert.ok(!command.args.includes('check'));
    assert.ok(!command.args.includes('--write'));
  }
});
test('already formatted bytes become coherent no-op and never a fabricated empty declaration', async () => {
  const f = fixture();
  const initial = await reproduceFormat(
    f.acquisition,
    [file()],
    f.policy,
    f.config,
    biome,
  );
  const formatted = initial.changes[0]?.replacementBytes;
  assert.ok(formatted);
  const result = await reproduceFormat(
    f.acquisition,
    [{ ...file(), originalBytes: formatted }],
    f.policy,
    f.config,
    biome,
  );
  assert.equal(result.decision.outcome, 'no-op');
  assert.deepEqual(result.request.changedPaths, []);
  assert.equal(result.request.proposedDiffDigest, digest(''));
  assert.equal(result.request.emptyDiff, true);
});
test('altered trusted config, unreproducible formatter and unsuccessful lint evidence fail closed', async () => {
  const f = fixture();
  await assert.rejects(
    reproduceFormat(f.acquisition, [file()], f.policy, encode('{}'), biome),
    /FORMATTER_MISMATCH/,
  );
  await assert.rejects(
    reproduceFormat(
      f.acquisition,
      [file()],
      f.policy,
      f.config,
      biome,
      async () => {
        throw Error('formatter failed');
      },
    ),
  );
  f.acquisition.evidence.checks[0]!.state = 'failure';
  await assert.rejects(
    reproduceFormat(f.acquisition, [file()], f.policy, f.config, biome),
    /INVALID_EVIDENCE/,
  );
});
test('source classification rejects rename, delete, symlink, binary, traversal and oversized aggregate', async (t) => {
  const f = fixture();
  let calls = 0;
  const unused: CommandExecutor = async () => {
    calls++;
    return encode('2.5.15');
  };
  for (const changed of [
    { ...file(), status: 'renamed' },
    { ...file(), status: 'removed' },
    { ...file(), mode: '120000' },
    { ...file(), originalBytes: new Uint8Array([255]) },
    { ...file(), path: '../a.ts' },
    { ...file(), path: 'scripts/release/unsafe.ts' },
    { ...file(), path: 'scripts/maintenance/runner.ts' },
    { ...file(), originalBytes: new Uint8Array(BYTE_LIMIT + 1) },
  ])
    await t.test(
      changed.path +
        changed.status +
        changed.mode +
        changed.originalBytes.length,
      async () => {
        await assert.rejects(
          reproduceFormat(
            f.acquisition,
            [changed],
            f.policy,
            f.config,
            biome,
            unused,
          ),
        );
      },
    );
  assert.equal(calls, 0);
  await assert.rejects(
    reproduceFormat(
      f.acquisition,
      Array.from({ length: 501 }, (_, i) => ({
        ...file(),
        path: `scripts/f${i}.ts`,
      })),
      f.policy,
      f.config,
      biome,
      unused,
    ),
    /FILE_LIMIT/,
  );
});
test('fixed Bun reproduces sole passive dependency patch and minor with exact lock bytes', async (t) => {
  for (const to of ['1.0.1', '1.1.0'])
    await t.test(to, async () => {
      await packageFixture(to, async (data) => {
        const f = fixture();
        f.acquisition.files = [
          {
            path: 'package.json',
            status: 'modified',
            sha: f.acquisition.headSha,
          },
          { path: 'bun.lock', status: 'modified', sha: f.acquisition.headSha },
        ];
        f.acquisition.receiptLockDigest = digest(data.candidateLock);
        const commands: Command[] = [];
        const execute: CommandExecutor = async (command) => {
          commands.push(command);
          return executeCommand(command);
        };
        const result = await reproduceDependency(
          f.acquisition,
          f.policy,
          data.manifest,
          data.lock,
          data.candidate,
          data.candidateLock,
          data.bun,
          execute,
          data.registry,
        );
        assert.equal(result.decision.outcome, 'allow');
        assert.equal(result.request.directUpdates.length, 1);
        assert.equal(result.request.directUpdates[0]?.to, to);
        for (const command of commands.filter(
          (row) => row.args[0] === 'install',
        ))
          assert.ok(command.args.includes('--ignore-scripts'));
        assert.ok(
          commands.some((row) => row.args.includes('--frozen-lockfile')),
        );
      });
    });
});
test('dependency zero/two, range, major, prerelease, additions/deletions and Actions refuse before execution', async (t) => {
  const f = fixture();
  f.acquisition.files = [
    { path: 'package.json', status: 'modified', sha: f.acquisition.headSha },
    { path: 'bun.lock', status: 'modified', sha: f.acquisition.headSha },
  ];
  const base = {
    name: 'fixture',
    devDependencies: { 'fixture-dep': '1.0.0', other: '1.0.0' },
  };
  let calls = 0;
  const unused: CommandExecutor = async () => {
    calls++;
    return encode('1.4.2');
  };
  const candidates = [
    base,
    { ...base, devDependencies: { 'fixture-dep': '1.0.1', other: '1.0.1' } },
    ...['^1.0.1', '2.0.0', '1.0.1-rc.1', '1.0.0', '0.9.0'].map((to) => ({
      ...base,
      devDependencies: { ...base.devDependencies, 'fixture-dep': to },
    })),
    { ...base, devDependencies: { ...base.devDependencies, added: '1.0.0' } },
    { ...base, devDependencies: { other: '1.0.0' } },
    { ...base, devDependencies: { ...base.devDependencies, other: '1.0.1' } },
  ];
  for (const [index, candidate] of candidates.entries())
    await t.test(String(index), async () => {
      await assert.rejects(
        reproduceDependency(
          f.acquisition,
          f.policy,
          encode(JSON.stringify(base)),
          encode('{}'),
          encode(JSON.stringify(candidate)),
          encode('{}'),
          '/fixed/bun',
          unused,
        ),
      );
    });
  assert.equal(calls, 0);
});
test('extra manifest fields and unrelated transitive lock or stale receipt lock cannot be merged', async () => {
  await packageFixture('1.0.1', async (data) => {
    const f = fixture();
    f.acquisition.files = [
      { path: 'package.json', status: 'modified', sha: f.acquisition.headSha },
      { path: 'bun.lock', status: 'modified', sha: f.acquisition.headSha },
    ];
    f.acquisition.receiptLockDigest = digest(data.candidateLock);
    await assert.rejects(
      reproduceDependency(
        f.acquisition,
        f.policy,
        data.manifest,
        data.lock,
        encode(
          Buffer.from(data.candidate)
            .toString()
            .replace('"private": true', '"private": false'),
        ),
        data.candidateLock,
        data.bun,
        executeCommand,
        data.registry,
      ),
      /MIXED_OR_PROTECTED_CHANGES/,
    );
    await assert.rejects(
      reproduceDependency(
        f.acquisition,
        f.policy,
        data.manifest,
        data.lock,
        data.candidate,
        encode(Buffer.from(data.candidateLock).toString() + '\n'),
        data.bun,
        executeCommand,
        data.registry,
      ),
      /LOCK_MISMATCH/,
    );
    f.acquisition.receiptLockDigest = 'd'.repeat(64);
    await assert.rejects(
      reproduceDependency(
        f.acquisition,
        f.policy,
        data.manifest,
        data.lock,
        data.candidate,
        data.candidateLock,
        data.bun,
        executeCommand,
        data.registry,
      ),
      /TOOLCHAIN_MISMATCH/,
    );
  });
});
test('PR script/config never execute and C2/C3 remain real gates rather than allow stubs', async () => {
  const f = fixture();
  const source = file('const malicious = "postinstall: steal-secret";\n');
  const result = await reproduceFormat(
    f.acquisition,
    [source],
    f.policy,
    f.config,
    biome,
  );
  assert.ok(['allow', 'no-op'].includes(result.decision.outcome));
  assert.ok(result.decision.decisionId);
  assert.equal(result.request.context.trustedWorkflow, true);
  const alteredObservation = {
    ...f.acquisition,
    observation: { ...f.acquisition.observation, runAttempt: 2 },
  };
  await assert.rejects(
    reproduceFormat(alteredObservation, [source], f.policy, f.config, biome),
    /INVALID_EVIDENCE/,
  );
});
