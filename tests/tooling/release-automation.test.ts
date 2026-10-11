import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

const workflow = (name: string) =>
  parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

test('release automation is restricted to upstream main and explicit enablement', () => {
  for (const name of ['release', 'release-merge']) {
    const w = workflow(name);
    const job = Object.values(w.jobs)[0] as any;
    assert.match(job.if, /github.repository == 'aletheia-works\/formicarium'/);
    assert.match(job.if, /github.ref == 'refs\/heads\/main'/);
    assert.match(job.if, /vars.RELEASE_AUTOMATION_ENABLED == 'true'/);
    assert.deepEqual(w.permissions, { contents: 'read' });
    assert.equal(w.concurrency['cancel-in-progress'], false);
    const token = job.steps.find((s: any) => s.id === 'app-token');
    assert.match(token.uses, /^actions\/create-github-app-token@[a-f0-9]{40}$/);
    assert.equal(token.with['permission-contents'], 'write');
  }
});

test('weekly merge selects the current bot PR and preserves branch protection', () => {
  const w = workflow('release-merge');
  assert.deepEqual(w.on.schedule, [{ cron: '23 0 * * 1' }]);
  assert.match(w.jobs.merge.if, /WEEKLY_RELEASE_MERGE_ENABLED == 'true'/);
  const command = w.jobs.merge.steps.at(-1).run;
  for (const pattern of [
    /release-please--branches--main--components--formicarium/,
    /app\/aletheia-works-bot/,
    /isCrossRepository == false/,
    /isDraft == false/,
    /count.*-ne 1/,
    /--squash --auto --match-head-commit/,
  ])
    assert.match(command, pattern);
  assert.doesNotMatch(command, /--admin/);
});

test('release baseline follows the published stable version and updates root version', () => {
  const config = JSON.parse(
    readFileSync('.github/release-please-config.json', 'utf8'),
  );
  const manifest = JSON.parse(
    readFileSync('.github/release-please-manifest.json', 'utf8'),
  );
  assert.match(manifest['.'], /^\d+\.\d+\.\d+$/);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, manifest['.']);
  assert.equal(existsSync('version.txt'), false);
  assert.equal(config.packages['.']['release-type'], 'node');
  assert.equal(config.packages['.'].component, 'formicarium');
  assert.equal(config.packages['.']['include-component-in-tag'], false);
  assert.equal(config.packages['.']['extra-files'], undefined);
});
