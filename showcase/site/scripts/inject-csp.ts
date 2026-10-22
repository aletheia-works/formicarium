import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TERMINAL_ATTRIBUTE } from '../src/terminal/page-data.ts';
import { fail } from './common.ts';

export { TERMINAL_ATTRIBUTE };

/**
 * Same origin, blob and wasm only; no external origin.
 * blob: stays because the existing COI page policy (showcase accept-server) needs it.
 */
export function terminalPolicy(hashes: readonly string[]): string {
  return [
    "default-src 'none'",
    [
      "script-src 'self' 'wasm-unsafe-eval' blob:",
      ...hashes.map((hash) => `'sha256-${hash}'`),
    ].join(' '),
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

/** Bodies of the inline scripts (no src attribute), in document order. */
export function inlineScripts(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(SCRIPT))
    if (!/\ssrc\s*=/i.test(` ${match[1] ?? ''}`)) found.push(match[2] ?? '');
  return found;
}

export const scriptHash = (body: string) =>
  createHash('sha256').update(body, 'utf8').digest('base64');

export const isTerminalPage = (html: string) =>
  new RegExp(`<[a-z]+\\s[^>]*\\b${TERMINAL_ATTRIBUTE}[\\s=>]`, 'i').test(html);

const META = /<meta\s+http-equiv\s*=\s*["']?content-security-policy/i;

/** Puts the meta CSP first in <head>, with the hash of every inline script. */
export function injectCsp(html: string): { html: string; policy: string } {
  if (META.test(html))
    fail('csp-invalid', 'page already has a CSP meta element');
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (!head) fail('csp-invalid', 'page has no <head>');
  const hashes = [...new Set(inlineScripts(html).map(scriptHash))];
  const policy = terminalPolicy(hashes);
  const at = head.index + head[0].length;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('"', '&quot;')}">`;
  return { html: `${html.slice(0, at)}${meta}${html.slice(at)}`, policy };
}

/** Rewrites each terminal page of the built site in place. */
export async function injectTerminalPages(
  siteDir: string,
  pages: readonly string[],
): Promise<Map<string, string>> {
  const policies = new Map<string, string>();
  for (const page of pages) {
    const path = join(siteDir, page);
    const html = await readFile(path, 'utf8');
    if (!isTerminalPage(html))
      fail('csp-invalid', `${page} is not a terminal page`);
    const injected = injectCsp(html);
    await writeFile(path, injected.html);
    policies.set(page, injected.policy);
  }
  return policies;
}
