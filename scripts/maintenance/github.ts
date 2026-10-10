import { BoundaryError, decodeJson, readBoundedStream } from './archive.ts';

export type HttpTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
export interface ApiClock {
  now(): number;
  schedule(callback: () => void, milliseconds: number): () => void;
}
const clock: ApiClock = {
  now: () => Date.now(),
  schedule(callback, milliseconds) {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
};
export class GitHubApi {
  private readonly started: number;
  private readonly token: string;
  private readonly transport: HttpTransport;
  private readonly timing: ApiClock;
  private readonly signal: AbortSignal | undefined;
  constructor(
    token: string,
    transport: HttpTransport = fetch,
    timing: ApiClock = clock,
    signal?: AbortSignal,
  ) {
    this.token = token;
    this.transport = transport;
    this.timing = timing;
    this.signal = signal;
    this.started = timing.now();
  }
  private url(path: string): URL {
    const url = new URL(path, 'https://api.github.com');
    if (
      url.origin !== 'https://api.github.com' ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname.startsWith('/')
    )
      throw new BoundaryError('INVALID_ENDPOINT');
    return url;
  }
  private async request(
    path: string,
    method: string,
    body?: unknown,
    redirectHosts: readonly string[] = [],
  ): Promise<{ bytes: Uint8Array; headers: Headers }> {
    const write = method !== 'GET';
    const target = this.url(path);
    for (let attempt = 0; attempt <= (write ? 0 : 2); attempt++) {
      if (this.signal?.aborted) throw new BoundaryError('CANCELLED');
      const remaining = 60000 - (this.timing.now() - this.started);
      if (remaining <= 0) throw new BoundaryError('READ_BUDGET');
      const controller = new AbortController();
      const cancel = () => controller.abort();
      this.signal?.addEventListener('abort', cancel, { once: true });
      let timedOut = false;
      let rejectTimeout: (reason: Error) => void = () => {};
      const timeout = new Promise<never>((_, reject) => {
        rejectTimeout = reject;
      });
      const unschedule = this.timing.schedule(
        () => {
          timedOut = true;
          controller.abort();
          rejectTimeout(new BoundaryError('REQUEST_TIMEOUT'));
        },
        Math.min(10000, remaining),
      );
      try {
        const perform = async () => {
          const headers = {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          };
          let response = await this.transport(target.href, {
            method,
            headers,
            redirect: 'manual',
            signal: controller.signal,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (write || !redirectHosts.length)
              throw new BoundaryError('REDIRECT_REJECTED');
            const location = response.headers.get('location');
            if (!location) throw new BoundaryError('REDIRECT_REJECTED');
            const redirect = new URL(location);
            if (
              redirect.protocol !== 'https:' ||
              !redirectHosts.includes(redirect.hostname) ||
              redirect.username ||
              redirect.password
            )
              throw new BoundaryError('REDIRECT_REJECTED');
            await response.body?.cancel();
            // Signed archive redirects must never receive the GitHub bearer token.
            response = await this.transport(redirect.href, {
              method: 'GET',
              redirect: 'error',
              signal: controller.signal,
            });
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new BoundaryError(
              response.status === 429 || response.status >= 500
                ? 'RETRYABLE_HTTP'
                : 'HTTP_REJECTED',
            );
          }
          return {
            bytes: await readBoundedStream(
              response.body,
              undefined,
              controller.signal,
            ),
            headers: response.headers,
          };
        };
        return await Promise.race([perform(), timeout]);
      } catch (error) {
        if (this.signal?.aborted) throw new BoundaryError('CANCELLED');
        const retry =
          error instanceof BoundaryError
            ? ['RETRYABLE_HTTP', 'REQUEST_TIMEOUT'].includes(error.code)
            : true;
        if (write || !retry || attempt === 2)
          throw error instanceof BoundaryError
            ? error
            : new BoundaryError(
                timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_UNKNOWN',
              );
      } finally {
        unschedule();
        this.signal?.removeEventListener('abort', cancel);
      }
    }
    throw new BoundaryError('READ_BUDGET');
  }
  async json(path: string): Promise<unknown> {
    return decodeJson((await this.request(path, 'GET')).bytes);
  }
  async bytes(
    path: string,
    redirectHosts: readonly string[] = [],
  ): Promise<Uint8Array> {
    return (await this.request(path, 'GET', undefined, redirectHosts)).bytes;
  }
  async writeJson(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: unknown,
  ): Promise<unknown> {
    return decodeJson((await this.request(path, method, body)).bytes);
  }
  async pages(path: string, collection: string): Promise<unknown[]> {
    let next: string | null = path;
    const rows: unknown[] = [];
    const first = this.url(path);
    const seen = new Set<string>();
    for (let page = 0; next && page < 10; page++) {
      const url = this.url(next);
      if (url.pathname !== first.pathname || seen.has(url.href))
        throw new BoundaryError('PAGINATION_REJECTED');
      seen.add(url.href);
      const response = await this.request(url.href, 'GET');
      const parsed = decodeJson(response.bytes) as Record<string, unknown>;
      const values = Array.isArray(parsed) ? parsed : parsed?.[collection];
      if (
        !Array.isArray(values) ||
        values.length > 100 ||
        rows.length + values.length > 1000
      )
        throw new BoundaryError('PAGINATION_REJECTED');
      rows.push(...values);
      const links = response.headers.get('link') ?? '';
      next = links.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    if (next) throw new BoundaryError('PAGINATION_REJECTED');
    return rows;
  }
}
