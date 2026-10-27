import type { FormicariumManifest } from './formicarium-loader.ts';

/**
 * Attribute of the terminal container. Its value is the build-time page data
 * (JSON). Only the terminal pages carry it; check-site.ts uses it to tell
 * terminal pages and their scripts from the documentation pages.
 */
export const TERMINAL_ATTRIBUTE = 'data-terminal-host';
export type Locale = 'en' | 'ja';
export type TerminalMode = 'empty' | 'preinstalled';

export interface EmbeddedFile {
  /** Path relative to the site root. */
  path: string;
  sha256: string;
}
export interface TerminalPageData {
  mode: TerminalMode;
  locale: Locale;
  /** Base path of the site, `/formicarium/`. */
  base: string;
  tool: string | null;
  version: string | null;
  catalog: EmbeddedFile;
  fixture: EmbeddedFile | null;
  formicarium: FormicariumManifest;
  /** Tools whose runs get the keystrokes and a terminal (tools.json `interactive`). */
  interactive: string[];
  /** Tools installed the first time their command runs (tools.json `onDemand`). */
  onDemand: string[];
}

const SHA256 = /^[a-f0-9]{64}$/;
const PATH = /^[a-z0-9][a-z0-9._/-]*$/;
/** The tool name shape of tools.json. */
const TOOL = /^[a-z][a-z0-9-]{0,63}$/;

function embedded(value: unknown, name: string): EmbeddedFile {
  const file = value as EmbeddedFile | null;
  if (
    !file ||
    typeof file.path !== 'string' ||
    !PATH.test(file.path) ||
    file.path.split('/').includes('..') ||
    typeof file.sha256 !== 'string' ||
    !SHA256.test(file.sha256)
  )
    throw new Error(`page data ${name} invalid`);
  return { path: file.path, sha256: file.sha256 };
}

/** Parses the attribute value; the build wrote it, the page still checks it. */
export function parsePageData(
  raw: string | null | undefined,
): TerminalPageData {
  let value: Partial<TerminalPageData>;
  try {
    value = JSON.parse(raw ?? '');
  } catch {
    throw new Error('page data is not JSON');
  }
  if (value.mode !== 'empty' && value.mode !== 'preinstalled')
    throw new Error('page data mode invalid');
  if (value.locale !== 'en' && value.locale !== 'ja')
    throw new Error('page data locale invalid');
  if (typeof value.base !== 'string' || !/^\/(?:[\w-]+\/)*$/.test(value.base))
    throw new Error('page data base invalid');
  const preinstalled = value.mode === 'preinstalled';
  if (
    preinstalled &&
    (typeof value.tool !== 'string' || typeof value.version !== 'string')
  )
    throw new Error('preinstalled page needs a tool and version');
  if (!value.formicarium || typeof value.formicarium !== 'object')
    throw new Error('page data formicarium missing');
  for (const name of ['interactive', 'onDemand'] as const) {
    const tools = value[name];
    if (
      !Array.isArray(tools) ||
      !tools.every((tool) => typeof tool === 'string' && TOOL.test(tool))
    )
      throw new Error(`page data ${name} invalid`);
  }
  return {
    mode: value.mode,
    locale: value.locale,
    base: value.base,
    tool: preinstalled ? (value.tool as string) : null,
    version: preinstalled ? (value.version as string) : null,
    catalog: embedded(value.catalog, 'catalog'),
    fixture: preinstalled ? embedded(value.fixture, 'fixture') : null,
    formicarium: value.formicarium,
    interactive: [...value.interactive!],
    onDemand: [...value.onDemand!],
  };
}
