import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUniqueJson } from './build-key.ts';
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
/** A GNU package built from its signed ftp.gnu.org tarball. */
export interface GnuPackage {
  /** GNU package name: ftp.gnu.org/gnu/<package>/<package>-<version>.tar.gz. */
  package: string;
  /** Tag of the release in the repository; `{version}`, `{major}`, `{minor}`, `{patch}`. */
  tag: string;
  /** Primary key fingerprints in showcase/keys/<package>.gpg that may sign. */
  signers: string[];
  /** SPDX identifier of the tarball's COPYING. */
  spdx: string;
  /** configure arguments; the builder adds --prefix, CC and the search paths. */
  configure: string[];
}
export interface GnuLibrary extends GnuPackage {
  repository: string;
}
export interface GnuSourceAcquire extends GnuPackage {
  kind: 'gnu-source';
  builder: 'autotools';
  /** Guest file name, and the built program's path in the source tree. */
  binary: string;
  output: string;
  /** Static libraries built first, in order, into one prefix. */
  libraries: GnuLibrary[];
}
export interface ToolConfig {
  tool: string;
  repository: string;
  tagPattern: string;
  fixture: string;
  acquire: ReleaseAssetAcquire | SourceBuildAcquire | GnuSourceAcquire;
  /** The terminal pages pass keystrokes to this tool and give it a terminal. */
  interactive?: true;
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
/** The npm release of formicarium that the showcase distributes. */
export interface FormicariumRelease {
  version: string;
  /** npm's dist.integrity of the tarball (SHA-512, base64). */
  integrity: string;
  /** The commit of the release tag v<version>. */
  sourceCommit: string;
}

const TOOL = /^[a-z][a-z0-9-]{0,63}$/;
/** A GitHub repository, or a Savannah git repository (GNU packages). */
const REPOSITORY =
  /^https:\/\/(?:github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|git\.savannah\.gnu\.org\/git\/[a-z0-9][a-z0-9_-]*\.git)$/;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const ASSET = /^[A-Za-z0-9._@+-]+$/;
const GNU_PACKAGE = /^[a-z][a-z0-9-]{0,63}$/;
const FINGERPRINT = /^[0-9A-F]{40}$/;
const SPDX = /^[A-Za-z0-9.+-]{1,64}$/;
const TAG_TEMPLATE = /^[A-Za-z0-9._{}-]{1,128}$/;
/** `--option[=value]` or `VARIABLE=value`; `{prefix}` is the build prefix. */
const CONFIGURE_ARGUMENT =
  /^(?:--[a-z0-9][a-z0-9-]*(?:=[A-Za-z0-9._,+/{}-]*)?|[A-Z][A-Z0-9_]*=[A-Za-z0-9._,+/{} -]*)$/;
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

function gnuPackage(value: Json, where: string): GnuPackage {
  const tag = text(value.tag, `${where}.tag`, TAG_TEMPLATE);
  if (!tag.includes('{'))
    fail('config-invalid', `${where}.tag must name the version`);
  const signers = strings(value.signers, `${where}.signers`).map((item) =>
    text(item, `${where}.signers`, FINGERPRINT),
  );
  if (new Set(signers).size !== signers.length)
    fail('config-invalid', `${where}.signers has duplicates`);
  return {
    package: text(value.package, `${where}.package`, GNU_PACKAGE),
    tag,
    signers,
    spdx: text(value.spdx, `${where}.spdx`, SPDX),
    configure: Array.isArray(value.configure)
      ? value.configure.map((item, index) =>
          text(item, `${where}.configure[${index}]`, CONFIGURE_ARGUMENT),
        )
      : fail('config-invalid', `${where}.configure must be an array`),
  };
}

const GNU_PACKAGE_KEYS = ['package', 'tag', 'signers', 'spdx', 'configure'];

function gnuSource(
  value: Json,
  where: string,
  allowed: Set<string>,
): GnuSourceAcquire {
  only(
    value,
    ['kind', 'builder', 'binary', 'output', 'libraries', ...GNU_PACKAGE_KEYS],
    where,
  );
  if (value.builder !== 'autotools')
    fail('config-invalid', `${where}.builder is an unknown build kind`);
  if (!Array.isArray(value.libraries))
    fail('config-invalid', `${where}.libraries must be an array`);
  const libraries = value.libraries.map((item, index) => {
    const at = `${where}.libraries[${index}]`;
    const raw = record(item, at);
    only(raw, ['repository', ...GNU_PACKAGE_KEYS], at);
    const repository = text(raw.repository, `${at}.repository`, REPOSITORY);
    if (!allowed.has(repository))
      fail('source-not-allowed', `${repository} is not in the main allow list`);
    return { ...gnuPackage(raw, at), repository };
  });
  const result: GnuSourceAcquire = {
    kind: 'gnu-source',
    builder: 'autotools',
    ...gnuPackage(value, where),
    binary: text(value.binary, `${where}.binary`, IDENTIFIER),
    output: relativePath(value.output, `${where}.output`),
    libraries,
  };
  const names = [result.package, ...libraries.map((item) => item.package)];
  if (new Set(names).size !== names.length)
    fail('config-invalid', `${where} names a package twice`);
  return result;
}

function tool(value: unknown, index: number, allowed: Set<string>): ToolConfig {
  const where = `tools[${index}]`;
  const raw = record(value, where);
  only(
    raw,
    ['tool', 'repository', 'tagPattern', 'fixture', 'acquire', 'interactive'],
    where,
  );
  if (raw.interactive !== undefined && raw.interactive !== true)
    fail('config-invalid', `${where}.interactive must be true when present`);
  const repository = text(raw.repository, `${where}.repository`, REPOSITORY);
  if (!allowed.has(repository))
    fail('source-not-allowed', `${repository} is not in the main allow list`);
  const acquire = record(raw.acquire, `${where}.acquire`);
  // Release assets and Cargo source builds use the GitHub API and codeload.
  if (
    (acquire.kind === 'release-asset' || acquire.kind === 'source-build') &&
    !repository.startsWith('https://github.com/')
  )
    fail('config-invalid', `${where}.repository must be on GitHub`);
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
          : acquire.kind === 'gnu-source'
            ? gnuSource(acquire, `${where}.acquire`, allowed)
            : fail('config-invalid', `${where}.acquire.kind is unknown`),
    ...(raw.interactive === true ? { interactive: true as const } : {}),
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

const RELEASE_FIELDS = ['version', 'integrity', 'sourceCommit'] as const;

/** null means no release is pinned yet: distribute must then fail. */
export function validateFormicariumRelease(
  value: unknown,
): FormicariumRelease | null {
  const raw = record(value, 'formicarium-release');
  only(raw, ['schemaVersion', ...RELEASE_FIELDS], 'formicarium-release');
  if (raw.schemaVersion !== 1)
    fail('config-invalid', 'formicarium-release.schemaVersion must be 1');
  const empty = RELEASE_FIELDS.filter((key) => raw[key] === null);
  if (empty.length === RELEASE_FIELDS.length) return null;
  if (empty.length > 0)
    fail(
      'config-invalid',
      'formicarium-release fields must be all null or all set',
    );
  return {
    version: text(
      raw.version,
      'version',
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    ),
    integrity: text(raw.integrity, 'integrity', /^sha512-[A-Za-z0-9+/]{86}==$/),
    sourceCommit: text(raw.sourceCommit, 'sourceCommit', /^[a-f0-9]{40}$/),
  };
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

/** Expands a GNU tag template for one version (missing parts are 0). */
export function gnuTag(template: string, version: string): string {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return template
    .replaceAll('{version}', version)
    .replaceAll('{major}', major)
    .replaceAll('{minor}', minor)
    .replaceAll('{patch}', patch);
}

/** Expands an asset name template for one resolved release. */
export function assetName(template: string, tag: string, version: string) {
  return template.replaceAll('{tag}', tag).replaceAll('{version}', version);
}
