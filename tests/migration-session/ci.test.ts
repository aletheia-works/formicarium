import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  mapCICommand,
  validateCIContext,
} from '../../scripts/migration-session/ci.js';
import {
  BLINK_IDENTITY,
  inspectRestoredCore,
  validateBlinkLock,
} from '../../scripts/migration-session/ci-core.js';
import {
  CI_INPUT_LIMITS,
  CI_INPUT_PATHS,
  inspectCIInputs,
  installCIInputs,
  validateCIInputManifest,
} from '../../scripts/migration-session/ci-inputs.js';
import { sha256 } from '../../scripts/package/stage-package.js';

test('fixed local core lock refuses short, swapped and duplicate identities', () => {
  const valid = `commit=${BLINK_IDENTITY.head}\nupstream_commit=${BLINK_IDENTITY.upstream}\n`;
  assert.deepEqual(validateBlinkLock(valid), BLINK_IDENTITY);
  for (const invalid of [
    valid.replace(BLINK_IDENTITY.head, 'short'),
    valid.replace(BLINK_IDENTITY.head, BLINK_IDENTITY.upstream),
    valid + `commit=${BLINK_IDENTITY.head}\n`,
  ])
    assert.throws(() => validateBlinkLock(invalid), /lock/);
});
test('mock Git object observations require exact HEAD/upstream, emufd diff and clean tree', () => {
  const outputs = new Map([
    ['rev-parse HEAD', BLINK_IDENTITY.head],
    [`rev-parse ${BLINK_IDENTITY.upstream}^{commit}`, BLINK_IDENTITY.upstream],
    [
      `diff --name-only ${BLINK_IDENTITY.upstream} ${BLINK_IDENTITY.head}`,
      'blink/emufd.c',
    ],
    ['status --porcelain --untracked-files=all', ''],
  ]);
  const execute = (_directory: string, args: string[]) => {
    const result = outputs.get(args.join(' '));
    assert.notEqual(result, undefined);
    return result!;
  };
  inspectRestoredCore('synthetic-git-observations', execute);
  for (const [key, wrong] of [
    ['rev-parse HEAD', 'b'.repeat(40)],
    [`rev-parse ${BLINK_IDENTITY.upstream}^{commit}`, 'c'.repeat(40)],
    [
      `diff --name-only ${BLINK_IDENTITY.upstream} ${BLINK_IDENTITY.head}`,
      'other.c',
    ],
    ['status --porcelain --untracked-files=all', '?? injected-hook'],
  ]) {
    const previous = outputs.get(key!)!;
    outputs.set(key!, wrong!);
    assert.throws(
      () => inspectRestoredCore('synthetic-git-observations', execute),
      /HEAD|upstream|dirty/,
    );
    outputs.set(key!, previous);
  }
});

const digest = sha256('synthetic-input-not-real-guest');
function fixture() {
  return {
    schema: 'migration-session-ci-inputs',
    version: 1,
    producer: 'main-session-observed-inputs',
    files: CI_INPUT_PATHS.map((path) => ({ path, bytes: 30, sha256: digest })),
    sourceFiles: [{ path: 'runtime/public.ts', sha256: digest }],
  };
}
test('synthetic manifest requires complete exact destinations and permits shared blob SHA', () => {
  assert.equal(validateCIInputManifest(fixture()).files.length, 19);
  for (const mutate of [
    (row: ReturnType<typeof fixture>) => row.files.pop(),
    (row: ReturnType<typeof fixture>) => {
      row.files[0]!.path = '../escape';
    },
    (row: ReturnType<typeof fixture>) => {
      row.files[1]!.path = row.files[0]!.path;
    },
  ]) {
    const row = fixture();
    mutate(row);
    assert.throws(() => validateCIInputManifest(row), /inventory|destination/);
  }
});
test('synthetic producer, size, unknown field and source self-reference fail closed', () => {
  assert.throws(
    () => validateCIInputManifest({ ...fixture(), producer: 'unobserved' }),
    /producer/,
  );
  assert.throws(
    () => validateCIInputManifest({ ...fixture(), extra: true }),
    /field/,
  );
  const large = fixture();
  large.files[0]!.bytes = CI_INPUT_LIMITS.file + 1;
  assert.throws(() => validateCIInputManifest(large), /byte limit/);
  const self = fixture();
  self.sourceFiles[0]!.path = 'ci/migration-session/inputs.bundle.json';
  assert.throws(() => validateCIInputManifest(self), /self reference/);
});
test('CI context mock accepts exact fork push and refuses local/mismatched identities', () => {
  const env = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'Marukome0743/formicarium',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/codex/terrarium-migration-u2',
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '1',
  };
  assert.equal(validateCIContext(env).head, env.GITHUB_SHA);
  for (const patch of [
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_REPOSITORY: 'aletheia-works/formicarium' },
    { GITHUB_REF: 'refs/heads/main' },
    { GITHUB_SHA: 'short' },
    { GITHUB_RUN_ID: '0' },
  ])
    assert.throws(
      () => validateCIContext({ ...env, ...patch }),
      /context refused/,
    );
});
test('task adapter keeps exact declared five-test and browser scopes', () => {
  const root = process.cwd();
  const unit = mapCICommand(
    { executable: 'mise', args: ['run', 'migration-session-unit'], cwd: root },
    root,
  );
  assert.equal(unit.executable, process.execPath);
  assert.equal(unit.args.length, 7);
  assert.equal(unit.args.at(-1), 'tests/migration-session/consumer.test.js');
  const browser = mapCICommand(
    {
      executable: 'mise',
      args: ['run', 'migration-session-browser'],
      cwd: root,
    },
    root,
  );
  assert.deepEqual(browser.args, [
    'node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    'tests/migration-session/playwright.config.ts',
    'tests/migration-session/consumer.spec.ts',
  ]);
  assert.deepEqual(
    mapCICommand(
      { executable: 'mise', args: ['run', 'build'], cwd: root },
      root,
    ).args,
    ['scripts/ci/tasks.ts', 'build'],
  );
});
test('adapter refuses unknown task, shell executor, escaping cwd and Node entry', () => {
  const root = process.cwd();
  for (const command of [
    { executable: 'mise', args: ['run', 'publish'], cwd: root },
    { executable: 'bash', args: ['-c', 'true'], cwd: root },
    {
      executable: process.execPath,
      args: ['--test'],
      cwd: resolve(root, '..'),
    },
    {
      executable: process.execPath,
      args: ['-e', 'process.exit(0)'],
      cwd: root,
    },
  ])
    assert.throws(() => mapCICommand(command, root), /refused/);
});
async function withBundle(
  run: (root: string, manifestPath: string, blob: string) => Promise<void>,
) {
  const base = resolve(process.cwd(), '.artifacts/migration-session');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(resolve(base, 'ci-fixture-'));
  const bundle = resolve(root, 'ci/migration-session');
  await mkdir(resolve(bundle, 'payload'), { recursive: true });
  const bytes = Buffer.from('synthetic-input-not-real-guest');
  const row = fixture();
  for (const file of row.files) file.bytes = bytes.length;
  const manifestPath = resolve(bundle, 'inputs.bundle.json'),
    blob = resolve(bundle, `payload/${digest}.bin`);
  await writeFile(manifestPath, JSON.stringify(row, null, 2) + '\n');
  await writeFile(blob, bytes);
  try {
    await run(root, manifestPath, blob);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('synthetic regular blob is deduplicated, copied and checked without overwriting', async () => {
  await withBundle(async (root, manifestPath) => {
    const installed = await installCIInputs(root, manifestPath);
    assert.equal(installed.created.length, 19);
    assert.equal((await installCIInputs(root, manifestPath)).created.length, 0);
    await writeFile(resolve(root, CI_INPUT_PATHS[0]!), 'tamper');
    await assert.rejects(
      installCIInputs(root, manifestPath),
      /existing destination differs/,
    );
  });
});
test('synthetic missing, tampered, unknown and symlink blobs rejected before writes', async () => {
  await withBundle(async (root, manifestPath, blob) => {
    await writeFile(blob, 'tamper');
    await assert.rejects(
      inspectCIInputs(root, manifestPath),
      /digest mismatch/,
    );
    await rm(blob);
    await assert.rejects(inspectCIInputs(root, manifestPath), /inventory/);
    await symlink(manifestPath, blob);
    await assert.rejects(inspectCIInputs(root, manifestPath), /symlink/);
    await rm(blob);
    await writeFile(blob, 'synthetic-input-not-real-guest');
    await writeFile(resolve(blob, '../extra.bin'), 'extra');
    await assert.rejects(inspectCIInputs(root, manifestPath), /inventory/);
  });
});
test('raw duplicate JSON keys and symlink destination parents are rejected', async () => {
  await withBundle(async (root, manifestPath) => {
    const row = fixture();
    for (const file of row.files)
      file.bytes = Buffer.byteLength('synthetic-input-not-real-guest');
    await writeFile(
      manifestPath,
      JSON.stringify(row, null, 2).replace(
        '"version": 1,',
        '"version": 1, "version": 1,',
      ) + '\n',
    );
    await assert.rejects(inspectCIInputs(root, manifestPath), /canonical JSON/);
    await writeFile(manifestPath, JSON.stringify(row, null, 2) + '\n');
    await symlink(resolve(root, 'ci'), resolve(root, 'dist'));
    await assert.rejects(inspectCIInputs(root, manifestPath), /symlink/);
  });
});
