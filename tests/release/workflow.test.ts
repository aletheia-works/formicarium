import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { PublicationIdentity } from '../../scripts/release/publication.js';
import {
  assertPublicationContext,
  validatePublishWorkflow,
} from '../../scripts/release/workflow.js';

const text = await readFile(
  new URL('../../.github/workflows/publish.yml', import.meta.url),
  'utf8',
);
const identity: PublicationIdentity = {
  repository: 'aletheia-works/formicarium',
  workflow: 'publish.yml',
  environment: 'release',
  sourceCommit: 'a'.repeat(40),
  version: '0.1.0-rc.1',
  tag: 'v0.1.0-rc.1',
  distTag: 'next',
};
const context = {
  event: 'push',
  repository: identity.repository,
  ref: `refs/tags/${identity.tag}`,
  sha: identity.sourceCommit,
};
const alter = (change: (w: any) => void) => {
  const w = JSON.parse(text);
  change(w);
  return JSON.stringify(w);
};
test('parse actual workflow and allow only exact approved tag origin', () => {
  assert.equal(
    validatePublishWorkflow(text).jobs.publish.environment,
    'release',
  );
  assertPublicationContext(identity, context);
});
test('fork context cannot reach publication', () =>
  assert.throws(
    () =>
      assertPublicationContext(identity, {
        ...context,
        repository: 'someone/formicarium',
      }),
    /untrusted/,
  ));
test('PR branch and manually dispatched inputs cannot reach publication', () => {
  for (const change of [
    { event: 'pull_request' },
    { event: 'workflow_dispatch' },
    { ref: 'refs/heads/main' },
  ])
    assert.throws(
      () => assertPublicationContext(identity, { ...context, ...change }),
      /untrusted/,
    );
  assert.throws(
    () => validatePublishWorkflow(alter((w) => (w.on.workflow_dispatch = {}))),
    /triggers/,
  );
});
test('different tag or source commit rejected before publication', () => {
  for (const change of [{ ref: 'refs/tags/v0.1.0' }, { sha: 'b'.repeat(40) }])
    assert.throws(
      () => assertPublicationContext(identity, { ...context, ...change }),
      /untrusted/,
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
test('every job requires immediate evidence gate, independent of earlier success', () => {
  for (const job of ['verify', 'publish', 'release'])
    assert.throws(
      () =>
        validatePublishWorkflow(
          alter(
            (w) =>
              (w.jobs[job].steps = w.jobs[job].steps.filter(
                (s: any) =>
                  !(
                    s.run?.includes('runner.mjs gate') ||
                    s.run?.includes('bootstrap.mjs')
                  ),
              )),
          ),
        ),
      /gate/,
    );
});
test('OIDC outside publish and verification writes are rejected', () => {
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter((w) => (w.permissions['id-token'] = 'write')),
      ),
    /global/,
  );
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter((w) => (w.jobs.verify.permissions.contents = 'write')),
      ),
    /permissions/,
  );
});
test('token fallback unpinned action and unvalidated tarball command rejected', () => {
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter((w) =>
          w.jobs.publish.steps.push({ env: { NODE_AUTH_TOKEN: 'fixture' } }),
        ),
      ),
    /token/,
  );
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter((w) => (w.jobs.verify.steps[0].uses = 'actions/checkout@v4')),
      ),
    /pinned/,
  );
  assert.throws(
    () =>
      validatePublishWorkflow(
        alter(
          (w) => (w.jobs.publish.steps.at(-1).run = 'npm publish other.tgz'),
        ),
      ),
    /unvalidated/,
  );
});
