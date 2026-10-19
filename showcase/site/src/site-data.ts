import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FormicariumManifest } from './terminal/formicarium-loader.ts';
import type { EmbeddedFile } from './terminal/page-data.ts';

/**
 * Build-time data of the pages, written by scripts/build-site.ts from the
 * checked candidate, tools.json and the staged pack (never from `latest`).
 */
export interface SiteTool {
  tool: string;
  version: string;
  repository: string;
  fixture: string;
  fixtureIndex: EmbeddedFile;
}
export interface SiteData {
  schemaVersion: 1;
  candidateId: string;
  catalog: EmbeddedFile;
  tools: SiteTool[];
  formicarium: FormicariumManifest;
  /** npm check (S18): true only when npm has this version with this integrity. */
  npm: { version: string; published: boolean; integrity: string };
}

const DEFAULT_PATH = fileURLToPath(
  new URL('../.work/build/site-data.json', import.meta.url),
);

/** Reads the site data once per build; a missing file stops the build. */
export function loadSiteData(
  path = process.env.SHOWCASE_SITE_DATA ?? DEFAULT_PATH,
): SiteData {
  let value: SiteData;
  try {
    value = JSON.parse(readFileSync(path, 'utf8')) as SiteData;
  } catch (error) {
    throw new Error(`site data missing: run scripts/build-site.ts (${path})`, {
      cause: error,
    });
  }
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.tools) ||
    value.tools.length === 0
  )
    throw new Error('site data invalid');
  return value;
}

export const toolOf = (data: SiteData, tool: string): SiteTool => {
  const found = data.tools.find((item) => item.tool === tool);
  if (!found) throw new Error(`unknown tool ${tool}`);
  return found;
};
