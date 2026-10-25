import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parseUniqueJson } from '../../scripts/build-key.ts';
import type { CandidateManifest } from '../../scripts/candidate.ts';
import {
  readConfigFile,
  validateAllowedSources,
  validateToolsConfig,
} from '../../scripts/config.ts';
import { npmCli, type PackRecord } from '../../scripts/pack.ts';
import { requireStrings } from '../src/i18n/strings.ts';
import type { SiteData } from '../src/site-data.ts';
import { writeFixtureIndexes } from './build-fixture-index.ts';
import {
  IDENTITY_FILE,
  identityFromEnvironment,
  writeSiteIdentity,
} from './build-site-identity.ts';
import { checkSite } from './check-site.ts';
import {
  fail,
  parseOptions,
  REPOSITORY_DIR,
  runCli,
  SITE_ROOT,
  type SiteLayout,
  siteLayout,
  summary,
  writeJsonFile,
  writeText,
} from './common.ts';
import { injectTerminalPages } from './inject-csp.ts';
import { computeInventory } from './inventory.ts';
import { buildNotices, NOTICES_FILE } from './notices.ts';
import {
  type FormicariumManifest,
  stageFormicarium,
} from './stage-formicarium.ts';
import { type Mode, mismatches, verifyCandidate } from './verify-candidate.ts';

/** Files of public/ that each build writes again (all gitignored). */
export const GENERATED_PUBLIC = [
  '_formicarium',
  'guests',
  'licenses',
  'demo-fixtures',
  'catalog.json',
  'NOTICES.md',
  'coi-serviceworker.js',
];
export const SITE_WORKFLOW_PATH = join(
  REPOSITORY_DIR,
  '.github',
  'workflows',
  'showcase-site.yml',
);
const PACKAGE = '@aletheia-works/formicarium';

export interface BuildContext {
  layout: SiteLayout;
  mode: Mode;
  env: NodeJS.ProcessEnv;
  /** Recorded order of the steps that ran (build-site.test.ts reads it). */
  steps: string[];
  /** Where the checked pack is extracted (the unit tests use their own). */
  packages?: { site: string; showcase: string };
  manifest?: CandidateManifest;
  pack?: PackRecord;
  formicarium?: FormicariumManifest;
  siteData?: SiteData;
}

/** Runs the Astro build; replaced by a fake in the unit tests. */
export type AstroBuild = (context: BuildContext) => Promise<void>;
export const astroBuild: AstroBuild = async (context) => {
  execFileSync(
    process.execPath,
    [join(SITE_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
    {
      cwd: SITE_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {
        ...context.env,
        ASTRO_TELEMETRY_DISABLED: '1',
        SHOWCASE_SITE_DATA: context.layout.siteData,
        SHOWCASE_SITE_MODULES: context.layout.modules,
      },
    },
  );
};
/** npm registry lookup (read only); replaced by a fake in the unit tests. */
export type NpmLookup = (version: string) => string | null;
export const npmIntegrity: NpmLookup = (version) => {
  try {
    const out = execFileSync(
      process.execPath,
      [npmCli(), 'view', `${PACKAGE}@${version}`, 'dist.integrity'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 120000,
      },
    );
    return out.trim() || null;
  } catch {
    return null;
  }
};

const step = (context: BuildContext, name: string) => context.steps.push(name);
/** The site's own copy (types, notices) and the showcase's (its scripts' types). */
const packageDirs = (context: BuildContext) =>
  context.packages ?? {
    site: join(SITE_ROOT, 'node_modules', '@aletheia-works', 'formicarium'),
    showcase: join(
      REPOSITORY_DIR,
      'showcase',
      'node_modules',
      '@aletheia-works',
      'formicarium',
    ),
  };

/** The candidate check, then the pack is checked, extracted and copied. */
export async function prepare(context: BuildContext): Promise<void> {
  const { layout } = context;
  step(context, 'verify-candidate');
  const pack = parseUniqueJson(
    await readFile(join(layout.pack, 'pack.json'), 'utf8'),
  ) as PackRecord;
  const result = await verifyCandidate({
    mode: context.mode,
    candidateDir: layout.candidate,
    pack,
    jobOutputs: {
      candidateId: context.env.SHOWCASE_CANDIDATE_ID,
      distributable: context.env.SHOWCASE_DISTRIBUTABLE,
    },
  });
  await writeJsonFile(join(layout.logs, 'verify-candidate.json'), {
    schemaVersion: 1,
    mode: context.mode,
    candidateId: result.manifest.candidateId,
    lines: result.lines,
  });
  const bad = mismatches(result);
  if (bad.length)
    fail(
      'candidate-mismatch',
      bad
        .map(
          (line) =>
            `${line.item} ${line.path} expected=${line.expected} actual=${line.actual}`,
        )
        .join('; '),
    );
  context.manifest = result.manifest;
  context.pack = pack;
  step(context, 'stage-formicarium');
  for (const name of GENERATED_PUBLIC)
    await rm(join(layout.public, name), { recursive: true, force: true });
  const packages = packageDirs(context);
  const staged = await stageFormicarium({
    packDir: layout.pack,
    publicDir: layout.public,
    destination: packages.site,
  });
  context.formicarium = staged.manifest;
  // The showcase scripts resolve the package types from showcase/node_modules.
  await stageFormicarium({
    packDir: layout.pack,
    publicDir: join(layout.build, 'unused'),
    destination: packages.showcase,
  });
  await rm(join(layout.build, 'unused'), { recursive: true, force: true });
  await writeJsonFile(join(layout.build, 'formicarium.json'), staged.manifest);
}

async function readPrepared(context: BuildContext): Promise<void> {
  const { layout } = context;
  context.manifest ??= parseUniqueJson(
    await readFile(join(layout.candidate, 'manifest.json'), 'utf8'),
  ) as CandidateManifest;
  context.pack ??= parseUniqueJson(
    await readFile(join(layout.pack, 'pack.json'), 'utf8'),
  ) as PackRecord;
  context.formicarium ??= parseUniqueJson(
    await readFile(join(layout.build, 'formicarium.json'), 'utf8'),
  ) as FormicariumManifest;
}

async function siteData(
  context: BuildContext,
  lookup: NpmLookup,
): Promise<SiteData> {
  const { layout } = context;
  const manifest = context.manifest!;
  const allowed = validateAllowedSources(
    await readConfigFile('allowed-sources.json'),
  );
  const config = validateToolsConfig(
    await readConfigFile('tools.json'),
    allowed,
  );
  const names = manifest.resolvedTools.map((tool) => tool.tool);
  requireStrings(names);
  const indexes = await writeFixtureIndexes(
    manifest.resolvedTools.map(
      (tool) =>
        config.tools.find((item) => item.tool === tool.tool)?.fixture ??
        fail('config-invalid', `tools.json lacks ${tool.tool}`),
    ),
    layout.public,
  );
  await writeJsonFile(join(layout.logs, 'build-fixture-index.json'), {
    schemaVersion: 1,
    indexes: indexes.map((index) => ({
      ...index,
      source: `showcase/fixtures/${index.fixture}`,
    })),
  });
  const tarball = await readFile(join(layout.pack, context.pack!.tarball));
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  const published = lookup(context.formicarium!.version);
  await writeJsonFile(join(layout.logs, 'npm-check.json'), {
    version: context.formicarium!.version,
    packIntegrity: integrity,
    registryIntegrity: published,
    published: published === integrity,
  });
  return {
    schemaVersion: 1,
    candidateId: manifest.candidateId,
    catalog: { path: 'catalog.json', sha256: manifest.catalogSha256 },
    tools: manifest.resolvedTools.map((tool) => {
      const entry = config.tools.find((item) => item.tool === tool.tool)!;
      const index = indexes.find((item) => item.fixture === entry.fixture)!;
      return {
        tool: tool.tool,
        version: tool.version,
        repository: entry.repository,
        fixture: entry.fixture,
        fixtureIndex: { path: index.path, sha256: index.sha256 },
        ...(entry.interactive ? { interactive: true as const } : {}),
      };
    }),
    formicarium: context.formicarium!,
    npm: {
      version: context.formicarium!.version,
      published: published === integrity,
      integrity,
    },
  };
}

async function listFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, {
    withFileTypes: true,
    recursive: true,
  }))
    if (entry.isFile()) found.push(join(entry.parentPath, entry.name));
  return found.sort();
}

/**
 * Code that reaches the site without passing through Vite's module graph:
 * coi-serviceworker (copied), the Pagefind index and UI runtime, and the
 * Expressive Code assets (`_astro/ec.*`) of the Starlight code blocks.
 */
export const EXPRESSIVE_CODE_PACKAGES = [
  'astro-expressive-code',
  'expressive-code',
  'rehype-expressive-code',
  '@expressive-code/core',
  '@expressive-code/plugin-frames',
  '@expressive-code/plugin-shiki',
  '@expressive-code/plugin-text-markers',
];
export async function copiedPackages(dist: string): Promise<string[]> {
  const top = await readdir(dist);
  const astro = top.includes('_astro')
    ? await readdir(join(dist, '_astro'))
    : [];
  return [
    'coi-serviceworker',
    ...(top.includes('pagefind') ? ['pagefind'] : []),
    ...(astro.some((name) => name.startsWith('ec.'))
      ? EXPRESSIVE_CODE_PACKAGES
      : []),
  ];
}

/** The terminal pages every build must produce (en and ja). */
export const terminalPages = (tools: readonly string[]) =>
  ['', 'ja/']
    .flatMap((prefix) => [
      `${prefix}terminal/index.html`,
      ...tools.map((tool) => `${prefix}tools/${tool}/index.html`),
    ])
    .sort();

/** Steps 7–11: index, placement, Astro, maps out, CSP, notices, identity, checks, inventory. */
export async function assemble(
  context: BuildContext,
  options: { build?: AstroBuild; npm?: NpmLookup; workflow?: string } = {},
): Promise<{ inventorySha256: string }> {
  const { layout } = context;
  await readPrepared(context);
  step(context, 'fixture-index');
  const data = await siteData(context, options.npm ?? npmIntegrity);
  context.siteData = data;
  step(context, 'place');
  await cp(join(layout.candidate, 'site'), layout.public, {
    recursive: true,
    force: true,
  });
  await cp(
    join(
      SITE_ROOT,
      'node_modules',
      'coi-serviceworker',
      'coi-serviceworker.js',
    ),
    join(layout.public, 'coi-serviceworker.js'),
  );
  await writeJsonFile(layout.siteData, data);
  step(context, 'astro-build');
  await rm(layout.dist, { recursive: true, force: true });
  await (options.build ?? astroBuild)(context);
  step(context, 'strip-maps');
  await rm(layout.sourcemaps, { recursive: true, force: true });
  for (const file of (await listFiles(layout.dist)).filter((path) =>
    path.endsWith('.map'),
  )) {
    const target = join(layout.sourcemaps, relative(layout.dist, file));
    await mkdir(dirname(target), { recursive: true });
    await rename(file, target);
  }
  step(context, 'inject-csp');
  const pages = terminalPages(data.tools.map((tool) => tool.tool));
  await injectTerminalPages(layout.dist, pages);
  step(context, 'notices');
  const modules = parseUniqueJson(
    await readFile(layout.modules, 'utf8'),
  ) as string[];
  const notices = await buildNotices({
    modules,
    copiedPackages: (await copiedPackages(layout.dist)).map((name) =>
      join(SITE_ROOT, 'node_modules', name),
    ),
    formicariumDir: packageDirs(context).site,
    candidateSiteDir: join(layout.candidate, 'site'),
  });
  await writeText(join(layout.dist, NOTICES_FILE), notices.text);
  step(context, 'identity');
  const identity = identityFromEnvironment(context.env, data.candidateId);
  await writeText(
    join(layout.build, IDENTITY_FILE),
    await writeSiteIdentity(layout.dist, identity),
  );
  step(context, 'check-site');
  const checked = await checkSite({
    siteDir: layout.dist,
    base: '/formicarium/',
    terminalPages: pages,
    workflow: options.workflow ?? (await readFile(SITE_WORKFLOW_PATH, 'utf8')),
  });
  await writeJsonFile(join(layout.logs, 'check-site.json'), checked);
  if (checked.problems.length) fail('site-check', checked.problems.join('; '));
  step(context, 'inventory');
  const inventory = await computeInventory(layout.dist);
  await writeJsonFile(join(layout.build, 'site-inventory.json'), inventory);
  await writeJsonFile(join(layout.logs, 'inventory-build.json'), {
    schemaVersion: 1,
    job: 'build',
    actual: inventory.sha256,
    files: inventory.files.length,
    recordedAt: new Date().toISOString(),
  });
  await summary(
    [
      '## showcase site build',
      '',
      `- run_number: ${identity.runNumber}`,
      `- candidateId: \`${data.candidateId}\``,
      `- siteInventorySha256: \`${inventory.sha256}\``,
      ...data.tools.map((tool) => `- ${tool.tool} ${tool.version}`),
      `- site: ${checked.bytes} bytes, ${checked.files} files; largest file: ${checked.largest ? `${checked.largest.path} ${checked.largest.bytes}` : 'none'}; guests: ${checked.guests.map((guest) => `${guest.path} ${guest.bytes}`).join(', ')}`,
      `- npm: formicarium ${data.npm.version} ${data.npm.published ? 'published with this integrity' : 'not published with this integrity'}`,
    ],
    context.env,
  );
  return { inventorySha256: inventory.sha256 };
}

if (import.meta.main)
  await runCli(`build-site ${process.argv[2] ?? ''}`.trim(), async () => {
    const verb = process.argv[2];
    const { mode } = parseOptions(process.argv.slice(3), ['mode']);
    if (mode !== 'verify' && mode !== 'distribute')
      fail('config-invalid', '--mode verify|distribute');
    const context: BuildContext = {
      layout: siteLayout(),
      mode,
      env: process.env,
      steps: [],
    };
    if (verb === 'prepare') await prepare(context);
    else if (verb === 'assemble')
      console.log((await assemble(context)).inventorySha256);
    else
      fail(
        'config-invalid',
        'usage: build-site.ts prepare|assemble --mode verify|distribute',
      );
  });
