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
  /** tools.json `interactive`: the terminal passes keystrokes to this tool. */
  interactive?: true;
  /** tools.json `onDemand`: every terminal page installs it on its first run. */
  onDemand?: true;
}
export interface SiteData {
  schemaVersion: 1;
  candidateId: string;
  catalog: EmbeddedFile;
  tools: SiteTool[];
  formicarium: FormicariumManifest;
  /** npm check: true only when npm has this version with this integrity. */
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

/** The tools the terminal pages run interactively (page data `interactive`). */
export const interactiveTools = (data: SiteData): string[] =>
  data.tools.filter((tool) => tool.interactive).map((tool) => tool.tool);

/** The tools every terminal page installs on first use (page data `onDemand`). */
export const onDemandTools = (data: SiteData): string[] =>
  data.tools.filter((tool) => tool.onDemand).map((tool) => tool.tool);

export const toolOf = (data: SiteData, tool: string): SiteTool => {
  const found = data.tools.find((item) => item.tool === tool);
  if (!found) throw new Error(`unknown tool ${tool}`);
  return found;
};
