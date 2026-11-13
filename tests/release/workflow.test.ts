import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stringify } from 'yaml';
import {
  parseWorkflow,
  validatePublishWorkflow,
  type Workflow,
} from '../../scripts/release/workflow.js';

const text = await readFile(
  new URL('../../.github/workflows/publish.yml', import.meta.url),
  'utf8',
);
const alter = (change: (w: Workflow) => unknown) => {
  const w = parseWorkflow(text);
  change(w);
  return stringify(w);
};
test('parse the actual publication workflow', () => {
  assert.equal(
    validatePublishWorkflow(text).jobs.publish.environment,
    'release',
  );
});
test('a manual dispatch cannot start publication', () => {
  assert.throws(
    () => validatePublishWorkflow(alter((w) => (w.on!.workflow_dispatch = {}))),
    /triggers/,
  );
});
test('publisher environment and job dependencies are mandatory', () => {
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter((w) => (w.jobs.publish.environment = 'other')),
      ),
    /environment/,
  );
  assert.throws(
    () =>
      validatePublishWorkflow(alter((w) => (w.jobs.release.needs = 'verify'))),
    /dependency/,
  );
});
test('new YAML refuses bypassed authorization, cross-run packages and token fallback', () => {
  for (const change of [
    (w: Workflow) => (w.jobs.verify.needs = []),
    (w: Workflow) => (w.jobs.authorize.steps.at(-1)!.run = 'echo bypass'),
    (w: Workflow) => (w.jobs.publish.env!.EXPECTED_SHA256 = 'forged'),
    (w: Workflow) =>
      (w.jobs.publish.steps.find((s) => s.id === 'digest')!.run =
        'echo bypass'),
    (w: Workflow) =>
      (w.jobs.publish.steps.find((s) =>
        s.uses?.startsWith('actions/download-artifact@'),
      )!.with!['run-id'] = 'other-run'),
    (w: Workflow) => w.jobs.publish.steps.push({ env: { NPM_TOKEN: 'fake' } }),
  ])
    assert.throws(() => validatePublishWorkflow(alter(change)));
});

test('both writers keep the latest-only dist-tag guard', () => {
  for (const name of ['publish', 'release'])
    assert.throws(
      () =>
        validatePublishWorkflow(
          alter((w: Workflow) => {
            const writer = w.jobs[name].steps.at(-1)!;
            writer.run = writer.run!.replace(/^.*DIST_TAG" == latest.*\n/m, '');
          }),
        ),
      /latest-only guard missing/,
    );
});
