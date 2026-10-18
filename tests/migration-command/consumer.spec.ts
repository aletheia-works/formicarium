import { expect, test } from '@playwright/test';
import { sha256 } from '../../scripts/package/stage-package.js';
import type { GuestCatalog } from '../../types/index.js';
import { consumerInput } from '../migration-session/consumer-input.js';
import { serveDirectory } from '../package/fixtures.js';

const input = await consumerInput();
expect(input.candidate.unit).toBe('u4-command');
for (const name of ['command', 'command-parse', 'install'])
  expect(
    input.candidate.files.some(
      (entry: { path: string }) => entry.path === `runtime/${name}.js`,
    ),
  ).toBe(true);
let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(input.packageRoot, {
    csp: "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' https://install.invalid",
  });
});
test.afterAll(async () => {
  await server.close();
});
test.beforeEach(async ({ page }, info) => {
  // Browser build numbers are not fixed in documents; record what ran.
  const observed = `${info.project.name} ${page.context().browser()?.version() ?? 'unknown'}`;
  info.annotations.push({ type: 'observed-browser', description: observed });
  console.log(`U4 observed browser: ${observed}`);
  // Controlled transport serves good bytes at /elf and zero bytes at /bad.
  await page.route('https://install.invalid/**', async (route) => {
    const bad = route.request().url().endsWith('/bad');
    await route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': server.url },
      body: Buffer.from(bad ? new Uint8Array(input.bytes.length) : input.bytes),
    });
  });
  await page.goto(server.url);
});
function catalog(path: 'elf' | 'bad' = 'elf'): GuestCatalog {
  const info = structuredClone(input.expected.identity);
  return {
    schemaVersion: 1,
    catalogId: 'u4-controlled-browser-transport',
    defaults: { [info.tool]: info.versionOrName },
    entries: [
      {
        tool: info.tool,
        versionOrName: info.versionOrName,
        url: `https://install.invalid/${path}`,
        format: 'elf',
        downloadSha256: sha256(input.bytes),
        downloadBytes: input.bytes.length,
        elfBytes: input.bytes.length,
        buildInfo: info,
        buildInfoSha256: input.expected.buildInfoSha256,
      },
    ],
  };
}

test('independent installed U4 empty terminal installs, runs aube, uses builtins and resets', async ({
  page,
}) => {
  const result = await page.evaluate(
    async ({ manifest, tool }) => {
      const api = await import('/runtime/public.js');
      const { createSession } = await import('/runtime/web/api.js');
      const session = await createSession({
        entries: [
          {
            path: '/work/note.txt',
            type: 'file',
            mode: 420,
            inodeId: 'note',
            data: new TextEncoder().encode('note'),
          },
        ],
      });
      const shell = api.createCommandSession(session, { catalog: manifest });
      const decode = (bytes: Uint8Array) => api.decodeUtf8(bytes);
      const codeOf = async (line: string) => {
        try {
          await shell.execute(line);
          return 'accepted';
        } catch (error) {
          return (error as { code: string }).code;
        }
      };
      try {
        const empty = (await shell.execute('   ')).kind;
        const before = await codeOf(`${tool} --version`);
        const phases: string[] = [];
        const installed = await shell.execute(`install ${tool}`, {
          onProgress(event) {
            phases.push(event.phase);
          },
        });
        const chunks: string[] = [];
        const run = await shell.execute(`${tool} --version`, {
          onOutput(chunk) {
            chunks.push(chunk.stream);
          },
        });
        const listed = decode((await shell.execute('ls')).stdout);
        const cat = decode((await shell.execute('cat /work/note.txt')).stdout);
        const relative = decode((await shell.execute('cat ./note.txt')).stdout);
        const parent = await codeOf('cat ../work/note.txt');
        await shell.execute('cd /root');
        await shell.execute('rm -rf /work/note.txt');
        const after = decode((await shell.execute('ls /work')).stdout);
        await session.reset();
        const reset = await codeOf(`${tool} --version`);
        const restored = decode((await shell.execute('ls')).stdout);
        return {
          coi: crossOriginIsolated,
          empty,
          before,
          line: decode(installed.stdout),
          phases: [...new Set(phases)],
          run: { kind: run.kind, code: run.exitCode, text: decode(run.stdout) },
          sawOutput: chunks.length > 0,
          listed,
          cat,
          relative,
          parent,
          after,
          reset,
          restored,
        };
      } finally {
        await session.dispose();
      }
    },
    { manifest: catalog(), tool: input.expected.identity.tool },
  );
  expect(result.coi).toBe(true);
  expect(result.empty).toBe('empty');
  expect(result.before).toBe('NOT_FOUND');
  expect(result.line).toBe(
    `installed ${input.expected.identity.tool}@${input.expected.identity.versionOrName} (sha256 ${input.expected.elfSha256})\n`,
  );
  expect(result.phases).toEqual(['fetch', 'digest', 'validate', 'register']);
  expect(result.run.kind).toBe('guest');
  expect(result.run.code).toBe(0);
  expect(result.run.text).toMatch(/^2\.7\.0/);
  expect(result.sawOutput).toBe(true);
  expect(result.listed).toBe('note.txt\n');
  expect(result.cat).toBe('note');
  expect(result.relative).toBe('note');
  expect(result.parent).toBe('INVALID_INPUT');
  expect(result.after).toBe('');
  expect(result.reset).toBe('NOT_FOUND');
  expect(result.restored).toBe('note.txt\n');
});
test('browser command competes BUSY with direct install and a failed reinstall keeps the old guest', async ({
  page,
}) => {
  const result = await page.evaluate(
    async ({ good, bad, tool }) => {
      const api = await import('/runtime/public.js');
      const { createSession } = await import('/runtime/web/api.js');
      const session = await createSession();
      const shell = api.createCommandSession(session, { catalog: good });
      const failing = api.createCommandSession(session, { catalog: bad });
      const direct = api.createInstaller(session, good);
      const codes: string[] = [];
      const capture = async (run: () => Promise<unknown>) => {
        try {
          await run();
          codes.push('accepted');
        } catch (error) {
          codes.push((error as { code: string }).code);
        }
      };
      try {
        let competing: Promise<void> | undefined;
        await shell.execute(`install ${tool}`, {
          onProgress(event) {
            if (event.phase === 'fetch' && !competing)
              competing = Promise.all([
                capture(() => direct.install(tool)),
                capture(() => shell.execute('ls')),
                capture(() => session.listEntries()),
              ]).then(() => undefined);
          },
        });
        await competing;
        await capture(() => failing.execute(`install ${tool}`));
        const run = await shell.execute(`${tool} --version`);
        return { codes, code: run.exitCode, text: api.decodeUtf8(run.stdout) };
      } finally {
        await session.dispose();
      }
    },
    {
      good: catalog(),
      bad: catalog('bad'),
      tool: input.expected.identity.tool,
    },
  );
  expect(result.codes).toEqual(['BUSY', 'BUSY', 'BUSY', 'INVALID_INPUT']);
  expect(result.code).toBe(0);
  expect(result.text).toMatch(/^2\.7\.0/);
});
test('browser keeps non-ASCII input, refuses shell syntax and matches direct install identity', async ({
  page,
}) => {
  const result = await page.evaluate(
    async ({ manifest, tool }) => {
      const api = await import('/runtime/public.js');
      const { createSession } = await import('/runtime/web/api.js');
      const name = '/work/日本語　名 x.txt';
      const session = await createSession({
        entries: [
          {
            path: name,
            type: 'file',
            mode: 420,
            inodeId: 'jp',
            data: new TextEncoder().encode('値'),
          },
          { path: '/work/a', type: 'dir', mode: 493 },
          {
            path: '/work/a.b',
            type: 'file',
            mode: 420,
            inodeId: 'ab',
            data: new Uint8Array(),
          },
        ],
      });
      const shell = api.createCommandSession(session, { catalog: manifest });
      const codes: string[] = [];
      try {
        for (const line of [
          'cat a|b',
          'aube $(id)',
          'cat "open',
          'ls -a',
          'rm -r -f /work/a',
          `cat ${'x'.repeat(65537)}`,
          'cat \uD800',
        ])
          try {
            await shell.execute(line);
            codes.push('accepted');
          } catch (error) {
            codes.push((error as { code: string }).code);
          }
        const cat = api.decodeUtf8((await shell.execute(`cat ${name}`)).stdout);
        const listing = api.decodeUtf8((await shell.execute('ls')).stdout);
        const viaCommand = (await shell.execute(`install ${tool}`))
          .installation!;
        const direct = await api
          .createInstaller(session, manifest)
          .install(tool);
        const same = (['tool', 'versionOrName', 'digest', 'buildKey'] as const)
          .map((field) => viaCommand[field] === direct[field])
          .every(Boolean);
        return { codes, cat, listing, same, digest: viaCommand.digest };
      } finally {
        await session.dispose();
      }
    },
    { manifest: catalog(), tool: input.expected.identity.tool },
  );
  expect(result.codes).toEqual(Array(7).fill('INVALID_INPUT'));
  expect(result.cat).toBe('値');
  expect(result.listing).toBe('a.b\na/\n日本語　名 x.txt\n');
  expect(result.same).toBe(true);
  expect(result.digest).toBe(input.expected.elfSha256);
});
