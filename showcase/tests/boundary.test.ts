import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  checkShowcaseFile,
  importSpecifiers,
  scanTree,
} from '../scripts/boundary.ts';
import { REPOSITORY_ROOT, SHOWCASE_ROOT } from '../scripts/paths.ts';

const fixtures = join(SHOWCASE_ROOT, 'tests', 'boundary-fixtures');
const probe = (name: string) => readFile(join(fixtures, name), 'utf8');

test('the current tree has no boundary violation', async () => {
  assert.deepEqual(await scanTree(REPOSITORY_ROOT), []);
});

test('each violation fixture fails with exactly its one violation', async () => {
  for (const [directory, kind] of [
    ['internal-import', 'internal-import'],
    ['reverse-dependency', 'reverse-dependency'],
    ['fixture-share', 'fixture-share'],
  ] as const) {
    const violations = await scanTree(join(fixtures, directory));
    assert.deepEqual(
      violations.map((violation) => violation.kind),
      [kind],
      `${directory} must report one ${kind}`,
    );
  }
});

test('only public entries, node builtins, showcase paths and test tooling are imported', async () => {
  assert.deepEqual(
    checkShowcaseFile(
      'showcase/scripts/x.ts',
      await probe('package-internal.ts'),
    ).map((item) => item.kind),
    ['internal-import'],
  );
  assert.deepEqual(
    checkShowcaseFile('showcase/scripts/x.ts', await probe('public-import.ts')),
    [],
  );
  assert.deepEqual(importSpecifiers(await probe('public-import.ts')), [
    '@aletheia-works/formicarium',
  ]);
  const tooling = await readFile(
    join(SHOWCASE_ROOT, 'tests', 'playwright.config.ts'),
    'utf8',
  );
  assert.deepEqual(
    checkShowcaseFile('showcase/tests/playwright.config.ts', tooling),
    [],
  );
  assert.deepEqual(
    checkShowcaseFile('showcase/scripts/playwright.config.ts', tooling).map(
      (item) => item.kind,
    ),
    ['unknown-import'],
  );
});

// Biome 2.5 answers stdin linting with exit 1 and no rule names whatever the
// input, so each probe is linted as a real file under the showcase override.
const PROBE_DIRECTORY = join(SHOWCASE_ROOT, '.probe');
async function biome(input: string) {
  await mkdir(PROBE_DIRECTORY, { recursive: true });
  const file = join(PROBE_DIRECTORY, 'boundary-probe.ts');
  try {
    await writeFile(file, input);
    return spawnSync(
      process.execPath,
      [
        join(
          REPOSITORY_ROOT,
          'node_modules',
          '@biomejs',
          'biome',
          'bin',
          'biome',
        ),
        'lint',
        file,
      ],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
    );
  } finally {
    await rm(PROBE_DIRECTORY, { recursive: true, force: true });
  }
}

test('the Biome rule refuses internal imports from showcase and allows the public export', async () => {
  for (const name of [
    'package-internal.ts',
    'internal-import/showcase/scripts/bad.ts',
  ]) {
    const result = await biome(await probe(name));
    assert.notEqual(result.status, 0, name);
    assert.match(
      `${result.stdout}${result.stderr}`,
      /noRestrictedImports/,
      name,
    );
  }
  const allowed = await biome(await probe('public-import.ts'));
  assert.equal(allowed.status, 0, `${allowed.stdout}${allowed.stderr}`);
});

test('every showcase script is loaded, so none is missing from the coverage denominator', async () => {
  const scripts = (await readdir(join(SHOWCASE_ROOT, 'scripts'))).filter(
    (name) => name.endsWith('.ts'),
  );
  assert.ok(scripts.length >= 20);
  for (const name of scripts) {
    const loaded = await import(
      pathToFileURL(join(SHOWCASE_ROOT, 'scripts', name)).href
    );
    assert.ok(Object.keys(loaded).length > 0, name);
  }
});
