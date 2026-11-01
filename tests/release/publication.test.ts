import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { PACKAGE_FILES, sha256 } from '../../scripts/package/stage-package.js';
import type { PublicationIdentity } from '../../scripts/release/publication.js';
import {
  preparePublication,
  validatePublication,
  validatePublicationIdentity,
} from '../../scripts/release/publication.js';

const identity: PublicationIdentity = {
  repository: 'aletheia-works/formicarium',
  workflow: 'publish.yml',
  environment: 'release',
  sourceCommit: 'b'.repeat(40),
  version: '0.1.0',
  tag: 'v0.1.0',
  distTag: 'latest',
};
async function archiveFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'publication-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = {
    name: '@aletheia-works/formicarium',
    version: '0.1.0',
    private: true,
    type: 'module',
    exports: Object.fromEntries(
      [
        '.',
        './node',
        './browser',
        './assets/paludarium/index.mjs',
        './assets/paludarium/paludarium.wasm',
        './assets/paludarium/build-info.json',
      ].map((key) => [key, './fixture.js']),
    ),
  };
  const files = [];
  for (const path of PACKAGE_FILES) {
    const bytes =
      path === 'package.json'
        ? JSON.stringify(manifest)
        : `fixture-only ${path}`;
    await mkdir(dirname(join(root, 'package', path)), { recursive: true });
    await writeFile(join(root, 'package', path), bytes);
    files.push({ path, sha256: sha256(bytes) });
  }
  const oldTar = join(root, 'old.tgz'),
    oldManifest = join(root, 'old.json'),
    out = join(root, 'prepared');
  execFileSync('tar', [
    '-czf',
    oldTar,
    '-C',
    root,
    ...PACKAGE_FILES.map((p) => `package/${p}`),
  ]);
  await writeFile(
    oldManifest,
    JSON.stringify({
      core: { package: '@aletheia-works/paludarium-wasm', version: '0.4.0' },
      files,
      tarball: { sha256: sha256(await readFile(oldTar)) },
    }),
  );
  const args = {
    originalManifestPath: oldManifest,
    originalTarballPath: oldTar,
    out,
    identity,
  };
  const pack = (source: string, target: string) =>
    execFileSync('tar', [
      '-czf',
      target,
      '-C',
      source,
      ...PACKAGE_FILES.map((p) => `package/${p}`),
    ]);
  return { root, oldTar, oldManifest, out, args, pack };
}
async function packPrepared(f: Awaited<ReturnType<typeof archiveFixture>>) {
  // npm pack's package/ layout without invoking npm or the network.
  const container = join(f.root, 'new-container');
  await mkdir(container);
  await symlink(f.out, join(container, 'package'));
  const archive = join(f.root, 'new.tgz');
  execFileSync('tar', [
    '-czf',
    archive,
    '-C',
    container,
    ...PACKAGE_FILES.map((p) => `package/${p}`),
  ]);
  return archive;
}
test('prepare public manifest keeps all nonmanifest bytes and original archive immutable', async (t) => {
  const f = await archiveFixture(t),
    old = await readFile(f.oldTar),
    candidate = await preparePublication(f.args),
    tarball = await packPrepared(f);
  const result = await validatePublication(candidate, identity, tarball);
  assert.equal(result.tarball.sha256, sha256(await readFile(tarball)));
  assert.deepEqual(await readFile(f.oldTar), old);
  for (const path of PACKAGE_FILES.filter((p) => p !== 'package.json'))
    assert.deepEqual(
      await readFile(join(f.out, path)),
      await readFile(join(f.root, 'package', path)),
    );
  const manifest = JSON.parse(
    await readFile(join(f.out, 'package.json'), 'utf8'),
  );
  assert.equal(manifest.private, false);
  assert.equal(
    manifest.repository.url,
    'git+https://github.com/aletheia-works/formicarium.git',
  );
});
test('reject private or wrong repository publication manifests', async (t) => {
  for (const change of [
    { private: true },
    {
      repository: { type: 'git', url: 'git+https://github.com/other/fork.git' },
    },
  ]) {
    const f = await archiveFixture(t),
      c = await preparePublication(f.args);
    const path = join(f.out, 'package.json'),
      value = { ...JSON.parse(await readFile(path, 'utf8')), ...change },
      bytes = JSON.stringify(value);
    await writeFile(path, bytes);
    c.files.find((row) => row.path === 'package.json')!.sha256 = sha256(bytes);
    await assert.rejects(
      validatePublication(c, identity, await packPrepared(f)),
      /private|repository/,
    );
  }
});
test('reject missing repository, wrong version or tag, a release candidate and another dist-tag', () => {
  for (const change of [
    { repository: '' },
    { version: '1.0.0' },
    { tag: 'v0.1.1' },
    { version: '0.1.0-rc.1', tag: 'v0.1.0-rc.1' },
    { distTag: 'next' },
  ])
    assert.throws(() =>
      validatePublicationIdentity({
        ...identity,
        ...change,
      } as PublicationIdentity),
    );
});
test('reject same-size archive mutation and a different identity', async (t) => {
  const f = await archiveFixture(t),
    c = await preparePublication(f.args),
    path = join(f.out, 'LICENSE'),
    bytes = await readFile(path);
  bytes[0] ^= 1;
  await writeFile(path, bytes);
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(f)),
    /archive digest/,
  );
  await assert.rejects(
    validatePublication(
      c,
      { ...identity, sourceCommit: 'c'.repeat(40) },
      f.oldTar,
    ),
    /identity/,
  );
});
test('reject original inventory deviation and symlink archive entry', async (t) => {
  const f = await archiveFixture(t),
    original = JSON.parse(await readFile(f.oldManifest, 'utf8'));
  original.files[0].path = 'unexpected.js';
  await writeFile(f.oldManifest, JSON.stringify(original));
  await assert.rejects(preparePublication(f.args), /digest/);
  const g = await archiveFixture(t),
    c = await preparePublication(g.args);
  await rm(join(g.out, 'LICENSE'));
  await symlink('/etc/passwd', join(g.out, 'LICENSE'));
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(g)),
    /links/,
  );
});
test('reject registry/access drift and refuse existing output including symlink', async (t) => {
  const f = await archiveFixture(t),
    c = await preparePublication(f.args);
  const path = join(f.out, 'package.json'),
    value = JSON.parse(await readFile(path, 'utf8'));
  value.publishConfig.registry = 'https://example.invalid/';
  const bytes = JSON.stringify(value);
  await writeFile(path, bytes);
  c.files.find((row) => row.path === 'package.json')!.sha256 = sha256(bytes);
  await assert.rejects(
    validatePublication(c, identity, await packPrepared(f)),
    /registry/,
  );
  await assert.rejects(preparePublication(f.args), /EEXIST/);
  await symlink(f.out, join(f.root, 'link'));
  await assert.rejects(
    preparePublication({ ...f.args, out: join(f.root, 'link') }),
    /EEXIST/,
  );
});
