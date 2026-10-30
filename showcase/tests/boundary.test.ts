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

// The site probes live in boundary-fixtures/site/ (not scanned): import-like
// text in this file would itself be reported.
test('site: Astro, Starlight, its Markdown processor and xterm (and their subpaths) are allowed below showcase/site only', async () => {
  const source = await probe('site/site-imports.ts');
  assert.deepEqual(checkShowcaseFile('showcase/site/src/x.ts', source), []);
  assert.equal(
    checkShowcaseFile('showcase/scripts/x.ts', source).filter(
      (item) => item.kind === 'unknown-import',
    ).length,
    8,
  );
  assert.deepEqual(
    checkShowcaseFile(
      'showcase/site/src/x.ts',
      await probe('site/look-alike.ts'),
    ).map((item) => item.reference),
    ['astro-evil', '@xterm/xterm-evil'],
  );
});

test('site: Playwright and v8-to-istanbul are allowed below showcase/site/tests only', async () => {
  const source = await probe('site/test-tools.ts');
  assert.deepEqual(
    checkShowcaseFile('showcase/site/tests/coverage/merge.ts', source),
    [],
  );
  assert.deepEqual(
    checkShowcaseFile('showcase/site/src/x.ts', source).map(
      (item) => item.kind,
    ),
    ['unknown-import', 'unknown-import'],
  );
});

test('site: .astro frontmatter and <script> imports are checked; <script src> must stay same-origin', async () => {
  const page = await probe('site/page.astro');
  assert.deepEqual(
    checkShowcaseFile('showcase/site/src/pages/x.astro', page).map(
      (item) => `${item.kind} ${item.reference}`,
    ),
    [
      'script-src https://cdn.example/x.js',
      'script-src //cdn.example/y.js',
      'internal-import ../../../../runtime/errors.ts',
      'internal-import @aletheia-works/formicarium/runtime/core.js',
    ],
  );
});

test('site: a computed import() is refused outside the formicarium loader', async () => {
  const computed = await probe('site/computed-import.ts');
  assert.deepEqual(
    checkShowcaseFile('showcase/site/src/terminal/other.ts', computed).map(
      (item) => item.kind,
    ),
    ['dynamic-import'],
  );
  assert.deepEqual(
    checkShowcaseFile(
      'showcase/site/src/terminal/formicarium-loader.ts',
      computed,
    ),
    [],
  );
  assert.deepEqual(
    checkShowcaseFile(
      'showcase/site/src/x.ts',
      await probe('site/literal-import.ts'),
    ),
    [],
  );
});

test('site: build output, Astro types, node_modules and the staged pack are not scanned', async () => {
  const root = join(SHOWCASE_ROOT, '.work', `boundary-site-${process.pid}`);
  const bad = await probe('site/bare-import.ts');
  try {
    for (const directory of [
      'dist/_astro',
      '.astro',
      'node_modules/x',
      '.work',
      'public/_formicarium/0.3.0',
    ]) {
      await mkdir(join(root, 'showcase', 'site', directory), {
        recursive: true,
      });
      await writeFile(join(root, 'showcase', 'site', directory, 'a.js'), bad);
    }
    assert.deepEqual(await scanTree(root), []);
    await writeFile(join(root, 'showcase', 'site', 'b.ts'), bad);
    assert.deepEqual(
      (await scanTree(root)).map((item) => item.file),
      ['showcase/site/b.ts'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
