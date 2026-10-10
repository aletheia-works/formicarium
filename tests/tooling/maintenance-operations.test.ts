import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { digest } from '../../scripts/ci/quality-evidence.js';
import { crc32 } from '../../scripts/maintenance/archive.js';
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
  type PreparedMaintenance,
  preparationFrom,
} from '../../scripts/maintenance/operations.js';
import {
  type AcquisitionPolicy,
  acquireMaintenance,
  REQUIRED_JOBS,
} from '../../scripts/maintenance/receipt.js';

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
test('format writes actual GraphQL input with atomic expected head and exact additions once', async () => {
  const f = await operationFixture();
  const result = await executeMaintenance(
    new GitHubApi('purpose-secret', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'success');
  assert.equal(f.calls.length, 1);
  const request = f.calls[0];
  assert.ok(request);
  assert.equal(request.url, 'https://api.github.com/graphql');
  assert.equal(request.init.method, 'POST');
  assert.equal(
    (request.init.headers as Record<string, string>).Authorization,
    'Bearer purpose-secret',
  );
  const body = request.body as {
    query: string;
    variables: {
      input: {
        expectedHeadOid: string;
        branch: unknown;
        fileChanges: unknown;
        message: { headline: string };
      };
    };
  };
  assert.ok(body.query.includes('createCommitOnBranch'));
  assert.equal(body.variables.input.expectedHeadOid, f.head);
  assert.deepEqual(body.variables.input.branch, {
    repositoryNameWithOwner: 'owner/repo',
    branchName: 'update',
  });
  assert.deepEqual(body.variables.input.fileChanges, {
    additions: f.prepared.changes.map((item) => ({
      path: item.path,
      contents: item.replacementBase64,
    })),
  });
  assert.equal(
    body.variables.input.message.headline,
    'style: apply trusted formatting',
  );
  assert.ok(!JSON.stringify(result).includes('purpose-secret'));
});
test('dependency performs sha-conditional REST squash merge exactly once', async () => {
  const f = await operationFixture(true);
  const result = await executeMaintenance(
    new GitHubApi('merge-secret', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'success');
  assert.equal(f.calls.length, 1);
  assert.equal(
    f.calls[0]?.url,
    'https://api.github.com/repos/owner/repo/pulls/7/merge',
  );
  assert.equal(f.calls[0]?.init.method, 'PUT');
  assert.deepEqual(f.calls[0]?.body, {
    sha: f.head,
    merge_method: 'squash',
    commit_title: 'chore(deps): apply verified dependency update',
  });
});
test('changed head, fork, unknown protection and merge queue block write before the atomic operation', async (t) => {
  for (const boundary of ['head', 'fork', 'protection', 'queue'])
    await t.test(boundary, async () => {
      const f = await operationFixture(true);
      if (boundary === 'head') f.pr.head.sha = 'e'.repeat(40);
      if (boundary === 'fork') f.pr.head.repo.full_name = 'fork/repo';
      const transport: HttpTransport = async (url, init) => {
        const path = new URL(url).pathname;
        if (boundary === 'protection' && path.endsWith('/protection'))
          return new Response(null, { status: 403 });
        if (boundary === 'queue' && path.endsWith('/rulesets'))
          return json([{ id: 77, enforcement: 'active' }]);
        if (boundary === 'queue' && path.endsWith('/rulesets/77'))
          return json({ rules: [{ type: 'merge_queue' }] });
        return f.transport(url, init);
      };
      const result = await executeMaintenance(
        new GitHubApi('x', transport),
        f.prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      );
      assert.equal(result.status, 'reject');
      assert.equal(f.calls.length, 0);
    });
});
test('all reject and coherent no-op preparation states invoke zero writes', async (t) => {
  const f = await operationFixture();
  assert.equal(f.prepared.request.operation, 'format-push');
  const request = f.prepared.request as FormatRequest;
  const noOp: PreparedMaintenance = {
    ...f.prepared,
    changes: [],
    request: {
      ...request,
      changedPaths: [],
      proposedDiffDigest: digest(''),
      reproducedDiffDigest: digest(''),
      emptyDiff: true,
    },
  };
  const cases: [string, PreparedMaintenance][] = [
    ['no-op', noOp],
    [
      'non-format',
      { ...f.prepared, request: { ...request, formattingOnly: false } },
    ],
    ['untrusted-base', { ...f.prepared, trustedBaseSha: 'e'.repeat(40) }],
    [
      'empty contradiction',
      { ...f.prepared, request: { ...request, emptyDiff: true } },
    ],
    [
      'altered bytes',
      {
        ...f.prepared,
        changes: [
          {
            ...f.prepared.changes[0]!,
            replacementBase64: Buffer.from('attacker').toString('base64'),
          },
        ],
      },
    ],
  ];
  for (const [name, prepared] of cases)
    await t.test(name, async () => {
      const result = await executeMaintenance(
        new GitHubApi('x', f.transport),
        prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      );
      assert.ok(['reject', 'no-op'].includes(result.status));
      assert.equal(f.calls.length, 0);
    });
});
test('GraphQL HTTP200 errors and REST permissions or atomic conflicts are failures without retry', async (t) => {
  for (const status of [200, 403, 409])
    await t.test(String(status), async () => {
      const f = await operationFixture(status !== 200);
      f.setHandler(async () =>
        status === 200
          ? json({ errors: [{ message: 'untrusted arbitrary server text' }] })
          : new Response(null, { status }),
      );
      const result = await executeMaintenance(
        new GitHubApi('x', f.transport),
        f.prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      );
      assert.equal(result.status, 'failure');
      assert.equal(f.calls.length, 1);
      assert.ok(
        !JSON.stringify(result).includes('untrusted arbitrary server text'),
      );
    });
});
test('unknown write completion is reconciled by finite reads and never resubmitted', async () => {
  const f = await operationFixture();
  f.setHandler(async () => {
    throw Error('lost connection secret');
  });
  const result = await executeMaintenance(
    new GitHubApi('x', f.transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'unknown');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(result.reasons, ['WRITE_RESULT_UNKNOWN']);
  assert.ok(!JSON.stringify(result).includes('lost connection secret'));
});
test('post-timeout parent and exact tree reconciliation can confirm format success', async () => {
  const f = await operationFixture();
  let written = false;
  f.setHandler(async () => {
    written = true;
    f.pr.head.sha = 'e'.repeat(40);
    throw Error('network timeout');
  });
  const transport: HttpTransport = async (url, init) => {
    const path = new URL(url).pathname;
    if (written && path.endsWith('/git/commits/' + 'e'.repeat(40)))
      return json({ parents: [{ sha: f.head }] });
    if (written && path.includes('/contents/scripts/example.ts')) {
      const bytes = Buffer.from(
        f.prepared.changes[0]!.replacementBase64,
        'base64',
      );
      return json({
        type: 'file',
        encoding: 'base64',
        content: bytes.toString('base64'),
        size: bytes.length,
      });
    }
    if (written && path.includes('/compare/'))
      return json({ files: [{ filename: 'scripts/example.ts' }] });
    return f.transport(url, init);
  };
  const result = await executeMaintenance(
    new GitHubApi('x', transport),
    f.prepared,
    f.policy,
    f.acquisitionPolicy,
    f.base,
  );
  assert.equal(result.status, 'success');
  assert.equal(result.resultingSha, 'e'.repeat(40));
  assert.equal(f.calls.length, 1);
});
test('duplicate events, stale checks and cancellation do not retry a completed or rejected operation', async (t) => {
  const f = await operationFixture();
  const api = new GitHubApi('x', f.transport);
  assert.equal(
    (
      await executeMaintenance(
        api,
        f.prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      )
    ).status,
    'success',
  );
  f.pr.head.sha = 'e'.repeat(40);
  assert.equal(
    (
      await executeMaintenance(
        new GitHubApi('x', f.transport),
        f.prepared,
        f.policy,
        f.acquisitionPolicy,
        f.base,
      )
    ).status,
    'reject',
  );
  assert.equal(f.calls.length, 1);
  await t.test('non-success check', async () => {
    const fresh = await operationFixture();
    fresh.checks[0]!.conclusion = 'failure';
    assert.equal(
      (
        await executeMaintenance(
          new GitHubApi('x', fresh.transport),
          fresh.prepared,
          fresh.policy,
          fresh.acquisitionPolicy,
          fresh.base,
        )
      ).status,
      'reject',
    );
    assert.equal(fresh.calls.length, 0);
  });
  await t.test('cancelled before write', async () => {
    const fresh = await operationFixture();
    const abort = new AbortController();
    abort.abort();
    const result = await executeMaintenance(
      new GitHubApi('x', fresh.transport, undefined, abort.signal),
      fresh.prepared,
      fresh.policy,
      fresh.acquisitionPolicy,
      fresh.base,
    );
    assert.equal(result.status, 'reject');
    assert.equal(fresh.calls.length, 0);
  });
});
