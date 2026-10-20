// Fetches the three fixed inputs of the formal U4/B1 acceptance run (the two
// official mirror assets U3's measure reads, and the archived actual site) and
// restores the actual site. Every input is checked against its pinned size and
// SHA256 before anything is written, and nothing is ever overwritten: an
// existing destination is reused only when its bytes are the pinned bytes.
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  INSTALL_ACTUAL_SITE_FILES,
  INSTALL_SITE_DESTINATION,
  inspectInstallActualSite,
  validateInstallSiteBudget,
} from '../migration-install/actual-site.js';
import { CI_INPUT_LIMITS } from '../migration-session/ci-inputs.js';
import { sha256 } from '../package/stage-package.js';
import {
  fetchAsset,
  readBoundedFile,
  safeAssetPath,
  unpackTar,
} from '../release/publication-assets.js';

export const ACCEPTANCE_INPUTS_MANIFEST = 'ci/migration-command/inputs.json';
export const ACCEPTANCE_INPUTS_SCHEMA = 'migration-command-acceptance-inputs';
export const MIRROR_INPUT_PATH =
  'docs/results/terrarium-migration-preflight-evidence/mirror-input.json';
/** The archived actual site, published as a prerelease asset by the person. */
export const SITE_ARCHIVE = Object.freeze({
  name: 'actual-site-v2.tar.gz',
  path: '.artifacts/migration-install/actual-site-v2.tar.gz',
  bytes: 36727106,
  sha256: '9c0dd08a854487501c5b2dcd2dc9ce5f703bddf993fc0156586776c2cf63307f',
  url: 'https://github.com/aletheia-works/formicarium/releases/download/migration-inputs-actual-site-v2/actual-site-v2.tar.gz',
});
/** The eleventh site file is the fixed aube guest, taken from the U2 inputs. */
export const SITE_REFERENCE = Object.freeze({
  source: 'dist/guests/aube',
  path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest',
  bytes: 36948544,
  sha256: 'c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e',
});
/** Where each input goes; U3's measure reads the two mirror assets from here. */
export const ACCEPTANCE_INPUT_DESTINATIONS: Readonly<Record<string, string>> =
  Object.freeze({
    'aube.tar.gz':
      '.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
    'biome.elf':
      '.artifacts/migration-preflight/mirror-assets-attempt-1/biome.elf',
    [SITE_ARCHIVE.name]: SITE_ARCHIVE.path,
  });
/** The official mirror-input tool each mirror asset must match. */
const MIRROR_TOOLS: Readonly<Record<string, string>> = Object.freeze({
  'aube.tar.gz': 'aube',
  'biome.elf': 'biome',
});
/** GitHub serves release downloads through one redirect to these hosts. */
export const RELEASE_REDIRECT_HOSTS = Object.freeze([
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
]);

export interface AcceptanceInput {
  name: string;
  url: string;
  bytes: number;
  sha256: string;
  path: string;
}
export interface AcceptanceInputs {
  schema: typeof ACCEPTANCE_INPUTS_SCHEMA;
  version: 1;
  files: AcceptanceInput[];
}
export interface SiteFile {
  path: string;
  bytes: number;
  sha256: string;
}
export interface SiteOptions {
  /** The eleven site files; tests pass a small inventory. */
  files?: readonly SiteFile[];
  reference?: { source: string; path: string; bytes: number; sha256: string };
  archive?: { path: string; bytes: number; sha256: string };
  /** The final gate over the restored site; U3's fixed inspector by default. */
  inspect?: (site: string) => Promise<string>;
}

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(`U4 acceptance input ${message}`);
}
function record(value: unknown, what: string): Record<string, unknown> {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${what} object required`,
  );
  return value as Record<string, unknown>;
}
function exactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  what: string,
) {
  ensure(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort()),
    `${what} unknown/missing field`,
  );
}
const SHA256 = /^[a-f0-9]{64}$/;

/** Official release URLs only: https, github.com, a release download path. */
export function validateReleaseUrl(value: unknown): string {
  ensure(typeof value === 'string', 'url required');
  const url = new URL(value);
  ensure(
    url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      // A tag may hold a slash (biome's `@biomejs/biome@2.5.15`).
      /^\/[^/]+\/[^/]+\/releases\/download\/[^/].*\/[^/]+$/.test(
        url.pathname,
      ) &&
      !url.pathname.split('/').some((part) => part === '..' || part === '.'),
    'url is not an official GitHub release download',
  );
  return value;
}

/** The official aube/biome rows of the accepted U1 mirror input. */
export function officialMirrorAssets(mirror: unknown) {
  const official = record(
    record(mirror, 'mirror input').metadataProducer,
    'mirror metadata',
  ).official;
  ensure(Array.isArray(official), 'mirror official list required');
  const byTool = new Map<string, { url: string; size: number; sha: string }>();
  for (const raw of official) {
    const row = record(raw, 'mirror official');
    ensure(
      typeof row.tool === 'string' && !byTool.has(row.tool),
      'mirror official tool duplicate/missing',
    );
    byTool.set(row.tool, {
      url: String(row.url),
      size: Number(row.size),
      sha: String(row.downloadSha256),
    });
  }
  return byTool;
}

/**
 * The exact three inputs, each bound to its fixed destination, the official
 * mirror-input row (aube, biome) or the pinned site archive.
 */
export function validateAcceptanceInputs(
  value: unknown,
  mirror: unknown,
): AcceptanceInputs {
  const manifest = record(value, 'manifest');
  exactFields(manifest, ['schema', 'version', 'files'], 'manifest');
  ensure(
    manifest.schema === ACCEPTANCE_INPUTS_SCHEMA && manifest.version === 1,
    'manifest schema/version refused',
  );
  const names = Object.keys(ACCEPTANCE_INPUT_DESTINATIONS);
  ensure(
    Array.isArray(manifest.files) && manifest.files.length === names.length,
    'manifest missing/extra inventory',
  );
  const official = officialMirrorAssets(mirror);
  const seen = new Set<string>();
  const files: AcceptanceInput[] = [];
  let total = 0;
  for (const raw of manifest.files) {
    const row = record(raw, 'file');
    exactFields(row, ['name', 'url', 'bytes', 'sha256', 'path'], 'file');
    ensure(
      typeof row.name === 'string' && names.includes(row.name),
      'unknown input name',
    );
    ensure(!seen.has(row.name), 'duplicate input name');
    seen.add(row.name);
    const path = ACCEPTANCE_INPUT_DESTINATIONS[row.name];
    ensure(
      path && row.path === path,
      'destination differs from the fixed destination',
    );
    const url = validateReleaseUrl(row.url);
    ensure(
      typeof row.bytes === 'number' &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= CI_INPUT_LIMITS.file,
      'byte limit',
    );
    ensure(
      typeof row.sha256 === 'string' && SHA256.test(row.sha256),
      'digest required',
    );
    const tool = MIRROR_TOOLS[row.name];
    if (tool) {
      const pinned = official.get(tool);
      ensure(
        pinned &&
          pinned.url === url &&
          pinned.size === row.bytes &&
          pinned.sha === row.sha256,
        `${row.name} differs from the official mirror input`,
      );
    } else
      ensure(
        url === SITE_ARCHIVE.url &&
          row.bytes === SITE_ARCHIVE.bytes &&
          row.sha256 === SITE_ARCHIVE.sha256,
        'site archive differs from the pinned archive',
      );
    total += row.bytes;
    ensure(total <= CI_INPUT_LIMITS.total, 'total limit');
    files.push({
      name: row.name,
      url,
      bytes: row.bytes,
      sha256: row.sha256,
      path,
    });
  }
  return { schema: ACCEPTANCE_INPUTS_SCHEMA, version: 1, files };
}

async function readCanonicalJson(path: string, limit: number) {
  const bytes = await readBoundedFile(path, limit);
  const text = bytes.toString('utf8');
  const parsed: unknown = JSON.parse(text);
  ensure(
    `${JSON.stringify(parsed, null, 2)}\n` === text,
    'canonical JSON required (duplicate keys refused)',
  );
  return { parsed, sha256: sha256(bytes) };
}

/** Reads the fixed manifest of this checkout, and the mirror input it binds. */
export async function readAcceptanceInputs(root: string, manifestPath: string) {
  ensure(
    resolve(manifestPath) === resolve(root, ACCEPTANCE_INPUTS_MANIFEST),
    `manifest must be ${ACCEPTANCE_INPUTS_MANIFEST}`,
  );
  ensure(
    await regularOrAbsent(root, ACCEPTANCE_INPUTS_MANIFEST),
    'manifest missing',
  );
  const manifest = await readCanonicalJson(
    resolve(manifestPath),
    CI_INPUT_LIMITS.metadata,
  );
  const mirror = JSON.parse(
    (
      await readBoundedFile(
        resolve(root, MIRROR_INPUT_PATH),
        CI_INPUT_LIMITS.metadata,
      )
    ).toString('utf8'),
  );
  return {
    inputs: validateAcceptanceInputs(manifest.parsed, mirror),
    manifestSha256: manifest.sha256,
  };
}

/**
 * True for a regular file, false when absent; every ancestor must be a real
 * directory, so a symlink can never redirect a write or a read.
 */
export async function regularOrAbsent(
  root: string,
  path: string,
): Promise<boolean> {
  const parts = safeAssetPath(path).split('/');
  for (let index = 1; index <= parts.length; index++) {
    try {
      const stat = await lstat(resolve(root, ...parts.slice(0, index)));
      ensure(
        !stat.isSymbolicLink() &&
          (index === parts.length ? stat.isFile() : stat.isDirectory()),
        `symlink/special path ${path}`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  return true;
}

/**
 * Downloads every missing input and checks every input before any write. An
 * existing destination is reused only when it is byte-identical.
 */
export async function fetchAcceptanceInputs(
  root: string,
  inputs: AcceptanceInputs,
  fetcher: typeof fetch = fetch,
) {
  const pending: { row: AcceptanceInput; bytes: Buffer }[] = [];
  const reused: string[] = [];
  for (const row of inputs.files) {
    if (await regularOrAbsent(root, row.path)) {
      const existing = await readBoundedFile(
        resolve(root, row.path),
        CI_INPUT_LIMITS.file,
      );
      ensure(
        existing.length === row.bytes && sha256(existing) === row.sha256,
        `existing ${row.path} differs (never overwritten)`,
      );
      reused.push(row.path);
      continue;
    }
    const bytes = await fetchAsset(row.url, row.bytes, fetcher, {}, [
      ...RELEASE_REDIRECT_HOSTS,
    ]);
    ensure(
      bytes.length === row.bytes && sha256(bytes) === row.sha256,
      `${row.name} download size/digest differs`,
    );
    pending.push({ row, bytes });
  }
  const created: string[] = [];
  try {
    for (const { row, bytes } of pending) {
      const target = resolve(root, row.path);
      await mkdir(dirname(target), { recursive: true });
      ensure(
        !(await regularOrAbsent(root, row.path)),
        `${row.path} appeared while fetching (never overwritten)`,
      );
      await writeFile(target, bytes, { flag: 'wx' });
      created.push(target);
    }
  } catch (error) {
    for (const path of created.reverse()) await rm(path, { force: true });
    throw error;
  }
  return { created, reused };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** The archive holds the site files except the reference guest. */
export function siteArchiveFiles(
  files: readonly SiteFile[] = INSTALL_ACTUAL_SITE_FILES,
  referencePath: string = SITE_REFERENCE.path,
): SiteFile[] {
  const rows = files.filter((row) => row.path !== referencePath);
  ensure(rows.length === files.length - 1, 'reference not in site inventory');
  return rows;
}

/**
 * Decodes the gzip tar (links, special entries, unsafe or duplicate paths are
 * refused by unpackTar) and requires exactly the expected files and bytes.
 */
export function decodeSiteArchive(
  bytes: Uint8Array,
  expected: readonly SiteFile[] = siteArchiveFiles(),
): Map<string, Buffer> {
  ensure(bytes.byteLength <= CI_INPUT_LIMITS.file, 'archive byte limit');
  const files = unpackTar(
    bytes,
    CI_INPUT_LIMITS.total,
    CI_INPUT_LIMITS.entries,
  );
  ensure(
    JSON.stringify([...files.keys()].sort()) ===
      JSON.stringify(expected.map((row) => row.path).sort()),
    'archive inventory missing/extra',
  );
  let total = 0;
  for (const row of expected) {
    const file = files.get(row.path)!;
    ensure(
      file.length === row.bytes && sha256(file) === row.sha256,
      `archive file size/digest differs: ${row.path}`,
    );
    total += file.length;
    validateInstallSiteBudget(total, files.size);
  }
  return files;
}

/** Generic inspector over any inventory: exact files, sizes and digests. */
export async function inspectRestoredSite(
  site: string,
  files: readonly SiteFile[],
): Promise<string> {
  const found: string[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      ensure(!entry.isSymbolicLink(), 'site symlink entry');
      if (entry.isDirectory()) await walk(path);
      else {
        ensure(entry.isFile(), 'site special entry');
        found.push(relative(site, path));
      }
    }
  };
  await walk(site);
  ensure(
    JSON.stringify(found.sort()) ===
      JSON.stringify(files.map((row) => row.path).sort()),
    'site inventory missing/extra',
  );
  for (const row of files) {
    const bytes = await readBoundedFile(
      resolve(site, row.path),
      CI_INPUT_LIMITS.file,
    );
    ensure(
      bytes.length === row.bytes && sha256(bytes) === row.sha256,
      `site file size/digest differs: ${row.path}`,
    );
  }
  return site;
}

/**
 * Restores `.artifacts/migration-install/actual-site` from the checked archive
 * and the reference guest, then hands the result to the final inspector. An
 * existing site is never rewritten: it is only inspected.
 */
export async function restoreActualSite(
  root: string,
  options: SiteOptions = {},
): Promise<string> {
  const files = options.files ?? INSTALL_ACTUAL_SITE_FILES;
  const reference = options.reference ?? SITE_REFERENCE;
  const archive = options.archive ?? SITE_ARCHIVE;
  const inspect = options.inspect ?? inspectInstallActualSite;
  const site = resolve(root, INSTALL_SITE_DESTINATION);
  if (await pathExists(site)) return await inspect(site);
  ensure(await regularOrAbsent(root, archive.path), 'site archive missing');
  const archived = await readBoundedFile(
    resolve(root, archive.path),
    CI_INPUT_LIMITS.file,
  );
  ensure(
    archived.length === archive.bytes && sha256(archived) === archive.sha256,
    'site archive size/digest differs',
  );
  const decoded = decodeSiteArchive(
    archived,
    siteArchiveFiles(files, reference.path),
  );
  ensure(
    await regularOrAbsent(root, reference.source),
    'reference guest missing',
  );
  const guest = await readBoundedFile(
    resolve(root, reference.source),
    CI_INPUT_LIMITS.file,
  );
  ensure(
    guest.length === reference.bytes && sha256(guest) === reference.sha256,
    'reference guest size/digest differs',
  );
  decoded.set(reference.path, guest);
  validateInstallSiteBudget(
    [...decoded.values()].reduce((sum, bytes) => sum + bytes.length, 0),
    decoded.size,
  );
  await mkdir(dirname(site), { recursive: true });
  // The parent chain must be real directories before the site is created.
  ensure(
    !(await regularOrAbsent(root, `${INSTALL_SITE_DESTINATION}/tools.json`)),
    'site appeared while restoring',
  );
  await mkdir(site);
  try {
    for (const [path, bytes] of decoded) {
      const target = resolve(site, safeAssetPath(path));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
    return await inspect(site);
  } catch (error) {
    await rm(site, { recursive: true, force: true });
    throw error;
  }
}

/** CLI `restore`: fetch, check, restore the site, and keep a receipt. */
export async function restoreAcceptanceInputs(
  root: string,
  manifestPath: string,
  fetcher: typeof fetch = fetch,
) {
  const { inputs, manifestSha256 } = await readAcceptanceInputs(
    root,
    manifestPath,
  );
  const fetched = await fetchAcceptanceInputs(root, inputs, fetcher);
  const site = await restoreActualSite(root);
  const receipt = {
    recordKind: 'restored-acceptance-inputs',
    assembledAt: new Date().toISOString(),
    manifest: ACCEPTANCE_INPUTS_MANIFEST,
    manifestSha256,
    files: inputs.files,
    created: fetched.created.map((path) => relative(root, path)),
    reused: fetched.reused,
    actualSite: relative(root, site),
  };
  const path = resolve(
    root,
    `.artifacts/migration-command/acceptance-inputs-${randomUUID()}.json`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
  });
  return path;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, path, ...extra] = process.argv.slice(2);
  const root = process.cwd();
  if (mode === 'restore' && path && !extra.length)
    console.log(await restoreAcceptanceInputs(root, resolve(path)));
  else if (mode === 'inspect' && path && !extra.length)
    console.log(
      JSON.stringify(
        (await readAcceptanceInputs(root, resolve(path))).inputs,
        null,
        2,
      ),
    );
  else if (mode === 'verify-archive' && path && !extra.length) {
    const bytes = await readBoundedFile(resolve(path), CI_INPUT_LIMITS.file);
    ensure(
      bytes.length === SITE_ARCHIVE.bytes &&
        sha256(bytes) === SITE_ARCHIVE.sha256,
      'site archive size/digest differs',
    );
    console.log(
      JSON.stringify(
        [...decodeSiteArchive(bytes)].map(([file, content]) => ({
          path: file,
          bytes: content.length,
          sha256: sha256(content),
        })),
        null,
        2,
      ),
    );
  } else
    throw Error(
      'usage: U4 acceptance-inputs.js restore ci/migration-command/inputs.json | inspect ci/migration-command/inputs.json | verify-archive <actual-site-v2.tar.gz>',
    );
}
