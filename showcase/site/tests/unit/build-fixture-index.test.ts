import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../../scripts/build-key.ts';
import {
  buildFixtureIndex,
  readFixtureTree,
  writeFixtureIndexes,
} from '../../scripts/build-fixture-index.ts';
import { validateFixtureIndex } from '../../src/model/fixture-index.ts';
import { tempDir, writeFiles } from './helpers.ts';

test('the real aube fixture keeps outside/ beside app/ (link:../outside/linked)', async () => {
  const index = await buildFixtureIndex('aube-local-deps');
  assert.deepEqual(
    index.entries.map((entry) => `${entry.type} ${entry.path}`),
    [
      'dir app',
      'dir app/filedep',
      'file app/filedep/package.json',
      'file app/package.json',
      'dir outside',
      'dir outside/linked',
      'file outside/linked/package.json',
    ],
  );
  const linked = index.entries.find(
    (entry) => entry.path === 'outside/linked/package.json',
  );
  assert.ok(linked?.type === 'file');
  assert.equal(Buffer.from(linked.bytes, 'base64').length, linked.size);
  assert.ok(
    String(
      await readFile(
        new URL(
          '../../../fixtures/aube-local-deps/app/package.json',
          import.meta.url,
        ),
      ),
    ).includes('link:../outside/linked'),
  );
});

test('modes are normalised: directories and executables 0755, other files 0644', async () => {
  const root = await tempDir('fixture');
  await writeFiles(root, {
    'app/run.sh': '#!/bin/sh\n',
    'app/private.txt': 'x',
    'app/sub/a.txt': 'a',
  });
  await chmod(join(root, 'app', 'run.sh'), 0o700);
  await chmod(join(root, 'app', 'private.txt'), 0o600);
  await chmod(join(root, 'app', 'sub'), 0o700);
  const entries = await readFixtureTree(root);
  assert.deepEqual(
    entries.map((entry) => [entry.path, entry.mode.toString(8)]),
    [
      ['app', '755'],
      ['app/private.txt', '644'],
      ['app/run.sh', '755'],
      ['app/sub', '755'],
      ['app/sub/a.txt', '644'],
    ],
  );
});

test('an empty directory fails the build', async () => {
  const root = await tempDir('fixture');
  await writeFiles(root, { 'app/a.txt': 'a' });
  await mkdir(join(root, 'app', 'empty'));
  await assert.rejects(
    readFixtureTree(root),
    /fixture-invalid: empty directory: app\/empty/,
  );
});

test('a symbolic link fails the build', async () => {
  const root = await tempDir('fixture');
  await writeFiles(root, { 'app/a.txt': 'a' });
  await symlink('a.txt', join(root, 'app', 'b.txt'));
  await assert.rejects(
    readFixtureTree(root),
    /symbolic link refused: app\/b\.txt/,
  );
});

test('a special file (FIFO) fails the build', async () => {
  const root = await tempDir('fixture');
  await writeFiles(root, { 'app/a.txt': 'a' });
  execFileSync('mkfifo', [join(root, 'app', 'pipe')]);
  await assert.rejects(
    readFixtureTree(root),
    /special file refused: app\/pipe/,
  );
});

test('each index is written as canonical JSON to demo-fixtures/<name>.json', async () => {
  const publicDir = await tempDir('public');
  const written = await writeFixtureIndexes(
    ['pitchfork-basic', 'biome-basic', 'biome-basic'],
    publicDir,
  );
  assert.deepEqual(
    written.map((item) => item.path),
    ['demo-fixtures/biome-basic.json', 'demo-fixtures/pitchfork-basic.json'],
  );
  const text = await readFile(
    join(publicDir, 'demo-fixtures', 'biome-basic.json'),
    'utf8',
  );
  assert.equal(sha256(text), written[0]!.sha256);
  assert.equal(validateFixtureIndex(JSON.parse(text)).fixture, 'biome-basic');
  assert.doesNotMatch(text, /\n/);
});
