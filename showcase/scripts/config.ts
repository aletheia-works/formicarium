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
/**
 * Where a package's signed release tarballs are published, when not on
 * ftp.gnu.org. Each URL is an HTTPS template with `{version}`, `{major}`,
 * `{minor}` and `{patch}`; `signature` may also start with `{tarball}`.
 */
export interface GnuSource {
  /** Page whose links name the tarball's file (any path prefix). */
  listing: string;
  /** Ends in `/<package>-{version}.tar.gz` or `.tar.xz`. */
  tarball: string;
  signature: string;
  /** `tar`: the signature covers the uncompressed tar, not the archive. */
  signedData?: 'tar';
  /** The license file, relative to the tarball's single root. */
  license: string;
  /**
   * Other servers with the same files, tried in order when the listing's
   * server cannot be reached: each replaces the `listing` prefix of the
   * listing, tarball and signature URLs. The signature check stays the same.
   */
  mirrors?: string[];
}
/**
 * A package built from its signed release tarball: by default the GNU one
 * on ftp.gnu.org with its `.sig`, otherwise the one `source` names.
 */
export interface GnuPackage {
  /** Package name: ftp.gnu.org/gnu/<package>/<package>-<version>.tar.gz by default. */
  package: string;
  /**
   * Tag of the release in the repository; `{version}`, `{major}`, `{minor}`,
   * `{patch}`, and on GitHub one `{date}` (8 digits, found among the tags).
   * null only for a library without a repository (see GnuLibrary).
   */
  tag: string | null;
  /** Primary key fingerprints in showcase/keys/<package>.gpg that may sign. */
  signers: string[];
  /** SPDX identifier or `A OR B` expression of the tarball's license. */
  spdx: string;
  /** configure arguments; the builder adds --prefix, CC and the search paths. */
  configure: string[];
  source?: GnuSource;
}
export interface GnuLibrary extends GnuPackage {
  /**
   * null together with `tag` for a library that has no tagged public
   * repository (GMP): it is identified by its signed ftp.gnu.org tarball
   * alone, and no commit is recorded for it.
   */
  repository: string | null;
}
/** A further program of the same build, distributed as a guest of its own. */
export interface GnuCompanion {
  /** Guest file name and tool name in the catalog. */
  binary: string;
  /** The built program's path in the source tree. */
  output: string;
}
export interface GnuSourceAcquire extends GnuPackage {
  kind: 'gnu-source';
  tag: string;
  builder: 'autotools';
  /** Guest file name, and the built program's path in the source tree. */
  binary: string;
  output: string;
  /** Static libraries built first, in order, into one prefix. */
  libraries: GnuLibrary[];
  /** make variables of the program build (`NAME=value`, `{prefix}` expanded). */
  make?: string[];
  companions?: GnuCompanion[];
}
export interface ToolConfig {
  tool: string;
  repository: string;
  tagPattern: string;
  fixture: string;
  acquire: ReleaseAssetAcquire | SourceBuildAcquire | GnuSourceAcquire;
  /** The terminal pages pass keystrokes to this tool and give it a terminal. */
  interactive?: true;
  /** Every terminal page installs this tool when its session starts. */
  everyPage?: true;
  /**
   * The terminal pages give this tool's runs the network: through the
   * site's relay, to the site's allow list only (github.com:443).
   */
  network?: true;
  /**
   * Text files every terminal page writes below the session home (/root),
   * by path relative to it, so this tool finds them wherever it is installed.
   */
  homeFiles?: Record<string, string>;
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
/** One SPDX identifier, or identifiers joined by ` OR ` / ` AND `. */
const SPDX = /^(?=.{1,128}$)[A-Za-z0-9.+-]+(?: (?:OR|AND) [A-Za-z0-9.+-]+)*$/;
const TAG_TEMPLATE = /^[A-Za-z0-9._{}-]{1,128}$/;
/**
 * `--option[=value]`, `VARIABLE=value` (the value may hold `=`, as in
 * `CFLAGS=-O2 -std=gnu17`), or an autoconf cache answer
 * `ac_cv_<name>=yes|no` (curl must not take GnuTLS's own memset_explicit,
 * which musl's headers do not declare); `{prefix}` is the build prefix.
 */
const CONFIGURE_ARGUMENT =
  /^(?:--[a-z0-9][a-z0-9-]*(?:=[A-Za-z0-9._,+/{}-]*)?|[A-Z][A-Z0-9_]*=[A-Za-z0-9._,+/{}= -]*|ac_cv_[a-z0-9_]+=(?:yes|no))$/;
/** A make variable; names that steer make itself are refused below. */
const MAKE_VARIABLE = /^[A-Za-z][A-Za-z0-9_]*=[A-Za-z0-9._,+/{} -]*$/;
const MAKE_CONTROL = /^(?:MAKE[A-Z]*|MFLAGS|SHELL|GNUMAKEFLAGS|VPATH)=/;
/** https://<host>/<path> with only these characters and template braces. */
const SOURCE_URL =
  /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[A-Za-z0-9._~/{}+-]*$/;
const URL_PLACEHOLDERS = ['{version}', '{major}', '{minor}', '{patch}'];
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

/** One URL template: HTTPS, a plain host, no `..`, only the placeholders. */
function urlTemplate(value: unknown, where: string): string {
  const url = text(value, where, SOURCE_URL);
  let literal = url;
  for (const placeholder of URL_PLACEHOLDERS)
    literal = literal.replaceAll(placeholder, '');
  if (/[{}]/.test(literal) || url.split('/').includes('..'))
    fail('config-invalid', `${where} has an unknown placeholder or ..`);
  return url;
}
/** `{tarball}` and a file suffix, such as `{tarball}.asc`. */
const TARBALL_SUFFIX = /^\{tarball\}[A-Za-z0-9._+-]+$/;

/** One to four distinct https directories, without placeholders. */
function mirrorList(value: unknown, where: string): string[] {
  const mirrors = strings(value, where).map((item) => {
    const url = text(item, where, SOURCE_URL);
    if (!url.endsWith('/') || /[{}]/.test(url) || url.split('/').includes('..'))
      fail(
        'config-invalid',
        `${where} entries must be directories without placeholders`,
      );
    return url;
  });
  if (
    mirrors.length < 1 ||
    mirrors.length > 4 ||
    new Set(mirrors).size !== mirrors.length
  )
    fail('config-invalid', `${where} must name one to four distinct mirrors`);
  return mirrors;
}

function gnuSourceSettings(
  value: unknown,
  where: string,
  name: string,
): GnuSource {
  const raw = record(value, where);
  only(
    raw,
    ['listing', 'tarball', 'signature', 'signedData', 'license', 'mirrors'],
    where,
  );
  const tarball = urlTemplate(raw.tarball, `${where}.tarball`);
  if (
    !/\.tar\.(?:gz|xz)$/.test(tarball) ||
    !tarball.endsWith(`/${name}-{version}${tarball.slice(-7)}`)
  )
    fail(
      'config-invalid',
      `${where}.tarball must end in ${name}-{version}.tar.gz or .tar.xz`,
    );
  const signature =
    typeof raw.signature === 'string' && TARBALL_SUFFIX.test(raw.signature)
      ? raw.signature
      : urlTemplate(raw.signature, `${where}.signature`);
  // The signature is served beside the tarball under its own file name.
  const expanded = signature.replace('{tarball}', tarball);
  if (
    !URL_PLACEHOLDERS.some((placeholder) => expanded.includes(placeholder)) ||
    expanded.split('/').at(-1) === tarball.split('/').at(-1)
  )
    fail(
      'config-invalid',
      `${where}.signature must name its own versioned file`,
    );
  if (raw.signedData !== undefined && raw.signedData !== 'tar')
    fail('config-invalid', `${where}.signedData must be tar when present`);
  const listing = urlTemplate(raw.listing, `${where}.listing`);
  const mirrors =
    raw.mirrors === undefined
      ? undefined
      : mirrorList(raw.mirrors, `${where}.mirrors`);
  // A mirror holds the listing's directory, so the files must be in it.
  if (
    mirrors &&
    (!listing.endsWith('/') ||
      !tarball.startsWith(listing) ||
      !expanded.startsWith(listing))
  )
    fail(
      'config-invalid',
      `${where} with mirrors needs the tarball and signature in the listing's directory`,
    );
  return {
    listing,
    tarball,
    signature,
    ...(raw.signedData === 'tar' ? { signedData: 'tar' as const } : {}),
    license: relativePath(raw.license, `${where}.license`),
    ...(mirrors ? { mirrors } : {}),
  };
}

function versionTag(value: unknown, where: string): string {
  const tag = text(value, where, TAG_TEMPLATE);
  let literal = tag.replace('{date}', '');
  for (const placeholder of URL_PLACEHOLDERS)
    literal = literal.replaceAll(placeholder, '');
  if (
    !URL_PLACEHOLDERS.some((placeholder) => tag.includes(placeholder)) ||
    /[{}]/.test(literal)
  )
    fail('config-invalid', `${where} must name the version only`);
  return tag;
}

/** The GNU mirror (gnu.ts GNU_MIRROR), which signs every release tarball. */
const GNU_FTP = 'https://ftp.gnu.org/gnu';

function gnuPackage(value: Json, where: string, untagged = false): GnuPackage {
  const tag = untagged ? null : versionTag(value.tag, `${where}.tag`);
  const signers = strings(value.signers, `${where}.signers`).map((item) =>
    text(item, `${where}.signers`, FINGERPRINT),
  );
  if (new Set(signers).size !== signers.length)
    fail('config-invalid', `${where}.signers has duplicates`);
  const name = text(value.package, `${where}.package`, GNU_PACKAGE);
  return {
    package: name,
    tag,
    signers,
    spdx: text(value.spdx, `${where}.spdx`, SPDX),
    configure: Array.isArray(value.configure)
      ? value.configure.map((item, index) =>
          text(item, `${where}.configure[${index}]`, CONFIGURE_ARGUMENT),
        )
      : fail('config-invalid', `${where}.configure must be an array`),
    ...(value.source === undefined
      ? {}
      : { source: gnuSourceSettings(value.source, `${where}.source`, name) }),
  };
}

const GNU_PACKAGE_KEYS = [
  'package',
  'tag',
  'signers',
  'spdx',
  'configure',
  'source',
];

function makeVariables(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0)
    fail('config-invalid', `${where} must be a non-empty array`);
  return value.map((item, index) => {
    const variable = text(item, `${where}[${index}]`, MAKE_VARIABLE);
    if (MAKE_CONTROL.test(variable))
      fail('config-invalid', `${where}[${index}] steers make itself`);
    return variable;
  });
}

function companions(value: unknown, where: string): GnuCompanion[] {
  if (!Array.isArray(value) || value.length === 0)
    fail('config-invalid', `${where} must be a non-empty array`);
  return value.map((item, index) => {
    const at = `${where}[${index}]`;
    const raw = record(item, at);
    only(raw, ['binary', 'output'], at);
    return {
      binary: text(raw.binary, `${at}.binary`, TOOL),
      output: relativePath(raw.output, `${at}.output`),
    };
  });
}

function gnuSource(
  value: Json,
  where: string,
  allowed: Set<string>,
  toolRepository: string,
): GnuSourceAcquire {
  only(
    value,
    [
      'kind',
      'builder',
      'binary',
      'output',
      'libraries',
      'make',
      'companions',
      ...GNU_PACKAGE_KEYS,
    ],
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
    if ((raw.repository === undefined) !== (raw.tag === undefined))
      fail('config-invalid', `${at} needs repository and tag, or neither`);
    if (raw.repository === undefined) {
      // Without a repository only the signed GNU tarball identifies it.
      const pkg = gnuPackage(raw, at, true);
      const gnu = `${GNU_FTP}/${pkg.package}/`;
      if (
        pkg.source &&
        (pkg.source.listing !== gnu ||
          !pkg.source.tarball.startsWith(gnu) ||
          pkg.source.signature !== '{tarball}.sig' ||
          pkg.source.signedData)
      )
        fail(
          'config-invalid',
          `${at} without a repository needs its signed ftp.gnu.org tarball`,
        );
      return { ...pkg, repository: null };
    }
    const repository = text(raw.repository, `${at}.repository`, REPOSITORY);
    if (!allowed.has(repository))
      fail('source-not-allowed', `${repository} is not in the main allow list`);
    return { ...gnuPackage(raw, at), repository };
  });
  const result: GnuSourceAcquire = {
    kind: 'gnu-source',
    builder: 'autotools',
    ...gnuPackage(value, where),
    tag: versionTag(value.tag, `${where}.tag`),
    binary: text(value.binary, `${where}.binary`, IDENTIFIER),
    output: relativePath(value.output, `${where}.output`),
    libraries,
    ...(value.make === undefined
      ? {}
      : { make: makeVariables(value.make, `${where}.make`) }),
    ...(value.companions === undefined
      ? {}
      : { companions: companions(value.companions, `${where}.companions`) }),
  };
  // A dated tag is found among the repository's tags through the GitHub API.
  for (const [pkg, repository] of [
    [result, toolRepository],
    ...libraries.map((item) => [item, item.repository] as const),
  ] as const)
    if (
      pkg.tag?.includes('{date}') &&
      !repository?.startsWith('https://github.com/')
    )
      fail(
        'config-invalid',
        `${pkg.package}.tag {date} needs a GitHub repository`,
      );
  const names = [result.package, ...libraries.map((item) => item.package)];
  if (new Set(names).size !== names.length)
    fail('config-invalid', `${where} names a package twice`);
  const binaries = [
    result.binary,
    ...(result.companions ?? []).map((item) => item.binary),
  ];
  if (new Set(binaries).size !== binaries.length)
    fail('config-invalid', `${where} names a program twice`);
  return result;
}

function tool(value: unknown, index: number, allowed: Set<string>): ToolConfig {
  const where = `tools[${index}]`;
  const raw = record(value, where);
  only(
    raw,
    [
      'tool',
      'repository',
      'tagPattern',
      'fixture',
      'acquire',
      'interactive',
      'everyPage',
      'network',
      'homeFiles',
    ],
    where,
  );
  for (const flag of ['interactive', 'everyPage', 'network'])
    if (raw[flag] !== undefined && raw[flag] !== true)
      fail('config-invalid', `${where}.${flag} must be true when present`);
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
            ? gnuSource(acquire, `${where}.acquire`, allowed, repository)
            : fail('config-invalid', `${where}.acquire.kind is unknown`),
    ...(raw.interactive === true ? { interactive: true as const } : {}),
    ...(raw.everyPage === true ? { everyPage: true as const } : {}),
    ...(raw.network === true ? { network: true as const } : {}),
    ...(raw.homeFiles === undefined
      ? {}
      : { homeFiles: homeFiles(raw.homeFiles, `${where}.homeFiles`) }),
  };
}

/** One segment of a home file path: no `.`, `..` or empty segment. */
const HOME_SEGMENT = /^\.?[A-Za-z0-9_][A-Za-z0-9._-]*$/;
/** Home files are small settings, embedded in every terminal page. */
export const MAX_HOME_FILE_BYTES = 4096;
/**
 * The CA bundle's path below the home. The terminal pages write the site's
 * CA bundle there (too large for a home file), so no home file may use it.
 */
export const CA_BUNDLE_HOME_PATH = '.config/ssl/cacert.pem';

function homeFiles(value: unknown, where: string): Record<string, string> {
  const raw = record(value, where);
  const files = Object.entries(raw);
  if (files.length === 0) fail('config-invalid', `${where} must not be empty`);
  for (const [path, content] of files) {
    if (!path.split('/').every((segment) => HOME_SEGMENT.test(segment)))
      fail('config-invalid', `${where} path ${path} is invalid`);
    if (
      typeof content !== 'string' ||
      new TextEncoder().encode(content).length > MAX_HOME_FILE_BYTES
    )
      fail(
        'config-invalid',
        `${where}.${path} must be text of at most ${MAX_HOME_FILE_BYTES} bytes`,
      );
  }
  return Object.fromEntries(files) as Record<string, string>;
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
  // A companion is installed by its own name, so it shares the tool names.
  const names = new Set<string>();
  for (const name of tools.flatMap((entry) => [
    entry.tool,
    ...companionNames(entry),
  ])) {
    if (names.has(name)) fail('config-invalid', `duplicate tool: ${name}`);
    names.add(name);
  }
  // Every page writes the home files of all tools into one home, so no two
  // may share a path and none may be the directory of another, nor of the
  // CA bundle the pages write beside them.
  const homePaths = tools.flatMap((entry) =>
    Object.keys(entry.homeFiles ?? {}),
  );
  for (const path of homePaths)
    if (
      path === CA_BUNDLE_HOME_PATH ||
      CA_BUNDLE_HOME_PATH.startsWith(`${path}/`) ||
      path.startsWith(`${CA_BUNDLE_HOME_PATH}/`) ||
      homePaths.some(
        (other, index) =>
          (other === path && homePaths.indexOf(path) !== index) ||
          other.startsWith(`${path}/`),
      )
    )
      fail('config-invalid', `home file ${path} conflicts with another`);
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

/** The tool names of a gnu-source tool's companions, in order. */
export const companionNames = (entry: ToolConfig): string[] =>
  entry.acquire.kind === 'gnu-source'
    ? (entry.acquire.companions ?? []).map((item) => item.binary)
    : [];

/** Expands a tag or URL template for one version (missing parts are 0). */
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
