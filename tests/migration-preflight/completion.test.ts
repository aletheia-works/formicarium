import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  executeSequential,
  runCompletion,
} from '../../scripts/migration-preflight/completion.js';

test('missing required completion input executes no live command', async () => {
  let count = 0;
  await assert.rejects(
    runCompletion({
      environment: {},
      execute: async () => {
        count++;
      },
    }),
    /required input/,
  );
  assert.equal(count, 0);
});
test('fake command failure prevents all following command executions', async () => {
  const observed: string[] = [];
  const commands = ['first', 'fail', 'never'].map((executable) => ({
    executable,
    args: [],
    cwd: process.cwd(),
  }));
  await assert.rejects(
    executeSequential(commands, async (command) => {
      observed.push(command.executable);
      if (command.executable === 'fail') throw Error('fixture failure');
    }),
    /fixture failure/,
  );
  assert.deepEqual(observed, ['first', 'fail']);
});
test('existing completion lock refuses overlap without deleting its owner lock', async () => {
  const root = resolve('.artifacts/completion-tests', randomUUID());
  await mkdir(
    resolve(root, 'consumer/node_modules/@aletheia-works/formicarium/assets'),
    { recursive: true },
  );
  await mkdir(
    resolve(
      root,
      'consumer/node_modules/@aletheia-works/formicarium/runtime/node',
    ),
    { recursive: true },
  );
  await mkdir(
    resolve(
      root,
      'consumer/node_modules/@aletheia-works/formicarium/runtime/web',
    ),
    { recursive: true },
  );
  await mkdir(resolve(root, '.artifacts/migration-preflight'), {
    recursive: true,
  });
  try {
    for (const file of [
      'runtime/node/api.js',
      'runtime/web/api.js',
      'assets/blink.mjs',
      'assets/blink.wasm',
    ])
      await writeFile(
        resolve(
          root,
          'consumer/node_modules/@aletheia-works/formicarium',
          file,
        ),
        'fixture',
      );
    await writeFile(
      resolve(root, 'candidate.json'),
      JSON.stringify({ tarball: { sha256: 'a'.repeat(64) } }),
    );
    await writeFile(resolve(root, 'biome'), 'fixture');
    await writeFile(
      resolve(root, 'input.json'),
      JSON.stringify({
        candidateManifest: 'candidate.json',
        evidence: 'candidate.json',
        inventory: 'candidate.json',
        baselineInputs: 'candidate.json',
        firstReceipt: 'candidate.json',
        reuseReceipt: 'candidate.json',
        baselineDirectory: '.',
      }),
    );
    await writeFile(
      resolve(root, '.artifacts/migration-preflight/completion.lock'),
      'owner',
    );
    let count = 0;
    await assert.rejects(
      runCompletion({
        root,
        environment: {
          FORMICARIUM_PREFLIGHT_VERIFICATION: 'input.json',
          FORMICARIUM_CANDIDATE: 'candidate.json',
          FORMICARIUM_CONSUMER: 'consumer',
        },
        execute: async () => {
          count++;
        },
      }),
      /EEXIST/,
    );
    assert.equal(count, 0);
    assert.equal(
      await readFile(
        resolve(root, '.artifacts/migration-preflight/completion.lock'),
        'utf8',
      ),
      'owner',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
