import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  assetName,
  companionNames,
  gnuTag,
  MAX_HOME_FILE_BYTES,
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
      ['git', 'gnu-source'],
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

test('everyPage is kept only as true, and any other value is refused', async () => {
  const config = await current();
  const tools = validateToolsConfig(config, allowed).tools;
  assert.equal(tools.find((item) => item.tool === 'nano')?.everyPage, true);
  assert.equal(Object.hasOwn(tools[0]!, 'everyPage'), false);
  for (const value of [false, 'yes', 1, null]) {
    const bad = await current();
    bad.tools[0]!.everyPage = value;
    rejects(() => validateToolsConfig(bad, allowed), 'config-invalid');
  }
});

test('homeFiles keeps small text files at plain relative paths', async () => {
  const config = await current();
  const tools = validateToolsConfig(config, allowed).tools;
  assert.deepEqual(tools.find((item) => item.tool === 'jj')?.homeFiles, {
    '.config/jj/config.toml':
      '[ui]\npaginate = "never"\n\n[user]\nname = "Showcase"\nemail = "showcase@example.com"\n',
  });
  assert.equal(Object.hasOwn(tools[0]!, 'homeFiles'), false);
  for (const value of [
    {},
    [],
    'x',
    { '/etc/passwd': 'x' },
    { '../escape': 'x' },
    { 'a/./b': 'x' },
    { 'a//b': 'x' },
    { '.': 'x' },
    { 'a/': 'x' },
    { 'a b': 'x' },
    { a: 1 },
    { a: 'x'.repeat(MAX_HOME_FILE_BYTES + 1) },
  ]) {
    const bad = await current();
    bad.tools[0]!.homeFiles = value;
    rejects(() => validateToolsConfig(bad, allowed), 'config-invalid');
  }
  const atLimit = await current();
  atLimit.tools[0]!.homeFiles = {
    '.a/b_c-1.toml': 'x'.repeat(MAX_HOME_FILE_BYTES),
  };
  assert.doesNotThrow(() => validateToolsConfig(atLimit, allowed));
});

test('two tools may not write the same home path or a path inside another', async () => {
  for (const [first, second] of [
    ['.config/jj/config.toml', '.config/jj/config.toml'],
    ['.config/jj', '.config/jj/config.toml'],
    ['.config/jj/config.toml', '.config/jj'],
  ]) {
    const bad = await current();
    const jj = bad.tools.find((item) => item.tool === 'jj')!;
    jj.homeFiles = { [first!]: 'x' };
    bad.tools[0]!.homeFiles = { [second!]: 'y' };
    rejects(() => validateToolsConfig(bad, allowed), 'config-invalid');
  }
  const config = await current();
  config.tools[0]!.homeFiles = { '.config/other/config.toml': 'y' };
  assert.doesNotThrow(() => validateToolsConfig(config, allowed));
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

test('git names its own source servers, GnuTLS and nettle, make variables and a companion', async () => {
  type Lib = Record<string, unknown> & { source?: Record<string, unknown> };
  const git = (config: { tools: ToolJson[] }) =>
    config.tools.find((item) => item.tool === 'git')!;
  const lib = (config: { tools: ToolJson[] }, index: number) =>
    (git(config).acquire.libraries as Lib[])[index]!;
  const source = (config: { tools: ToolJson[] }) =>
    git(config).acquire.source as Record<string, unknown>;
  const parsed = validateToolsConfig(await current(), allowed).tools.find(
    (item) => item.tool === 'git',
  )!;
  assert.equal(parsed.acquire.kind, 'gnu-source');
  if (parsed.acquire.kind !== 'gnu-source') return;
  assert.equal(parsed.acquire.source?.signedData, 'tar');
  assert.deepEqual(
    parsed.acquire.libraries.map((item) => [
      item.package,
      item.tag,
      item.source?.signature,
      item.source?.license,
    ]),
    [
      ['zlib', 'v{version}', '{tarball}.asc', 'LICENSE'],
      ['gmp', null, '{tarball}.sig', 'COPYINGv2'],
      [
        'nettle',
        'nettle_{version}_release_{date}',
        '{tarball}.sig',
        'COPYINGv2',
      ],
      ['gnutls', '{version}', '{tarball}.sig', 'COPYING.LESSERv2'],
      ['curl', 'curl-{major}_{minor}_{patch}', '{tarball}.asc', 'COPYING'],
    ],
  );
  // GMP has no repository; GnuTLS ships .tar.xz only; nettle is dual licensed.
  assert.equal(parsed.acquire.libraries[1]!.repository, null);
  assert.ok(parsed.acquire.libraries[3]!.source?.tarball.endsWith('.tar.xz'));
  assert.equal(
    parsed.acquire.libraries[2]!.spdx,
    'LGPL-3.0-or-later OR GPL-2.0-or-later',
  );
  assert.ok(parsed.acquire.make?.includes('NO_CURL='));
  assert.deepEqual(parsed.acquire.companions, [
    { binary: 'git-remote-https', output: 'git-remote-http' },
  ]);
  assert.deepEqual(companionNames(parsed), ['git-remote-https']);
  assert.deepEqual(
    companionNames(validateToolsConfig(await current(), allowed).tools[0]!),
    [],
  );
  // nano keeps the GNU defaults: no source settings at all.
  const nano = validateToolsConfig(await current(), allowed).tools.find(
    (item) => item.tool === 'nano',
  )!;
  assert.equal(
    nano.acquire.kind === 'gnu-source' && nano.acquire.source,
    undefined,
  );
  // A full signature URL without {tarball} and an absent signedData pass too.
  const accepted = await current();
  source(accepted).signature =
    'https://www.kernel.org/pub/software/scm/git/git-{major}.{minor}.{patch}.tar.asc';
  delete source(accepted).signedData;
  validateToolsConfig(accepted, allowed);
  // A library without a repository may also keep the plain GNU defaults.
  const plain = await current();
  delete lib(plain, 1).source;
  assert.equal(
    validateToolsConfig(plain, allowed).tools.at(-1)?.acquire.kind,
    'gnu-source',
  );
  const refused: ((config: { tools: ToolJson[] }) => void)[] = [
    // Source URLs: HTTPS, a plain host, known placeholders, no `..`.
    (config) => (source(config).listing = 'http://www.kernel.org/git/'),
    (config) => (source(config).listing = 'https://user@kernel.org/git/'),
    (config) => (source(config).listing = 'https://kernel.org/git/?x=1'),
    (config) => (source(config).listing = 'https://kernel.org/git/{tag}/'),
    (config) => (source(config).listing = 'https://kernel.org/../git/'),
    (config) => (source(config).listing = 'https://localhost/git/'),
    (config) =>
      (source(config).tarball = 'https://kernel.org/git-{version}.tar.bz2'),
    (config) =>
      (source(config).tarball = 'https://kernel.org/git-{version}.tar.gz.xz'),
    (config) =>
      (source(config).tarball = 'https://kernel.org/nano-{version}.tar.gz'),
    (config) => (source(config).signature = '{tarball}'),
    (config) => (source(config).signature = 'x{tarball}.asc'),
    (config) => (source(config).signature = '{tarball}/../x.asc'),
    (config) => (source(config).signature = 'https://kernel.org/git.tar.sign'),
    (config) =>
      (source(config).signature = 'https://kernel.org/x/git-{version}.tar.gz'),
    (config) => (source(config).signedData = 'archive'),
    (config) => (source(config).license = '../COPYING'),
    (config) => (source(config).extra = true),
    (config) => (git(config).acquire.source = 'https://kernel.org/'),
    // No library builder but autotools, and autotools arguments only.
    (config) => (lib(config, 2).builder = 'openssl'),
    (config) => (lib(config, 0).configure = ['linux x86_64']),
    // An autoconf cache answer is yes or no, nothing else.
    (config) => (lib(config, 0).configure = ['ac_cv_func_x=maybe']),
    (config) => (lib(config, 0).configure = ['ac_cv_func_x=$(id)']),
    (config) => (lib(config, 0).configure = ['cv_func_x=no']),
    // Tags: known placeholders only; {date} only on GitHub, once.
    (config) => (lib(config, 2).tag = 'nettle_{version}_{when}'),
    (config) => (lib(config, 2).tag = 'nettle_{date}'),
    (config) => (lib(config, 2).tag = 'nettle_{version}_{date}_{date}'),
    (config) => {
      lib(config, 2).repository = 'https://git.savannah.gnu.org/git/nano.git';
    },
    // No repository and tag: both or neither, never for the tool, and only
    // for a signed ftp.gnu.org tarball.
    (config) => (lib(config, 1).repository = 'https://github.com/madler/zlib'),
    (config) => (lib(config, 1).tag = 'v{version}'),
    (config) => delete lib(config, 0).tag,
    (config) => delete lib(config, 0).repository,
    (config) => delete git(config).acquire.tag,
    (config) => (lib(config, 1).source!.listing = 'https://zlib.net/'),
    (config) =>
      (lib(config, 1).source!.tarball =
        'https://zlib.net/gmp-{version}.tar.gz'),
    (config) => (lib(config, 1).source!.signature = '{tarball}.asc'),
    (config) => (lib(config, 1).source!.signedData = 'tar'),
    // SPDX: identifiers joined by OR/AND, nothing else.
    (config) => (lib(config, 2).spdx = 'LGPL-3.0-or-later or GPL-2.0'),
    (config) => (lib(config, 2).spdx = 'LGPL-3.0-or-later OR'),
    (config) => (lib(config, 2).spdx = '(MIT)'),
    // Make variables: NAME=value, nothing that steers make itself.
    (config) => (git(config).acquire.make = []),
    (config) => (git(config).acquire.make = ['-j1']),
    (config) => (git(config).acquire.make = ['NO_CURL=$(shell id)']),
    (config) => (git(config).acquire.make = ['MAKEFLAGS=-e']),
    (config) => (git(config).acquire.make = ['SHELL=/bin/sh']),
    // Companions: a tool name, a safe output, no clash with any tool.
    (config) => (git(config).acquire.companions = []),
    (config) =>
      (git(config).acquire.companions = [{ binary: 'Git', output: 'g' }]),
    (config) =>
      (git(config).acquire.companions = [{ binary: 'x', output: '../x' }]),
    (config) =>
      (git(config).acquire.companions = [{ binary: 'x', output: 'x', y: 1 }]),
    (config) =>
      (git(config).acquire.companions = [{ binary: 'git', output: 'git' }]),
    (config) =>
      (git(config).acquire.companions = [{ binary: 'jj', output: 'jj' }]),
  ];
  for (const change of refused) {
    const config = await current();
    change(config);
    rejects(() => validateToolsConfig(config, allowed), 'config-invalid');
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
