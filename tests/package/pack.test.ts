import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FIRST_PARTY_JS,
  PACKAGE_FILES,
  sha256,
} from '../../scripts/package/stage-package.js';

const candidate = JSON.parse(
  await readFile(
    process.env.FORMICARIUM_CANDIDATE ??
      new URL('../../.artifacts/u1-package.manifest.json', import.meta.url),
    'utf8',
  ),
);
const read = (path: string) =>
  execFileSync('tar', ['-xOzf', candidate.tarball.path, `package/${path}`]);
test('candidate binds one real tgz by SHA256', async () => {
  assert.equal(
    sha256(await readFile(candidate.tarball.path)),
    candidate.tarball.sha256,
  );
  assert.match(candidate.tarball.sha256, /^[a-f0-9]{64}$/);
});
test('real tarball inventory is exactly the fixed public files', () => {
  const paths = execFileSync('tar', ['-tzf', candidate.tarball.path], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((path) => !path.endsWith('/'))
    .map((path) => path.slice(8));
  assert.deepEqual(paths.sort(), [...PACKAGE_FILES].sort());
  assert.equal(FIRST_PARTY_JS.length, 23);
  assert.equal(PACKAGE_FILES.length, 33);
});
test('real tarball every file matches staged manifest digest', () => {
  assert.deepEqual(
    candidate.files.map((entry: { path: string }) => entry.path).sort(),
    [...PACKAGE_FILES].sort(),
  );
  for (const entry of candidate.files)
    assert.equal(sha256(read(entry.path)), entry.sha256, entry.path);
});
test('package exports six exact entries and no development tools/dependencies', () => {
  const pkg = JSON.parse(read('package.json').toString('utf8'));
  assert.deepEqual(Object.keys(pkg.exports), [
    '.',
    './node',
    './browser',
    './assets/blink.mjs',
    './assets/blink.wasm',
    './assets/build-info.json',
  ]);
  assert.equal(pkg.name, '@aletheia-works/formicarium');
  assert.equal(pkg.private, true);
  assert.equal(pkg.version, candidate.version);
  assert.equal(pkg.scripts, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
test('assets identify pinned clean core and exact loader/wasm bytes', async () => {
  const info = JSON.parse(read('assets/build-info.json').toString('utf8'));
  const lock = await readFile(
    new URL('../../blink.lock', import.meta.url),
    'utf8',
  );
  assert.equal(info.blinkCommit, /^commit=(\w+)$/m.exec(lock)?.[1]);
  assert.equal(info.blinkSourceDirty, false);
  assert.equal(
    info.assetDigests.loaderSha256,
    sha256(read('assets/blink.mjs')),
  );
  assert.equal(info.assetDigests.wasmSha256, sha256(read('assets/blink.wasm')));
});
test('license/notices/types/readme are nonempty and guests stay external', () => {
  for (const path of [
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'README.md',
    'types/index.d.ts',
    'types/node.d.ts',
    'types/browser.d.ts',
  ])
    assert.ok(read(path).length > 100, path);
  assert.ok(
    !PACKAGE_FILES.some((path) =>
      /guest\/|fixtures\/|registry|run\.mjs|service-worker/.test(path),
    ),
  );
});

test('packed README community links resolve to the upstream repository', () => {
  const readme = read('README.md').toString('utf8');
  for (const filename of [
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
  ]) {
    const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => target?.endsWith(filename));
    assert.deepEqual(
      links,
      [`https://github.com/aletheia-works/formicarium/blob/main/${filename}`],
      `${filename} is outside the tarball and needs its upstream URL`,
    );
  }
});
