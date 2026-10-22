import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { buildTestSite, TEST_TOOLS, testSiteData } from './site-fixture.ts';

let out = '';
before(async () => {
  ({ out } = await buildTestSite());
});
const cards = (html: string) =>
  [
    ...html.matchAll(
      /<a class="tool-card[^"]*" href="([^"]+)" data-testid="tool-card" data-tool="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    ),
  ].map((match) => ({
    href: match[1]!,
    tool: match[2]!,
    text: match[3]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  }));

test('/tools/ shows exactly the candidate tools with their accepted versions', async () => {
  const found = cards(await readFile(join(out, 'tools', 'index.html'), 'utf8'));
  assert.deepEqual(
    found.map((card) => card.tool),
    TEST_TOOLS.map((tool) => tool.tool),
  );
  for (const [index, tool] of TEST_TOOLS.entries()) {
    assert.equal(found[index]!.href, `/formicarium/tools/${tool.tool}/`);
    assert.ok(found[index]!.text.includes(tool.version), found[index]!.text);
  }
});

test('the Japanese cards link to the Japanese tool pages', async () => {
  const found = cards(
    await readFile(join(out, 'ja', 'tools', 'index.html'), 'utf8'),
  );
  assert.deepEqual(
    found.map((card) => card.href),
    TEST_TOOLS.map((tool) => `/formicarium/ja/tools/${tool.tool}/`),
  );
  assert.ok(found[0]!.text.includes('端末を開く'));
});

test('card text is escaped by Astro, never inserted as HTML', async () => {
  const html = await readFile(join(out, 'tools', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /data-testid="tools-empty-terminal"/);
});

test('a candidate tool without site strings fails the build', async () => {
  const data = testSiteData();
  data.tools.push({
    tool: 'deno',
    version: '9.9.9',
    repository: 'https://github.com/example/deno',
    fixture: 'deno-basic',
    fixtureIndex: {
      path: 'demo-fixtures/deno-basic.json',
      sha256: 'a'.repeat(64),
    },
  });
  await assert.rejects(buildTestSite(data), (error: unknown) =>
    /site strings: strings lack the candidate tool deno/.test(
      String((error as { stderr?: unknown }).stderr ?? error),
    ),
  );
});

test('a candidate without one of the string tools fails the build too', async () => {
  const data = testSiteData();
  data.tools = data.tools.filter((tool) => tool.tool !== 'biome');
  await assert.rejects(buildTestSite(data), (error: unknown) =>
    /strings name biome, which is not in the candidate/.test(
      String((error as { stderr?: unknown }).stderr ?? error),
    ),
  );
});
