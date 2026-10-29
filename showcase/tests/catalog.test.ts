import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  type CommandSession,
  createInstaller,
  type GuestCatalog,
  type Session,
} from '@aletheia-works/formicarium';
import { createSession } from '@aletheia-works/formicarium/node';
import {
  acceptAll,
  acceptTool,
  type CommandApi,
} from '../scripts/accept-node.ts';
import {
  contentType,
  importMap,
  pagePolicy,
  safeJoin,
} from '../scripts/accept-server.ts';
import { storeAcquired } from '../scripts/acquire.ts';
import { canonicalJson } from '../scripts/build-key.ts';
import {
  absoluteCatalog,
  buildCatalog,
  runCatalogJob,
  verifyCatalog,
} from '../scripts/catalog.ts';
import { causeOf } from '../scripts/errors.ts';
import { TRANSFER_POLICY } from '../scripts/limits.ts';
import { createJobTls, tlsFromEnvironment } from '../scripts/tls.ts';
import { officialRecord } from './fixtures/records.ts';
import { withLayout } from './fixtures/work.ts';

const aube = officialRecord('aube', '2.7.0', 'tar.gz', 1);
const biome = officialRecord('biome', '2.5.15', 'elf', 2);
const installerApi = { createSession: () => createSession(), createInstaller };
const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);

test('the generated catalog has resolved defaults, relative URLs and is accepted by createInstaller', async () => {
  const catalog = buildCatalog([aube.record, biome.record]);
  assert.deepEqual(catalog.defaults, { aube: '2.7.0', biome: '2.5.15' });
  assert.equal(
    catalog.entries[0]!.url,
    `guests/aube/2.7.0/${aube.record.downloadFile}`,
  );
  assert.equal(catalog.entries[0]!.archiveEntry, 'aube');
  assert.equal(Object.hasOwn(catalog.entries[1]!, 'archiveEntry'), false);
  await verifyCatalog(catalog, installerApi);
  assert.equal(
    absoluteCatalog(catalog, 'https://localhost:9/').entries[1]!.url,
    `https://localhost:9/guests/biome/2.5.15/${biome.record.downloadFile}`,
  );
  assert.throws(
    () => absoluteCatalog(catalog, 'http://localhost/'),
    (error) => causeOf(error) === 'catalog-invalid',
  );
});

test('a companion is installable by its own name and names the tool it belongs to', async () => {
  const extra = officialRecord('biome-extra', '2.5.15', 'elf', 3);
  const catalog = buildCatalog([
    biome.record,
    { ...extra.record, companionOf: 'biome' },
  ]);
  assert.deepEqual(catalog.defaults, {
    biome: '2.5.15',
    'biome-extra': '2.5.15',
  });
  assert.equal(Object.hasOwn(catalog.entries[0]!, 'companionOf'), false);
  assert.equal(catalog.entries[1]!.companionOf, 'biome');
  await verifyCatalog(catalog, installerApi);
});

test('a catalog the public API refuses is not used', async () => {
  const catalog = buildCatalog([aube.record]);
  const tampered: GuestCatalog = {
    ...catalog,
    entries: [{ ...catalog.entries[0]!, buildInfoSha256: '0'.repeat(64) }],
  };
  await rejects(verifyCatalog(tampered, installerApi), 'catalog-invalid');
});

test('the 4 MiB catalog limit accepts its value and refuses one byte more', () => {
  assert.equal(TRANSFER_POLICY.maxCatalogBytes, 4194304);
  const size = new TextEncoder().encode(
    canonicalJson(buildCatalog([aube.record, biome.record])),
  ).length;
  assert.equal(
    buildCatalog([aube.record, biome.record], size).entries.length,
    2,
  );
  assert.throws(
    () => buildCatalog([aube.record, biome.record], size - 1),
    (error) => causeOf(error) === 'size-limit',
  );
  assert.throws(
    () => buildCatalog([]),
    (error) => causeOf(error) === 'catalog-invalid',
  );
});

test('the catalog job places verified bytes and writes canonical catalog.json once', async () => {
  await withLayout(async (layout) => {
    for (const fixture of [aube, biome])
      await storeAcquired(
        layout,
        fixture.record,
        fixture.download,
        fixture.elf,
      );
    const catalog = await runCatalogJob({ api: installerApi, layout });
    assert.equal(
      await readFile(layout.catalog, 'utf8'),
      canonicalJson(catalog),
    );
    assert.deepEqual(
      new Uint8Array(
        await readFile(
          join(
            layout.site,
            'guests',
            'aube',
            '2.7.0',
            aube.record.downloadFile,
          ),
        ),
      ),
      aube.download,
    );
    await rejects(
      runCatalogJob({ api: installerApi, layout }),
      'output-exists',
    );
  });
});

function fakeCommands(
  outputs: Record<string, { exitCode: number; stdout: string } | Error>,
): CommandApi {
  const encoder = new TextEncoder();
  return {
    createSession: async () =>
      ({ dispose: async () => undefined }) as unknown as Session,
    createCommandSession: () =>
      ({
        async execute(line: string) {
          const output = outputs[line];
          if (output instanceof Error) throw output;
          if (!output)
            throw Object.assign(new Error('missing'), { code: 'NOT_FOUND' });
          return {
            kind: line.startsWith('install ') ? 'install' : 'guest',
            exitCode: output.exitCode,
            stdout: encoder.encode(output.stdout),
            stderr: new Uint8Array(),
          };
        },
      }) as CommandSession,
    decodeUtf8: (bytes) => new TextDecoder().decode(bytes),
  };
}

test('one acceptance row per tool records version match, failures and timings', async () => {
  const catalog = buildCatalog([aube.record, biome.record]);
  const api = fakeCommands({
    'install aube': { exitCode: 0, stdout: 'installed aube@2.7.0\n' },
    'aube --version': { exitCode: 0, stdout: 'aube 2.7.0\n' },
    'install biome': { exitCode: 0, stdout: 'installed\n' },
    'biome --version': { exitCode: 0, stdout: 'Version: 2.5.16\n' },
  });
  const rows = await acceptAll(
    api,
    catalog,
    [
      { tool: 'aube', version: '2.7.0' },
      { tool: 'biome', version: '2.5.15' },
    ],
    'node',
  );
  assert.deepEqual(
    rows.map((row) => [row.name, row.status, row.cause]),
    [
      ['tool-aube-version', 'passed', null],
      ['tool-biome-version', 'failed', 'version-mismatch'],
    ],
  );
  assert.ok(
    rows.every(
      (row) =>
        typeof row.installMs === 'number' && typeof row.versionMs === 'number',
    ),
  );
  const failing = await acceptTool(
    fakeCommands({
      'install aube': Object.assign(new Error('x'), { code: 'ASSET_LOAD' }),
    }),
    catalog,
    { tool: 'aube', version: '2.7.0' },
    'node',
  );
  assert.equal(failing.cause, 'ASSET_LOAD');
  const refused = await acceptTool(
    fakeCommands({ 'install aube': { exitCode: 1, stdout: '' } }),
    catalog,
    { tool: 'aube', version: '2.7.0' },
    'node',
  );
  assert.equal(refused.cause, 'install-failed');
});

test('job TLS material must come complete from CI or be created locally', async () => {
  assert.equal(await tlsFromEnvironment({}), null);
  await rejects(
    tlsFromEnvironment({ SHOWCASE_TLS_CERT: '/x.pem' }),
    'config-invalid',
  );
  await withLayout(async (layout) => {
    const directory = join(layout.root, 'tls');
    await rejects(
      createJobTls(directory, () => {
        throw Error('openssl unavailable');
      }),
      'config-invalid',
    );
    await assert.rejects(access(directory));
  });
});

test('the acceptance page maps only public exports and pins its inline script', () => {
  const map = importMap({
    name: '@aletheia-works/formicarium',
    exports: {
      '.': { import: './runtime/public.js' },
      './browser': { import: './runtime/web/api.js' },
      './node': { import: './runtime/node/api.js' },
    },
  });
  assert.deepEqual(map.imports, {
    '@aletheia-works/formicarium': '/pkg/runtime/public.js',
    '@aletheia-works/formicarium/browser': '/pkg/runtime/web/api.js',
  });
  assert.throws(
    () => importMap({ name: 'x', exports: {} }),
    (error) => causeOf(error) === 'config-invalid',
  );
  const policy = pagePolicy('{}');
  assert.match(
    policy,
    /script-src 'self' 'wasm-unsafe-eval' 'sha256-[A-Za-z0-9+/=]+'/,
  );
  assert.match(policy, /worker-src 'self';/);
  assert.doesNotMatch(policy, /blob:/);
  assert.equal(safeJoin('/srv/site', 'guests/a/b'), '/srv/site/guests/a/b');
  for (const path of [
    '../etc/passwd',
    'a/%2e%2e/b',
    'a\\b',
    'a%00',
    '%E0%A4%A',
  ])
    assert.equal(safeJoin('/srv/site', path), null);
  assert.equal(contentType('x.wasm'), 'application/wasm');
  assert.equal(contentType('x.js'), 'text/javascript');
  assert.equal(contentType('x.json'), 'application/json');
  assert.equal(contentType('guest'), 'application/octet-stream');
});
