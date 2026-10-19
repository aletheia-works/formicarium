import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { REPOSITORY_DIR } from '../../scripts/common.ts';

const read = (name: string) =>
  readFile(join(REPOSITORY_DIR, '.github', 'workflows', name), 'utf8');
const workflow = await read('showcase-site.yml');
const showcase = await read('showcase.yml');

/** Top-level job blocks by name (two-space keys under `jobs:`). */
function jobs(text: string): Map<string, string> {
  const lines = text.split('\n');
  const result = new Map<string, string>();
  let name: string | null = null;
  let body: string[] = [];
  for (const line of lines.slice(lines.indexOf('jobs:') + 1)) {
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
const table = jobs(workflow);
const field = (job: string, key: string) =>
  new RegExp(`^ {4}${key}: (.+)$`, 'm')
    .exec(table.get(job) ?? '')?.[1]
    ?.trim() ?? null;
const needsOf = (job: string) => {
  const value = field(job, 'needs');
  if (!value) return [];
  return value.startsWith('[')
    ? value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
    : [value];
};
const permissions = (body: string) =>
  /^ {4}permissions:\n((?: {6}.+\n)+)/m.exec(`${body}\n`)?.[1] ?? '';

// ---- a small evaluator for the `if:` expressions of this workflow ----
type Value = string | boolean | null;
interface Context {
  event: string;
  ref: string;
  results: Record<string, string>;
}
function evaluate(expression: string, context: Context): Value {
  const source = expression.replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const tokens =
    source.match(/'[^']*'|==|!=|&&|\|\||!|\(|\)|[\w.-]+\(\)|[\w.-]+/g) ?? [];
  let index = 0;
  const peek = () => tokens[index];
  const next = () => tokens[index++];
  const atom = (): Value => {
    const token = next();
    if (token === '(') {
      const value = or();
      next();
      return value;
    }
    if (token === '!') return !truthy(atom());
    if (token === undefined) throw Error(`unexpected end: ${expression}`);
    if (token.startsWith("'")) return token.slice(1, -1);
    if (token === 'always()') return true;
    if (token === 'cancelled()') return false;
    if (token === 'github.event_name') return context.event;
    if (token === 'github.ref') return context.ref;
    const result = /^needs\.([\w-]+)\.result$/.exec(token);
    if (result) return context.results[result[1]!] ?? null;
    throw Error(`unknown token ${token}`);
  };
  const truthy = (value: Value) =>
    value !== null && value !== false && value !== '';
  const comparison = (): Value => {
    let left = atom();
    while (peek() === '==' || peek() === '!=') {
      const operator = next();
      const right = atom();
      left = operator === '==' ? left === right : left !== right;
    }
    return left;
  };
  const and = (): Value => {
    let left = comparison();
    while (peek() === '&&') {
      next();
      const right = comparison();
      left = truthy(left) ? right : left;
    }
    return left;
  };
  const or = (): Value => {
    let left = and();
    while (peek() === '||') {
      next();
      const right = and();
      left = truthy(left) ? left : right;
    }
    return left;
  };
  const value = or();
  if (index !== tokens.length) throw Error(`trailing tokens in ${expression}`);
  return value;
}

/** Jobs that run for an event when every job that runs succeeds. */
function runs(event: string, ref = 'refs/heads/main'): string[] {
  const results: Record<string, string> = {};
  const ran: string[] = [];
  for (const name of table.keys()) {
    const condition = field(name, 'if');
    const ok = needsOf(name).every((need) => need in results);
    if (!ok) throw Error(`${name} needs a later job`);
    const run =
      condition === null
        ? needsOf(name).every((need) => results[need] === 'success')
        : evaluate(condition, { event, ref, results }) === true ||
          evaluate(condition, { event, ref, results }) === 'distribute';
    results[name] = run ? 'success' : 'skipped';
    if (run) ran.push(name);
  }
  return ran;
}
const ALL = [
  'candidate',
  'fetch-candidate',
  'verify-pack',
  'build',
  'accept-chromium',
  'accept-firefox',
  'accept-webkit',
  'coverage',
  'evidence',
  'deploy',
  'verify-deployment',
  'summary',
];
const VERIFY_RUN = [
  'fetch-candidate',
  'verify-pack',
  'build',
  'accept-chromium',
  'accept-firefox',
  'accept-webkit',
  'coverage',
  'evidence',
  'summary',
];
const DIST =
  "(github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'";

test('triggers: daily at 04:17 UTC, manual, and PR/push on the site paths', () => {
  const head = workflow.slice(0, workflow.indexOf('permissions:'));
  assert.match(head, /schedule:\n {4}- cron: '17 4 \* \* \*'/);
  assert.match(head, /^ {2}workflow_dispatch:$/m);
  assert.match(head, /^ {2}push:\n {4}branches: \[main\]/m);
  for (const path of [
    'showcase/site/**',
    '.github/workflows/showcase-site.yml',
    'showcase/scripts/**',
  ])
    assert.equal(head.split(`- ${path}\n`).length - 1, 2, path);
  assert.deepEqual([...table.keys()], ALL);
});

test('each event runs its jobs, and nothing after build is skipped by mistake', () => {
  assert.deepEqual(
    runs('schedule'),
    ALL.filter((name) => !['fetch-candidate', 'verify-pack'].includes(name)),
  );
  assert.deepEqual(runs('workflow_dispatch'), runs('schedule'));
  assert.deepEqual(runs('workflow_dispatch', 'refs/heads/feature'), VERIFY_RUN);
  assert.deepEqual(runs('pull_request', 'refs/pull/7/merge'), VERIFY_RUN);
  assert.deepEqual(runs('push'), VERIFY_RUN);
});

test('deploy needs every earlier gate and runs only when distributing and all succeeded', () => {
  assert.deepEqual(needsOf('deploy'), [
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
    'coverage',
    'evidence',
  ]);
  const condition = field('deploy', 'if')!;
  assert.ok(condition.startsWith(DIST), condition);
  for (const need of needsOf('deploy'))
    assert.ok(condition.includes(`needs.${need}.result == 'success'`), need);
  const base = Object.fromEntries(
    needsOf('deploy').map((need) => [need, 'success']),
  );
  assert.equal(
    evaluate(condition, {
      event: 'schedule',
      ref: 'refs/heads/main',
      results: base,
    }),
    true,
  );
  for (const need of needsOf('deploy'))
    for (const result of ['failure', 'skipped', 'cancelled'])
      assert.equal(
        evaluate(condition, {
          event: 'schedule',
          ref: 'refs/heads/main',
          results: { ...base, [need]: result },
        }),
        false,
        `${need} ${result}`,
      );
  assert.equal(
    evaluate(condition, {
      event: 'pull_request',
      ref: 'refs/heads/main',
      results: base,
    }),
    false,
  );
  assert.deepEqual(needsOf('coverage'), [
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
  ]);
  assert.equal(
    evaluate(field('build', 'if')!, {
      event: 'push',
      ref: 'refs/heads/main',
      results: {
        candidate: 'skipped',
        'fetch-candidate': 'success',
        'verify-pack': 'failure',
      },
    }),
    false,
  );
});

test('pages write, id-token write and deploy-pages exist only in the deploy job', () => {
  for (const [name, body] of table) {
    const block = permissions(body);
    if (name === 'deploy')
      assert.equal(
        block,
        '      contents: read\n      pages: write\n      id-token: write\n      actions: read\n',
      );
    else assert.doesNotMatch(block, /write/, name);
    assert.equal(
      body.includes('actions/deploy-pages@'),
      name === 'deploy',
      name,
    );
  }
  assert.match(workflow, /^permissions:\n {2}contents: read\n(?=\S)/m);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(table.get('deploy')!, /environment:\n {6}name: github-pages/);
  assert.match(
    table.get('deploy')!,
    /concurrency:\n {6}group: showcase-site-pages\n {6}cancel-in-progress: false/,
  );
  const steps = table.get('deploy')!;
  assert.ok(
    steps.indexOf('deploy-guard.ts') < steps.indexOf('inventory.ts --site'),
  );
  assert.ok(
    steps.indexOf('inventory.ts --site') <
      steps.indexOf('actions/deploy-pages@'),
  );
  assert.ok(
    steps.indexOf('actions/deploy-pages@') <
      steps.indexOf('evidence.ts --stage deployed'),
  );
});

test("the candidate job holds every permission showcase.yml's jobs ask for", () => {
  const asked = new Set<string>(['contents: read']);
  for (const body of jobs(showcase).values())
    for (const line of permissions(body).split('\n'))
      if (line.trim()) asked.add(line.trim());
  const granted = new Set(
    permissions(table.get('candidate')!)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  for (const permission of asked)
    assert.ok(granted.has(permission), permission);
  assert.match(
    table.get('candidate')!,
    /uses: \.\/\.github\/workflows\/showcase\.yml\n {4}with:\n {6}mode: distribute/,
  );
});

test('PR and push runs never call showcase.yml and never deploy; summary fails only when distributing', () => {
  for (const event of ['pull_request', 'push']) {
    const ran = runs(event);
    assert.ok(!ran.includes('candidate') && !ran.includes('deploy'), event);
  }
  const summary = table.get('summary')!;
  assert.equal(field('summary', 'if'), 'always()');
  assert.deepEqual(needsOf('summary'), ALL.slice(0, -1));
  const dist = /SHOWCASE_DIST: \$\{\{ (.+) \}\}/.exec(summary)?.[1];
  assert.equal(dist, DIST);
  assert.equal(
    evaluate(dist!, {
      event: 'pull_request',
      ref: 'refs/heads/main',
      results: {},
    }),
    false,
  );
  assert.equal(
    evaluate(dist!, { event: 'schedule', ref: 'refs/heads/main', results: {} }),
    true,
  );
  assert.match(summary, /SHOWCASE_NEEDS: \$\{\{ toJSON\(needs\) \}\}/);
});

test('timeouts, pinned actions, credentials and artifacts follow the infrastructure design', () => {
  const timeouts = Object.fromEntries(
    [...table.keys()]
      .filter((name) => name !== 'candidate')
      .map((name) => [name, Number(field(name, 'timeout-minutes'))]),
  );
  assert.deepEqual(timeouts, {
    'fetch-candidate': 10,
    'verify-pack': 30,
    build: 30,
    'accept-chromium': 60,
    'accept-firefox': 60,
    'accept-webkit': 60,
    coverage: 15,
    evidence: 10,
    deploy: 15,
    'verify-deployment': 15,
    summary: 5,
  });
  for (const [, action, ref, version] of workflow.matchAll(
    /uses: ([\w./-]+)@(\S+)(?: # (\S+))?/g,
  )) {
    assert.match(ref!, /^[a-f0-9]{40}$/, String(action));
    assert.ok(version, String(action));
  }
  assert.match(
    workflow,
    /actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5\.0\.0\n {8}with:\n {10}path: showcase\/site\/dist\n {10}retention-days: 7\n {10}include-hidden-files: true/,
  );
  assert.match(
    workflow,
    /actions\/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5\.0\.1/,
  );
  const checkouts = workflow.split('uses: actions/checkout@').slice(1);
  assert.equal(checkouts.length, 11);
  for (const checkout of checkouts)
    assert.match(
      checkout.split('\n      - ')[0]!,
      /persist-credentials: false/,
    );
  const runId = ['$', '{{ github.run_id }}'].join('');
  for (const name of [
    `showcase-site-evidence-${runId}`,
    `showcase-site-evidence-${runId}-deployed`,
  ])
    assert.ok(
      workflow.includes(`name: ${name}\n          retention-days: 90`),
      name,
    );
  assert.match(
    table.get('build')!,
    /bun install --frozen-lockfile --ignore-scripts/,
  );
});

test('showcase.yml skips site-only changes on PR and push', () => {
  const head = showcase.slice(0, showcase.indexOf('permissions:'));
  assert.equal(head.split("- '!showcase/site/**'\n").length - 1, 2);
});
