import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import type { WorkflowJob } from '../../scripts/release/workflow.js';

const workflow = (name: string) =>
  parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

test('release automation is restricted to upstream main and explicit enablement', () => {
  for (const name of ['release', 'release-merge']) {
    const w = workflow(name);
    const job = Object.values(w.jobs)[0] as WorkflowJob;
    assert.match(
      job.if ?? '',
      /github.repository == 'aletheia-works\/formicarium'/,
    );
    assert.match(job.if ?? '', /github.ref == 'refs\/heads\/main'/);
    assert.match(job.if ?? '', /vars.RELEASE_AUTOMATION_ENABLED == 'true'/);
    assert.deepEqual(w.permissions, { contents: 'read' });
    assert.equal(w.concurrency['cancel-in-progress'], false);
    const token = job.steps.find((s) => s.id === 'app-token');
    assert.match(
      token?.uses ?? '',
      /^actions\/create-github-app-token@[a-f0-9]{40}$/,
    );
    assert.equal(token?.with?.['permission-contents'], 'write');
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
  // JSR reads its version from jsr.json, so the release PR bumps it too.
  assert.deepEqual(config.packages['.']['extra-files'], [
    { type: 'json', path: 'jsr.json', jsonpath: '$.version' },
  ]);
});

test('jsr.json publishes the npm package as it is, with the same entries and version', async () => {
  const { PACKAGE_FILES } = (await import(
    pathToFileURL(resolve(process.cwd(), 'scripts/package/stage-package.js'))
      .href
  )) as typeof import('../../scripts/package/stage-package.js');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const jsr = JSON.parse(readFileSync('jsr.json', 'utf8'));
  assert.deepEqual(Object.keys(jsr).sort(), [
    'exports',
    'license',
    'name',
    'publish',
    'version',
  ]);
  assert.equal(jsr.name, pkg.name);
  assert.equal(jsr.version, pkg.version);
  assert.equal(jsr.license, pkg.license);
  // JSR exports only modules; the core assets are files beside them.
  assert.deepEqual(jsr.exports, {
    '.': pkg.exports['.'].import,
    './node': pkg.exports['./node'].import,
    './browser': pkg.exports['./browser'].import,
  });
  // The JSR job publishes the verified npm tarball's files, which hold
  // jsr.json; package.json stays npm's.
  assert.ok(PACKAGE_FILES.includes('jsr.json'));
  assert.deepEqual(jsr.publish, {
    include: PACKAGE_FILES.filter((path) => path !== 'package.json'),
  });
  // Each emitted entry names its declarations, so JSR needs no slow-type
  // analysis. tsc keeps the comment only as a header apart from the imports.
  for (const entry of ['.', './node', './browser']) {
    const source = readFileSync(pkg.exports[entry].import, 'utf8');
    const types = source.match(/^\/\/ @ts-self-types="([^"]+)"$/m)?.[1];
    assert.equal(
      types &&
        new URL(types, `file:///${pkg.exports[entry].import.slice(2)}`)
          .pathname,
      `/${pkg.exports[entry].types.slice(2)}`,
      entry,
    );
  }
});

test('release notes live in the GitHub release, not in a CHANGELOG.md', () => {
  const config = JSON.parse(
    readFileSync('.github/release-please-config.json', 'utf8'),
  );
  assert.equal(config.packages['.']['skip-changelog'], true);
  assert.equal(existsSync('CHANGELOG.md'), false);
});

test('commits that touch only the showcase do not propose a package release', () => {
  const config = JSON.parse(
    readFileSync('.github/release-please-config.json', 'utf8'),
  );
  const excluded: string[] = config.packages['.']['exclude-paths'];
  // The showcase site and its tasks ship apart from the npm package.
  assert.deepEqual(excluded, [
    'showcase',
    'mise-tasks/showcase',
    'mise-tasks/showcase-site',
  ]);
  // release-please matches an entry only as a directory prefix (`<path>/`),
  // so a file entry would never exclude anything.
  for (const path of excluded)
    assert.ok(statSync(path).isDirectory(), `${path} is not a directory`);
  // Nothing the package ships is excluded.
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const file of pkg.files as string[])
    assert.ok(
      excluded.every((path) => !`${file}/`.startsWith(`${path}/`)),
      `package file ${file} is excluded`,
    );
});
