import { appendFile, copyFile, cp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AcceptanceLog,
  mergeAcceptance,
  readAcceptanceParts,
  requireAllRows,
} from './acceptance.ts';
import { type AcquiredTool, loadAcquired } from './acquire.ts';
import {
  COMMIT_PATTERN,
  canonicalJson,
  canonicalSha256,
  parseUniqueJson,
  sha256,
} from './build-key.ts';
import { readConfigFile, validateTrustedCallers } from './config.ts';
import { fail, runCli } from './errors.ts';
import { createGitHubApi, type GitHubApi } from './github.ts';
import type { Mode } from './mode.ts';
import type { PackRecord } from './pack.ts';
import {
  fileInventory,
  type InventoryFile,
  readJson,
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
  writeOnce,
} from './paths.ts';
import { loadResolutions, type Resolutions, resolutionFor } from './resolve.ts';
import { downloadArtifact, eligibleRuns } from './reuse.ts';

export interface ResolvedTool {
  tool: string;
  version: string;
  source: { repository: string; commit: string };
  elfSha256: string;
  provenance: AcquiredTool['provenance'];
}
/** ShowcaseCandidateManifest plus the fields the site needs from the run. */
export interface CandidateManifest {
  schemaVersion: 1;
  candidateId: string;
  sourceCommit: string;
  formicariumSourceCommit: string;
  formicariumPackSha256: string;
  catalogSha256: string;
  fixtureInventorySha256: string;
  assets: InventoryFile[];
  resolvedTools: ResolvedTool[];
  acceptanceLogSha256: string;
  distributable: boolean;
  /** Run records (acceptance log, resolutions with their times); not identity. */
  records: InventoryFile[];
}

/**
 * candidateId: the manifest without itself, the log digest and the run
 * records (times, run id/attempt, `provenance.reusedFromRun`). Every other
 * field, including the additional ones, stays part of the identity.
 */
export function candidateIdentity(
  manifest: Omit<CandidateManifest, 'candidateId'> & { candidateId?: string },
): unknown {
  const {
    candidateId: _id,
    acceptanceLogSha256: _log,
    records: _records,
    ...identity
  } = manifest;
  return {
    ...identity,
    resolvedTools: identity.resolvedTools.map((tool) => {
      const { reusedFromRun: _run, ...provenance } = tool.provenance;
      return { ...tool, provenance };
    }),
  };
}
export const computeCandidateId = (
  manifest: Parameters<typeof candidateIdentity>[0],
) => canonicalSha256(candidateIdentity(manifest));

export async function fixtureInventorySha256(
  directory = join(SHOWCASE_ROOT, 'fixtures'),
): Promise<string> {
  return canonicalSha256(await fileInventory(directory));
}

export function resolvedTools(
  acquired: readonly AcquiredTool[],
  resolutions: Resolutions,
): ResolvedTool[] {
  return acquired.map((record) => {
    const resolution = resolutionFor(resolutions, record.tool);
    if (
      resolution.version !== record.version ||
      resolution.commit !== record.buildInfo.source.commit ||
      resolution.repository !== record.buildInfo.source.repository
    )
      fail('config-invalid', `${record.tool} differs from resolutions.json`);
    return {
      tool: record.tool,
      version: record.version,
      source: { ...record.buildInfo.source },
      elfSha256: record.elfSha256,
      provenance: { ...record.provenance },
    };
  });
}

/** Deterministic third-party notice index; no times or run data. */
export function noticesText(resolutions: Resolutions): string {
  const lines = ['# Showcase guest notices', ''];
  for (const tool of resolutions.tools)
    lines.push(
      `- ${tool.tool} ${tool.version} (${tool.repository} @ ${tool.commit}): ` +
        `${tool.license.spdx ?? 'license file'} — licenses/${tool.license.file} ` +
        `(sha256 ${tool.license.sha256})`,
    );
  lines.push(
    '- formicarium: licenses/formicarium-LICENSE, licenses/formicarium-THIRD_PARTY_NOTICES.md',
    '',
  );
  return lines.join('\n');
}

export interface AssembleOptions {
  layout: WorkLayout;
  mode: Mode;
  sourceCommit: string;
  pack: PackRecord;
  log: AcceptanceLog;
  packageRoot?: string;
}

/** Builds the candidate directory only after every acceptance row passed. */
export async function assembleCandidate(
  options: AssembleOptions,
): Promise<CandidateManifest> {
  const { layout } = options;
  if (!COMMIT_PATTERN.test(options.sourceCommit))
    fail('config-invalid', 'candidate needs the 40-hex source commit');
  if (options.pack.mode !== options.mode)
    fail('b1-pack-mismatch', 'pack mode differs from the run mode');
  if (
    options.mode === 'verify' &&
    options.pack.formicariumSourceCommit !== options.sourceCommit
  )
    fail('b1-pack-mismatch', 'verify pack must come from this commit');
  const resolutions = await loadResolutions(layout);
  const acquired = await loadAcquired(layout);
  const tools = resolvedTools(acquired, resolutions);
  requireAllRows(options.log.rows, tools);
  const site = join(layout.candidate, 'site');
  await mkdir(layout.candidate, { recursive: false });
  await cp(layout.site, site, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  const packageRoot =
    options.packageRoot ??
    join(SHOWCASE_ROOT, 'node_modules', '@aletheia-works', 'formicarium');
  await mkdir(join(site, 'licenses'), { recursive: true });
  for (const tool of resolutions.tools)
    await copyFile(
      join(layout.licenses, tool.license.file),
      join(site, 'licenses', tool.license.file),
    );
  await copyFile(
    join(packageRoot, 'LICENSE'),
    join(site, 'licenses', 'formicarium-LICENSE'),
  );
  await copyFile(
    join(packageRoot, 'THIRD_PARTY_NOTICES.md'),
    join(site, 'licenses', 'formicarium-THIRD_PARTY_NOTICES.md'),
  );
  await writeOnce(join(site, 'NOTICES.md'), noticesText(resolutions));
  const logBytes = `${JSON.stringify(options.log, null, 2)}\n`;
  await writeOnce(join(layout.candidate, 'acceptance-log.json'), logBytes);
  await copyFile(
    layout.resolutions,
    join(layout.candidate, 'resolutions.json'),
  );
  const assets = (await fileInventory(site)).map((file) => ({
    ...file,
    path: `site/${file.path}`,
  }));
  const records = (await fileInventory(layout.candidate)).filter(
    (file) =>
      file.path === 'acceptance-log.json' || file.path === 'resolutions.json',
  );
  const catalog = await readFile(layout.catalog);
  if (
    canonicalJson(parseUniqueJson(catalog.toString('utf8'))) !==
    catalog.toString('utf8')
  )
    fail('catalog-invalid', 'catalog.json is not canonical');
  const manifest: Omit<CandidateManifest, 'candidateId'> = {
    schemaVersion: 1,
    sourceCommit: options.sourceCommit,
    formicariumSourceCommit: options.pack.formicariumSourceCommit,
    formicariumPackSha256: options.pack.packSha256,
    catalogSha256: sha256(catalog),
    fixtureInventorySha256: await fixtureInventorySha256(),
    assets,
    resolvedTools: tools,
    acceptanceLogSha256: sha256(logBytes),
    distributable: options.mode === 'distribute',
    records,
  };
  const complete: CandidateManifest = {
    ...manifest,
    candidateId: computeCandidateId(manifest),
  };
  await writeOnce(
    join(layout.candidate, 'manifest.json'),
    `${JSON.stringify(complete, null, 2)}\n`,
  );
  return complete;
}

/** Whole days since the last distributable candidate, or null when none was found. */
export function daysSince(lastAt: string | null, now: Date): number | null {
  if (lastAt === null) return null;
  const then = Date.parse(lastAt);
  if (!Number.isFinite(then)) fail('bad-body', 'run timestamp invalid');
  return Math.max(0, Math.floor((now.getTime() - then) / 86400000));
}

/** Reads previous trusted main runs (actions: read) for the newest distributable one. */
export async function lastDistributableAt(
  api: GitHubApi,
  repository: string,
  limit = 10,
): Promise<string | null> {
  const trusted = validateTrustedCallers(
    await readConfigFile('trusted-callers.json'),
  );
  const listed = (await api.get(
    `repos/${repository}/actions/runs?branch=main&status=success&per_page=50`,
  )) as { workflow_runs?: unknown };
  for (const run of eligibleRuns(listed.workflow_runs, trusted).slice(
    0,
    limit,
  )) {
    const body = (await api.get(
      `repos/${repository}/actions/runs/${run.id}/artifacts?name=showcase-candidate`,
    )) as { artifacts?: { id?: unknown; name?: unknown; expired?: unknown }[] };
    const artifact = body.artifacts?.find(
      (item) => item.name === 'showcase-candidate' && item.expired === false,
    );
    if (typeof artifact?.id !== 'number') continue;
    const files = await downloadArtifact({ api, repository }, artifact.id);
    const manifest = files.get('manifest.json');
    if (!manifest) continue;
    const parsed = parseUniqueJson(new TextDecoder().decode(manifest)) as {
      distributable?: unknown;
    };
    if (parsed.distributable === true) return run.created_at;
  }
  return null;
}

export function summaryMarkdown(
  manifest: CandidateManifest,
  days: number | null,
): string {
  return [
    '## showcase candidate',
    '',
    `- candidateId: \`${manifest.candidateId}\``,
    `- distributable: \`${manifest.distributable}\``,
    `- formicariumPackSha256: \`${manifest.formicariumPackSha256}\``,
    `- catalogSha256: \`${manifest.catalogSha256}\``,
    ...manifest.resolvedTools.map(
      (tool) =>
        `- ${tool.tool} ${tool.version} \`${tool.source.commit}\` (${tool.provenance.kind}${tool.provenance.reusedFromRun ? `, reused from run ${tool.provenance.reusedFromRun.runId}` : ''})`,
    ),
    `- 最後に配布可能な候補を作ったrunからの日数: ${days === null ? '直近のrunに配布可能な候補はない' : `${days}日`}`,
    '',
  ].join('\n');
}

async function main() {
  const layout = workLayout();
  const mode = process.env.SHOWCASE_MODE_RESOLVED;
  if (mode !== 'verify' && mode !== 'distribute')
    fail(
      'mode-rejected',
      'SHOWCASE_MODE_RESOLVED must be verify or distribute',
    );
  const parts = await readAcceptanceParts(layout.acceptance);
  const log = mergeAcceptance(parts, {
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    recordedAt: new Date().toISOString(),
  });
  const manifest = await assembleCandidate({
    layout,
    mode,
    sourceCommit:
      process.env.SHOWCASE_SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? '',
    pack: (await readJson(join(layout.pack, 'pack.json'))) as PackRecord,
    log,
  });
  let days: number | null = null;
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository) {
    const at = manifest.distributable
      ? new Date().toISOString()
      : await lastDistributableAt(
          createGitHubApi({ token: process.env.GITHUB_TOKEN }),
          repository,
        );
    days = daysSince(at, new Date());
  }
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `candidate-id=${manifest.candidateId}\ndistributable=${manifest.distributable}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      summaryMarkdown(manifest, days),
    );
  console.log(
    `${manifest.candidateId} distributable=${manifest.distributable}`,
  );
}

if (import.meta.main) await runCli('candidate', main);
