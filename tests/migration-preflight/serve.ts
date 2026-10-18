import { X509Certificate } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { sha256 } from '../../scripts/migration-preflight/assets.js';
import type { MirrorManifest } from '../../scripts/migration-preflight/prepare-mirror.js';
import {
  mirrorOrigin,
  OFFICIAL_PINS,
} from '../../scripts/migration-preflight/prepare-mirror.js';

const root = resolve('.');
const origin =
  process.env.FORMICARIUM_PREFLIGHT_ORIGIN ?? 'http://127.0.0.1:4182';
const tls = origin.startsWith('https:');
const certificate = process.env.FORMICARIUM_PREFLIGHT_TLS_CERT;
const key = process.env.FORMICARIUM_PREFLIGHT_TLS_KEY;
let fingerprint: string | undefined;
let tlsOptions: { cert: Buffer; key: Buffer } | undefined;
const mirrored = new Map<string, Uint8Array>();
// These pins were observed on the accepted baseline package and are checked
// against the original dist bytes before deriving this trial-only input.
const corePins = {
  loaderSha256:
    '3f00350cc66a27e55188c7647abfd7c18a33d46ff2c747a03013b0da457db5bd',
  wasmSha256:
    'a180e20a5c5e208d74cb0b1cd5e6e6e28f61c5afff0cc581cb50bbbcfa9dcbe2',
};
const coreSnapshots = new Map<string, Uint8Array>();
const loader = new Uint8Array(
  await readFile(resolve(root, 'dist/blink/blink.mjs')),
);
const wasm = new Uint8Array(
  await readFile(resolve(root, 'dist/blink/blink.wasm')),
);
const originalCoreInfo = new Uint8Array(
  await readFile(resolve(root, 'dist/blink/build-info.json')),
);
const actualCoreDigests = {
  loaderSha256: await sha256(loader),
  wasmSha256: await sha256(wasm),
};
if (
  actualCoreDigests.loaderSha256 !== corePins.loaderSha256 ||
  actualCoreDigests.wasmSha256 !== corePins.wasmSha256
)
  throw Error('existing core differs from observed baseline package byte pins');
const coreInfo = JSON.parse(
  new TextDecoder('utf-8', { fatal: true }).decode(originalCoreInfo),
);
if (
  !/^[0-9a-f]{40}$/.test(coreInfo.blinkCommit) ||
  coreInfo.blinkSourceDirty !== false
)
  throw Error('existing core provenance invalid');
if (
  coreInfo.assetDigests &&
  (coreInfo.assetDigests.loaderSha256 !== actualCoreDigests.loaderSha256 ||
    coreInfo.assetDigests.wasmSha256 !== actualCoreDigests.wasmSha256)
)
  throw Error('existing core metadata digest mismatch');
const trialCoreInfo = new TextEncoder().encode(
  JSON.stringify({ ...coreInfo, assetDigests: actualCoreDigests }),
);
const trialCoreInfoSha256 = await sha256(trialCoreInfo);
const coreInputRecord = {
  schemaVersion: 1,
  kind: 'trial-only-derived-metadata',
  blinkCommit: coreInfo.blinkCommit,
  originalInfoSha256: await sha256(originalCoreInfo),
  derivedInfoSha256: trialCoreInfoSha256,
  assetDigests: actualCoreDigests,
  originalMetadataPreserved: true,
  condition:
    'existing original core bytes match observed baseline package pins; assetDigests supplemented only in immutable HTTP response',
};
coreSnapshots.set('/dist/blink/blink.mjs', loader);
coreSnapshots.set('/dist/blink/blink.wasm', wasm);
coreSnapshots.set('/dist/blink/build-info.json', trialCoreInfo);
coreSnapshots.set(
  '/preflight/core-input.json',
  new TextEncoder().encode(JSON.stringify(coreInputRecord)),
);
if (tls) {
  mirrorOrigin(origin);
  if (
    !certificate ||
    !key ||
    !process.env.FORMICARIUM_PREFLIGHT_MIRROR_MANIFEST
  )
    throw Error(
      'HTTPS mirror requires explicit TLS cert/key and pinned manifest',
    );
  tlsOptions = { cert: await readFile(certificate), key: await readFile(key) };
  const cert = new X509Certificate(tlsOptions.cert);
  if (
    cert.ca ||
    cert.checkHost('localhost') !== 'localhost' ||
    Date.parse(cert.validTo) <= Date.now()
  )
    throw Error('localhost server certificate missing/expired or CA');
  fingerprint = cert.fingerprint256.replaceAll(':', '').toLowerCase();
  if (
    !process.env.FORMICARIUM_PREFLIGHT_TLS_FINGERPRINT ||
    fingerprint !==
      process.env.FORMICARIUM_PREFLIGHT_TLS_FINGERPRINT.toLowerCase()
  )
    throw Error(
      'TLS certificate fingerprint differs from explicitly pinned input',
    );
  const manifest: MirrorManifest = JSON.parse(
    await readFile(process.env.FORMICARIUM_PREFLIGHT_MIRROR_MANIFEST, 'utf8'),
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.origin !== new URL(origin).origin ||
    manifest.entries.length !== 2
  )
    throw Error('mirror manifest origin/schema/count mismatch');
  for (const tool of ['aube', 'biome'] as const) {
    const matches = manifest.entries.filter((entry) => entry.tool === tool);
    const entry = matches[0];
    const pin = OFFICIAL_PINS[tool];
    if (
      matches.length !== 1 ||
      !entry ||
      entry.version !== pin.version ||
      entry.sourceCommit !== pin.sourceCommit ||
      entry.originalUrl !== pin.originalUrl ||
      entry.sha256 !== pin.downloadSha256 ||
      entry.mirrorUrl !== `${manifest.origin}/mirror/${pin.fileName}`
    )
      throw Error(`${tool}: pinned mirror identity mismatch`);
    const path = resolve(entry.file);
    if (
      !path.startsWith(resolve(root, '.artifacts') + sep) ||
      (await realpath(path)) !== path
    )
      throw Error('mirror file must be nonsymlink beneath project .artifacts');
    const bytes = new Uint8Array(await readFile(path));
    if (
      bytes.length !== entry.bytes ||
      (await sha256(bytes)) !== pin.downloadSha256
    )
      throw Error(`${tool}: mirror bytes changed`);
    // Retain the verified snapshot, so a later file mutation cannot be served.
    mirrored.set(`/mirror/${pin.fileName}`, bytes);
  }
} else if (origin !== 'http://127.0.0.1:4182' || certificate || key)
  throw Error('invalid trial origin/TLS configuration');
const types: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
};
// Dedicated loopback origin: never reuse an existing process or expose arbitrary
// repository files. Later trial fixtures live only beneath the allowlisted paths.
const handler = async (request: IncomingMessage, response: ServerResponse) => {
  if (request.headers.host !== new URL(origin).host) {
    response.writeHead(400).end();
    return;
  }
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'no-store');
  if (fingerprint)
    response.setHeader('X-Preflight-Certificate-Sha256', fingerprint);
  response.setHeader('X-Preflight-Core-Metadata-Sha256', trialCoreInfoSha256);
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' https:; style-src 'self'",
  );
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', origin).pathname,
    );
    if (pathname === '/') {
      response.setHeader('Content-Type', types['.html']!);
      response.end(
        '<!doctype html><meta charset="utf-8"><title>Migration preflight</title>',
      );
      return;
    }
    const coreSnapshot = coreSnapshots.get(pathname);
    if (coreSnapshot) {
      response.setHeader(
        'Content-Type',
        types[extname(pathname)] ?? 'application/octet-stream',
      );
      response.setHeader('Content-Length', coreSnapshot.length);
      response.end(coreSnapshot);
      return;
    }
    const mirror = mirrored.get(pathname);
    if (mirror) {
      response.setHeader('Content-Type', 'application/octet-stream');
      response.setHeader('Content-Length', mirror.length);
      response.end(mirror);
      return;
    }
    const module =
      /^\/(?:runtime\/(?:[a-z-]+\/)?|scripts\/migration-preflight\/)[a-z-]+\.js$/.test(
        pathname,
      );
    const dependency =
      /^\/integration\/terrarium\/guest-distribution\/(?:resolver|manifest|fixtures)\.js$/.test(
        pathname,
      );
    const core =
      /^\/dist\/blink\/(?:blink\.mjs|blink\.wasm|build-info\.json)$/.test(
        pathname,
      );
    if (
      !(module || dependency || core) ||
      pathname.includes('\0') ||
      pathname.includes('\\')
    ) {
      response.writeHead(404).end();
      return;
    }
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    if ((await realpath(file)) !== file) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader(
      'Content-Type',
      types[extname(file)] ?? 'application/octet-stream',
    );
    const stream = createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(404).end();
  }
};
(tlsOptions
  ? createHttpsServer(tlsOptions, handler)
  : createServer(handler)
).listen(4182, '127.0.0.1');
