import { execFileSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE_ROOT } from '../../scripts/common.ts';
import type { SiteData } from '../../src/site-data.ts';
import { tempDir, writeFiles } from './helpers.ts';

const SHA = 'a'.repeat(64);
export const TEST_TOOLS = [
  { tool: 'aube', version: '2.7.2', fixture: 'aube-local-deps' },
  { tool: 'biome', version: '2.5.15', fixture: 'biome-basic' },
  { tool: 'git', version: '2.56.0', fixture: 'git-basic' },
  { tool: 'jj', version: '0.46.0', fixture: 'jj-basic' },
  { tool: 'nano', version: '9.3', fixture: 'nano-basic' },
  { tool: 'pitchfork', version: '2.32.0', fixture: 'pitchfork-basic' },
];

/** Site data of a small test candidate (no real pack or guest is needed to render). */
export function testSiteData(overrides: Partial<SiteData> = {}): SiteData {
  return {
    schemaVersion: 1,
    candidateId: SHA,
    catalog: { path: 'catalog.json', sha256: SHA },
    tools: TEST_TOOLS.map((tool) => ({
      ...tool,
      repository: `https://github.com/example/${tool.tool}`,
      fixtureIndex: { path: `demo-fixtures/${tool.fixture}.json`, sha256: SHA },
      // git's build also gives git-remote-https, installed with it.
      ...(tool.tool === 'git' ? { companions: ['git-remote-https'] } : {}),
    })),
    formicarium: {
      version: '0.3.0',
      base: '_formicarium/0.3.0/',
      root: 'runtime/public.js',
      browser: 'runtime/web/api.js',
      assets: {
        loader: 'assets/paludarium/index.mjs',
        wasm: 'assets/paludarium/paludarium.wasm',
        worker: 'runtime/web/package-worker.bundle.js',
        buildInfo: 'assets/paludarium/build-info.json',
      },
      files: [{ path: 'runtime/public.js', sha256: SHA, bytes: 1 }],
    },
    npm: { version: '0.3.0', published: false, integrity: 'sha512-test' },
    ...overrides,
  };
}

/**
 * Runs the real Astro build of showcase/site with test site data into a
 * temporary public and output directory; returns the output directory.
 */
export async function buildTestSite(
  data: SiteData = testSiteData(),
): Promise<{ out: string; publicDir: string }> {
  const root = await tempDir('astro');
  const publicDir = join(root, 'public');
  const out = join(root, 'dist');
  await writeFiles(root, {
    'site-data.json': JSON.stringify(data),
    'public/catalog.json': '{}',
  });
  for (const name of ['coi-config.js', 'favicon.svg'])
    await copyFile(join(SITE_ROOT, 'public', name), join(publicDir, name));
  await copyFile(
    join(
      SITE_ROOT,
      'node_modules',
      'coi-serviceworker',
      'coi-serviceworker.js',
    ),
    join(publicDir, 'coi-serviceworker.js'),
  );
  execFileSync(
    process.execPath,
    [join(SITE_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
    {
      cwd: SITE_ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: '1',
        SHOWCASE_SITE_DATA: join(root, 'site-data.json'),
        SHOWCASE_SITE_MODULES: join(root, 'bundle-modules.json'),
        SHOWCASE_SITE_PUBLIC: publicDir,
        SHOWCASE_SITE_OUT: out,
      },
    },
  );
  return { out, publicDir };
}
