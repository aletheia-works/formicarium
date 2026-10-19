import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseUniqueJson } from '../../scripts/build-key.ts';
import { fileInventory } from '../../scripts/paths.ts';
import {
  type SiteInventory,
  siteInventory,
  validateSiteInventory,
} from '../src/model/inventory.ts';
import {
  fail,
  parseOptions,
  runCli,
  siteLayout,
  summary,
  writeJsonFile,
} from './common.ts';

/**
 * Inventory of the final site bytes: every regular file, dotfiles included;
 * a symbolic link or special file fails (U7 fileInventory).
 */
export async function computeInventory(
  siteDir: string,
): Promise<SiteInventory> {
  // U7's fileInventory compares resolved paths: give it an absolute root.
  return siteInventory(await fileInventory(resolve(siteDir)));
}

export async function readInventory(path: string): Promise<SiteInventory> {
  return validateSiteInventory(parseUniqueJson(await readFile(path, 'utf8')));
}

/** The paths that differ between two inventories (for the failure message). */
export function inventoryDifference(
  a: SiteInventory,
  b: SiteInventory,
): string[] {
  const left = new Map(
    a.files.map((file) => [file.path, `${file.sha256}/${file.bytes}`]),
  );
  const right = new Map(
    b.files.map((file) => [file.path, `${file.sha256}/${file.bytes}`]),
  );
  const paths = new Set([...left.keys(), ...right.keys()]);
  return [...paths].filter((path) => left.get(path) !== right.get(path)).sort();
}

/** Recomputes the inventory of `siteDir` and requires the recorded digest. */
export async function requireSameInventory(
  siteDir: string,
  expected: SiteInventory,
): Promise<SiteInventory> {
  const actual = await computeInventory(siteDir);
  if (actual.sha256 !== expected.sha256)
    fail(
      'inventory-mismatch',
      `site differs from the recorded inventory: ${inventoryDifference(expected, actual).slice(0, 20).join(', ')}`,
    );
  return actual;
}

// CLI: `inventory.ts --site <dir> --out <file>` records, `--expect <file>` compares.
if (import.meta.main)
  await runCli('inventory', async () => {
    const options = parseOptions(process.argv.slice(2), [
      'site',
      'out',
      'expect',
      'log',
    ]);
    const site = options.site ?? siteLayout().dist;
    const inventory = options.expect
      ? await requireSameInventory(site, await readInventory(options.expect))
      : await computeInventory(site);
    if (options.out) await writeJsonFile(options.out, inventory);
    if (options.log)
      await writeJsonFile(options.log, {
        schemaVersion: 1,
        site,
        expected: options.expect
          ? (await readInventory(options.expect)).sha256
          : null,
        actual: inventory.sha256,
        files: inventory.files.length,
        recordedAt: new Date().toISOString(),
      });
    await summary(
      `- siteInventorySha256: \`${inventory.sha256}\` (${inventory.files.length} files)`,
    );
    console.log(`${inventory.sha256} ${inventory.files.length} files`);
  });
