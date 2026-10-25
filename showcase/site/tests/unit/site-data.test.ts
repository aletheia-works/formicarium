import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { interactiveTools, loadSiteData, toolOf } from '../../src/site-data.ts';
import { tempDir, writeFiles } from './helpers.ts';
import { testSiteData } from './site-fixture.ts';

test('the pages read the site data written by the build', async () => {
  const root = await tempDir('data');
  await writeFiles(root, { 'site-data.json': JSON.stringify(testSiteData()) });
  const data = loadSiteData(join(root, 'site-data.json'));
  assert.equal(toolOf(data, 'biome').version, '2.5.15');
  assert.throws(() => toolOf(data, 'deno'), /unknown tool deno/);
});

test('the interactive tools are the ones tools.json marks', () => {
  const data = testSiteData();
  assert.deepEqual(interactiveTools(data), []);
  data.tools[1] = { ...data.tools[1]!, interactive: true };
  assert.deepEqual(interactiveTools(data), [data.tools[1]!.tool]);
});

test('missing or empty site data stops the build', async () => {
  const root = await tempDir('data');
  assert.throws(
    () => loadSiteData(join(root, 'absent.json')),
    /site data missing: run scripts\/build-site\.ts/,
  );
  await writeFiles(root, {
    'empty.json': JSON.stringify({ ...testSiteData(), tools: [] }),
    'old.json': '{"schemaVersion":2,"tools":[1]}',
  });
  assert.throws(
    () => loadSiteData(join(root, 'empty.json')),
    /site data invalid/,
  );
  assert.throws(
    () => loadSiteData(join(root, 'old.json')),
    /site data invalid/,
  );
});

test('SHOWCASE_SITE_DATA selects the file when no path is given', async () => {
  const root = await tempDir('data');
  await writeFiles(root, { 'site-data.json': JSON.stringify(testSiteData()) });
  const previous = process.env.SHOWCASE_SITE_DATA;
  process.env.SHOWCASE_SITE_DATA = join(root, 'site-data.json');
  try {
    assert.equal(loadSiteData().tools.length, 3);
  } finally {
    if (previous === undefined) delete process.env.SHOWCASE_SITE_DATA;
    else process.env.SHOWCASE_SITE_DATA = previous;
  }
});
