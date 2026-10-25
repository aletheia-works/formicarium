import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { readConfigFile, validateTrustedCallers } from '../scripts/config.ts';
import { REPOSITORY_ROOT } from '../scripts/paths.ts';

const workflow = await readFile(
  join(REPOSITORY_ROOT, '.github', 'workflows', 'showcase.yml'),
  'utf8',
);
const ci = await readFile(
  join(REPOSITORY_ROOT, '.github', 'workflows', 'ci.yml'),
  'utf8',
);
const lines = workflow.split('\n');

/** Top-level job blocks keyed by name (two-space indented keys under jobs:). */
function jobs(): Map<string, string> {
  const result = new Map<string, string>();
  const start = lines.indexOf('jobs:');
  let name: string | null = null;
  let body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}([a-z-]+):$/.exec(line);
    if (match) {
      if (name) result.set(name, body.join('\n'));
      name = match[1]!;
      body = [];
    } else body.push(line);
  }
  if (name) result.set(name, body.join('\n'));
  return result;
}
/** Steps of one job, split at each `      - ` list item. */
const steps = (job: string) =>
  job.split(/\n(?= {6}- )/).filter((step) => step.trimStart().startsWith('- '));

test('triggers: PR and main push on showcase or public API paths, manual run, showcase-site call', () => {
  const head = workflow.slice(0, workflow.indexOf('permissions:'));
  for (const path of [
    'showcase/**',
    '.github/workflows/showcase.yml',
    'runtime/**',
    'types/**',
    'package.json',
  ])
    assert.equal(head.split(`- ${path}\n`).length - 1, 2, path);
  assert.match(head, /^ {2}push:\n {4}branches: \[main\]/m);
  assert.match(head, /^ {2}workflow_dispatch:\n {2}workflow_call:/m);
  assert.match(head, /mode:\n[\s\S]*?default: verify/);
  assert.doesNotMatch(head, /schedule:/);
  assert.match(
    head,
    /candidate-id:[\s\S]*jobs\.candidate\.outputs\.candidate-id/,
  );
});

test('permissions are read-only; only acquire, catalog and candidate read actions', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read\n(?=\S)/m);
  assert.doesNotMatch(workflow, /:\s*write\b/);
  assert.doesNotMatch(workflow, /secrets\./);
  const table = jobs();
  assert.deepEqual(
    [...table.keys()],
    ['resolve', 'acquire', 'catalog', 'accept', 'accept-safari', 'candidate'],
  );
  for (const [name, body] of table) {
    const block =
      /^ {4}permissions:\n((?: {6}.+\n)+)/m.exec(`${body}\n`)?.[1] ?? '';
    const expected = ['acquire', 'catalog', 'candidate'].includes(name)
      ? '      contents: read\n      actions: read\n'
      : '';
    assert.equal(block, expected, name);
  }
});

test('job timeouts follow the infrastructure design', () => {
  const timeouts = Object.fromEntries(
    [...jobs()].map(([name, body]) => [
      name,
      Number(/timeout-minutes: (\d+)/.exec(body)?.[1]),
    ]),
  );
  assert.deepEqual(timeouts, {
    resolve: 10,
    acquire: 180,
    catalog: 15,
    accept: 60,
    'accept-safari': 60,
    candidate: 10,
  });
});

test('actions are pinned by commit SHA and match the versions ci.yml uses', () => {
  const uses = [...workflow.matchAll(/uses: ([\w./-]+)@(\S+)(?: # (\S+))?/g)];
  assert.ok(uses.length > 10);
  for (const [, action, ref, version] of uses) {
    assert.match(ref!, /^[a-f0-9]{40}$/, action ?? 'unknown action');
    assert.ok(version, `${action} carries its version comment`);
  }
  for (const action of [
    'actions/checkout',
    'actions/setup-node',
    'oven-sh/setup-bun',
    'actions/upload-artifact',
  ]) {
    const ours = new Set(
      uses.filter((use) => use[1] === action).map((use) => use[2]),
    );
    const theirs = new Set(
      [
        ...ci.matchAll(new RegExp(`uses: ["']?${action}@([a-f0-9]{40})`, 'g')),
      ].map((match) => match[1]),
    );
    assert.equal(ours.size, 1, action);
    assert.deepEqual(ours, theirs, action);
  }
});

test('every checkout keeps credentials out of the workspace', () => {
  const checkouts = workflow.split('uses: actions/checkout@').slice(1);
  assert.equal(checkouts.length, 6);
  for (const checkout of checkouts)
    assert.match(
      checkout.split('\n      - ')[0]!,
      /persist-credentials: false/,
    );
});

test('the source build step gets no token and runs after reuse lookup', () => {
  const acquire = steps(jobs().get('acquire')!);
  const index = acquire.findIndex((step) => step.includes('build.ts compile'));
  assert.ok(index > 0);
  assert.doesNotMatch(
    acquire[index]!,
    /GITHUB_TOKEN|github\.token|secrets\.|env:/,
  );
  assert.ok(acquire.findIndex((step) => step.includes('reuse.ts')) < index);
  for (const step of acquire.filter((item) => /GITHUB_TOKEN/.test(item)))
    assert.match(step, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
});

test('PR runs cancel older revisions only; the candidate is uploaded once at the end', () => {
  assert.match(
    workflow,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
  );
  assert.match(
    workflow,
    /group: showcase-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.run_id \}\}/,
  );
  assert.equal(workflow.split('name: showcase-candidate').length - 1, 1);
  const candidate = steps(jobs().get('candidate')!);
  assert.match(candidate.at(-1)!, /name: showcase-candidate/);
  assert.doesNotMatch(candidate.at(-1)!, /if: always\(\)/);
  for (const name of [
    'resolve',
    'acquired',
    'site',
    'acceptance',
    'acceptance-safari',
  ])
    assert.match(
      workflow,
      new RegExp(`name: showcase-work-${name}\\n {10}retention-days: 1`),
    );
});

test('real Safari accepts on macOS, trusts only the job CA and gates the candidate', () => {
  const table = jobs();
  const safari = table.get('accept-safari')!;
  assert.match(safari, /^ {4}runs-on: macos-latest$/m);
  assert.match(safari, /node showcase\/tests\/accept-safari\.ts/);
  // Safari verifies TLS: the job CA is trusted, never acceptInsecureCerts.
  assert.match(safari, /add-trusted-cert -d -r trustRoot/);
  assert.match(
    safari,
    /verify-cert -c "\$SHOWCASE_TLS_CERT" -p ssl -s localhost/,
  );
  const list = steps(safari);
  const cleanup = list.find((step) => step.includes('remove-trusted-cert'));
  assert.ok(cleanup);
  assert.match(cleanup, /if: always\(\)/);
  assert.match(cleanup, /delete-certificate -c formicarium-showcase-job-ca/);
  assert.ok(
    list.indexOf(cleanup) >
      list.findIndex((step) => step.includes('accept-safari.ts')),
  );
  const candidate = table.get('candidate')!;
  assert.match(candidate, /needs: \[[^\]]*\baccept-safari\b/);
  assert.match(
    candidate,
    /name: showcase-work-acceptance-safari\n {10}path: showcase\/\.work\/acceptance\n/,
  );
});

test('the showcase CI does not copy the heavy body regressions', () => {
  for (const heavy of [
    'test-light',
    'test:browser',
    'probe',
    'migration-install',
    'migration-command',
    'coverage-80',
  ])
    assert.doesNotMatch(
      workflow,
      new RegExp(heavy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
});

/** The job blocks of a workflow text whose jobs call showcase.yml in distribute mode. */
function distributeCallers(text: string): string[] {
  const body = text.slice(text.indexOf('\njobs:\n'));
  return body
    .split(/\n(?= {2}[a-z][a-z0-9-]*:\n)/)
    .filter((job) =>
      /\n {4}uses: \.\/\.github\/workflows\/showcase\.yml\n {4}with:\n {6}mode: distribute\n/.test(
        `${job}\n`,
      ),
    );
}
test("trusted-callers' distributeCaller exists and calls showcase.yml in distribute mode", async () => {
  const trusted = validateTrustedCallers(
    await readConfigFile('trusted-callers.json'),
  );
  const caller = await readFile(
    join(REPOSITORY_ROOT, trusted.distributeCaller),
    'utf8',
  );
  assert.equal(distributeCallers(caller).length, 1);
  // The caller must be listed for reuse too, and the check must catch drift.
  assert.ok(trusted.reuseWorkflows.includes(trusted.distributeCaller));
  const job = (uses: string, mode: string) =>
    `name: x\njobs:\n  candidate:\n    uses: ${uses}\n    with:\n      mode: ${mode}\n`;
  assert.equal(
    distributeCallers(job('./.github/workflows/showcase.yml', 'distribute'))
      .length,
    1,
  );
  assert.equal(
    distributeCallers(job('./.github/workflows/other.yml', 'distribute'))
      .length,
    0,
  );
  assert.equal(
    distributeCallers(job('./.github/workflows/showcase.yml', 'verify')).length,
    0,
  );
});
