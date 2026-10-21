import type { GuestBuild } from './index.js';
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const TOOLS = new Set(['aube', 'pitchfork']);
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const own = (value: object, key: string) => Object.hasOwn(value, key);
const object = isRecord;

function requireObject(
  value: unknown,
  target: string,
): asserts value is Record<string, unknown> {
  if (!object(value)) throw new Error(`${target}: expected an object`);
}

function requireText(value: unknown, target: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in untrusted paths.
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    throw new Error(`${target}: expected nonempty text`);
  }
}

function checkPath(path: string, target: string) {
  // Inspect the authored path before URL normalization erases dot segments.
  for (const part of path.split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      throw new Error(`${target}: malformed URL encoding`);
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in untrusted paths.
      /[\\/\x00-\x1f\x7f%]/.test(decoded)
    ) {
      throw new Error(`${target}: unsafe URL path`);
    }
  }
}

function parseUrl(
  value: unknown,
  base: string | URL | undefined,
  target: string,
) {
  requireText(value, target);
  if (value !== value.trim() || value.includes('\\'))
    throw new Error(`${target}: unsafe URL`);
  checkPath(
    value.split(/[?#]/)[0]!.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, ''),
    target,
  );
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new Error(`${target}: invalid URL`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`${target}: HTTP(S) URL without credentials required`);
  }
  if (url.hash || url.search)
    throw new Error(`${target}: URL query/fragment not allowed`);
  return url;
}

/** Canonical directory boundary for the static distribution. */
export function normalizeBase(value: string) {
  const url = parseUrl(value, undefined, 'base');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

/** Resolve only within the chosen distribution's origin and directory. */
export function resolveAssetUrl(
  value: unknown,
  base: string,
  target = 'asset',
) {
  const boundary = new URL(normalizeBase(base));
  const url = parseUrl(value, boundary, target);
  if (
    url.origin !== boundary.origin ||
    !url.pathname.startsWith(boundary.pathname)
  ) {
    throw new Error(`${target}: URL outside distribution boundary`);
  }
  return url.href;
}

/** Redirects are forbidden, even when a fetch mock supplies a final URL. */
export function assertResponseUrl(
  response: { status: number; redirected?: boolean; url?: string },
  requested: string,
  base: string,
  target = 'asset',
) {
  if (
    response.redirected ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new Error(`${target}: redirect refused`);
  }
  if (
    response.url &&
    resolveAssetUrl(response.url, base, target) !== requested
  ) {
    throw new Error(`${target}: response URL mismatch`);
  }
}

function validateAsset(asset: unknown, base: string, target: string) {
  requireObject(asset, target);
  if (typeof asset.sha256 !== 'string' || !SHA256.test(asset.sha256))
    throw new Error(`${target}: invalid SHA-256`);
  resolveAssetUrl(asset.url, base, target);
}

/** Validate the selected C3 entry without migrating unrelated legacy tools. */
export function validateBuild(
  build: unknown,
  { tool, ref, base }: { tool: string; ref: string; base: string },
): GuestBuild {
  requireObject(build, 'build');
  if (build.schemaVersion !== 1)
    throw new Error('build: unsupported schemaVersion');
  if (!TOOLS.has(tool) || build.tool !== tool || build.ref !== ref) {
    throw new Error('build: tool/ref identity mismatch');
  }
  requireObject(build.source, 'build source');
  parseUrl(build.source.url, undefined, 'build source');
  requireText(build.source.ref, 'build source ref');
  if (
    typeof build.source.commit !== 'string' ||
    !COMMIT.test(build.source.commit)
  ) {
    throw new Error('build source: missing or invalid commit');
  }
  if (
    typeof build.built_at !== 'string' ||
    !Number.isFinite(Date.parse(build.built_at))
  ) {
    throw new Error('build: invalid built_at');
  }
  validateAsset(build.guest, base, 'guest');
  requireObject(build.guest, 'guest');
  if (build.guest.format !== 'static-musl-x86_64')
    throw new Error('guest: unsupported format');
  validateAsset(build.buildInfo, base, 'build-info');
  requireObject(build.fixtures, 'fixtures');
  for (const [name, asset] of Object.entries(build.fixtures)) {
    requireText(name, 'fixture name');
    validateAsset(asset, base, 'fixture');
  }
  return build as unknown as GuestBuild;
}

/** Keep the default-first catalogue ordering and explicit failures. */
export function selectBuild(catalog: unknown, input: unknown) {
  requireObject(catalog, 'catalogue');
  requireObject(input, 'selection');
  if (typeof input.tool !== 'string' || !TOOLS.has(input.tool))
    throw new Error('selection: unknown tool');
  requireObject(catalog.tools, 'tools');
  requireObject(catalog.builds, 'builds');
  if (!own(catalog.tools, input.tool))
    throw new Error('selection: unknown tool');
  const tool = catalog.tools[input.tool];
  requireObject(tool, 'tool');
  const builds = own(catalog.builds, input.tool)
    ? catalog.builds[input.tool]
    : {};
  requireObject(builds, 'tool builds');
  const toolOptions = tool as {
    default?: string;
    fixture?: string;
    cwd?: string;
  };
  const names = Object.keys(builds).sort((a, b) =>
    a === tool.default ? -1 : b === tool.default ? 1 : a.localeCompare(b),
  );
  const ref = input.ref ?? names[0];
  if (ref === undefined) throw new Error('selection: no published builds');
  requireText(ref, 'selection ref');
  if (!own(builds, ref)) throw new Error('selection: unknown ref');
  const build = validateBuild(builds[ref], {
    tool: input.tool,
    ref,
    base: String(input.base),
  });
  return {
    catalog,
    toolName: input.tool,
    tool: toolOptions,
    ref,
    build,
    builds,
    names,
  };
}
