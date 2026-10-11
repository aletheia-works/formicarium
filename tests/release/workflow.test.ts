import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import type { PublicationIdentity } from '../../scripts/release/publication.js';
import {
  assertPublicationContext,
  assertReleasePreflightContext,
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
  const w = parse(text);
  change(w);
  return stringify(w);
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
test('verification and both writers require their gate or artifact digest check', () => {
  for (const job of ['verify', 'publish', 'release'])
    assert.throws(
      () =>
        validatePublishWorkflow(
          alter((w) => {
            w.jobs[job].steps = w.jobs[job].steps.filter(
              (s: any) => s.id !== (job === 'verify' ? 'candidate' : 'digest'),
            );
          }),
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
    /unvalidated|gate/,
  );
});

test('artifact transfer cannot precede validation or follow the digest check', () => {
  for (const name of ['verify', 'publish', 'release']) {
    assert.throws(
      () =>
        validatePublishWorkflow(
          alter((w) => {
            const steps = w.jobs[name].steps;
            const index = steps.findIndex((s: any) =>
              s.uses?.startsWith(
                name === 'verify'
                  ? 'actions/upload-artifact@'
                  : 'actions/download-artifact@',
              ),
            );
            const [transfer] = steps.splice(index, 1);
            if (name === 'verify') steps.unshift(transfer);
            else steps.push(transfer);
          }),
        ),
      /artifact/,
    );
  }
});
test('cross-run artifacts, forged outputs and failed-step bypass are refused', () => {
  for (const change of [
    (w: any) => {
      w.jobs.publish.steps.find((s: any) =>
        s.uses?.startsWith('actions/download-artifact@'),
      ).with['run-id'] = 'other-run';
    },
    (w: any) => {
      w.jobs.verify.outputs.sha256 = 'forged';
    },
    (w: any) => {
      w.jobs.publish.steps.find((s: any) => s.id === 'digest')[
        'continue-on-error'
      ] = true;
    },
  ])
    assert.throws(
      () => validatePublishWorkflow(alter(change)),
      /artifact|output|conditional/,
    );
});

test('read-only preflight accepts only the exact upstream main candidate and package version', () => {
  const preflight = {
    ...context,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assertReleasePreflightContext(identity, preflight, identity.version);
  for (const mutation of [
    { event: 'push' },
    { event: 'pull_request' },
    { repository: 'Marukome0743/formicarium' },
    { ref: 'refs/heads/codex/release' },
    { sha: 'd'.repeat(40) },
  ])
    assert.throws(
      () =>
        assertReleasePreflightContext(
          identity,
          { ...preflight, ...mutation },
          identity.version,
        ),
      /untrusted/,
    );
  assert.throws(
    () => assertReleasePreflightContext(identity, preflight, '0.2.0'),
    /untrusted/,
  );
  assert.throws(
    () => assertPublicationContext(identity, preflight),
    /untrusted/,
  );
});

test('stale release inputs explain the expected and observed tag/source without admitting publication', () => {
  assert.throws(
    () =>
      assertPublicationContext(identity, {
        ...context,
        ref: 'refs/tags/v0.2.0',
        sha: 'b'.repeat(40),
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /reviewed inputs require/);
      assert.match(error.message, /refs\/tags\/v0.1.0-rc.1/);
      assert.match(error.message, /refs\/tags\/v0.2.0/);
      assert.match(error.message, /complete release preflight/);
      return true;
    },
  );
});
