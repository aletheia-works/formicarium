import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';

const { validatePublishWorkflow } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/workflow.js')).href
)) as typeof import('../../scripts/release/workflow.js');
const text = await readFile('.github/workflows/publish.yml', 'utf8');
test('automatic workflow delegates full source-bound CI and exports only a verified package', () => {
  const workflow = validatePublishWorkflow(text);
  assert.equal(workflow.jobs.verify.uses, './.github/workflows/ci.yml');
  assert.match(
    workflow.jobs.publish.steps.at(-1).run,
    /bunx npm@latest publish/,
  );
  assert.doesNotMatch(
    text,
    /FORMICARIUM_RELEASE_INPUT|publication-cli|rcAdoption/,
  );
});
test('JSR takes only the unpacked verified tarball, through its own lookup', () => {
  for (const mutate of [
    // Publishing a checkout would skip the verified bytes.
    (w: any) =>
      w.jobs.jsr.steps.splice(1, 0, {
        uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      }),
    (w: any) =>
      (w.jobs.jsr.steps.at(-1)['working-directory'] =
        '.artifacts/publication-package'),
    (w: any) => (w.jobs.jsr.steps.find((s: any) => s.id === 'unpack').id = 'x'),
    (w: any) =>
      (w.jobs.jsr.steps.find((s: any) => s.id === 'registry').run = 'true'),
    (w: any) => delete w.jobs.jsr.steps.at(-1).if,
    (w: any) =>
      (w.jobs.jsr.steps.at(-1).run = 'bunx jsr@latest publish --allow-dirty'),
  ]) {
    const workflow = parse(text);
    mutate(workflow);
    assert.throws(() => validatePublishWorkflow(stringify(workflow)));
  }
});
test('failed prerequisite cannot bypass dependencies permissions or tag serialization', () => {
  for (const mutate of [
    (w: any) => (w.jobs.publish.needs = 'authorize'),
    (w: any) => (w.jobs.release.needs = 'verify'),
    (w: any) => (w.jobs.jsr.needs = 'verify'),
    (w: any) => (w.jobs.jsr.permissions.contents = 'write'),
    (w: any) => (w.jobs.jsr.environment = undefined),
    (w: any) => (w.jobs.verify.permissions.contents = 'write'),
    (w: any) => (w.concurrency['cancel-in-progress'] = true),
  ]) {
    const workflow = parse(text);
    mutate(workflow);
    assert.throws(
      () => validatePublishWorkflow(stringify(workflow)),
      /dependency|permissions|concurrency|environment/,
    );
  }
});
