import { readFile } from 'node:fs/promises';
import { basename, dirname, join, posix } from 'node:path';
import { sha256 } from '../../scripts/build-key.ts';
import { installPack, type PackRecord } from '../../scripts/pack.ts';
import { readJson, workLayout } from '../../scripts/paths.ts';
import { checkRelativePath } from '../src/model/model-error.ts';
import { fail, SITE_ROOT, writeText } from './common.ts';

/** Same-origin directory below the site root that holds the package bytes. */
export const FORMICARIUM_DIR = '_formicarium';
/** The single-file browser Worker of the package (PR #38). */
export const WORKER_FILE = 'runtime/web/package-worker.bundle.js';
const LICENSE_FILES = ['LICENSE', 'THIRD_PARTY_NOTICES.md'];

export interface StagedFile {
  path: string;
  sha256: string;
  bytes: number;
}
/** What the page needs to load formicarium (embedded in the terminal pages). */
export interface FormicariumManifest {
  version: string;
  /** Site-root relative directory, `_formicarium/<version>/`. */
  base: string;
  root: string;
  browser: string;
  assets: { loader: string; wasm: string; worker: string; buildInfo: string };
  files: StagedFile[];
}

/** Relative module specifiers of an ES module (static, re-export, literal dynamic). */
/** `node:` builtins reached only by a literal dynamic import. */
export function nodeBuiltinDynamicImports(source: string): Set<string> {
  const dynamic = new Set(
    [...source.matchAll(/\bimport\s*\(\s*['"](node:[^'"\n]+)['"]\s*\)/g)].map(
      (match) => match[1]!,
    ),
  );
  const fromStatic =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;'"`(]*?\sfrom\s*)?['"](node:[^'"\n]+)['"]/g;
  for (const match of source.matchAll(fromStatic)) dynamic.delete(match[1]!);
  return dynamic;
}

export function relativeImports(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;'"`]*?\sfrom\s*)?['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) found.add(match[1]!);
  return [...found];
}

/**
 * Every module reachable from the given package files. A bare specifier
 * cannot load in the browser without a bundler and fails the build.
 */
export async function moduleGraph(
  packageRoot: string,
  entries: readonly string[],
): Promise<string[]> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    checkRelativePath('inventory-invalid', path, 4096);
    seen.add(path);
    let source: string;
    try {
      source = await readFile(join(packageRoot, path), 'utf8');
    } catch (error) {
      return fail(
        'pack-invalid',
        `module missing from the pack: ${path}`,
        error,
      );
    }
    const nodeOnly = nodeBuiltinDynamicImports(source);
    for (const specifier of relativeImports(source)) {
      // `await import('node:…')` sits in a Node-only branch the browser never runs.
      if (nodeOnly.has(specifier)) continue;
      if (!specifier.startsWith('./') && !specifier.startsWith('../'))
        fail('pack-invalid', `${path} imports bare ${specifier}`);
      const target = posix.normalize(
        posix.join(posix.dirname(path), specifier),
      );
      if (target.startsWith('../'))
        fail('pack-invalid', `${path} leaves the package`);
      queue.push(target);
    }
  }
  return [...seen].sort();
}

interface PackageJson {
  name?: unknown;
  version?: unknown;
  exports?: Record<string, unknown>;
}
function exportTarget(manifest: PackageJson, entry: string): string {
  const target = manifest.exports?.[entry];
  const value =
    typeof target === 'string'
      ? target
      : (target as { import?: unknown } | undefined)?.import;
  if (typeof value !== 'string' || !value.startsWith('./'))
    fail('pack-invalid', `package export ${entry} missing`);
  return value.slice(2);
}

/** The file list placed below `_formicarium/<version>/`, in path order. */
export async function formicariumFiles(packageRoot: string): Promise<{
  manifest: Omit<FormicariumManifest, 'files'>;
  paths: string[];
}> {
  const pkg = (await readJson(
    join(packageRoot, 'package.json'),
  )) as PackageJson;
  if (
    typeof pkg.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(pkg.version)
  )
    fail('pack-invalid', 'package version invalid');
  const root = exportTarget(pkg, '.');
  const browser = exportTarget(pkg, './browser');
  const assets = {
    loader: exportTarget(pkg, './assets/blink.mjs'),
    wasm: exportTarget(pkg, './assets/blink.wasm'),
    worker: WORKER_FILE,
    buildInfo: exportTarget(pkg, './assets/build-info.json'),
  };
  const modules = await moduleGraph(packageRoot, [root, browser]);
  const paths = [
    ...new Set([
      ...modules,
      assets.loader,
      assets.wasm,
      assets.worker,
      assets.buildInfo,
      ...LICENSE_FILES,
    ]),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    manifest: {
      version: pkg.version,
      base: `${FORMICARIUM_DIR}/${pkg.version}/`,
      root,
      browser,
      assets,
    },
    paths,
  };
}

/**
 * Checks the recorded pack (SHA256, then npm pack layout) and extracts it for
 * type resolution, then copies the browser files byte for byte into public/.
 */
export async function stageFormicarium(options: {
  packDir: string;
  publicDir?: string;
  destination?: string;
}): Promise<{ record: PackRecord; manifest: FormicariumManifest }> {
  // The showcase installPack reads the tarball from <work>/pack/.
  if (basename(options.packDir) !== 'pack')
    fail('config-invalid', 'the pack directory must be named pack');
  const record = (await readJson(
    join(options.packDir, 'pack.json'),
  )) as PackRecord;
  const destination =
    options.destination ??
    join(SITE_ROOT, 'node_modules', '@aletheia-works', 'formicarium');
  await installPack(record, {
    layout: workLayout(dirname(options.packDir)),
    destination,
  });
  const { manifest, paths } = await formicariumFiles(destination);
  const publicDir = options.publicDir ?? join(SITE_ROOT, 'public');
  const files: StagedFile[] = [];
  for (const path of paths) {
    let bytes: Buffer;
    try {
      bytes = await readFile(join(destination, path));
    } catch (error) {
      return fail('pack-invalid', `pack file missing: ${path}`, error);
    }
    await writeText(join(publicDir, manifest.base, path), bytes);
    files.push({ path, sha256: sha256(bytes), bytes: bytes.length });
  }
  return { record, manifest: { ...manifest, files } };
}
