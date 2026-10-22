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
  // Biome writes a long flow sequence over several lines under `needs:`.
  const value =
    field(job, 'needs') ??
    /^ {4}needs:\n((?: {6}.+\n)+)/m
      .exec(`${table.get(job) ?? ''}\n`)?.[1]
      ?.replace(/\s+/g, '')
      .replace(/,\]$/, ']') ??
    null;
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
  /** `needs.<job>.outputs.<name>` values, as `<job>.<name>`. */
  outputs?: Record<string, string>;
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
    const output = /^needs\.([\w-]+)\.outputs\.([\w-]+)$/.exec(token);
    if (output) return context.outputs?.[`${output[1]!}.${output[2]!}`] ?? null;
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

/** Every job a job needs, directly or through the jobs it needs. */
function ancestors(name: string, seen = new Set<string>()): Set<string> {
  for (const need of needsOf(name))
    if (!seen.has(need)) {
      seen.add(need);
      ancestors(need, seen);
    }
  return seen;
}
const STATUS_FUNCTION = /\b(?:always|cancelled|success|failure)\(\)/;

/**
 * Jobs that run for an event when every job that runs succeeds. As on
 * GitHub, a condition without a status function also needs `success()`:
 * every ancestor job, not only the direct needs, must have succeeded.
 */
function runs(event: string, ref = 'refs/heads/main', site = 'true'): string[] {
  const results: Record<string, string> = {};
  const outputs = { 'changes.site': site };
  const ran: string[] = [];
  for (const name of table.keys()) {
    const condition = field(name, 'if');
    const ok = needsOf(name).every((need) => need in results);
    if (!ok) throw Error(`${name} needs a later job`);
    const succeeded = [...ancestors(name)].every(
      (need) => results[need] === 'success',
    );
    const value =
      condition === null
        ? true
        : evaluate(condition, { event, ref, results, outputs });
    const run =
      (condition === null || !STATUS_FUNCTION.test(condition)
        ? succeeded
        : true) &&
      (value === true || value === 'distribute');
    results[name] = run ? 'success' : 'skipped';
    if (run) ran.push(name);
  }
  return ran;
}
const ALL = [
  'changes',
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
  'required',
];
const VERIFY_RUN = [
  'changes',
  'fetch-candidate',
  'verify-pack',
  'build',
  'accept-chromium',
  'accept-firefox',
  'accept-webkit',
  'coverage',
  'evidence',
  'summary',
  'required',
];
const DIST =
  "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'";

test('triggers: manual, every PR, and push on the site paths; no schedule', () => {
  const head = workflow.slice(0, workflow.indexOf('permissions:'));
  assert.doesNotMatch(head, /schedule:|cron:/);
  assert.match(head, /^ {2}workflow_dispatch:$/m);
  assert.match(head, /^ {2}pull_request:\n {2}push:\n {4}branches: \[main\]/m);
  for (const path of [
    'showcase/site/**',
    '.github/workflows/showcase-site.yml',
    'showcase/scripts/**',
  ])
    assert.equal(head.split(`- ${path}\n`).length - 1, 1, path);
  // On a PR the changes job matches the same three paths and the showcase inputs
  // the site build reads (tools.json, fixtures, b1-pack.json).
  assert.ok(
    table
      .get('changes')!
      .includes(
        "grep -qE '^(showcase/site/|showcase/scripts/|showcase/fixtures/|showcase/tools\\.json$|showcase/b1-pack\\.json$|\\.github/workflows/showcase-site\\.yml$)'",
      ),
  );
  assert.deepEqual([...table.keys()], ALL);
});

test('each event runs its jobs, and nothing after build is skipped by mistake', () => {
  assert.deepEqual(
    runs('push'),
    ALL.filter((name) => !['fetch-candidate', 'verify-pack'].includes(name)),
  );
  assert.deepEqual(runs('workflow_dispatch'), runs('push'));
  assert.deepEqual(runs('workflow_dispatch', 'refs/heads/feature'), VERIFY_RUN);
  assert.deepEqual(runs('pull_request', 'refs/pull/7/merge'), VERIFY_RUN);
  // A schedule is not a trigger any more; were one added, it would not deploy.
  assert.deepEqual(runs('schedule'), VERIFY_RUN);
  assert.deepEqual(runs('pull_request', 'refs/pull/7/merge', 'false'), [
    'changes',
    'summary',
    'required',
  ]);
});

test('every job after the entry jobs has a status function, so the other path cannot skip it', () => {
  for (const name of ALL.filter(
    (job) =>
      !['changes', 'candidate', 'fetch-candidate', 'verify-pack'].includes(job),
  ))
    assert.match(field(name, 'if') ?? '', STATUS_FUNCTION, name);
  for (const name of ['fetch-candidate', 'verify-pack']) {
    assert.deepEqual(needsOf(name), ['changes']);
    assert.ok(
      field(name, 'if')!.includes("needs.changes.outputs.site == 'true'"),
      name,
    );
  }
  assert.match(
    table.get('changes')!,
    /permissions:\n {6}contents: read\n {6}pull-requests: read\n/,
  );
});

test('showcase-site-required needs every job but the summary and always reports', () => {
  assert.equal(field('required', 'name'), 'showcase-site-required');
  assert.equal(field('required', 'if'), 'always()');
  assert.deepEqual(
    needsOf('required'),
    ALL.filter((name) => !['summary', 'required'].includes(name)),
  );
  const body = table.get('required')!;
  assert.equal(/SHOWCASE_DIST: \$\{\{ (.+) \}\}/.exec(body)?.[1], DIST);
  assert.match(
    body,
    /SHOWCASE_SITE: \$\{\{ needs\.changes\.outputs\.site \}\}/,
  );
  assert.match(body, /SHOWCASE_NEEDS: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(body, /node showcase\/site\/scripts\/summary\.ts --required/);
});

test('deploy needs every earlier gate and runs only when distributing and all succeeded', () => {
  assert.deepEqual(needsOf('deploy'), [
    'candidate',
    'build',
    'accept-chromium',
    'accept-firefox',
    'accept-webkit',
    'coverage',
    'evidence',
  ]);
  const condition = field('deploy', 'if')!;
  assert.ok(condition.startsWith(`\${{ !cancelled() && ${DIST}`), condition);
  for (const need of needsOf('deploy'))
    assert.ok(condition.includes(`needs.${need}.result == 'success'`), need);
  const base = Object.fromEntries(
    needsOf('deploy').map((need) => [need, 'success']),
  );
  assert.equal(
    evaluate(condition, {
      event: 'push',
      ref: 'refs/heads/main',
      results: base,
    }),
    true,
  );
  for (const need of needsOf('deploy'))
    for (const result of ['failure', 'skipped', 'cancelled'])
      assert.equal(
        evaluate(condition, {
          event: 'push',
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
      event: 'pull_request',
      ref: 'refs/pull/7/merge',
      results: {
        candidate: 'skipped',
        'fetch-candidate': 'success',
        'verify-pack': 'failure',
      },
    }),
    false,
  );
});

test('a distribute run whose candidate did not succeed never deploys', () => {
  const condition = field('deploy', 'if')!;
  const others = Object.fromEntries(
    needsOf('deploy')
      .filter((need) => need !== 'candidate')
      .map((need) => [need, 'success']),
  );
  for (const event of ['push', 'workflow_dispatch'])
    for (const candidate of ['skipped', 'failure', 'cancelled'])
      assert.equal(
        evaluate(condition, {
          event,
          ref: 'refs/heads/main',
          results: { ...others, candidate },
        }),
        false,
        `${event} ${candidate}`,
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

test('PR runs and manual runs of another branch never call showcase.yml and never deploy', () => {
  for (const [event, ref] of [
    ['pull_request', 'refs/pull/7/merge'],
    ['workflow_dispatch', 'refs/heads/feature'],
  ] as const) {
    const ran = runs(event, ref);
    assert.ok(!ran.includes('candidate') && !ran.includes('deploy'), event);
  }
  const summary = table.get('summary')!;
  assert.equal(field('summary', 'if'), 'always()');
  assert.deepEqual(needsOf('summary'), ALL.slice(0, -2));
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
    evaluate(dist!, { event: 'push', ref: 'refs/heads/main', results: {} }),
    true,
  );
  assert.equal(
    evaluate(dist!, { event: 'schedule', ref: 'refs/heads/main', results: {} }),
    false,
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
    changes: 5,
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
    required: 5,
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
  assert.equal(checkouts.length, 12);
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
