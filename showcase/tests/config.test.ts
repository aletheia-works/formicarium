import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  assetName,
  gnuTag,
  readConfigFile,
  validateAllowedSources,
  validateFormicariumRelease,
  validateToolsConfig,
  validateTrustedCallers,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { MAIN_ALLOWED, withLayout } from './fixtures/work.ts';

const allowed = validateAllowedSources(JSON.parse(MAIN_ALLOWED));
const SIGNER = '168E6F4297BFD7A79AFD4496514BBE2EB8E1961F';
type ToolJson = Record<string, unknown> & { acquire: Record<string, unknown> };
const current = async () =>
  structuredClone(await readConfigFile('tools.json')) as { tools: ToolJson[] };
const rejects = (run: () => unknown, code: string) =>
  assert.throws(run, (error) => causeOf(error) === code);

test('the committed tools.json, allow list, callers and release pin are valid', async () => {
  const tools = validateToolsConfig(await current(), allowed);
  assert.deepEqual(
    tools.tools.map((tool) => [tool.tool, tool.acquire.kind]),
    [
      ['aube', 'release-asset'],
      ['pitchfork', 'source-build'],
      ['biome', 'release-asset'],
      ['nano', 'gnu-source'],
      ['jj', 'release-asset'],
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
  // The pin moves with each release (showcase-release-pin.yml), so only its
  // shape is fixed here: a complete pin, never the unpinned null.
  assert.notEqual(
    validateFormicariumRelease(
      await readConfigFile('formicarium-release.json'),
    ),
    null,
  );
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

test('interactive is kept only as true, and any other value is refused', async () => {
  const config = await current();
  config.tools[2]!.interactive = true;
  const tools = validateToolsConfig(config, allowed).tools;
  assert.equal(tools[2]!.interactive, true);
  assert.equal(Object.hasOwn(tools[0]!, 'interactive'), false);
  for (const value of [false, 'yes', 1, null]) {
    const bad = await current();
    bad.tools[0]!.interactive = value;
    rejects(() => validateToolsConfig(bad, allowed), 'config-invalid');
  }
});

test('onDemand is kept only as true, and any other value is refused', async () => {
  const config = await current();
  const tools = validateToolsConfig(config, allowed).tools;
  assert.equal(tools.find((item) => item.tool === 'nano')?.onDemand, true);
  assert.equal(Object.hasOwn(tools[0]!, 'onDemand'), false);
  for (const value of [false, 'yes', 1, null]) {
    const bad = await current();
    bad.tools[0]!.onDemand = value;
    rejects(() => validateToolsConfig(bad, allowed), 'config-invalid');
  }
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

test('a gnu-source tool needs pinned signers, a version tag and allowed libraries', async () => {
  const nano = (config: { tools: ToolJson[] }) =>
    config.tools.find((item) => item.tool === 'nano')!;
  const ncurses = (config: { tools: ToolJson[] }) =>
    (nano(config).acquire.libraries as Record<string, unknown>[])[0]!;
  const parsed = validateToolsConfig(await current(), allowed).tools.find(
    (item) => item.tool === 'nano',
  );
  assert.equal(parsed?.acquire.kind, 'gnu-source');
  assert.equal(parsed?.interactive, true);
  assert.equal(gnuTag('v{major}_{minor}', '6.6'), 'v6_6');
  assert.equal(gnuTag('v{version}.{patch}', '9.3'), 'v9.3.0');
  const refused: [(config: { tools: ToolJson[] }) => void, string][] = [
    [(config) => (nano(config).acquire.builder = 'meson'), 'config-invalid'],
    [(config) => (nano(config).acquire.signers = ['abc']), 'config-invalid'],
    [
      (config) => (nano(config).acquire.signers = [SIGNER, SIGNER]),
      'config-invalid',
    ],
    [(config) => (nano(config).acquire.tag = 'v9.3'), 'config-invalid'],
    [(config) => (nano(config).acquire.package = 'Nano'), 'config-invalid'],
    [(config) => (nano(config).acquire.configure = '--x'), 'config-invalid'],
    [
      (config) => (nano(config).acquire.configure = ['--x; rm -rf /']),
      'config-invalid',
    ],
    [(config) => (nano(config).acquire.output = '../nano'), 'config-invalid'],
    [(config) => (nano(config).acquire.libraries = {}), 'config-invalid'],
    [(config) => (ncurses(config).package = 'nano'), 'config-invalid'],
    [(config) => (ncurses(config).extra = true), 'config-invalid'],
    [
      (config) =>
        (ncurses(config).repository = 'https://github.com/someone/ncurses'),
      'source-not-allowed',
    ],
  ];
  for (const [change, code] of refused) {
    const config = await current();
    change(config);
    rejects(() => validateToolsConfig(config, allowed), code);
  }
});

test('the allow list takes GitHub and Savannah git repositories only', () => {
  const list = (repository: string) => () =>
    validateAllowedSources({ schemaVersion: 1, repositories: [repository] });
  for (const repository of [
    'https://github.com/aubepkg/aube',
    'https://git.savannah.gnu.org/git/nano.git',
  ])
    assert.deepEqual(list(repository)().repositories, [repository]);
  for (const repository of [
    'http://git.savannah.gnu.org/git/nano.git',
    'https://git.savannah.gnu.org/git/nano',
    'https://git.savannah.gnu.org/cgit/nano.git',
    'https://git.savannah.gnu.org/git/../nano.git',
    'https://gitlab.com/someone/nano',
  ])
    rejects(list(repository), 'config-invalid');
});

test('a release asset or a Cargo build needs a GitHub repository', async () => {
  const savannah = {
    ...allowed,
    repositories: [
      ...allowed.repositories,
      'https://git.savannah.gnu.org/git/biome.git',
    ],
  };
  for (const index of [1, 2]) {
    const config = await current();
    config.tools[index]!.repository =
      'https://git.savannah.gnu.org/git/biome.git';
    rejects(() => validateToolsConfig(config, savannah), 'config-invalid');
  }
});

test('tag patterns must be anchored with exactly one version group', async () => {
  for (const pattern of ['v(\\d+)$', '^v\\d+$', '^(v)(\\d+)$', '^v(\\d+$']) {
    const config = await current();
    config.tools[0]!.tagPattern = pattern;
    rejects(() => validateToolsConfig(config, allowed), 'config-invalid');
  }
});

test('formicarium-release.json must be all null or a full npm version, integrity and commit', () => {
  const release = {
    schemaVersion: 1,
    version: '0.4.0',
    integrity: `sha512-${'A'.repeat(86)}==`,
    sourceCommit: 'a'.repeat(40),
  };
  assert.deepEqual(validateFormicariumRelease(release), {
    version: '0.4.0',
    integrity: release.integrity,
    sourceCommit: release.sourceCommit,
  });
  assert.equal(
    validateFormicariumRelease({
      schemaVersion: 1,
      version: null,
      integrity: null,
      sourceCommit: null,
    }),
    null,
  );
  for (const change of [
    { version: '1.0.0-rc.2' },
    { version: 'v0.4.0' },
    { version: '0.4' },
    { integrity: 'sha256-abc' },
    { sourceCommit: 'A'.repeat(40) },
    { sourceCommit: null },
    { extra: 1 },
    { schemaVersion: 2 },
  ])
    rejects(
      () => validateFormicariumRelease({ ...release, ...change }),
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
