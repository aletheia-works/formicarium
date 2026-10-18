import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CatalogEntry,
  GuestCatalog,
  Installer,
  Session,
} from '@aletheia-works/formicarium';
import { type AcquiredTool, loadAcquired } from './acquire.ts';
import { canonicalJson, canonicalSha256 } from './build-key.ts';
import { fail, runCli } from './errors.ts';
import { TRANSFER_POLICY } from './limits.ts';
import { type WorkLayout, workLayout, writeOnce } from './paths.ts';

/** Same-origin relative path under which a deployed site serves each guest. */
export const sitePath = (tool: string, version: string, file: string) =>
  `guests/${tool}/${version}/${file}`;

/** C04 GuestCatalog whose defaults are the versions resolved in this run. */
export function buildCatalog(
  records: readonly AcquiredTool[],
  limit: number = TRANSFER_POLICY.maxCatalogBytes,
): GuestCatalog {
  if (records.length === 0) fail('catalog-invalid', 'no acquired tools');
  const entries: CatalogEntry[] = records.map((record) => ({
    tool: record.tool,
    versionOrName: record.version,
    url: sitePath(record.tool, record.version, record.downloadFile),
    format: record.format,
    ...(record.format === 'tar.gz'
      ? { archiveEntry: record.archiveEntry }
      : {}),
    downloadSha256: record.downloadSha256,
    downloadBytes: record.downloadBytes,
    elfBytes: record.elfBytes,
    buildInfo: record.buildInfo,
    buildInfoSha256: record.buildInfoSha256,
  }));
  const defaults = Object.fromEntries(
    records.map((record) => [record.tool, record.version]),
  );
  if (Object.keys(defaults).length !== records.length)
    fail('catalog-invalid', 'duplicate tool in catalog');
  const catalog: GuestCatalog = {
    schemaVersion: 1,
    catalogId: `showcase-${canonicalSha256({ defaults, entries }).slice(0, 32)}`,
    defaults,
    entries,
  };
  if (new TextEncoder().encode(canonicalJson(catalog)).length > limit)
    fail('size-limit', `catalog exceeds ${limit} bytes`);
  return catalog;
}

/** Node has no document origin: relative URLs are resolved against an HTTPS base. */
export function absoluteCatalog(
  catalog: GuestCatalog,
  base: string,
): GuestCatalog {
  const origin = new URL(base);
  if (origin.protocol !== 'https:')
    fail('catalog-invalid', 'base must be HTTPS');
  return {
    ...catalog,
    entries: catalog.entries.map((entry) => ({
      ...entry,
      url: new URL(entry.url, origin).href,
    })),
  };
}

export interface InstallerApi {
  createSession(): Promise<Session>;
  createInstaller(session: Session, catalog: GuestCatalog): Installer;
}

/** The generated catalog must be accepted by the public createInstaller. */
export async function verifyCatalog(
  catalog: GuestCatalog,
  api: InstallerApi,
): Promise<void> {
  const session = await api.createSession();
  try {
    api.createInstaller(
      session,
      absoluteCatalog(catalog, 'https://showcase.invalid/'),
    );
  } catch (error) {
    fail(
      'catalog-invalid',
      'public createInstaller refused the catalog',
      error,
    );
  } finally {
    await session.dispose();
  }
}

/** Copies verified bytes into the site tree beside their build-info. */
export async function placeSite(
  layout: WorkLayout,
  records: readonly AcquiredTool[],
): Promise<void> {
  for (const record of records) {
    const directory = join(layout.site, 'guests', record.tool, record.version);
    await mkdir(directory, { recursive: true });
    await copyFile(
      join(layout.acquired, record.tool, record.downloadFile),
      join(directory, record.downloadFile),
    );
    await writeOnce(
      join(directory, 'build-info.json'),
      canonicalJson(record.buildInfo),
    );
  }
}

export async function runCatalogJob(options: {
  api: InstallerApi;
  layout?: WorkLayout;
}): Promise<GuestCatalog> {
  const layout = options.layout ?? workLayout();
  const records = await loadAcquired(layout);
  const catalog = buildCatalog(records);
  await verifyCatalog(catalog, options.api);
  await placeSite(layout, records);
  await writeOnce(layout.catalog, canonicalJson(catalog));
  return catalog;
}

if (import.meta.main)
  await runCli('catalog', async () => {
    const { createInstaller } = await import('@aletheia-works/formicarium');
    const { createSession } = await import('@aletheia-works/formicarium/node');
    const catalog = await runCatalogJob({
      api: { createSession: () => createSession(), createInstaller },
    });
    console.log(`${catalog.catalogId} ${canonicalSha256(catalog)}`);
  });
