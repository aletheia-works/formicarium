import { readdir, readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { fail, runCli } from './errors.ts';
import { REPOSITORY_ROOT } from './paths.ts';

export type ViolationKind =
  | 'internal-import'
  | 'unknown-import'
  | 'reverse-dependency'
  | 'fixture-share'
  | 'dynamic-import'
  | 'script-src';
export interface Violation {
  kind: ViolationKind;
  file: string;
  reference: string;
}

/** The only packages showcase code may import. */
export const PUBLIC_ENTRIES: readonly string[] = Object.freeze([
  '@aletheia-works/formicarium',
  '@aletheia-works/formicarium/node',
  '@aletheia-works/formicarium/browser',
]);
/** Test tooling allowed below showcase/tests only. */
export const TEST_PACKAGES: readonly string[] = Object.freeze([
  '@playwright/test',
]);
/**
 * Showcase site: below showcase/site only, these packages, a
 * `/` subpath of them, and Astro's `astro:` virtual modules.
 */
export const SITE_PACKAGES: readonly string[] = Object.freeze([
  'astro',
  '@astrojs/starlight',
  '@xterm/xterm',
  '@xterm/addon-fit',
]);
/** Test tooling allowed below showcase/site/tests only. */
export const SITE_TEST_PACKAGES: readonly string[] = Object.freeze([
  '@playwright/test',
  'v8-to-istanbul',
]);
/** The one site module that may import a computed URL (staged formicarium). */
export const SITE_LOADER = 'showcase/site/src/terminal/formicarium-loader.ts';
const SOURCE = /\.(?:[cm]?ts|[cm]?js|astro)$/;
/** Directories that hold data, generated files or intentional violations. */
const SKIPPED = new Set([
  'showcase/node_modules',
  'showcase/.work',
  'showcase/fixtures',
  'showcase/tests/boundary-fixtures',
  'showcase/site/dist',
  'showcase/site/.astro',
  'showcase/site/node_modules',
  'showcase/site/.work',
  'showcase/site/public/_formicarium',
]);

const packageMatch = (specifier: string, names: readonly string[]) =>
  names.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/**
 * Source parts of an `.astro` file: the frontmatter between the first two
 * `---` lines and the body of every `<script>`. Markup is not code.
 */
export function astroSource(text: string): {
  code: string;
  scriptSources: string[];
} {
  const parts: string[] = [];
  const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (frontmatter) parts.push(frontmatter[1]!);
  const scriptSources: string[] = [];
  for (const match of text.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/i.exec(
      ` ${match[1] ?? ''}`,
    );
    if (src) scriptSources.push(src[1] ?? src[2] ?? src[3] ?? '');
    parts.push(match[2] ?? '');
  }
  return { code: parts.join('\n'), scriptSources };
}

/** `import(` whose argument is not a string literal. */
const COMPUTED_IMPORT = /\bimport\s*\((?:\s|\/\*[\s\S]*?\*\/)*(?![\s'"`]|\/\*)/;
/** A `<script src>` may only name a path of the same origin. */
const SAME_ORIGIN_SRC = /^(?:\.{0,2}\/(?!\/)|[\w.-]+(?:\/|$))[^:]*$/;
const BODY_ROOTS = Object.freeze(['runtime', 'types', 'scripts']);

/** Static import/export-from/dynamic import/require specifiers. */
export function importSpecifiers(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;'"`]*?\sfrom\s*)?['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) found.push(match[1]!);
  return [...new Set(found)];
}

/** Quoted string literals; used for fixture paths and reverse references. */
export function stringLiterals(source: string): string[] {
  return [...source.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map(
    (match) => match[2]!,
  );
}

const resolveFrom = (file: string, reference: string) =>
  posix.normalize(posix.join(posix.dirname(file), reference));
const isRelative = (reference: string) =>
  reference.startsWith('./') || reference.startsWith('../');
const below = (path: string, directory: string) =>
  path === directory || path.startsWith(`${directory}/`);

/** Checks one file below showcase/ (repo-relative POSIX path). */
export function checkShowcaseFile(file: string, text: string): Violation[] {
  const violations: Violation[] = [];
  const add = (kind: ViolationKind, reference: string) =>
    violations.push({ kind, file, reference });
  const astro = file.endsWith('.astro') ? astroSource(text) : null;
  const source = astro ? astro.code : text;
  const site = below(file, 'showcase/site');
  for (const src of astro?.scriptSources ?? [])
    if (!SAME_ORIGIN_SRC.test(src)) add('script-src', src);
  if (site && file !== SITE_LOADER && COMPUTED_IMPORT.test(source))
    add('dynamic-import', 'import(<computed>)');
  for (const specifier of importSpecifiers(source)) {
    if (specifier.startsWith('node:')) continue;
    if (PUBLIC_ENTRIES.includes(specifier)) continue;
    if (TEST_PACKAGES.includes(specifier) && below(file, 'showcase/tests'))
      continue;
    if (
      site &&
      (packageMatch(specifier, SITE_PACKAGES) || specifier.startsWith('astro:'))
    )
      continue;
    if (
      below(file, 'showcase/site/tests') &&
      packageMatch(specifier, SITE_TEST_PACKAGES)
    )
      continue;
    if (isRelative(specifier)) {
      const target = resolveFrom(file, specifier);
      if (
        !below(target, 'showcase') ||
        below(target, 'showcase/node_modules') ||
        below(target, 'showcase/site/node_modules')
      )
        add('internal-import', specifier);
      continue;
    }
    if (specifier.startsWith('@aletheia-works/formicarium/'))
      add('internal-import', specifier);
    else add('unknown-import', specifier);
  }
  for (const literal of stringLiterals(source)) {
    if (/vivarium/i.test(literal) && /fixture/i.test(literal))
      add('fixture-share', literal);
    else if (/^\/?fixtures\//.test(literal)) add('fixture-share', literal);
    else if (
      literal.startsWith('../') &&
      below(resolveFrom(file, literal), 'fixtures')
    )
      add('fixture-share', literal);
  }
  return violations;
}

/** Checks one body file (runtime/, types/, scripts/): no reference to showcase. */
export function checkBodyFile(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  for (const specifier of importSpecifiers(source))
    if (
      (isRelative(specifier) &&
        below(resolveFrom(file, specifier), 'showcase')) ||
      specifier.includes('formicarium-showcase')
    )
      violations.push({
        kind: 'reverse-dependency',
        file,
        reference: specifier,
      });
  // An import specifier is also a string literal: report each reference once.
  const reported = new Set(violations.map((violation) => violation.reference));
  for (const literal of stringLiterals(source))
    if (/(?:^|\/)showcase\//.test(literal) && !reported.has(literal)) {
      reported.add(literal);
      violations.push({ kind: 'reverse-dependency', file, reference: literal });
    }
  return violations;
}

async function sources(root: string, directory: string): Promise<string[]> {
  const files: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED.has(path) && entry.name !== 'node_modules')
        files.push(...(await sources(root, path)));
    } else if (entry.isFile() && SOURCE.test(entry.name)) files.push(path);
  }
  return files.sort();
}

/** Scans a repository-shaped tree; the real tree must report nothing. */
export async function scanTree(root: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  for (const file of await sources(root, 'showcase'))
    violations.push(
      ...checkShowcaseFile(file, await readFile(join(root, file), 'utf8')),
    );
  for (const directory of BODY_ROOTS)
    for (const file of await sources(root, directory))
      violations.push(
        ...checkBodyFile(file, await readFile(join(root, file), 'utf8')),
      );
  return violations;
}

if (import.meta.main)
  await runCli('boundary', async () => {
    const violations = await scanTree(process.argv[2] ?? REPOSITORY_ROOT);
    for (const violation of violations)
      console.error(
        `${violation.kind}: ${violation.file} -> ${violation.reference}`,
      );
    if (violations.length)
      fail('boundary-violation', `${violations.length} boundary violation(s)`);
    console.log('boundary: no violation');
  });
