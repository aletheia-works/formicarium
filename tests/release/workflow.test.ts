import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { validatePublishWorkflow } from '../../scripts/release/workflow.js';

const text = await readFile(
  new URL('../../.github/workflows/publish.yml', import.meta.url),
  'utf8',
);
const alter = (change: (w: any) => void) => {
  const w = parse(text);
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
    () => validatePublishWorkflow(alter((w) => (w.on.workflow_dispatch = {}))),
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
    (w: any) => (w.jobs.verify.needs = []),
    (w: any) => (w.jobs.authorize.steps.at(-1).run = 'echo bypass'),
    (w: any) => (w.jobs.publish.env.EXPECTED_SHA256 = 'forged'),
    (w: any) =>
      (w.jobs.publish.steps.find((s: any) => s.id === 'digest').run =
        'echo bypass'),
    (w: any) =>
      (w.jobs.publish.steps.find((s: any) =>
        s.uses?.startsWith('actions/download-artifact@'),
      ).with['run-id'] = 'other-run'),
    (w: any) => w.jobs.publish.steps.push({ env: { NPM_TOKEN: 'fake' } }),
  ])
    assert.throws(() => validatePublishWorkflow(alter(change)));
});

test('both writers keep the latest-only dist-tag guard', () => {
  for (const name of ['publish', 'release'])
    assert.throws(
      () =>
        validatePublishWorkflow(
          alter((w: any) => {
            const writer = w.jobs[name].steps.at(-1);
            writer.run = writer.run.replace(/^.*DIST_TAG" == latest.*\n/m, '');
          }),
        ),
      /latest-only guard missing/,
    );
});
