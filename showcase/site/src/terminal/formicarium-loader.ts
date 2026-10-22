import type * as Root from '@aletheia-works/formicarium';
import type * as Browser from '@aletheia-works/formicarium/browser';

/** Embedded by the build from the staged pack (stage-formicarium.ts). */
export interface FormicariumManifest {
  version: string;
  base: string;
  root: string;
  browser: string;
  assets: { loader: string; wasm: string; worker: string; buildInfo: string };
  files: { path: string; sha256: string; bytes: number }[];
}
export interface LoadedFormicarium {
  root: typeof Root;
  browser: typeof Browser;
  assets: Root.Assets;
}
export type ModuleImporter = (url: string) => Promise<unknown>;

export class LoaderError extends Error {
  constructor(message: string) {
    super(`ASSET_LOAD: ${message}`);
    this.name = 'LoaderError';
  }
}

const VERSION = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * URL of one listed package file below `<site root>_formicarium/`. A path that
 * is not in the embedded list, has `..`, or resolves to another origin or
 * outside that directory is refused.
 */
export function packageUrl(
  manifest: FormicariumManifest,
  siteRoot: URL,
  path: string,
): URL {
  if (
    !VERSION.test(manifest.version) ||
    manifest.base !== `_formicarium/${manifest.version}/`
  )
    throw new LoaderError('formicarium manifest base invalid');
  if (!manifest.files.some((file) => file.path === path))
    throw new LoaderError(`not a staged file: ${path}`);
  if (
    path.split('/').some((part) => part === '..' || part === '' || part === '.')
  )
    throw new LoaderError(`path refused: ${path}`);
  const allowed = new URL('_formicarium/', siteRoot);
  const url = new URL(`${manifest.base}${path}`, siteRoot);
  if (
    url.origin !== siteRoot.origin ||
    !url.pathname.startsWith(allowed.pathname)
  )
    throw new LoaderError(`outside ${allowed.pathname}: ${path}`);
  return url;
}

/** The four public Assets URLs of the same-origin package copy. */
export function packageAssets(
  manifest: FormicariumManifest,
  siteRoot: URL,
): Root.Assets {
  return {
    loaderURL: packageUrl(manifest, siteRoot, manifest.assets.loader).href,
    wasmURL: packageUrl(manifest, siteRoot, manifest.assets.wasm).href,
    workerURL: packageUrl(manifest, siteRoot, manifest.assets.worker).href,
    buildInfoURL: packageUrl(manifest, siteRoot, manifest.assets.buildInfo)
      .href,
  };
}

// The only non-literal dynamic import of the site (boundary.ts allows it here).
const browserImport: ModuleImporter = (url) => import(/* @vite-ignore */ url);

/**
 * Imports the public root and /browser entries from the staged copy; the
 * site's Vite bundle never contains formicarium itself.
 */
export async function loadFormicarium(
  manifest: FormicariumManifest,
  siteRoot: URL,
  importer: ModuleImporter = browserImport,
): Promise<LoadedFormicarium> {
  const assets = packageAssets(manifest, siteRoot);
  const rootUrl = packageUrl(manifest, siteRoot, manifest.root).href;
  const browserUrl = packageUrl(manifest, siteRoot, manifest.browser).href;
  let root: typeof Root;
  let browser: typeof Browser;
  try {
    [root, browser] = (await Promise.all([
      importer(rootUrl),
      importer(browserUrl),
    ])) as [typeof Root, typeof Browser];
  } catch {
    throw new LoaderError(
      `formicarium ${manifest.version} could not be imported`,
    );
  }
  if (
    typeof root?.createCommandSession !== 'function' ||
    typeof browser?.createSession !== 'function'
  )
    throw new LoaderError('formicarium entries lack the public API');
  return { root, browser, assets };
}
