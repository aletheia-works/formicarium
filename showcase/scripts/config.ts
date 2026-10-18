import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUniqueJson, SHA256_PATTERN } from './build-key.ts';
import { fail } from './errors.ts';
import { SHOWCASE_ROOT } from './paths.ts';

export interface ReleaseAssetAcquire {
  kind: 'release-asset';
  /** Asset name template; `{tag}` and `{version}` are the only placeholders. */
  asset: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
}
export interface UiBuild {
  directory: string;
  /** A release-asset tool of this run whose verified ELF runs the UI build. */
  runner: string;
  install: string[];
  build: string[];
  output: string;
}
export interface SourceBuildAcquire {
  kind: 'source-build';
  builder: 'cargo';
  binary: string;
  package?: string;
  ui?: UiBuild;
}
export interface ToolConfig {
  tool: string;
  repository: string;
  tagPattern: string;
  fixture: string;
  acquire: ReleaseAssetAcquire | SourceBuildAcquire;
}
export interface ToolsConfig {
  schemaVersion: 1;
  tools: ToolConfig[];
}
export interface AllowedSources {
  schemaVersion: 1;
  repositories: string[];
}
export interface TrustedCallers {
  schemaVersion: 1;
  distributeCaller: string;
  reuseWorkflows: string[];
}
export interface B1Pack {
  releaseTag: string;
  packAsset: string;
  packSha256: string;
  evidenceAsset: string;
  evidenceSha256: string;
}

const TOOL = /^[a-z][a-z0-9-]{0,63}$/;
const REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const ASSET = /^[A-Za-z0-9._@+-]+$/;
const WORKFLOW = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/;
export const SHOWCASE_WORKFLOW = '.github/workflows/showcase.yml';

type Json = Record<string, unknown>;
function record(value: unknown, where: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('config-invalid', `${where} must be an object`);
  return value as Json;
}
function only(value: Json, keys: readonly string[], where: string): void {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) fail('config-invalid', `${where}.${key} unknown`);
}
function text(value: unknown, where: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0)
    fail('config-invalid', `${where} must be a non-empty string`);
  if (pattern && !pattern.test(value))
    fail('config-invalid', `${where} has an invalid shape`);
  return value;
}
function strings(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0)
    fail('config-invalid', `${where} must be a non-empty array`);
  return value.map((item, index) => {
    const result = text(item, `${where}[${index}]`);
    if (result.includes('\0')) fail('config-invalid', `${where} has NUL`);
    return result;
  });
}
/** Relative POSIX path without traversal, NUL, backslash or empty parts. */
export function relativePath(value: unknown, where: string): string {
  const path = text(value, where);
  if (
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    fail('config-invalid', `${where} must be a safe relative path`);
  return path;
}

function tagPattern(value: unknown, where: string): string {
  const pattern = text(value, where);
  if (!pattern.startsWith('^') || !pattern.endsWith('$'))
    fail('config-invalid', `${where} must be anchored`);
  let groups: number;
  try {
    groups = (new RegExp(`${pattern}|`).exec('')?.length ?? 1) - 1;
  } catch (error) {
    return fail(
      'config-invalid',
      `${where} is not a regular expression`,
      error,
    );
  }
  if (groups !== 1)
    fail('config-invalid', `${where} needs exactly one version capture group`);
  return pattern;
}

function releaseAsset(value: Json, where: string): ReleaseAssetAcquire {
  only(value, ['kind', 'asset', 'format', 'archiveEntry'], where);
  const asset = text(value.asset, `${where}.asset`);
  const literal = asset.replaceAll('{tag}', '').replaceAll('{version}', '');
  if (!ASSET.test(literal))
    fail('config-invalid', `${where}.asset has invalid characters`);
  if (value.format === 'elf') {
    if (Object.hasOwn(value, 'archiveEntry'))
      fail('config-invalid', `${where}.archiveEntry is forbidden for elf`);
    return { kind: 'release-asset', asset, format: 'elf' };
  }
  if (value.format !== 'tar.gz')
    fail('config-invalid', `${where}.format must be elf or tar.gz`);
  return {
    kind: 'release-asset',
    asset,
    format: 'tar.gz',
    archiveEntry: relativePath(value.archiveEntry, `${where}.archiveEntry`),
  };
}

function uiBuild(value: unknown, where: string): UiBuild {
  const ui = record(value, where);
  only(ui, ['directory', 'runner', 'install', 'build', 'output'], where);
  return {
    directory: relativePath(ui.directory, `${where}.directory`),
    runner: text(ui.runner, `${where}.runner`, TOOL),
    install: strings(ui.install, `${where}.install`),
    build: strings(ui.build, `${where}.build`),
    output: relativePath(ui.output, `${where}.output`),
  };
}

function sourceBuild(value: Json, where: string): SourceBuildAcquire {
  only(value, ['kind', 'builder', 'binary', 'package', 'ui'], where);
  if (value.builder !== 'cargo')
    fail('config-invalid', `${where}.builder is an unknown build kind`);
  const result: SourceBuildAcquire = {
    kind: 'source-build',
    builder: 'cargo',
    binary: text(value.binary, `${where}.binary`, IDENTIFIER),
  };
  if (value.package !== undefined)
    result.package = text(value.package, `${where}.package`, IDENTIFIER);
  if (value.ui !== undefined) result.ui = uiBuild(value.ui, `${where}.ui`);
  return result;
}

function tool(value: unknown, index: number, allowed: Set<string>): ToolConfig {
  const where = `tools[${index}]`;
  const raw = record(value, where);
  only(raw, ['tool', 'repository', 'tagPattern', 'fixture', 'acquire'], where);
  const repository = text(raw.repository, `${where}.repository`, REPOSITORY);
  if (!allowed.has(repository))
    fail('source-not-allowed', `${repository} is not in the main allow list`);
  const acquire = record(raw.acquire, `${where}.acquire`);
  return {
    tool: text(raw.tool, `${where}.tool`, TOOL),
    repository,
    tagPattern: tagPattern(raw.tagPattern, `${where}.tagPattern`),
    fixture: text(raw.fixture, `${where}.fixture`, TOOL),
    acquire:
      acquire.kind === 'release-asset'
        ? releaseAsset(acquire, `${where}.acquire`)
        : acquire.kind === 'source-build'
          ? sourceBuild(acquire, `${where}.acquire`)
          : fail('config-invalid', `${where}.acquire.kind is unknown`),
  };
}

export function validateAllowedSources(value: unknown): AllowedSources {
  const raw = record(value, 'allowed-sources');
  only(raw, ['schemaVersion', 'repositories'], 'allowed-sources');
  if (raw.schemaVersion !== 1)
    fail('config-invalid', 'allowed-sources.schemaVersion must be 1');
  const repositories = strings(raw.repositories, 'repositories').map((item) =>
    text(item, 'repositories', REPOSITORY),
  );
  if (new Set(repositories).size !== repositories.length)
    fail('config-invalid', 'allowed-sources has duplicates');
  return { schemaVersion: 1, repositories };
}

/** Validates tools.json against the allow list read from main. */
export function validateToolsConfig(
  value: unknown,
  allowedSources: AllowedSources,
): ToolsConfig {
  const raw = record(value, 'tools.json');
  only(raw, ['schemaVersion', 'tools'], 'tools.json');
  if (raw.schemaVersion !== 1)
    fail('config-invalid', 'tools.json schemaVersion must be 1');
  if (!Array.isArray(raw.tools) || raw.tools.length === 0)
    fail('config-invalid', 'tools.json tools must be a non-empty array');
  const allowed = new Set(allowedSources.repositories);
  const tools = raw.tools.map((item, index) => tool(item, index, allowed));
  const names = new Set<string>();
  for (const entry of tools) {
    if (names.has(entry.tool))
      fail('config-invalid', `duplicate tool: ${entry.tool}`);
    names.add(entry.tool);
  }
  for (const entry of tools) {
    if (entry.acquire.kind !== 'source-build' || !entry.acquire.ui) continue;
    const runnerName = entry.acquire.ui.runner;
    const runner = tools.find((item) => item.tool === runnerName);
    if (runner?.acquire.kind !== 'release-asset')
      fail('config-invalid', `${entry.tool} ui runner must be a release asset`);
  }
  return { schemaVersion: 1, tools };
}

export function validateTrustedCallers(value: unknown): TrustedCallers {
  const raw = record(value, 'trusted-callers');
  only(
    raw,
    ['schemaVersion', 'distributeCaller', 'reuseWorkflows'],
    'trusted-callers',
  );
  if (raw.schemaVersion !== 1)
    fail('config-invalid', 'trusted-callers.schemaVersion must be 1');
  const reuseWorkflows = strings(raw.reuseWorkflows, 'reuseWorkflows').map(
    (item) => text(item, 'reuseWorkflows', WORKFLOW),
  );
  if (!reuseWorkflows.includes(SHOWCASE_WORKFLOW))
    fail('config-invalid', 'reuseWorkflows must include showcase.yml');
  return {
    schemaVersion: 1,
    distributeCaller: text(raw.distributeCaller, 'distributeCaller', WORKFLOW),
    reuseWorkflows,
  };
}

const B1_FIELDS = [
  'releaseTag',
  'packAsset',
  'packSha256',
  'evidenceAsset',
  'evidenceSha256',
] as const;

/** null means no long-lived B1 pack exists yet: distribute must then fail. */
export function validateB1Pack(value: unknown): B1Pack | null {
  const raw = record(value, 'b1-pack');
  only(raw, ['schemaVersion', ...B1_FIELDS], 'b1-pack');
  if (raw.schemaVersion !== 1)
    fail('config-invalid', 'b1-pack.schemaVersion must be 1');
  const empty = B1_FIELDS.filter((key) => raw[key] === null);
  if (empty.length === B1_FIELDS.length) return null;
  if (empty.length > 0)
    fail('config-invalid', 'b1-pack fields must be all null or all set');
  const pack: B1Pack = {
    releaseTag: text(raw.releaseTag, 'releaseTag', /^b1-[a-f0-9]{12}$/),
    packAsset: text(raw.packAsset, 'packAsset', /^[A-Za-z0-9._-]+\.tgz$/),
    packSha256: text(raw.packSha256, 'packSha256', SHA256_PATTERN),
    evidenceAsset: text(raw.evidenceAsset, 'evidenceAsset', /^[\w.-]+\.json$/),
    evidenceSha256: text(raw.evidenceSha256, 'evidenceSha256', SHA256_PATTERN),
  };
  if (pack.releaseTag !== `b1-${pack.packSha256.slice(0, 12)}`)
    fail('config-invalid', 'b1-pack releaseTag must name the pack digest');
  return pack;
}

export async function readConfigFile(
  name: string,
  root = SHOWCASE_ROOT,
): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(join(root, name), 'utf8');
  } catch (error) {
    return fail('config-invalid', `${name} is unreadable`, error);
  }
  try {
    return parseUniqueJson(raw);
  } catch (error) {
    return fail('config-invalid', `${name} is not unique JSON`, error);
  }
}

/** Expands an asset name template for one resolved release. */
export function assetName(template: string, tag: string, version: string) {
  return template.replaceAll('{tag}', tag).replaceAll('{version}', version);
}
