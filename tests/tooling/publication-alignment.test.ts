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
test('failed prerequisite cannot bypass dependencies permissions or tag serialization', () => {
  for (const mutate of [
    (w: any) => (w.jobs.publish.needs = 'authorize'),
    (w: any) => (w.jobs.release.needs = 'verify'),
    (w: any) => (w.jobs.verify.permissions.contents = 'write'),
    (w: any) => (w.concurrency['cancel-in-progress'] = true),
  ]) {
    const workflow = parse(text);
    mutate(workflow);
    assert.throws(
      () => validatePublishWorkflow(stringify(workflow)),
      /dependency|permissions|concurrency/,
    );
  }
});
