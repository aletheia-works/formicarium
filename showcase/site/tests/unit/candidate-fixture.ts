import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { canonicalJson } from '../../../scripts/build-key.ts';
import {
  type CandidateManifest,
  computeCandidateId,
  fixtureInventorySha256,
} from '../../../scripts/candidate.ts';
import { fileInventory } from '../../../scripts/paths.ts';
import { writeFiles } from './helpers.ts';

const sha = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
export const TOOLS = [
  { tool: 'aube', version: '2.7.2', fixture: 'aube-local-deps' },
  { tool: 'biome', version: '2.5.15', fixture: 'biome-basic' },
  { tool: 'pitchfork', version: '2.32.0', fixture: 'pitchfork-basic' },
] as const;
const ENVIRONMENTS = ['chromium', 'firefox', 'node', 'safari', 'webkit'];
export const PACK_SHA = 'c'.repeat(64);

/** Small fixtures tree: aube's has the outside/ directory it links to. */
export const FIXTURE_FILES: Record<string, string> = {
  'aube-local-deps/app/package.json':
    '{"name":"app","dependencies":{"linked":"link:../outside/linked"}}\n',
  'aube-local-deps/outside/linked/package.json': '{"name":"linked"}\n',
  'biome-basic/app/index.js': 'console.log(1)\n',
  'pitchfork-basic/app/pitchfork.toml': '[daemons]\n',
};

export interface CandidateOptions {
  distributable?: boolean;
  logRows?: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
  catalogDefaults?: Record<string, string>;
  /** Name the repository's showcase/fixtures (the build reads those). */
  realFixtures?: boolean;
}

/**
 * Writes a showcase-candidate artifact shaped like the showcase's (manifest computed
 * by its own functions) plus a fixtures directory, and returns both paths.
 */
export async function writeCandidate(
  root: string,
  options: CandidateOptions = {},
) {
  const candidateDir = join(root, 'candidate');
  const fixturesDir = join(root, 'fixtures');
  await writeFiles(fixturesDir, FIXTURE_FILES);
  const catalog = canonicalJson({
    schemaVersion: 1,
    catalogId: 'showcase-test',
    defaults:
      options.catalogDefaults ??
      Object.fromEntries(TOOLS.map((tool) => [tool.tool, tool.version])),
    entries: TOOLS.map((tool) => ({
      tool: tool.tool,
      versionOrName: tool.version,
      url: `guests/${tool.tool}/${tool.version}/${tool.tool}`,
    })),
  });
  const rows = TOOLS.flatMap((tool) =>
    ENVIRONMENTS.map((environment) => ({
      name: `tool-${tool.tool}-version`,
      tool: tool.tool,
      environment,
      status: 'passed',
      expectedVersion: tool.version,
      exitCode: 0,
      stdout: `${tool.version}\n`,
      cause: null,
      installMs: 10,
      versionMs: 5,
    })),
  );
  const log = `${JSON.stringify({ schemaVersion: 1, rows: options.logRows ? options.logRows(rows) : rows }, null, 2)}\n`;
  const site: Record<string, string> = {
    'catalog.json': catalog,
    'NOTICES.md': '# Showcase guest notices\n',
    'licenses/aube-LICENSE': 'MIT\n',
  };
  for (const tool of TOOLS) {
    site[`guests/${tool.tool}/${tool.version}/${tool.tool}`] =
      `ELF ${tool.tool}`;
    site[`guests/${tool.tool}/${tool.version}/build-info.json`] = '{}';
  }
  await writeFiles(join(candidateDir, 'site'), site);
  await writeFiles(candidateDir, {
    'acceptance-log.json': log,
    'resolutions.json': '{}',
  });
  const assets = (await fileInventory(join(candidateDir, 'site'))).map(
    (file) => ({ ...file, path: `site/${file.path}` }),
  );
  const manifest: Omit<CandidateManifest, 'candidateId'> = {
    schemaVersion: 1,
    sourceCommit: 'd'.repeat(40),
    formicariumSourceCommit: 'd'.repeat(40),
    formicariumPackSha256: PACK_SHA,
    catalogSha256: sha(catalog),
    fixtureInventorySha256: await fixtureInventorySha256(
      options.realFixtures ? undefined : fixturesDir,
    ),
    assets,
    resolvedTools: TOOLS.map((tool) => ({
      tool: tool.tool,
      version: tool.version,
      source: {
        repository: `https://github.com/example/${tool.tool}`,
        commit: 'e'.repeat(40),
      },
      elfSha256: sha(`ELF ${tool.tool}`),
      provenance: {
        kind: 'release-asset',
      } as CandidateManifest['resolvedTools'][number]['provenance'],
    })),
    acceptanceLogSha256: sha(log),
    distributable: options.distributable ?? false,
    records: [],
  };
  const complete: CandidateManifest = {
    ...manifest,
    candidateId: computeCandidateId(manifest),
  };
  await writeFiles(candidateDir, {
    'manifest.json': `${JSON.stringify(complete, null, 2)}\n`,
  });
  return { candidateDir, fixturesDir, manifest: complete };
}

export const packRecord = (packSha256 = PACK_SHA) => ({
  schemaVersion: 1 as const,
  mode: 'verify' as const,
  tarball: 'x.tgz',
  packSha256,
  formicariumSourceCommit: 'd'.repeat(40),
  npmVersion: null,
  integrity: null,
});
