import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BuildInput } from '../../scripts/guest-distribution/stage.js';
import { stageDistribution } from '../../scripts/guest-distribution/stage.js';

const moduleRoot = fileURLToPath(
  new URL('../../integration/guest-distribution/', import.meta.url),
);

/** Clearly synthetic ELF/schema data; no actual tool provenance or execution. */
export async function createSyntheticSite() {
  const dir = await mkdtemp(join(tmpdir(), 'guest-distribution-site-'));
  const builds: BuildInput[] = [];
  for (const [index, ref] of ['main', 'pr-1645'].entries()) {
    const guest = Buffer.alloc(128);
    guest.set([127, 69, 76, 70, 2, 1, 1]);
    guest.writeUInt16LE(2, 16);
    guest.writeUInt16LE(62, 18);
    guest.writeUInt32LE(1, 20);
    guest.writeBigUInt64LE(64n, 32);
    guest.writeUInt16LE(64, 52);
    guest.writeUInt16LE(56, 54);
    guest.writeUInt16LE(1, 56);
    guest.writeUInt32LE(1, 64);
    guest.writeBigUInt64LE(128n, 96);
    guest.writeBigUInt64LE(128n, 104);
    guest[127] = index + 1;
    const guestPath = join(dir, `guest-${index}`),
      buildInfoPath = join(dir, `info-${index}.json`),
      fixturePath = join(dir, `fixture-${index}.json`);
    await writeFile(guestPath, guest);
    await writeFile(
      buildInfoPath,
      JSON.stringify({
        schemaVersion: 1,
        tool: 'aube',
        ref,
        source: {
          url: 'https://example.test/synthetic-source',
          ref,
          commit: String(index + 1).repeat(40),
        },
        built_at: '2026-10-08T00:00:00Z',
        target: 'x86_64-unknown-linux-musl',
        linkage: 'static',
        libc: 'musl',
        synthetic: true,
      }),
    );
    await writeFile(fixturePath, JSON.stringify({ 'app/name': ref }));
    builds.push({
      tool: 'aube',
      ref,
      guestPath,
      buildInfoPath,
      fixturePaths: { seed: fixturePath },
    });
  }
  const site = join(dir, 'site');
  await stageDistribution(
    {
      tools: { aube: { default: 'main', fixture: 'seed', cwd: '/work/app' } },
      manifest: { builds: {} },
      builds,
    },
    site,
  );
  return { site, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export async function serveDistribution({
  synthetic,
  actual,
  port = 0,
}: {
  synthetic: string;
  actual?: string;
  port?: number;
}) {
  const roots: Record<string, string> = {
    modules: moduleRoot,
    synthetic: resolve(synthetic),
    redirect: resolve(synthetic),
  };
  const stats = { redirectTargetRequests: 0 };
  if (actual) roots.actual = resolve(actual);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/stats') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(stats));
        return;
      }
      if (url.pathname === '/outside-redirect-target') {
        stats.redirectTargetRequests++;
        response.setHeader('Content-Type', 'application/octet-stream');
        response.end(Buffer.from([1, 2, 3]));
        return;
      }
      if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end(
          '<!doctype html><title>Guest distribution contract consumer</title>',
        );
        return;
      }
      const [mount, ...parts] = url.pathname.slice(1).split('/');
      if (mount === 'redirect' && url.pathname.endsWith('/guest')) {
        response.writeHead(302, { Location: '/outside-redirect-target' });
        response.end();
        return;
      }
      const root = roots[mount];
      if (!root) {
        response.writeHead(404);
        response.end();
        return;
      }
      const target = resolve(root, decodeURIComponent(parts.join('/')));
      if (!target.startsWith(`${resolve(root)}${sep}`)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const bytes = await readFile(target);
      response.setHeader(
        'Content-Type',
        target.endsWith('.mjs') || target.endsWith('.js')
          ? 'text/javascript'
          : target.endsWith('.json')
            ? 'application/json'
            : 'application/octet-stream',
      );
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', accept);
  });
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    stats,
    close: () =>
      new Promise<void>((accept, reject) =>
        server.close((error) => (error ? reject(error) : accept())),
      ),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const synthetic = await createSyntheticSite();
  const server = await serveDistribution({
    synthetic: synthetic.site,
    actual: process.env.U2_ACTUAL_SITE,
    port: Number(process.env.U2_PORT ?? 4178),
  });
  console.log(`Guest contract server ${server.base}`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await server.close();
      await synthetic.cleanup();
      process.exit(0);
    });
}
