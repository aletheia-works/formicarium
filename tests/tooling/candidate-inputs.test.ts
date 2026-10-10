import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createBundle } from '../../scripts/ci/bundle.js';
import { validateCandidateInputs } from '../../scripts/ci/candidate.js';
import { hash } from '../../scripts/ci/verification.js';

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'formicarium-candidate-test-'));
  const inputRoot = resolve(root, '.ci-inputs');
  const prefix = '.artifacts/ci-candidate/';
  const terrarium = `${prefix}owner`;
  const ownerPath = `${terrarium}/packages/terrarium/src/index.ts`;
  const bytes = Buffer.from('test fixture only, not an executable release');
  const paths = [
    'assets/blink.wasm',
    'assets/blink.mjs',
    'assets/build-info.json',
    'dist/guests/probe',
    'dist/guests/aube',
    'dist/guests/pitchfork',
    `${prefix}provenance/aube.json`,
    `${prefix}provenance/pitchfork.json`,
    'fixtures/baseline/aube-1645.native.txt',
    'fixtures/baseline/pitchfork-basic.native.txt',
    `${prefix}package.tgz`,
    `${prefix}package.json`,
    `${terrarium}/web/terminal.mjs`,
    ownerPath,
    ...['manifest.js', 'fixtures.js', 'resolver.js'].map(
      (name) => `${prefix}inputs/resolver/${name}`,
    ),
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
        site: `${prefix}site`,
        terrarium,
        coreCommit: 'b'.repeat(40),
        guests: { aube: 'v2.7.0', pitchfork: 'v2.30.1' },
        owner: {
          baselineCommit: 'c'.repeat(40),
          integrationSourceIdentity: hash(
            JSON.stringify([{ path: ownerPath, sha256: hash(bytes) }]),
          ),
        },
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
    await rm(resolve(options.inputRoot, 'payload/assets/blink.wasm'));
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
      resolve(options.inputRoot, 'payload/assets/blink.wasm'),
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
      resolve(options.inputRoot, 'payload/assets/unknown'),
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
    const path = resolve(options.inputRoot, 'payload/assets/blink.wasm');
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
