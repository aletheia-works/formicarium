import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(await readFile('.github/workflows/publish.yml', 'utf8'));
const sha = 'a'.repeat(40);
const head = 'b'.repeat(40);
const repo = 'aletheia-works/formicarium';
const pr = {
  number: 22,
  merged_at: '2026-10-11T00:00:00Z',
  merge_commit_sha: sha,
  base: { ref: 'main', repo: { full_name: repo } },
  head: {
    ref: 'release-please--branches--main--components--formicarium',
    sha: head,
    repo: { full_name: repo },
  },
  user: { login: 'aletheia-works-bot[bot]' },
};
const run = {
  head_sha: head,
  workflow_id: 123,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
};

test('actual YAML authorizes only the exact merged Bot release with successful head CI', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'formicarium-auto-release-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });
  const bin = join(root, 'bin');
  await mkdir(bin);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: '0.2.1' }),
  );
  await writeFile(
    join(bin, 'gh'),
    `#!${process.execPath}\nconst fs=require('node:fs');const endpoint=process.argv[3];const fixture=JSON.parse(fs.readFileSync(process.env.API_FIXTURE,'utf8'));if(process.argv.includes('--jq')) { console.log(123); process.exit(0); } console.log(JSON.stringify(endpoint.includes('/commits/') ? fixture.prs : endpoint.includes('/runs?') ? {workflow_runs:fixture.runs} : {id:123}));`,
    { mode: 0o755 },
  );
  const command = workflow.jobs.authorize.steps.at(-1).run;
  const check = async (prs: unknown[], runs: unknown[], tag = 'v0.2.1') => {
    await writeFile(join(root, 'api.json'), JSON.stringify({ prs, runs }));
    return spawnSync('bash', ['-euo', 'pipefail', '-c', command], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        API_FIXTURE: join(root, 'api.json'),
        RUNNER_TEMP: root,
        GITHUB_STEP_SUMMARY: join(root, 'summary'),
        GITHUB_REPOSITORY: repo,
        SOURCE_SHA: sha,
        RELEASE_TAG: tag,
      },
    }).status;
  };
  assert.equal(await check([pr], [run]), 0);
  for (const mutation of [
    { merge_commit_sha: head },
    { merged_at: null },
    { user: { login: 'someone' } },
    { base: { ...pr.base, ref: 'other' } },
    { head: { ...pr.head, ref: 'manual', repo: { full_name: 'fork/repo' } } },
  ])
    assert.notEqual(await check([{ ...pr, ...mutation }], [run]), 0);
  for (const mutation of [
    { head_sha: sha },
    { workflow_id: 456 },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { status: 'in_progress' },
    { event: 'workflow_dispatch' },
  ])
    assert.notEqual(await check([pr], [{ ...run, ...mutation }]), 0);
  assert.notEqual(
    await check(
      [pr],
      [
        { ...run, run_number: 1, run_attempt: 1 },
        { ...run, run_number: 1, run_attempt: 2, conclusion: 'failure' },
      ],
    ),
    0,
  );
  assert.notEqual(await check([], [run]), 0);
  assert.notEqual(await check([pr, pr], [run]), 0);
  assert.notEqual(await check([pr], [], 'v0.2.1-rc.1'), 0);
  assert.notEqual(await check([pr], [run], 'v0.2.0'), 0);
});

test('registry recovery skips identical bytes and refuses mismatches and lookup failures', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'formicarium-registry-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });
  const script = workflow.jobs.publish.steps
    .find((s: any) => s.id === 'registry')
    .run.split("<<'JS'\n")[1]
    .replace(/\nJS\s*$/, '');
  const bytes = 'verified candidate';
  const digest = createHash('sha256').update(bytes).digest('hex');
  const check = async (
    status: number,
    body: string,
    metadata: any = {
      name: '@aletheia-works/formicarium',
      version: '0.2.1',
      dist: { tarball: 'https://registry.npmjs.org/package.tgz' },
    },
  ) => {
    const output = join(root, `result-${Math.random()}`);
    const stub = `globalThis.fetch=async url=>String(url).endsWith('/0.2.1') ? new Response(JSON.stringify(${JSON.stringify(metadata)}),{status:${status}}) : new Response(${JSON.stringify(body)});\n`;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', stub + script],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          VERSION: '0.2.1',
          EXPECTED_SHA256: digest,
          GITHUB_OUTPUT: output,
        },
      },
    );
    return {
      status: result.status,
      output: await readFile(output, 'utf8').catch(() => ''),
      error: result.stderr,
    };
  };
  assert.deepEqual((await check(404, '')).output, 'skip=false\n');
  assert.deepEqual((await check(200, bytes)).output, 'skip=true\n');
  for (const [status, body] of [
    [500, ''],
    [200, 'altered'],
  ] as const) {
    const r = await check(status, body);
    assert.notEqual(r.status, 0);
    assert.equal(r.output, '');
  }
  assert.notEqual(
    (
      await check(200, bytes, {
        name: 'other',
        version: '0.2.1',
        dist: { tarball: 'https://untrusted.example/package.tgz' },
      })
    ).status,
    0,
  );
});

test('source CI, measured package and writers form a same-run dependency chain', async () => {
  const ci = parse(await readFile('.github/workflows/ci.yml', 'utf8'));
  const candidate = parse(
    await readFile('.github/workflows/release-candidate.yml', 'utf8'),
  );
  assert.equal(workflow.jobs.verify.uses, './.github/workflows/ci.yml');
  assert.equal(workflow.jobs.verify.needs, 'authorize');
  assert.equal(workflow.jobs.publish.needs, 'verify');
  assert.deepEqual(workflow.jobs.release.needs, ['verify', 'publish']);
  assert.equal(
    ci.on.workflow_call.outputs['candidate-sha256'].value,
    '${{ jobs.release-candidate.outputs.sha256 }}',
  );
  const exportStep = candidate.jobs.verify.steps.find(
    (s: any) => s.id === 'candidate',
  );
  assert.ok(
    candidate.jobs.verify.steps.findIndex(
      (s: any) => s.name === 'Run regression and fixed-inventory coverage',
    ) < candidate.jobs.verify.steps.indexOf(exportStep),
  );
  assert.match(exportStep.run, /coverage.lines.pct < 80/);
  assert.match(exportStep.run, /coverage.files.length !== 23/);
  assert.equal(exportStep.if, undefined);
  assert.equal(
    workflow.jobs.publish.steps.at(-1).if,
    "steps.registry.outputs.skip == 'false'",
  );
  assert.doesNotMatch(
    JSON.stringify(workflow),
    /FORMICARIUM_RELEASE_INPUT|rcAdoption|humanInput|NPM_TOKEN/,
  );
});

test('actual candidate export refuses changed bytes, failed checks and insufficient coverage before outputs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'formicarium-candidate-output-'));
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });
  const candidateWorkflow = parse(
    await readFile('.github/workflows/release-candidate.yml', 'utf8'),
  );
  const script = candidateWorkflow.jobs.verify.steps
    .find((s: any) => s.id === 'candidate')
    .run.split("<<'JS'\n")[1]
    .replace(/\nJS\s*$/, '');
  const dir = join(root, '.artifacts/release-candidate');
  await mkdir(dir, { recursive: true });
  const checks = join(root, '.artifacts/ci-results');
  await mkdir(checks, { recursive: true });
  const bytes = 'exact candidate';
  await writeFile(join(dir, 'candidate.tgz'), bytes);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const candidate = {
    identity: { sourceCommit: sha, version: '0.2.1', distTag: 'latest' },
    tarball: { sha256: digest },
  };
  const acceptance = {
    passed: true,
    context: { commit: sha },
    checks: [{ exitCode: 0, timedOut: false, skipped: 0 }],
    coverage: { lines: { pct: 80.16 }, files: Array(23).fill({}) },
  };
  const check = async (c: any, a: any) => {
    await writeFile(join(dir, 'candidate.json'), JSON.stringify(c));
    await writeFile(join(checks, 'acceptance.json'), JSON.stringify(a));
    const output = join(root, `output-${Math.random()}`);
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, SOURCE_SHA: sha, GITHUB_OUTPUT: output },
      },
    );
    return {
      status: result.status,
      output: await readFile(output, 'utf8').catch(() => ''),
      error: result.stderr,
    };
  };
  const ok = await check(candidate, acceptance);
  assert.equal(ok.status, 0, ok.error);
  assert.match(ok.output, /dist-tag=latest/);
  for (const bad of [
    { ...acceptance, passed: false },
    { ...acceptance, context: { commit: head } },
    { ...acceptance, checks: [{ exitCode: 1 }] },
    {
      ...acceptance,
      coverage: { ...acceptance.coverage, lines: { pct: 79.9 } },
    },
    {
      ...acceptance,
      coverage: { ...acceptance.coverage, files: Array(22).fill({}) },
    },
  ]) {
    const r = await check(candidate, bad);
    assert.notEqual(r.status, 0);
    assert.equal(r.output, '');
  }
  const changed = await check(
    { ...candidate, tarball: { sha256: 'f'.repeat(64) } },
    acceptance,
  );
  assert.notEqual(changed.status, 0);
  assert.equal(changed.output, '');
});
