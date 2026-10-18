import { isRecord } from './contracts.js';
import { invalid } from './errors.js';
import type { GuestBuildInfo } from './guest-validation.js';
import {
  GUEST_LIMITS,
  guestBuildKey,
  guestCanonical,
  guestSha256,
} from './guest-validation.js';

export interface CatalogEntry {
  tool: string;
  versionOrName: string;
  url: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
  downloadSha256: string;
  downloadBytes: number;
  elfBytes: number;
  buildInfo: GuestBuildInfo;
  buildInfoSha256: string;
  [key: string]: unknown;
}
export interface GuestCatalog {
  schemaVersion: 1;
  catalogId: string;
  defaults: Readonly<Record<string, string>>;
  entries: readonly CatalogEntry[];
  [key: string]: unknown;
}
export const INSTALL_LIMITS = Object.freeze({
  download: GUEST_LIMITS.elf,
  expanded: GUEST_LIMITS.fixture,
  catalog: 4194304,
  fetchMs: 120000,
  installMs: 180000,
});
const encoder = new TextEncoder();
function identifier(value: unknown, limit = 128): asserts value is string {
  invalid(
    typeof value === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) &&
      encoder.encode(value).length <= limit,
    'install identifier invalid',
  );
}
function digest(value: unknown): asserts value is string {
  invalid(
    typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
    'install digest invalid',
  );
}
function byteCount(value: unknown): asserts value is number {
  invalid(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= INSTALL_LIMITS.download,
    'install byte count invalid',
  );
}
/** No host origin is invented for a Node catalog. Browsers use document origin only. */
export function assetURL(value: unknown): string {
  invalid(
    typeof value === 'string' &&
      value.length > 0 &&
      ![...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x20 || code === 0x7f || character === '\\';
      }),
    'install URL invalid',
  );
  let url: URL;
  try {
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) url = new URL(value);
    else {
      invalid(
        typeof document !== 'undefined' && !!document.location?.origin,
        'relative install URL requires document origin',
      );
      url = new URL(value, `${document.location.origin}/`);
      invalid(
        url.origin === document.location.origin,
        'relative install URL changed origin',
      );
    }
  } catch (error) {
    invalid(
      false,
      error instanceof Error
        ? 'install URL is not public HTTPS'
        : 'install URL invalid',
    );
  }
  invalid(
    url!.protocol === 'https:' &&
      !url!.username &&
      !url!.password &&
      !url!.hash,
    'install URL must be credential-free HTTPS',
  );
  return url!.href;
}
export function archivePath(value: unknown): string {
  invalid(
    typeof value === 'string' &&
      value.length > 0 &&
      !value.startsWith('/') &&
      !value.includes('\0') &&
      !value.includes('\\'),
    'archive path must be relative POSIX',
  );
  invalid(
    encoder.encode(value).length <= GUEST_LIMITS.path,
    'archive path limit exceeded',
  );
  const parts = value.split('/').filter((part) => part !== '' && part !== '.');
  invalid(
    parts.every((part) => part !== '..'),
    'archive traversal rejected',
  );
  invalid(parts.length > 0, 'archive root cannot be selected');
  return parts.join('/');
}
function source(value: unknown): void {
  invalid(isRecord(value), 'install source identity required');
  invalid(
    typeof value.repository === 'string' &&
      value.repository.startsWith('https://'),
    'install repository must be absolute HTTPS',
  );
  assetURL(value.repository);
  invalid(
    typeof value.commit === 'string' && /^[a-f0-9]{40}$/.test(value.commit),
    'install full source commit required',
  );
}
function buildInfo(value: unknown, entry: CatalogEntry): void {
  invalid(
    isRecord(value) && value.schemaVersion === 1,
    'install metadata schema invalid',
  );
  identifier(value.tool, 64);
  identifier(value.versionOrName);
  invalid(
    value.tool === entry.tool && value.versionOrName === entry.versionOrName,
    'install metadata selection mismatch',
  );
  source(value.source);
  invalid(
    value.target === 'x86_64-unknown-linux-musl',
    'install target invalid',
  );
  invalid(
    value.rustc === null ||
      (typeof value.rustc === 'string' && value.rustc.length > 0),
    'install rustc identity invalid',
  );
  invalid(
    Array.isArray(value.sourcePatches) && Array.isArray(value.dependencies),
    'install patches/dependencies required',
  );
  const patches = new Set<string>();
  for (const patch of value.sourcePatches) {
    invalid(
      isRecord(patch) &&
        typeof patch.name === 'string' &&
        patch.name.length > 0,
      'install patch invalid',
    );
    digest(patch.sha256);
    invalid(!patches.has(patch.name), 'install duplicate patch');
    patches.add(patch.name);
  }
  const dependencies = new Set<string>();
  for (const dependency of value.dependencies) {
    invalid(isRecord(dependency), 'install dependency invalid');
    identifier(dependency.tool, 64);
    source(dependency);
    digest(dependency.digest);
    const key = `${dependency.tool}/${dependency.repository}/${dependency.commit}`;
    invalid(!dependencies.has(key), 'install duplicate dependency');
    dependencies.add(key);
  }
  for (const field of ['builderHash', 'buildKey', 'elfSha256'])
    digest(value[field]);
  const canonical = encoder.encode(guestCanonical(value));
  invalid(
    canonical.length <= GUEST_LIMITS.metadata,
    'install metadata size exceeded',
  );
  invalid(
    guestSha256(canonical) === entry.buildInfoSha256,
    'install metadata digest mismatch',
  );
  invalid(
    guestBuildKey(value as unknown as GuestBuildInfo) === value.buildKey,
    'install build key mismatch',
  );
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}
/** Unknown JSON fields remain in the snapshot and canonical metadata identity. */
export function snapshotCatalog(input: unknown): GuestCatalog {
  const canonical = guestCanonical(input);
  invalid(
    encoder.encode(canonical).length <= INSTALL_LIMITS.catalog,
    'install catalog size exceeded',
  );
  const value = JSON.parse(canonical);
  invalid(
    isRecord(value) && value.schemaVersion === 1,
    'install catalog schema invalid',
  );
  invalid(
    typeof value.catalogId === 'string' &&
      value.catalogId.length > 0 &&
      encoder.encode(value.catalogId).length <= 128,
    'install catalog id invalid',
  );
  invalid(
    isRecord(value.defaults) && Array.isArray(value.entries),
    'install catalog defaults/entries required',
  );
  const entries = new Set<string>();
  for (const raw of value.entries) {
    invalid(isRecord(raw), 'install catalog entry required');
    identifier(raw.tool, 64);
    identifier(raw.versionOrName);
    const entry = raw as unknown as CatalogEntry;
    const key = `${entry.tool}@${entry.versionOrName}`;
    invalid(!entries.has(key), 'install duplicate entry');
    entries.add(key);
    entry.url = assetURL(entry.url);
    invalid(
      entry.format === 'elf' || entry.format === 'tar.gz',
      'install format invalid',
    );
    if (entry.format === 'tar.gz')
      entry.archiveEntry = archivePath(entry.archiveEntry);
    else
      invalid(
        !Object.hasOwn(entry, 'archiveEntry'),
        'ELF cannot have archiveEntry',
      );
    digest(entry.downloadSha256);
    digest(entry.buildInfoSha256);
    byteCount(entry.downloadBytes);
    byteCount(entry.elfBytes);
    buildInfo(entry.buildInfo, entry);
    if (entry.format === 'elf')
      invalid(
        entry.downloadBytes === entry.elfBytes &&
          entry.downloadSha256 === entry.buildInfo.elfSha256,
        'ELF download identity mismatch',
      );
  }
  for (const [tool, version] of Object.entries(value.defaults)) {
    identifier(tool, 64);
    identifier(version);
    invalid(
      entries.has(`${tool}@${version}`),
      'install default references missing entry',
    );
  }
  freeze(value);
  return value as unknown as GuestCatalog;
}
export function selectCatalog(
  catalog: GuestCatalog,
  selection: unknown,
): CatalogEntry {
  invalid(typeof selection === 'string', 'install selection required');
  const parts = selection.split('@');
  invalid(parts.length <= 2, 'install selection has multiple separators');
  const tool = parts[0];
  identifier(tool, 64);
  const version = parts.length === 2 ? parts[1] : catalog.defaults[tool];
  identifier(version);
  const entry = catalog.entries.find(
    (candidate) =>
      candidate.tool === tool && candidate.versionOrName === version,
  );
  invalid(entry !== undefined, 'install selection is unknown');
  return entry;
}
