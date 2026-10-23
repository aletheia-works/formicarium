import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createBundle } from '../../scripts/ci/bundle.js';
import { validateCandidateInputs } from '../../scripts/ci/candidate.js';

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'formicarium-candidate-test-'));
  const inputRoot = resolve(root, '.ci-inputs');
  const prefix = '.artifacts/ci-candidate/';
  const bytes = Buffer.from('test fixture only, not an executable release');
  const paths = [
    'dist/guests/probe',
    'dist/guests/aube',
    'dist/guests/pitchfork',
    `${prefix}provenance/aube.json`,
    `${prefix}provenance/pitchfork.json`,
    'fixtures/baseline/aube-1645.native.txt',
    'fixtures/baseline/pitchfork-basic.native.txt',
    `${prefix}package.tgz`,
    `${prefix}package.json`,
  ];
  await writeFile(resolve(root, 'source.ts'), bytes);
  const sourceInput = resolve(root, 'fixture-bytes');
  await writeFile(sourceInput, bytes);
  const context = {
    repository: 'aletheia-works/formicarium',
    commit: 'a'.repeat(40),
    event: 'workflow_dispatch',
    ref: 'refs/heads/codex/bun-ci-u1',
  };
  await createBundle(
    {
      manifest: {
        schemaVersion: 1,
        repository: context.repository,
        sourceCommit: context.commit,
        tarball: `${prefix}package.tgz`,
        packageManifest: `${prefix}package.json`,
        packageRoot: `${prefix}package`,
        guests: { aube: 'v2.7.0', pitchfork: 'v2.30.1' },
      },
      sourcePaths: ['source.ts'],
      inputs: paths.map((path) => ({ source: sourceInput, path })),
    },
    inputRoot,
    root,
  );
  const options = { root, inputRoot, context, sourcePaths: ['source.ts'] };
  return { options, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('candidate preflight accepts complete pinned fixture inventory without executing regressions', async () => {
  const { options, cleanup } = await fixture();
  try {
    assert.equal(
      (await validateCandidateInputs(options)).sourceCommit,
      options.context.commit,
    );
  } finally {
    await cleanup();
  }
});
test('candidate preflight rejects a missing required asset', async () => {
  const { options, cleanup } = await fixture();
  try {
    await rm(resolve(options.inputRoot, 'payload/dist/guests/probe'));
    await assert.rejects(
      validateCandidateInputs(options),
      /unknown or missing/,
    );
  } finally {
    await cleanup();
  }
});
test('candidate preflight rejects changed payload bytes', async () => {
  const { options, cleanup } = await fixture();
  try {
    await writeFile(
      resolve(options.inputRoot, 'payload/dist/guests/probe'),
      'changed',
    );
    await assert.rejects(validateCandidateInputs(options), /bytes differ/);
  } finally {
    await cleanup();
  }
});
test('candidate preflight rejects stale source SHA and missing source inventory', async () => {
  const { options, cleanup } = await fixture();
  try {
    await assert.rejects(
      validateCandidateInputs({
        ...options,
        context: { ...options.context, commit: 'd'.repeat(40) },
      }),
      /source commit differs/,
    );
    await assert.rejects(
      validateCandidateInputs({
        ...options,
        sourcePaths: ['source.ts', 'omitted.ts'],
      }),
      /source inventory/,
    );
  } finally {
    await cleanup();
  }
});
test('candidate preflight rejects unknown payload members', async () => {
  const { options, cleanup } = await fixture();
  try {
    await writeFile(
      resolve(options.inputRoot, 'payload/dist/guests/unknown'),
      'unknown',
    );
    await assert.rejects(
      validateCandidateInputs(options),
      /unknown or missing/,
    );
  } finally {
    await cleanup();
  }
});
test('candidate preflight rejects symlink payloads even when the target is owned', async () => {
  const { options, cleanup } = await fixture();
  try {
    const path = resolve(options.inputRoot, 'payload/dist/guests/probe');
    const bytes = await readFile(path);
    const target = resolve(options.root, 'owned-symlink-target');
    await writeFile(target, bytes);
    await rm(path);
    await symlink(target, path);
    await assert.rejects(
      validateCandidateInputs(options),
      /nonregular|symlink/,
    );
  } finally {
    await cleanup();
  }
});
