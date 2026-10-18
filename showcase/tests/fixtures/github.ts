import { createHash } from 'node:crypto';
import type { FetchLike } from '../../scripts/github.ts';

export const sha = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
export const commit = (seed: string) => sha(seed).slice(0, 40);

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
export const bytes = (body: Uint8Array, status = 200) =>
  new Response(new Uint8Array(body), { status });
export const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });

export type Route = Response | (() => Response | Promise<Response>);
/** Routes by exact URL; an unknown URL is a test failure, not a network call. */
export function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const execute = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new TypeError(`unrouted test URL ${url}`);
    return typeof route === 'function' ? await route() : route.clone();
  }) as FetchLike;
  return Object.assign(execute, { calls });
}

export interface FakeRelease {
  slug: string;
  tag: string;
  commit: string;
  assets?: { name: string; bytes: Uint8Array }[];
  annotated?: boolean;
  license?: string;
}

/** GitHub REST answers for one latest release, its tag and its license. */
export function releaseRoutes(
  release: FakeRelease,
  api = 'https://api.github.com',
) {
  const base = `${api}/repos/${release.slug}`;
  const encoded = release.tag.split('/').map(encodeURIComponent).join('/');
  const tagObject = sha(`tag-object-${release.tag}`).slice(0, 40);
  const routes: Record<string, Route> = {
    [`${base}/releases/latest`]: () =>
      json({
        tag_name: release.tag,
        draft: false,
        prerelease: false,
        assets: (release.assets ?? []).map((asset) => ({
          name: asset.name,
          size: asset.bytes.length,
          digest: `sha256:${sha(asset.bytes)}`,
          browser_download_url: `https://github.com/${release.slug}/releases/download/${encodeURIComponent(release.tag)}/${asset.name}`,
        })),
      }),
    [`${base}/git/ref/tags/${encoded}`]: () =>
      json({
        ref: `refs/tags/${release.tag}`,
        object: release.annotated
          ? { type: 'tag', sha: tagObject }
          : { type: 'commit', sha: release.commit },
      }),
    [`${base}/git/tags/${tagObject}`]: () =>
      json({ object: { type: 'commit', sha: release.commit } }),
    [`${base}/license?ref=${release.commit}`]: () =>
      json({
        path: 'LICENSE',
        encoding: 'base64',
        content: Buffer.from(release.license ?? 'MIT License\n').toString(
          'base64',
        ),
        license: { spdx_id: 'MIT' },
      }),
  };
  for (const asset of release.assets ?? []) {
    routes[`${base}/attestations/sha256:${sha(asset.bytes)}`] = () =>
      json({ message: 'Not Found' }, 404);
    routes[
      `https://github.com/${release.slug}/releases/download/${encodeURIComponent(release.tag)}/${asset.name}`
    ] = () => bytes(asset.bytes);
  }
  return routes;
}
