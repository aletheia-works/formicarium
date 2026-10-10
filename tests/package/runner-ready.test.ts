import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { elfHeader, isolatedDirectory } from './fixtures.js';

test('U1 runner supports ESM, assertions and isolated cleanup on Node >=24', async (t) => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24);
  const directory = await isolatedDirectory(t);
  assert.ok(directory.includes('formicarium-u1-'));
  assert.deepEqual([...elfHeader().slice(0, 4)], [127, 69, 76, 70]);
});

test('U1 tool dependencies match the lockfile', async () => {
  const bun = process.env.FORMICARIUM_CI_BUN ?? 'bun';
  assert.equal(
    execFileSync(bun, ['--version'], { encoding: 'utf8', shell: false }).trim(),
    '1.4.2',
  );
  // Bun's native JSONC parser handles its generated lock format. Feed bytes
  // through stdin, never interpolate lock contents into executable code.
  const lock = JSON.parse(
    execFileSync(
      bun,
      [
        '--eval',
        'console.log(JSON.stringify(Bun.JSONC.parse(await Bun.stdin.text())))',
      ],
      {
        input: await readFile(
          new URL('../../bun.lock', import.meta.url),
          'utf8',
        ),
        encoding: 'utf8',
        shell: false,
      },
    ),
  ) as {
    lockfileVersion: number;
    workspaces: Record<string, { devDependencies: Record<string, string> }>;
    packages: Record<string, [string, string, unknown, string]>;
  };
  assert.equal(lock.lockfileVersion, 2);
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    lock.workspaces['']!.devDependencies,
    manifest.devDependencies,
  );
  const dependencies = [
    '@playwright/test',
    'typescript',
    '@biomejs/biome',
    'istanbul-lib-instrument',
    'istanbul-lib-coverage',
  ];
  for (const name of dependencies) {
    const metadata = JSON.parse(
      await readFile(
        new URL(`../../node_modules/${name}/package.json`, import.meta.url),
        'utf8',
      ),
    );
    const pinned = lock.packages[name];
    assert.ok(pinned, `${name} must have a resolved lock entry`);
    assert.equal(metadata.name, name);
    assert.equal(pinned[0], `${name}@${metadata.version}`, name);
    assert.match(pinned[3], /^sha512-[A-Za-z0-9+/]+={0,2}$/, name);
  }
});

test('U1 browser configuration keeps all three browsers, one worker and no retries', async () => {
  const { default: config } = await import('./playwright.config.ts');
  assert.deepEqual(
    config.projects?.map(({ name }) => name),
    ['chromium', 'firefox', 'webkit'],
  );
  assert.equal(config.workers, 1);
  assert.equal(config.retries, 0);
});
