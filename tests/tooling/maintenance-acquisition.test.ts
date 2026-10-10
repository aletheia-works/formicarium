import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { digest } from '../../scripts/ci/quality-evidence.js';
import {
  BYTE_LIMIT,
  crc32,
  decodeJson,
  readBoundedStream,
  unpackArchive,
} from '../../scripts/maintenance/archive.js';
import {
  type ApiClock,
  GITHUB_ARTIFACT_SHARDS,
  GitHubApi,
  type HttpTransport,
  validArchiveHostRule,
} from '../../scripts/maintenance/github.js';
import {
  type AcquisitionPolicy,
  acquireMaintenance,
  normalizeReceipt,
  producerIdentity,
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
test('bounded API and deflated ZIP produce independently normalized three-check evidence', async () => {
  const f = fixture();
  const acquired = await acquireMaintenance(
    new GitHubApi('read-secret', f.transport),
    123,
    f.policy,
  );
  assert.equal(acquired.prNumber, 7);
  assert.equal(acquired.authenticatedUpdateBot, true);
  assert.deepEqual(
    acquired.evidence.checks.map((check) => check.name),
    [...REQUIRED_JOBS],
  );
  assert.equal(acquired.evidence.artifactDigest, digest(f.archive));
  assert.equal(acquired.receiptLockDigest, 'c'.repeat(64));
  assert.equal(
    acquired.evidence.checks[2]?.producerIdentity,
    producerIdentity(f.policy),
  );
  assert.equal(f.receipt.observedJobs.length, 2);
});
test('HTTP headers, bounded pagination and signed redirects use actual request shapes', async (t) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = new GitHubApi('private-token', async (url, init) => {
    calls.push({ url, init });
    if (new URL(url).hostname === 'archive.blob.core.windows.net')
      return new Response('archive');
    if (url.endsWith('/zip'))
      return new Response(null, {
        status: 302,
        headers: {
          location:
            'https://archive.blob.core.windows.net/file?signature=fixed',
        },
      });
    if (url.includes('page=2')) return json({ jobs: [{ id: 2 }] });
    return json(
      { jobs: [{ id: 1 }] },
      {
        link: '<https://api.github.com/repos/owner/repo/jobs?page=2>; rel="next"',
      },
    );
  });
  assert.deepEqual(await api.pages('/repos/owner/repo/jobs', 'jobs'), [
    { id: 1 },
    { id: 2 },
  ]);
  await api.bytes('/repos/owner/repo/zip', ['archive.blob.core.windows.net']);
  const first = calls[0];
  assert.ok(first);
  assert.equal(
    (first.init.headers as Record<string, string>).Authorization,
    'Bearer private-token',
  );
  assert.equal(
    (first.init.headers as Record<string, string>)['X-GitHub-Api-Version'],
    '2022-11-28',
  );
  assert.equal(
    (first.init.headers as Record<string, string>).Accept,
    'application/vnd.github+json',
  );
  assert.equal(calls.at(-1)?.init.headers, undefined);
  for (const path of [
    'https://evil.example/repos/x',
    'https://user:pass@api.github.com/x',
    '/x#fragment',
  ])
    await t.test(path, async () => {
      await assert.rejects(api.json(path), /INVALID_ENDPOINT/);
    });
  await assert.rejects(
    api.bytes('/repos/owner/repo/zip', ['other.example']),
    /REDIRECT_REJECTED/,
  );
  const looping = new GitHubApi('x', async () =>
    json(
      { jobs: [] },
      { link: '<https://api.github.com/repos/owner/repo/jobs>; rel="next"' },
    ),
  );
  await assert.rejects(
    looping.pages('/repos/owner/repo/jobs', 'jobs'),
    /PAGINATION_REJECTED/,
  );
});
test('read request and total budgets cap retries, while writes and cancellation never retry', async (t) => {
  let attempts = 0;
  const failed = new GitHubApi('x', async () => {
    attempts++;
    return new Response(null, { status: 429 });
  });
  await assert.rejects(failed.json('/x'), /RETRYABLE_HTTP/);
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(
    failed.writeJson('/graphql', 'POST', { query: 'fixed', variables: {} }),
    /RETRYABLE_HTTP/,
  );
  assert.equal(attempts, 1);
  let schedules = 0;
  const timing: ApiClock = {
    now: () => 0,
    schedule(callback, milliseconds) {
      assert.equal(milliseconds, 10000);
      schedules++;
      queueMicrotask(callback);
      return () => {};
    },
  };
  const timed = new GitHubApi(
    'x',
    async () => new Promise<Response>(() => {}),
    timing,
  );
  await assert.rejects(timed.json('/x'), /REQUEST_TIMEOUT/);
  assert.equal(schedules, 3);
  let nowCalls = 0;
  const budget: ApiClock = {
    now: () => (nowCalls++ === 0 ? 0 : 60000),
    schedule() {
      throw Error('must not schedule');
    },
  };
  await assert.rejects(
    new GitHubApi('x', async () => json({}), budget).json('/x'),
    /READ_BUDGET/,
  );
  for (const status of [403, 404])
    await t.test(`HTTP ${status}`, async () => {
      let count = 0;
      const api = new GitHubApi('x', async () => {
        count++;
        return new Response(null, { status });
      });
      await assert.rejects(api.json('/x'), /HTTP_REJECTED/);
      assert.equal(count, 1);
    });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    new GitHubApi('x', async () => json({}), undefined, abort.signal).json(
      '/x',
    ),
    /CANCELLED/,
  );
});
test('stream enforces 8 MiB before copy or parsing regardless of Content-Length', async (t) => {
  for (const size of [BYTE_LIMIT - 1, BYTE_LIMIT])
    await t.test(`accept ${size}`, async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(size));
          controller.close();
        },
      });
      assert.equal((await readBoundedStream(body)).length, size);
    });
  let cancelled = 0;
  const tooLarge = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(BYTE_LIMIT));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled++;
    },
  });
  await assert.rejects(readBoundedStream(tooLarge), /BYTE_LIMIT/);
  assert.equal(cancelled, 1);
  const api = new GitHubApi(
    'x',
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(BYTE_LIMIT + 1));
            controller.close();
          },
        }),
        { headers: { 'content-length': '1' } },
      ),
  );
  await assert.rejects(api.json('/x'), /BYTE_LIMIT/);
  assert.throws(() => decodeJson(new Uint8Array(BYTE_LIMIT + 1)), /BYTE_LIMIT/);
});
test('ZIP rejects unsafe members, duplicates, bombs, CRC changes and member overflow', async (t) => {
  const data = new TextEncoder().encode('{}');
  const names = Array.from({ length: 16 }, (_, index) => `member${index}.json`);
  assert.equal(
    (
      await unpackArchive(
        zip(names.map((name) => ({ name, bytes: data }))),
        names,
      )
    ).size,
    16,
  );
  const cases = [
    {
      name: '17 members',
      archive: zip(
        Array.from({ length: 17 }, (_, i) => ({
          name: `member${i}.json`,
          bytes: data,
        })),
      ),
    },
    ...[
      '../receipt.json',
      '/receipt.json',
      'a\\receipt.json',
      'C:/receipt.json',
      'a//b',
    ].map((name) => ({ name, archive: zip([{ name, bytes: data }]) })),
    {
      name: 'symlink',
      archive: zip([{ name: 'receipt.json', bytes: data, mode: 0xa1ff }]),
    },
    {
      name: 'duplicate',
      archive: zip([
        { name: 'receipt.json', bytes: data },
        { name: 'receipt.json', bytes: data },
      ]),
    },
    {
      name: 'bomb',
      archive: zip([
        {
          name: 'receipt.json',
          bytes: new Uint8Array(BYTE_LIMIT + 1),
          method: 8,
        },
      ]),
    },
    {
      name: 'unknown method',
      archive: zip([{ name: 'receipt.json', bytes: data, method: 99 }]),
    },
  ];
  for (const value of cases)
    await t.test(value.name, async () => {
      await assert.rejects(unpackArchive(value.archive));
    });
  const changed = Buffer.from(zip([{ name: 'receipt.json', bytes: data }]));
  const payloadOffset = 30 + 'receipt.json'.length;
  changed[payloadOffset] = (changed[payloadOffset] ?? 0) ^ 1;
  await assert.rejects(unpackArchive(changed), /INVALID_ZIP/);
});
test('receipt identity and toolchain mutations cannot fabricate the missing third job', async (t) => {
  const f = fixture();
  for (const [key, value] of [
    ['repository', 'other/repo'],
    ['sourceSha', 'd'.repeat(40)],
    ['runId', '999'],
    ['runAttempt', 2],
    ['workflowIdentity', 'other.yml'],
    ['purpose', 'publication-candidate'],
    ['receiptNodeVersion', '22.0.0'],
  ] as const)
    await t.test(key, () => {
      assert.throws(() =>
        normalizeReceipt(
          { ...f.receipt, [key]: value },
          f.archive,
          f.run,
          f.pr,
          f.jobs,
          f.checks,
          f.policy,
        ),
      );
    });
  assert.throws(
    () =>
      normalizeReceipt(
        {
          ...f.receipt,
          observedJobs: [
            ...f.receipt.observedJobs,
            {
              name: 'ci-required',
              state: 'success',
              sourceSha: f.head,
              runId: '123',
            },
          ],
        },
        f.archive,
        f.run,
        f.pr,
        f.jobs,
        f.checks,
        f.policy,
      ),
    /RECEIPT_JOBS/,
  );
  assert.throws(
    () =>
      normalizeReceipt(
        {
          ...f.receipt,
          expectedToolchain: { ...f.receipt.expectedToolchain, bun: 'other' },
        },
        f.archive,
        f.run,
        f.pr,
        f.jobs,
        f.checks,
        f.policy,
      ),
    /TOOLCHAIN_MISMATCH/,
  );
});
test('independent checks, producers and CI hash reject fake names, stale or non-success evidence', async (t) => {
  const f = fixture();
  for (const delta of [
    { app: { id: 999 } },
    { head_sha: 'd'.repeat(40) },
    { check_suite: { id: 999 } },
    ...['failure', 'skipped', 'pending', 'cancelled'].map((conclusion) => ({
      conclusion,
    })),
  ])
    await t.test(JSON.stringify(delta), () => {
      assert.throws(() =>
        normalizeReceipt(
          f.receipt,
          f.archive,
          f.run,
          f.pr,
          f.jobs,
          [{ ...f.checks[0], ...delta }, ...f.checks.slice(1)],
          f.policy,
        ),
      );
    });
  assert.throws(
    () =>
      normalizeReceipt(
        f.receipt,
        f.archive,
        f.run,
        f.pr,
        f.jobs,
        [...f.checks, f.checks[0]],
        f.policy,
      ),
    /CHECK_IDENTITY/,
  );
  await assert.rejects(
    acquireMaintenance(new GitHubApi('x', f.transport), 123, {
      ...f.policy,
      workflowDigest: 'd'.repeat(64),
    }),
    /UNTRUSTED_CI/,
  );
});
test('PR ambiguity, fork, closed state and malformed trusted policy fail before mutation', async (t) => {
  for (const delta of [
    { state: 'closed' },
    {
      head: {
        sha: 'a'.repeat(40),
        ref: 'update',
        repo: { full_name: 'fork/repo' },
      },
    },
  ]) {
    const f = fixture();
    Object.assign(f.pr, delta);
    await t.test(JSON.stringify(delta), async () => {
      await assert.rejects(
        acquireMaintenance(new GitHubApi('x', f.transport), 123, f.policy),
        /PR_REJECTED/,
      );
    });
  }
  const f = fixture();
  f.run.pull_requests.push({ number: 8 });
  await assert.rejects(
    acquireMaintenance(new GitHubApi('x', f.transport), 123, f.policy),
    /AMBIGUOUS_PR/,
  );
  await assert.rejects(
    acquireMaintenance(new GitHubApi('x', f.transport), 123, {
      ...f.policy,
      producerAppId: null,
    }),
  );
  await assert.rejects(
    acquireMaintenance(new GitHubApi('x', f.transport), 123, {
      ...f.policy,
      workflowId: 0,
    }),
  );
});

test('GitHub numeric artifact shards work without credentials while hostile redirects refuse', async (t) => {
  assert.equal(validArchiveHostRule(GITHUB_ARTIFACT_SHARDS), true);
  for (const rule of [
    '*.blob.core.windows.net',
    '*',
    'productionresultssa*.evil.example',
  ])
    assert.equal(validArchiveHostRule(rule), false);
  for (const host of [
    'productionresultssa2.blob.core.windows.net',
    'productionresultssa10.blob.core.windows.net',
    'productionresultssa19.blob.core.windows.net',
    'productionresultssa100.blob.core.windows.net',
  ])
    await t.test(host, async () => {
      const calls: RequestInit[] = [];
      const api = new GitHubApi('private-token', async (url, init) => {
        calls.push(init);
        return new URL(url).hostname === 'api.github.com'
          ? new Response(null, {
              status: 302,
              headers: { location: `https://${host}/artifact?signature=fixed` },
            })
          : new Response('archive');
      });
      assert.equal(
        Buffer.from(
          await api.bytes('/repos/owner/repo/zip', [GITHUB_ARTIFACT_SHARDS]),
        ).toString(),
        'archive',
      );
      assert.equal(calls.length, 2);
      assert.equal(calls[1]?.headers, undefined);
      assert.equal(calls[1]?.redirect, 'error');
    });
  for (const location of [
    'http://productionresultssa2.blob.core.windows.net/x',
    'https://productionresultssa2.blob.core.windows.net.evil.example/x',
    'https://productionresultssax.blob.core.windows.net/x',
    'https://other.blob.core.windows.net/x',
    'https://user:secret@productionresultssa2.blob.core.windows.net/x',
    'https://productionresultssa2.blob.core.windows.net:8443/x',
    'https://productionresultssa2.blob.core.windows.net/x#fragment',
  ])
    await t.test(location, async () => {
      let calls = 0;
      const api = new GitHubApi('private-token', async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location } });
      });
      await assert.rejects(
        api.bytes('/repos/owner/repo/zip', [GITHUB_ARTIFACT_SHARDS]),
        /REDIRECT_REJECTED/,
      );
      assert.equal(calls, 1);
    });
});
