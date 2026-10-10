import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  access,
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const { publicationBundles } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/bundle.js')).href
)) as typeof import('../../scripts/release/bundle.js');
const biome = resolve('node_modules/@biomejs/biome/bin/biome');
async function bunPath() {
  if (process.env.BUN_EXECUTABLE) return process.env.BUN_EXECUTABLE;
  for (const location of [
    join(homedir(), '.local/share/mise/installs/bun'),
    join(homedir(), 'AppData/Local/mise/installs/bun'),
  ]) {
    let versions: string[] = [];
    try {
      versions = await readdir(location);
    } catch {
      continue;
    }
    for (const version of versions)
      for (const path of [
        join(location, version, 'bin/bun'),
        join(location, version, 'bun'),
      ]) {
        try {
          await access(path);
          const result = spawnSync(path, ['--version'], { encoding: 'utf8' });
          if (result.status === 0 && result.stdout.trim() === '1.4.2')
            return path;
        } catch {
          /*Only fixed installed executable.*/
        }
      }
  }
  throw Error('fixed Bun1.4.2 unavailable');
}
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'publication-bundle-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp('scripts', join(root, 'scripts'), { recursive: true });
  await cp('.github/publication', join(root, '.github/publication'), {
    recursive: true,
  });
  await cp('biome.json', join(root, 'biome.json'));
  return root;
}
test('fixed Bun and Biome reproduce actual tracked runner bootstrap and manifest bytes', async () => {
  const rows = await publicationBundles(process.cwd(), await bunPath(), biome);
  assert.deepEqual(
    rows.map((item) => item.path),
    ['runner.mjs', 'trusted-policy.json'],
  );
  assert.ok(
    rows.every((item) => item.size > 0 && /^[a-f0-9]{64}$/.test(item.sha256)),
  );
});
test('generated runner or independent bootstrap alteration cannot pass regeneration', async (t) => {
  for (const name of ['runner.mjs', 'bootstrap.mjs']) {
    const root = await fixture(t);
    await writeFile(join(root, '.github/publication', name), 'modified');
    await assert.rejects(
      publicationBundles(root, await bunPath(), biome),
      /BUNDLE_MISMATCH/,
    );
  }
});
test('trusted config alteration invalidates the complete tracked manifest', async (t) => {
  const root = await fixture(t),
    path = join(root, '.github/publication/trusted-policy.json');
  const value = JSON.parse(await readFile(path, 'utf8'));
  value.writerEnabled = true;
  await writeFile(path, JSON.stringify(value));
  await assert.rejects(
    publicationBundles(root, await bunPath(), biome),
    /MANIFEST_MISMATCH/,
  );
});
test('version mismatch or untrusted executable refuses before bundle generation', async () => {
  await assert.rejects(
    publicationBundles(process.cwd(), process.execPath, biome),
    /TOOLCHAIN_MISMATCH/,
  );
  await assert.rejects(
    publicationBundles(process.cwd(), 'bun', biome),
    /UNTRUSTED_EXECUTABLE/,
  );
});
test('Node starts both actual bundles with no dependency installation', () => {
  for (const name of ['runner.mjs', 'bootstrap.mjs']) {
    const result = spawnSync(
      process.execPath,
      [resolve('.github/publication', name)],
      {
        cwd: tmpdir(),
        env: { PATH: process.env.PATH ?? '' },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|ENOENT/);
    assert.match(
      result.stderr,
      name === 'bootstrap.mjs' ? /PUBLICATION_BOOTSTRAP_REJECTED/ : /usage:/,
    );
  }
});
test('missing tracked executable manifest or config is not treated as successful supply', async (t) => {
  for (const name of [
    'runner.mjs',
    'runner-manifest.json',
    'trusted-policy.json',
  ]) {
    const root = await fixture(t);
    await rm(join(root, '.github/publication', name));
    await assert.rejects(
      publicationBundles(root, await bunPath(), biome),
      /ENOENT/,
    );
  }
});
