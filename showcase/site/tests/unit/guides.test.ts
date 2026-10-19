import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { SITE_ROOT } from '../../scripts/common.ts';
import { tempDir, writeFiles } from './helpers.ts';
import { buildTestSite, testSiteData } from './site-fixture.ts';

const page = (out: string, path: string) =>
  readFile(join(out, path, 'index.html'), 'utf8');
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

test('npm instructions appear only when npm has this pack with the same integrity', async () => {
  const unpublished = (await buildTestSite()).out;
  for (const path of ['guides/embedding', 'ja/guides/embedding']) {
    const html = await page(unpublished, path);
    assert.match(html, /data-testid="package-unpublished"/, path);
    assert.doesNotMatch(html, /npm install @aletheia-works\/formicarium/, path);
  }
  assert.match(
    await page(unpublished, 'ja/guides/embedding'),
    /この版は npm に未公開です/,
  );
  const published = (
    await buildTestSite(
      testSiteData({
        npm: { version: '0.3.0', published: true, integrity: 'sha512-x' },
      }),
    )
  ).out;
  const html = await page(published, 'guides/embedding');
  assert.match(html, /data-testid="package-install"/);
  assert.match(plain(html), /npm install @aletheia-works\/formicarium@0\.3\.0/);
  assert.match(
    html,
    /https:\/\/www\.npmjs\.com\/package\/@aletheia-works\/formicarium\/v\/0\.3\.0/,
  );
});

test('the embedding example shown is the type-checked source file', async () => {
  const { out } = await buildTestSite();
  const source = await readFile(
    join(SITE_ROOT, 'src', 'examples', 'embedding.ts'),
    'utf8',
  );
  const shown = plain(await page(out, 'guides/embedding'));
  for (const line of source
    .split('\n')
    .filter((item) => item.trim().length > 20)
    .slice(0, 8))
    assert.ok(shown.includes(line.trim()), line);
});

const tsc = (file: string) =>
  execFileSync(
    process.execPath,
    [
      join(SITE_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'nodenext',
      '--moduleResolution',
      'nodenext',
      '--target',
      'es2023',
      '--lib',
      'es2024,dom',
      '--types',
      'node',
      file,
    ],
    { cwd: SITE_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

test('the embedding example type-checks against the staged pack types', () => {
  assert.doesNotThrow(() =>
    tsc(join(SITE_ROOT, 'src', 'examples', 'embedding.ts')),
  );
});

test('a wrong use of the API fails the same type check', async () => {
  const directory = await tempDir('example');
  const file = join(directory, 'wrong.ts');
  await writeFiles(directory, {
    'wrong.ts':
      "import { createSession } from '@aletheia-works/formicarium/browser';\nexport const s = createSession({ assets: { loaderURL: 1 } });\n",
  });
  assert.throws(
    () => tsc(file),
    (error: unknown) =>
      /TS2322|TS2739|TS2741/.test(
        String((error as { stdout?: unknown }).stdout),
      ),
  );
});
