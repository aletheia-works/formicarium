import type { GuestCatalog } from '@aletheia-works/formicarium';
import {
  decodeJson,
  FetchFailure,
  type FetchLimitedOptions,
  fetchVerified,
  MAX_CATALOG_BYTES,
} from './fetch-limited.ts';

/** The site root (`<origin>/formicarium/`) seen from any page of the site. */
export const siteRootFrom = (pageUrl: string, basePath: string) =>
  new URL(basePath.endsWith('/') ? basePath : `${basePath}/`, pageUrl);

/**
 * Resolves every entry url against the site root (BR5.1): the same guest URL
 * from /terminal/, /tools/<tool>/ and the /ja/ pages. Absolute URLs, other
 * origins and `..` segments are refused before the public API sees them.
 */
export function resolveCatalog(
  catalog: GuestCatalog,
  siteRoot: URL,
): GuestCatalog {
  const root = new URL(
    siteRoot.href.endsWith('/') ? siteRoot.href : `${siteRoot.href}/`,
  );
  return {
    ...catalog,
    entries: catalog.entries.map((entry) => {
      const raw = entry.url;
      if (
        typeof raw !== 'string' ||
        raw === '' ||
        /^[a-z][a-z0-9+.-]*:/i.test(raw) ||
        raw.startsWith('/') ||
        raw.includes('\\') ||
        raw.split(/[?#]/)[0]!.split('/').includes('..')
      )
        throw new FetchFailure(
          'bad-body',
          root.href,
          `catalog url refused: ${raw}`,
        );
      const url = new URL(raw, root);
      if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
        throw new FetchFailure(
          'bad-body',
          root.href,
          `catalog url leaves the site: ${raw}`,
        );
      return { ...entry, url: url.href };
    }),
  };
}

/**
 * Fetches catalog.json, checks the SHA256 embedded at build time, and
 * resolves its URLs. Its schema is checked by the public createCommandSession.
 */
export async function loadCatalog(options: {
  url: string;
  sha256: string;
  siteRoot: URL;
  fetch?: Omit<FetchLimitedOptions, 'maxBytes'>;
}): Promise<GuestCatalog> {
  const bytes = await fetchVerified(options.url, options.sha256, {
    ...options.fetch,
    maxBytes: MAX_CATALOG_BYTES,
  });
  const catalog = decodeJson(bytes, options.url) as GuestCatalog;
  if (
    !catalog ||
    typeof catalog !== 'object' ||
    !Array.isArray(catalog.entries)
  )
    throw new FetchFailure('bad-body', options.url, 'catalog entries missing');
  return resolveCatalog(catalog, options.siteRoot);
}
