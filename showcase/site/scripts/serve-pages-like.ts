import { readFile, stat } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { safeJoin } from '../../scripts/accept-server.ts';
import { tlsFromEnvironment } from '../../scripts/tls.ts';
import { fail, parseOptions, runCli, siteLayout } from './common.ts';

/**
 * A static server shaped like GitHub Pages for the site acceptance:
 * the site below /formicarium/, index.html for directories, a redirect to the
 * trailing slash, 404.html for misses, and no COOP, COEP, CORP or CSP header
 * (isolation must come from coi-serviceworker, as on Pages).
 */
export const BASE = '/formicarium';
const TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
});
export const typeOf = (path: string) =>
  TYPES[extname(path)] ?? 'application/octet-stream';

export interface PagesServerOptions {
  siteDir: string;
  /** HTTPS material (job CA leaf). Omitted only for `http` on localhost. */
  tls?: { cert: string; key: string };
  /** Plain HTTP on localhost (a secure context too); local runs only. */
  http?: boolean;
  port?: number;
  /** Test-only replacement files, by URL path (adversarial harness). */
  overlay?: ReadonlyMap<string, string>;
}
export interface PagesServer {
  origin: string;
  requests: string[];
  close(): Promise<void>;
}

async function resolveFile(
  siteDir: string,
  path: string,
): Promise<{ file: string | null; redirect: boolean }> {
  const relative = path.slice(BASE.length + 1);
  const target = relative === '' ? siteDir : safeJoin(siteDir, relative);
  if (!target) return { file: null, redirect: false };
  try {
    const info = await stat(target);
    if (info.isDirectory())
      return path.endsWith('/')
        ? { file: join(target, 'index.html'), redirect: false }
        : { file: null, redirect: true };
    return { file: target, redirect: false };
  } catch {
    return { file: null, redirect: false };
  }
}

async function handle(
  options: PagesServerOptions,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.statusCode = 405;
    response.end();
    return;
  }
  const url = new URL(request.url ?? '/', 'https://localhost');
  const path = url.pathname;
  const overlay = options.overlay?.get(path);
  const send = (status: number, file: string, body: Buffer) => {
    response.statusCode = status;
    response.setHeader('Content-Type', typeOf(file));
    response.setHeader('Content-Length', body.length);
    response.end(request.method === 'HEAD' ? undefined : body);
  };
  if (overlay) return send(200, overlay, await readFile(overlay));
  if (path === BASE || !path.startsWith(`${BASE}/`)) {
    response.statusCode = path === BASE ? 301 : 404;
    if (path === BASE) response.setHeader('Location', `${BASE}/`);
    response.end();
    return;
  }
  const { file, redirect } = await resolveFile(options.siteDir, path);
  if (redirect) {
    response.statusCode = 301;
    response.setHeader('Location', `${path}/${url.search}`);
    response.end();
    return;
  }
  try {
    if (!file) throw Error('missing');
    return send(200, file, await readFile(file));
  } catch {
    const missing = join(options.siteDir, '404.html');
    return send(
      404,
      missing,
      await readFile(missing).catch(() => Buffer.from('Not Found')),
    );
  }
}

export async function startPagesServer(
  options: PagesServerOptions,
): Promise<PagesServer> {
  if (!options.tls && !options.http)
    fail('config-invalid', 'HTTPS material or the local HTTP mode is required');
  const requests: string[] = [];
  const listener = (request: IncomingMessage, response: ServerResponse) => {
    requests.push(new URL(request.url ?? '/', 'https://localhost').pathname);
    handle(options, request, response).catch(() => {
      response.statusCode = 500;
      response.end();
    });
  };
  const server = options.tls
    ? createHttpsServer(
        {
          cert: await readFile(options.tls.cert),
          key: await readFile(options.tls.key),
        },
        listener,
      )
    : createHttpServer(listener);
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => done());
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `${options.tls ? 'https' : 'http'}://localhost:${port}`,
    requests,
    close: () =>
      new Promise<void>((done, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : done()));
      }),
  };
}

/** The acceptance configuration from the environment (CI passes the job CA). */
export async function serverFromEnvironment(
  env: NodeJS.ProcessEnv,
  overlay?: ReadonlyMap<string, string>,
): Promise<PagesServer> {
  const tls = await tlsFromEnvironment(env);
  return startPagesServer({
    siteDir: env.SHOWCASE_SITE_DIR ?? siteLayout().dist,
    tls: tls ?? undefined,
    http: !tls && env.SHOWCASE_SITE_LOCAL_HTTP === '1',
    overlay,
  });
}

if (import.meta.main)
  await runCli('serve-pages-like', async () => {
    const options = parseOptions(process.argv.slice(2), ['site']);
    const server = await serverFromEnvironment({
      ...process.env,
      SHOWCASE_SITE_DIR: options.site ?? process.env.SHOWCASE_SITE_DIR,
    });
    console.log(`${server.origin}${BASE}/`);
    await new Promise(() => undefined);
  });
