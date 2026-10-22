import { readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { sha256 } from '../../scripts/build-key.ts';
import { fileInventory } from '../../scripts/paths.ts';
import { totalBytes } from '../src/model/inventory.ts';
import { TERMINAL_ATTRIBUTE } from '../src/terminal/page-data.ts';
import { IDENTITY_FILE } from './build-site-identity.ts';
import {
  inlineScripts,
  isTerminalPage,
  scriptHash,
  terminalPolicy,
} from './inject-csp.ts';
import { NOTICES_FILE } from './notices.ts';

/** GitHub Pages site limit (BR5.4, NFR6.4): the site must stay below 1 GB. */
export const MAX_SITE_BYTES = 1073741824;
/** coi-serviceworker 0.1.7 (npm, MIT): the only copy at the site root. */
export const COI_FILE = 'coi-serviceworker.js';
export const COI_SHA256 =
  'd12bd536e27e39a773d7dc7adb1a1167d24002293e97ac81c995fb00cf8d4d5a';
export const COI_CONFIG_FILE = 'coi-config.js';
export const LOCALES = ['ja'] as const;

const SUBRESOURCE_RELS = new Set([
  'stylesheet',
  'preload',
  'modulepreload',
  'prefetch',
  'icon',
  'shortcut',
  'apple-touch-icon',
  'manifest',
  'mask-icon',
  'preconnect',
  'dns-prefetch',
]);
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const TAG = /<([a-z]+)\b([^>]*)>/gi;
const ATTRIBUTE = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const attributes = (text: string) => {
  const found = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE))
    found.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  return found;
};
const srcsetUrls = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean);

/** URLs of CSS url() and @import. */
export function cssUrls(css: string): string[] {
  const found: string[] = [];
  for (const match of css.matchAll(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi,
  ))
    found.push(match[1] ?? match[2] ?? match[3] ?? '');
  for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi))
    found.push(match[1]!);
  return found;
}

/** Every URL an HTML page fetches by itself (not plain <a> navigation). */
export function htmlSubresources(html: string): { tag: string; url: string }[] {
  const found: { tag: string; url: string }[] = [];
  for (const match of html.matchAll(TAG)) {
    const tag = match[1]!.toLowerCase();
    const attrs = attributes(match[2] ?? '');
    const add = (name: string) => {
      const value = attrs.get(name);
      if (value) found.push({ tag, url: value });
    };
    if (tag === 'link') {
      const rels = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
      if (rels.some((rel) => SUBRESOURCE_RELS.has(rel))) add('href');
    } else if (['script', 'iframe', 'embed', 'track', 'audio'].includes(tag))
      add('src');
    else if (['img', 'source', 'input'].includes(tag)) {
      add('src');
      for (const url of srcsetUrls(attrs.get('srcset') ?? ''))
        found.push({ tag, url });
    } else if (tag === 'video') {
      add('src');
      add('poster');
    } else if (tag === 'object') add('data');
    const style = attrs.get('style');
    if (style) for (const url of cssUrls(style)) found.push({ tag, url });
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    for (const url of cssUrls(match[1] ?? ''))
      found.push({ tag: 'style', url });
  return found;
}

export const isExternal = (url: string) => EXTERNAL.test(url.trim());

/** `x/index.html` and `ja/x/index.html` must both exist (BR2.2). */
export function missingTranslations(htmlFiles: readonly string[]): string[] {
  const pages = new Set(htmlFiles.filter((path) => path !== '404.html'));
  const problems: string[] = [];
  for (const path of pages) {
    const locale = LOCALES.find((name) => path.startsWith(`${name}/`));
    const counterpart = locale ? path.slice(locale.length + 1) : `ja/${path}`;
    if (!pages.has(counterpart))
      problems.push(
        `${path} has no ${locale ? 'en' : 'ja'} page ${counterpart}`,
      );
  }
  return problems.sort();
}

/** JS files a script loads, statically or by literal dynamic import. */
export function scriptImports(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+\.m?js)["']/g,
  ))
    found.add(match[1]!);
  return [...found];
}

export interface SiteCheckInput {
  siteDir: string;
  base: string;
  /** Expected terminal pages (site-relative index.html paths). */
  terminalPages: readonly string[];
  /** Text of the workflow that uploads the Pages artifact. */
  workflow: string;
}
export interface SiteCheckResult {
  problems: string[];
  bytes: number;
  files: number;
  /** The largest file (Pages states no per-file limit; recorded per build). */
  largest: { path: string; bytes: number } | null;
  guests: { path: string; bytes: number }[];
}

async function reachesTerminal(
  input: SiteCheckInput,
  entry: string,
  seen: Set<string>,
): Promise<boolean> {
  if (seen.has(entry)) return false;
  seen.add(entry);
  let source: string;
  try {
    source = await readFile(join(input.siteDir, entry), 'utf8');
  } catch {
    return false;
  }
  if (source.includes(TERMINAL_ATTRIBUTE)) return true;
  for (const specifier of scriptImports(source)) {
    const next = specifier.startsWith(input.base)
      ? specifier.slice(input.base.length)
      : posix.normalize(posix.join(posix.dirname(entry), specifier));
    if (!next.startsWith('..') && (await reachesTerminal(input, next, seen)))
      return true;
  }
  return false;
}

/** Problems of a documentation page or /tools/ (BR4.3, P5). */
async function documentProblems(
  input: SiteCheckInput,
  page: string,
  html: string,
): Promise<string[]> {
  const problems: string[] = [];
  for (const { url } of htmlSubresources(html)) {
    if (
      /coi-serviceworker|coi-config|_formicarium\/|demo-fixtures\/|catalog\.json|guests\//.test(
        url,
      )
    )
      problems.push(`${page} loads terminal resource ${url}`);
    if (
      url.startsWith(input.base) &&
      /\.m?js$/.test(url) &&
      (await reachesTerminal(input, url.slice(input.base.length), new Set()))
    )
      problems.push(`${page} loads the terminal module through ${url}`);
  }
  return problems;
}

function terminalProblems(page: string, html: string): string[] {
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  const afterHead = head ? html.slice(head.index + head[0].length) : '';
  const meta =
    /^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(
      afterHead,
    );
  if (!meta) return [`${page} has no CSP meta as the first element of <head>`];
  const policy = meta[1]!.replaceAll('&quot;', '"');
  const problems: string[] = [];
  const hashes = [...new Set(inlineScripts(html).map(scriptHash))];
  if (policy !== terminalPolicy(hashes))
    problems.push(`${page} CSP differs from the inline script hashes`);
  if (/https?:|\*/.test(policy))
    problems.push(`${page} CSP names an external origin`);
  if (!html.includes(`/${COI_FILE}`) || !html.includes(`/${COI_CONFIG_FILE}`))
    problems.push(`${page} does not load the isolation scripts`);
  return problems;
}

function uploadProblems(workflow: string): string[] {
  const step =
    /uses: actions\/upload-pages-artifact@[^\n]*\n((?: {8,}.*\n?)*)/.exec(
      workflow,
    )?.[1] ?? '';
  const problems: string[] = [];
  if (!/include-hidden-files: true/.test(step))
    problems.push(
      'upload-pages-artifact leaves dotfiles out (include-hidden-files: true missing)',
    );
  if (!/retention-days: 7\b/.test(step))
    problems.push('upload-pages-artifact retention-days must be 7');
  return problems;
}

/** The whole site must stay below 1073741824 bytes. */
export const sizeProblems = (bytes: number) =>
  bytes >= MAX_SITE_BYTES
    ? [`site is ${bytes} bytes (limit below ${MAX_SITE_BYTES})`]
    : [];

/** check-site (S3 step 11): pages, sub-resources, CSP, dotfiles, size, COI, maps. */
export async function checkSite(
  input: SiteCheckInput,
): Promise<SiteCheckResult> {
  const files = await fileInventory(resolve(input.siteDir));
  const problems: string[] = [];
  const html = files
    .filter((file) => file.path.endsWith('.html'))
    .map((file) => file.path);
  problems.push(...missingTranslations(html));
  const terminals = new Set<string>();
  for (const page of html) {
    const text = await readFile(join(input.siteDir, page), 'utf8');
    for (const { tag, url } of htmlSubresources(text))
      if (isExternal(url))
        problems.push(`${page} <${tag}> loads cross-origin ${url}`);
    if (isTerminalPage(text)) {
      terminals.add(page);
      problems.push(...terminalProblems(page, text));
    } else problems.push(...(await documentProblems(input, page, text)));
  }
  for (const expected of input.terminalPages)
    if (!terminals.has(expected))
      problems.push(`terminal page missing: ${expected}`);
  for (const page of terminals)
    if (!input.terminalPages.includes(page))
      problems.push(`unexpected terminal page: ${page}`);
  for (const file of files.filter((item) => item.path.endsWith('.css')))
    for (const url of cssUrls(
      await readFile(join(input.siteDir, file.path), 'utf8'),
    ))
      if (isExternal(url))
        problems.push(`${file.path} loads cross-origin ${url}`);
  problems.push(...uploadProblems(input.workflow));
  const bytes = totalBytes(files);
  problems.push(...sizeProblems(bytes));
  const coi = files.filter((file) => posix.basename(file.path) === COI_FILE);
  if (coi.length !== 1 || coi[0]!.path !== COI_FILE)
    problems.push(`exactly one ${COI_FILE} at the site root is required`);
  else if (sha256(await readFile(join(input.siteDir, COI_FILE))) !== COI_SHA256)
    problems.push(`${COI_FILE} SHA256 differs from 0.1.7`);
  if (!files.some((file) => file.path === COI_CONFIG_FILE))
    problems.push(`${COI_CONFIG_FILE} missing`);
  for (const file of files)
    if (file.path.endsWith('.map'))
      problems.push(`source map left in the site: ${file.path}`);
  for (const required of [NOTICES_FILE, IDENTITY_FILE])
    if (!files.some((file) => file.path === required))
      problems.push(`${required} missing`);
  return {
    problems,
    bytes,
    files: files.length,
    largest: files.reduce<{ path: string; bytes: number } | null>(
      (largest, file) =>
        !largest || file.bytes > largest.bytes
          ? { path: file.path, bytes: file.bytes }
          : largest,
      null,
    ),
    guests: files
      .filter((file) => file.path.startsWith('guests/'))
      .map((file) => ({ path: file.path, bytes: file.bytes })),
  };
}
