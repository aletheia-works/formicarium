import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { fail } from './errors.ts';

export const PACKAGE_PREFIX = '/pkg/';

/** Browser import map built from the package's own export map (public entries only). */
export function importMap(manifest: {
  name?: unknown;
  exports?: Record<string, unknown>;
}): { imports: Record<string, string> } {
  const imports: Record<string, string> = {};
  for (const [entry, specifier] of [
    ['.', ''],
    ['./browser', '/browser'],
  ] as const) {
    const target = manifest.exports?.[entry] as
      | { import?: unknown }
      | undefined;
    if (typeof target?.import !== 'string' || !target.import.startsWith('./'))
      fail('config-invalid', `package export ${entry} missing`);
    imports[`${manifest.name}${specifier}`] =
      `${PACKAGE_PREFIX}${target.import.slice(2)}`;
  }
  return { imports };
}

/** Existing COI page policy (blob + wasm) plus the hash of the inline import map. */
export function pagePolicy(inlineScript: string): string {
  const hash = createHash('sha256').update(inlineScript).digest('base64');
  return [
    "default-src 'none'",
    `script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-${hash}'`,
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "style-src 'self'",
  ].join('; ');
}

export function contentType(path: string): string {
  const extension = extname(path);
  if (extension === '.js' || extension === '.mjs') return 'text/javascript';
  if (extension === '.wasm') return 'application/wasm';
  if (extension === '.json') return 'application/json';
  return 'application/octet-stream';
}

/** Maps a URL path below a root; traversal, NUL and backslashes are refused. */
export function safeJoin(root: string, path: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  if (decoded.split('/').some((part) => part === '..')) return null;
  const target = normalize(join(root, decoded));
  return target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
    ? target
    : null;
}

export interface AcceptServerOptions {
  siteRoot: string;
  packageRoot: string;
  cert: string;
  key: string;
  port?: number;
}
export interface AcceptServer {
  origin: string;
  close(): Promise<void>;
}

/**
 * Serves the candidate site and the staged package from one HTTPS origin with
 * COOP/COEP/CORP and the page CSP, so guests, Worker and wasm stay same-origin.
 */
export async function startAcceptServer(
  options: AcceptServerOptions,
): Promise<AcceptServer> {
  const manifest = JSON.parse(
    await readFile(join(options.packageRoot, 'package.json'), 'utf8'),
  );
  const map = JSON.stringify(importMap(manifest));
  const page = `<!doctype html><meta charset="utf-8"><title>showcase acceptance</title><script type="importmap">${map}</script>`;
  const policy = pagePolicy(map);
  const server = createServer(
    { cert: await readFile(options.cert), key: await readFile(options.key) },
    async (request, response) => {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Security-Policy', policy);
      const path = new URL(request.url ?? '/', 'https://localhost').pathname;
      if (request.method !== 'GET') {
        response.statusCode = 405;
        response.end();
        return;
      }
      if (path === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(page);
        return;
      }
      const file = path.startsWith(PACKAGE_PREFIX)
        ? safeJoin(options.packageRoot, path.slice(PACKAGE_PREFIX.length))
        : safeJoin(options.siteRoot, path.slice(1));
      try {
        if (!file) throw Error('path refused');
        const body = await readFile(file);
        response.setHeader('Content-Type', contentType(file));
        response.end(body);
      } catch {
        response.statusCode = 404;
        response.end('missing');
      }
    },
  );
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => done());
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `https://localhost:${port}`,
    close: () =>
      new Promise<void>((done, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : done()));
      }),
  };
}
