import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { sha256 } from '../../scripts/package/stage-package.js';
import type { GuestCatalog, Progress } from '../../types/index.js';
import { consumerInput } from '../migration-session/consumer-input.js';
import { serveDirectory } from '../package/fixtures.js';

const input = await consumerInput();
expect(['u3-install', 'u4-command']).toContain(input.candidate.unit);
for (const name of [
  'install',
  'install-catalog',
  'install-transfer',
  'install-archive',
  'install-lifecycle',
])
  expect(
    input.candidate.files.some(
      (entry: { path: string }) => entry.path === `runtime/${name}.js`,
    ),
  ).toBe(true);
const compressed = new Uint8Array(
  await readFile(
    new URL(
      '../../.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
      import.meta.url,
    ),
  ),
);
expect(sha256(compressed)).toBe(
  'fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666',
);
let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(input.packageRoot, {
    extraFiles: { '/guest': input.bytes },
    csp: "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' https://install.invalid",
  });
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }) => {
  // Controlled transport proves browser C04/DecompressionStream/package behavior.
  // Formal 36 trials are separately required to use the real accepted HTTPS mirror.
  await page.route('https://install.invalid/**', async (route) => {
    const body = route.request().url().endsWith('/archive')
      ? compressed
      : input.bytes;
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': server.url },
      body: Buffer.from(body),
    });
  });
  await page.goto(server.url);
});
function catalog(format: 'elf' | 'tar.gz' = 'elf'): GuestCatalog {
  const info = structuredClone(input.expected.identity);
  const bytes = format === 'elf' ? input.bytes : compressed;
  return {
    schemaVersion: 1,
    catalogId: 'u3-controlled-browser-transport',
    defaults: { [info.tool]: info.versionOrName },
    entries: [
      {
        tool: info.tool,
        versionOrName: info.versionOrName,
        url: `https://install.invalid/${format === 'elf' ? 'elf' : 'archive'}`,
        format,
        ...(format === 'tar.gz' ? { archiveEntry: 'aube' } : {}),
        downloadSha256: sha256(bytes),
        downloadBytes: bytes.length,
        elfBytes: input.bytes.length,
        buildInfo: info,
        buildInfoSha256: input.expected.buildInfoSha256,
      },
    ],
  };
}
test('independent installed U3 ELF and real archive install with controlled HTTPS transport and real guest run', async ({
  page,
}) => {
  for (const format of ['elf', 'tar.gz'] as const) {
    const result = await page.evaluate(
      async ({ manifest, expected }) => {
        const api = await import('/runtime/public.js');
        const { createSession } = await import('/runtime/web/api.js');
        const session = await createSession();
        const phases: string[] = [];
        try {
          const installer = api.createInstaller(session, manifest);
          manifest.entries[0].url = 'https://changed.invalid';
          const installed = await installer.install(expected.identity.tool, {
            onProgress(event: Progress) {
              phases.push(event.phase);
            },
          });
          const bytes = new Uint8Array(
            await (await fetch('/guest')).arrayBuffer(),
          );
          const handle = api.validateGuest(bytes, expected);
          bytes.fill(0);
          const run = await api.runValidatedGuest(session, handle, {
            args: ['--version'],
          });
          return {
            coi: crossOriginIsolated,
            digest: installed.digest,
            code: run.exitCode,
            text: api.decodeUtf8(run.stdout),
            phases: [...new Set(phases)],
          };
        } finally {
          await session.dispose();
        }
      },
      { manifest: catalog(format), expected: input.expected },
    );
    expect(result.coi).toBe(true);
    expect(result.digest).toBe(input.expected.elfSha256);
    expect(result.code).toBe(0);
    expect(result.text).toMatch(/^2\.7\.0/);
    expect(result.phases).toEqual(
      format === 'elf'
        ? ['fetch', 'digest', 'validate', 'register']
        : ['fetch', 'extract', 'digest', 'validate', 'register'],
    );
  }
});
test('browser factory, digest failure and preabort preserve seed and refuse forged session', async ({
  page,
}) => {
  const result = await page.evaluate(async (manifest) => {
    const api = await import('/runtime/public.js');
    const { createSession } = await import('/runtime/web/api.js');
    const session = await createSession({
      entries: [
        {
          path: '/work/seed',
          type: 'file',
          mode: 384,
          inodeId: 'seed',
          data: new Uint8Array([7]),
        },
      ],
    });
    const codes: string[] = [];
    const rejected = async (run: () => unknown) => {
      try {
        await run();
        codes.push('accepted');
      } catch (error) {
        codes.push((error as { code: string }).code);
      }
    };
    try {
      await rejected(() => api.createInstaller({} as typeof session, manifest));
      const installer = api.createInstaller(session, manifest);
      await installer.install(manifest.entries[0].tool);
      const bad = structuredClone(manifest);
      bad.entries[0].downloadSha256 = 'f'.repeat(64);
      bad.entries[0].format = 'tar.gz';
      bad.entries[0].archiveEntry = 'aube';
      await rejected(() =>
        api.createInstaller(session, bad).install(manifest.entries[0].tool),
      );
      const caller = new AbortController();
      caller.abort();
      await rejected(() =>
        installer.install(manifest.entries[0].tool, { signal: caller.signal }),
      );
      return { codes, seed: (await session.readFile('/work/seed'))[0] };
    } finally {
      await session.dispose();
    }
  }, catalog());
  expect(result.codes).toEqual(['INVALID_INPUT', 'INVALID_INPUT', 'ABORTED']);
  expect(result.seed).toBe(7);
});
test('browser same reservation rejects reentry and owner reset/dispose cancel install', async ({
  page,
}) => {
  const result = await page.evaluate(async (manifest) => {
    const api = await import('/runtime/public.js');
    const { createSession } = await import('/runtime/web/api.js');
    const outcomes: string[] = [];
    for (const operation of ['reset', 'dispose'] as const) {
      const session = await createSession();
      const installer = api.createInstaller(session, manifest);
      let cleanup: Promise<void> | undefined;
      const competing: Promise<string>[] = [];
      try {
        await installer.install(manifest.entries[0].tool, {
          onProgress(event: Progress) {
            if (event.phase === 'fetch' && !cleanup) {
              competing.push(
                installer.install(manifest.entries[0].tool).then(
                  () => 'accepted',
                  (error: unknown) =>
                    error instanceof Error && 'code' in error
                      ? String(error.code)
                      : 'UNEXPECTED',
                ),
              );
              cleanup = session[operation]();
            }
          },
        });
        outcomes.push('accepted');
      } catch (error) {
        outcomes.push((error as { code: string }).code);
      }
      await cleanup;
      outcomes.push(...(await Promise.all(competing)));
      if (operation === 'reset') await session.listEntries();
      await session.dispose();
    }
    return outcomes;
  }, catalog());
  expect(result).toEqual(['ABORTED', 'BUSY', 'DISPOSED', 'BUSY']);
});
