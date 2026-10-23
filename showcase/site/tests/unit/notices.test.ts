import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { SITE_ROOT } from '../../scripts/common.ts';
import {
  buildNotices,
  packageNotice,
  packagesFromModules,
} from '../../scripts/notices.ts';
import { tempDir, writeFiles } from './helpers.ts';

test('packages come from the last node_modules segment; first-party modules are skipped', () => {
  const packages = packagesFromModules([
    '/repo/showcase/site/node_modules/@xterm/xterm/lib/xterm.mjs',
    '/repo/showcase/site/node_modules/@xterm/xterm/css/xterm.css',
    '/repo/showcase/site/node_modules/astro/node_modules/nested/index.js',
    'C:\\repo\\node_modules\\zeta\\index.js',
    '/repo/showcase/site/src/terminal/terminal-host.ts',
    '\0vite/preload-helper.js',
  ]);
  assert.deepEqual([...packages.keys()], ['@xterm/xterm', 'nested', 'zeta']);
  assert.equal(
    packages.get('nested'),
    '/repo/showcase/site/node_modules/astro/node_modules/nested',
  );
});

test('a package license file is found under its usual names', async () => {
  for (const name of [
    'LICENSE',
    'LICENSE.md',
    'LICENCE',
    'license.txt',
    'COPYING',
  ]) {
    const directory = await tempDir('pkg');
    await writeFiles(directory, {
      'package.json': '{"name":"p","version":"1.0.0","license":"MIT"}',
      [name]: 'MIT text\n',
    });
    const notice = await packageNotice(directory);
    assert.deepEqual(
      [notice.name, notice.version, notice.license, notice.file, notice.text],
      ['p', '1.0.0', 'MIT', name, 'MIT text'],
    );
  }
});

test('a LICENSE directory (as pagefind ships) contributes every file inside', async () => {
  const directory = await tempDir('pkg');
  await writeFiles(directory, {
    'package.json': '{"name":"pagefind","version":"1.5.2","license":"MIT"}',
    'LICENSE/LICENSE': 'MIT pagefind\n',
    'LICENSE/LICENSE-vscode-ripgrep': 'MIT ripgrep\n',
  });
  const notice = await packageNotice(directory);
  assert.equal(notice.file, 'LICENSE');
  assert.equal(
    notice.text,
    '--- LICENSE/LICENSE\nMIT pagefind\n\n--- LICENSE/LICENSE-vscode-ripgrep\nMIT ripgrep',
  );
});

test('@pagefind/default-ui takes the license of pagefind only for the same repository and version', async () => {
  const root = await tempDir('modules');
  const files = (version: string) => ({
    'node_modules/pagefind/package.json':
      '{"name":"pagefind","version":"1.5.2","license":"MIT","repository":{"url":"https://github.com/Pagefind/pagefind"}}',
    'node_modules/pagefind/LICENSE': 'MIT pagefind\n',
    'node_modules/@pagefind/default-ui/package.json': `{"name":"@pagefind/default-ui","version":"${version}","license":"MIT","repository":{"url":"git+https://github.com/Pagefind/pagefind.git"}}`,
  });
  await writeFiles(root, files('1.5.2'));
  const notice = await packageNotice(
    join(root, 'node_modules/@pagefind/default-ui'),
  );
  assert.deepEqual(
    [notice.file, notice.text],
    ['pagefind/LICENSE', 'MIT pagefind'],
  );
  const other = await tempDir('modules');
  await writeFiles(other, files('1.5.1'));
  await assert.rejects(
    packageNotice(join(other, 'node_modules/@pagefind/default-ui')),
    /has no license file/,
  );
});

test('a package without a license file fails the build', async () => {
  const directory = await tempDir('pkg');
  await writeFiles(directory, {
    'package.json': '{"name":"nolicense","version":"1.0.0"}',
    'README.md': 'x',
  });
  await assert.rejects(
    packageNotice(directory),
    /notices-missing: nolicense has no license file/,
  );
  await assert.rejects(
    packageNotice(join(directory, 'absent')),
    /package\.json unreadable/,
  );
});

async function inputs() {
  const root = await tempDir('notices');
  await writeFiles(root, {
    'formicarium/LICENSE': 'Apache License 2.0\n',
    'formicarium/THIRD_PARTY_NOTICES.md': '# paludarium Apache-2.0\n',
    'candidate/site/NOTICES.md': '# Showcase guest notices\n',
    'candidate/site/licenses/aube-LICENSE': 'MIT aube\n',
    'node_modules/@xterm/xterm/package.json':
      '{"name":"@xterm/xterm","version":"6.0.0","license":"MIT"}',
    'node_modules/@xterm/xterm/LICENSE': 'MIT xterm\n',
  });
  return root;
}

test('THIRD_PARTY_NOTICES holds formicarium, the guests and every site package', async () => {
  const root = await inputs();
  const { text, packages } = await buildNotices({
    modules: [join(root, 'node_modules/@xterm/xterm/lib/xterm.mjs')],
    copiedPackages: [join(SITE_ROOT, 'node_modules', 'coi-serviceworker')],
    formicariumDir: join(root, 'formicarium'),
    candidateSiteDir: join(root, 'candidate', 'site'),
  });
  assert.deepEqual(
    packages.map((item) => `${item.name}@${item.version}`),
    ['@xterm/xterm@6.0.0', 'coi-serviceworker@0.1.7'],
  );
  for (const expected of [
    'Apache License 2.0',
    '# paludarium Apache-2.0',
    '# Showcase guest notices',
    'MIT aube',
    'MIT xterm',
    '### coi-serviceworker 0.1.7 (MIT)',
  ])
    assert.ok(text.includes(expected), expected);
  assert.ok(text.endsWith('\n'));
});

test('missing formicarium or guest notices fail the build', async () => {
  const root = await inputs();
  await assert.rejects(
    buildNotices({
      modules: [],
      copiedPackages: [],
      formicariumDir: join(root, 'absent'),
      candidateSiteDir: join(root, 'candidate', 'site'),
    }),
    /formicarium LICENSE missing/,
  );
  await assert.rejects(
    buildNotices({
      modules: [],
      copiedPackages: [],
      formicariumDir: join(root, 'formicarium'),
      candidateSiteDir: join(root, 'absent'),
    }),
    /candidate NOTICES\.md missing/,
  );
});
