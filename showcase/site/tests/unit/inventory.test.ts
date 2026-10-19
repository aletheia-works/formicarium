import assert from 'node:assert/strict';
import { appendFile, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import {
  IDENTITY_FILE,
  identityFromEnvironment,
  writeSiteIdentity,
} from '../../scripts/build-site-identity.ts';
import {
  computeInventory,
  inventoryDifference,
  readInventory,
  requireSameInventory,
} from '../../scripts/inventory.ts';
import { COMMIT, SHA, tempDir, writeFiles } from './helpers.ts';

async function site() {
  const root = await tempDir('site');
  await writeFiles(root, {
    'index.html': '<!doctype html>',
    'ja/index.html': '<!doctype html>',
    '.well-known/x.txt': 'dot',
    '_astro/a.js': 'export {}',
  });
  return root;
}

test('the inventory lists every file in path order, dotfiles and the identity file included', async () => {
  const root = await site();
  await writeSiteIdentity(
    root,
    identityFromEnvironment(
      { GITHUB_RUN_NUMBER: '7', SHOWCASE_SOURCE_COMMIT: COMMIT },
      SHA,
    ),
  );
  const inventory = await computeInventory(root);
  assert.deepEqual(
    inventory.files.map((file) => file.path),
    [
      '.well-known/x.txt',
      '_astro/a.js',
      'index.html',
      'ja/index.html',
      IDENTITY_FILE,
    ],
  );
  assert.match(inventory.sha256, /^[a-f0-9]{64}$/);
});

test('the identity file holds run number, source commit and candidate only', async () => {
  const root = await tempDir('site');
  const text = await writeSiteIdentity(
    root,
    identityFromEnvironment(
      { GITHUB_RUN_NUMBER: '7', GITHUB_SHA: COMMIT },
      SHA,
    ),
  );
  assert.deepEqual(JSON.parse(text), {
    candidateId: SHA,
    runNumber: 7,
    schemaVersion: 1,
    sourceCommit: COMMIT,
  });
  assert.throws(
    () =>
      identityFromEnvironment(
        { GITHUB_RUN_NUMBER: 'x', GITHUB_SHA: COMMIT },
        SHA,
      ),
    /GITHUB_RUN_NUMBER/,
  );
  assert.throws(
    () =>
      identityFromEnvironment(
        { GITHUB_RUN_NUMBER: '7', GITHUB_SHA: 'main' },
        SHA,
      ),
    /identity-invalid/,
  );
});

test('a recorded inventory is read back and compared with the final bytes', async () => {
  const root = await site();
  const recorded = await computeInventory(root);
  const file = join(await tempDir('record'), 'site-inventory.json');
  await writeFile(file, JSON.stringify(recorded));
  assert.deepEqual(await readInventory(file), recorded);
  assert.equal(
    (await requireSameInventory(root, recorded)).sha256,
    recorded.sha256,
  );
});

test('a byte changed after the inventory, or an added file, is found', async () => {
  const root = await site();
  const recorded = await computeInventory(root);
  await appendFile(join(root, 'index.html'), '<script>evil()</script>');
  await writeFile(join(root, 'added.js'), '1');
  await assert.rejects(
    requireSameInventory(root, recorded),
    /inventory-mismatch: site differs from the recorded inventory: added\.js, index\.html/,
  );
  assert.deepEqual(
    inventoryDifference(recorded, await computeInventory(root)),
    ['added.js', 'index.html'],
  );
});

test('a relative site path (as the workflow passes it) gives the same inventory', async () => {
  const root = await site();
  const absolute = await computeInventory(root);
  assert.equal(
    (await computeInventory(relative(process.cwd(), root))).sha256,
    absolute.sha256,
  );
});

test('a symbolic link in the site is refused', async () => {
  const root = await site();
  await symlink('index.html', join(root, 'link.html'));
  await assert.rejects(computeInventory(root), /symbolic link refused/);
});
