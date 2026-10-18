import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  assetName,
  readConfigFile,
  validateAllowedSources,
  validateB1Pack,
  validateToolsConfig,
  validateTrustedCallers,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { MAIN_ALLOWED, withLayout } from './fixtures/work.ts';

const allowed = validateAllowedSources(JSON.parse(MAIN_ALLOWED));
type ToolJson = Record<string, unknown> & { acquire: Record<string, unknown> };
const current = async () =>
  structuredClone(await readConfigFile('tools.json')) as { tools: ToolJson[] };
const rejects = (run: () => unknown, code: string) =>
  assert.throws(run, (error) => causeOf(error) === code);

test('the committed tools.json, allow list, callers and B1 placeholder are valid', async () => {
  const tools = validateToolsConfig(await current(), allowed);
  assert.deepEqual(
    tools.tools.map((tool) => [tool.tool, tool.acquire.kind]),
    [
      ['aube', 'release-asset'],
      ['pitchfork', 'source-build'],
      ['biome', 'release-asset'],
    ],
  );
  assert.deepEqual(
    validateAllowedSources(await readConfigFile('allowed-sources.json')),
    allowed,
  );
  const callers = validateTrustedCallers(
    await readConfigFile('trusted-callers.json'),
  );
  assert.ok(callers.reuseWorkflows.includes('.github/workflows/showcase.yml'));
  assert.equal(validateB1Pack(await readConfigFile('b1-pack.json')), null);
  assert.equal(
    assetName('aube-{tag}-x86_64-unknown-linux-musl.tar.gz', 'v2.7.0', '2.7.0'),
    'aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz',
  );
});

test('a missing required field or an unknown field is refused', async () => {
  const missing = await current();
  delete missing.tools[0]!.tagPattern;
  rejects(() => validateToolsConfig(missing, allowed), 'config-invalid');
  const extra = await current();
  extra.tools[1]!.acquire.patches = [];
  rejects(() => validateToolsConfig(extra, allowed), 'config-invalid');
});

test('a duplicate tool is refused', async () => {
  const config = await current();
  config.tools.push(structuredClone(config.tools[0]!));
  rejects(() => validateToolsConfig(config, allowed), 'config-invalid');
});

test('an unknown build kind and an unknown acquire kind are refused', async () => {
  const builder = await current();
  builder.tools[1]!.acquire.builder = 'make';
  rejects(() => validateToolsConfig(builder, allowed), 'config-invalid');
  const kind = await current();
  kind.tools[0]!.acquire.kind = 'mirror';
  rejects(() => validateToolsConfig(kind, allowed), 'config-invalid');
});

test('a repository outside the main allow list is refused', async () => {
  const config = await current();
  config.tools[2]!.repository = 'https://github.com/someone/biome';
  rejects(() => validateToolsConfig(config, allowed), 'source-not-allowed');
});

test('tag patterns must be anchored with exactly one version group', async () => {
  for (const pattern of ['v(\\d+)$', '^v\\d+$', '^(v)(\\d+)$', '^v(\\d+$']) {
    const config = await current();
    config.tools[0]!.tagPattern = pattern;
    rejects(() => validateToolsConfig(config, allowed), 'config-invalid');
  }
});

test('b1-pack.json must be all null or a fully valid pack with digest-named tag', () => {
  const pack = {
    schemaVersion: 1,
    releaseTag: 'b1-61b209ae1c98',
    packAsset: 'aletheia-works-formicarium-0.3.0.tgz',
    packSha256:
      '61b209ae1c98690f4f69eeca25c06f6485d05420c339283416e0aff91ea9cb98',
    evidenceAsset: 'api-acceptance.json',
    evidenceSha256: 'a'.repeat(64),
  };
  assert.equal(validateB1Pack(pack)?.releaseTag, 'b1-61b209ae1c98');
  rejects(
    () => validateB1Pack({ ...pack, packSha256: 'A'.repeat(64) }),
    'config-invalid',
  );
  rejects(
    () => validateB1Pack({ ...pack, releaseTag: 'b1-000000000000' }),
    'config-invalid',
  );
  rejects(
    () => validateB1Pack({ ...pack, evidenceSha256: null }),
    'config-invalid',
  );
});

test('a config file with a duplicate JSON key is refused', async () => {
  await withLayout(async (layout) => {
    await mkdir(layout.root, { recursive: true });
    await writeFile(
      join(layout.root, 'dup.json'),
      '{"schemaVersion":1,"schemaVersion":1}',
    );
    await assert.rejects(
      readConfigFile('dup.json', layout.root),
      (error) => causeOf(error) === 'config-invalid',
    );
  });
});
