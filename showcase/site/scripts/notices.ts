import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { comparePaths } from '../src/model/model-error.ts';
import { fail } from './common.ts';

export const NOTICES_FILE = 'THIRD_PARTY_NOTICES.md';
const LICENSE_NAME = /^(?:licen[cs]e|copying)(?:[.-][\w.-]+)?$/i;

/**
 * Package directories whose code reached the built site, from the module ids
 * Vite recorded (the last node_modules segment names the package).
 */
export function packagesFromModules(
  ids: readonly string[],
): Map<string, string> {
  const packages = new Map<string, string>();
  for (const id of ids) {
    const normalised = id.replaceAll('\\', '/');
    const marker = normalised.lastIndexOf('/node_modules/');
    if (marker < 0) continue;
    const rest = normalised.slice(marker + '/node_modules/'.length).split('/');
    const name = rest[0]?.startsWith('@')
      ? `${rest[0]}/${rest[1] ?? ''}`
      : rest[0];
    if (!name || name.endsWith('/') || name === '.vite') continue;
    packages.set(name, `${normalised.slice(0, marker)}/node_modules/${name}`);
  }
  return new Map([...packages].sort(([a], [b]) => comparePaths(a, b)));
}

export interface PackageNotice {
  name: string;
  version: string;
  license: string;
  file: string;
  text: string;
}

/** The package's own license file; a package without one fails the build. */
export async function packageNotice(directory: string): Promise<PackageNotice> {
  let manifest: { name?: unknown; version?: unknown; license?: unknown };
  try {
    manifest = JSON.parse(
      await readFile(join(directory, 'package.json'), 'utf8'),
    );
  } catch (error) {
    return fail(
      'notices-missing',
      `package.json unreadable: ${directory}`,
      error,
    );
  }
  const name = String(manifest.name ?? directory);
  const version = String(manifest.version ?? 'unknown');
  const license =
    typeof manifest.license === 'string'
      ? manifest.license
      : 'see license file';
  const file = await licenseFile(directory);
  if (file)
    return {
      name,
      version,
      license,
      file,
      text: await licenseText(join(directory, file), file),
    };
  const sibling = await siblingLicense(directory, name, manifest);
  if (!sibling) fail('notices-missing', `${name} has no license file`);
  return { name, version, license, ...sibling };
}

const licenseFile = async (directory: string) =>
  (await readdir(directory))
    .filter((entry) => LICENSE_NAME.test(entry))
    .sort(comparePaths)[0];

/**
 * Packages that ship no license file of their own but come from the same
 * repository and release as a package that does (checked, never assumed).
 */
export const LICENSE_FROM: Readonly<Record<string, string>> = Object.freeze({
  '@pagefind/default-ui': 'pagefind',
});
const repositoryOf = (manifest: { repository?: unknown }) => {
  const value = manifest.repository;
  const url =
    typeof value === 'string'
      ? value
      : (value as { url?: unknown } | undefined)?.url;
  return typeof url === 'string'
    ? url
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
        .toLowerCase()
    : null;
};

async function siblingLicense(
  directory: string,
  name: string,
  manifest: { version?: unknown; repository?: unknown },
): Promise<{ file: string; text: string } | null> {
  const owner = LICENSE_FROM[name];
  if (!owner) return null;
  const root = directory.slice(0, directory.length - name.length);
  const ownerDir = join(root, owner);
  let ownerManifest: { version?: unknown; repository?: unknown };
  try {
    ownerManifest = JSON.parse(
      await readFile(join(ownerDir, 'package.json'), 'utf8'),
    );
  } catch {
    return null;
  }
  const file = await licenseFile(ownerDir);
  if (
    !file ||
    ownerManifest.version !== manifest.version ||
    !repositoryOf(manifest) ||
    repositoryOf(ownerManifest) !== repositoryOf(manifest)
  )
    return null;
  return {
    file: `${owner}/${file}`,
    text: await licenseText(join(ownerDir, file), file),
  };
}

/** A license file, or every file of a license directory (pagefind ships one). */
async function licenseText(path: string, name: string): Promise<string> {
  if (!(await stat(path)).isDirectory())
    return (await readFile(path, 'utf8')).trimEnd();
  const files = (await readdir(path)).sort(comparePaths);
  if (files.length === 0) fail('notices-missing', `${name} directory is empty`);
  const parts: string[] = [];
  for (const file of files)
    parts.push(
      `--- ${name}/${file}\n${(await readFile(join(path, file), 'utf8')).trimEnd()}`,
    );
  return parts.join('\n\n');
}

async function textFile(path: string, label: string): Promise<string> {
  try {
    return (await readFile(path, 'utf8')).trimEnd();
  } catch (error) {
    return fail('notices-missing', `${label} missing`, error);
  }
}

export interface NoticesInput {
  /** Module ids recorded by the Vite plugin of astro.config.mjs. */
  modules: readonly string[];
  /** Packages copied into the site outside Vite (coi-serviceworker, pagefind). */
  copiedPackages: readonly string[];
  /** Extracted formicarium pack (LICENSE, THIRD_PARTY_NOTICES.md). */
  formicariumDir: string;
  /** The candidate's site/ (NOTICES.md and licenses/). */
  candidateSiteDir: string;
}

/** THIRD_PARTY_NOTICES.md of the site (NFR8.3, S14). */
export async function buildNotices(
  input: NoticesInput,
): Promise<{ text: string; packages: PackageNotice[] }> {
  const directories = packagesFromModules(input.modules);
  for (const directory of input.copiedPackages) {
    const notice = await packageNotice(directory);
    directories.set(notice.name, directory);
  }
  const packages: PackageNotice[] = [];
  for (const directory of [...directories.entries()]
    .sort(([a], [b]) => comparePaths(a, b))
    .map(([, path]) => path))
    packages.push(await packageNotice(directory));
  const lines = [
    '# Third-party notices of the formicarium showcase site',
    '',
    '## formicarium',
    '',
    await textFile(
      join(input.formicariumDir, 'LICENSE'),
      'formicarium LICENSE',
    ),
    '',
    await textFile(
      join(input.formicariumDir, 'THIRD_PARTY_NOTICES.md'),
      'formicarium THIRD_PARTY_NOTICES.md',
    ),
    '',
    '## Guests',
    '',
    await textFile(
      join(input.candidateSiteDir, 'NOTICES.md'),
      'candidate NOTICES.md',
    ),
  ];
  const licenses = join(input.candidateSiteDir, 'licenses');
  for (const name of (await readdir(licenses)).sort(comparePaths))
    lines.push(
      '',
      `### ${name}`,
      '',
      '```text',
      await textFile(join(licenses, name), name),
      '```',
    );
  lines.push('', '## Site packages', '');
  for (const notice of packages)
    lines.push(
      `### ${notice.name} ${notice.version} (${notice.license})`,
      '',
      '```text',
      notice.text,
      '```',
      '',
    );
  return { text: `${lines.join('\n').trimEnd()}\n`, packages };
}
