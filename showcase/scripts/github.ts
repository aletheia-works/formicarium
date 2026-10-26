import { parseUniqueJson } from './build-key.ts';
import { type CauseCode, fail, ShowcaseError } from './errors.ts';
import { MAX_API_BODY_BYTES, TRANSFER_POLICY } from './limits.ts';

export type FetchLike = typeof fetch;
export interface GitHubApi {
  /** GET a REST path (no leading slash). Every failure is classified. */
  get(path: string): Promise<unknown>;
  /** Like get, but 404 resolves to null. */
  getOptional(path: string): Promise<unknown | null>;
  /** GET a path that answers with a redirect; returns the Location only. */
  redirectLocation(path: string): Promise<string>;
}
export interface GitHubApiOptions {
  token?: string;
  fetchImpl?: FetchLike;
  apiBase?: string;
  deadlineMs?: number;
}

/** The system error code under a fetch failure (ECONNRESET, UND_ERR_*). */
function systemCode(error: unknown): string | null {
  for (let item = error, depth = 0; item && depth < 4; depth++) {
    const code = (item as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code))
      return code;
    item = (item as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Maps a transport exception without echoing request headers or bodies.
 * `where` is the request without its query (signed URLs carry tokens).
 */
export function transportFailure(
  error: unknown,
  timedOut: boolean,
  where?: string,
): never {
  if (error instanceof ShowcaseError) throw error;
  const detail = [where, systemCode(error)].filter(Boolean).join(', ');
  const suffix = detail ? ` (${detail})` : '';
  if (timedOut) fail('deadline', `request deadline exceeded${suffix}`);
  return fail('offline', `network request failed${suffix}`, error);
}

export function statusCause(response: Response): CauseCode {
  if (response.status === 429) return 'rate-limit';
  if (
    response.status === 403 &&
    response.headers.get('x-ratelimit-remaining') === '0'
  )
    return 'rate-limit';
  return 'http-status';
}

/** Reads at most `limit` bytes; the declared Content-Length is not trusted. */
/** Releases an unread body without waiting: a tee'd stream cancels late. */
export function discardBody(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}

export async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  if (!response.body) fail('bad-body', 'response has no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.length;
      if (!Number.isSafeInteger(received) || received > limit)
        fail('size-limit', `response exceeds ${limit} bytes`);
      chunks.push(chunk.value);
    }
  } catch (error) {
    // Not awaited: a tee'd or stalled stream resolves its cancel only later.
    void reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function createGitHubApi(options: GitHubApiOptions = {}): GitHubApi {
  const execute = options.fetchImpl ?? globalThis.fetch;
  const base = options.apiBase ?? 'https://api.github.com';
  const deadline = options.deadlineMs ?? TRANSFER_POLICY.fetchDeadlineMs;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'formicarium-showcase',
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  async function request(
    path: string,
    redirect: RequestRedirect,
    optional: boolean,
  ): Promise<{ response: Response; body: Uint8Array | null } | null> {
    if (path.startsWith('/') || /[\s\\]/.test(path))
      fail('config-invalid', 'GitHub API path invalid');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, deadline);
    try {
      const response = await execute(`${base}/${path}`, {
        headers,
        redirect,
        signal: controller.signal,
      });
      if (optional && response.status === 404) {
        discardBody(response);
        return null;
      }
      if (
        redirect === 'manual' &&
        response.status >= 300 &&
        response.status < 400
      ) {
        discardBody(response);
        return { response, body: null };
      }
      if (!response.ok) {
        discardBody(response);
        fail(statusCause(response), `GitHub API answered ${response.status}`);
      }
      return {
        response,
        body: await readBounded(response, MAX_API_BODY_BYTES),
      };
    } catch (error) {
      return transportFailure(error, timedOut, `${base}/${path.split('?')[0]}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const json = (body: Uint8Array | null) => {
    let raw: string;
    try {
      raw = new TextDecoder('utf-8', { fatal: true }).decode(
        body ?? new Uint8Array(),
      );
    } catch (error) {
      return fail('bad-body', 'GitHub API body is not UTF-8', error);
    }
    return parseUniqueJson(raw);
  };
  return {
    async get(path) {
      return json((await request(path, 'error', false))!.body);
    },
    async getOptional(path) {
      const result = await request(path, 'error', true);
      return result === null ? null : json(result.body);
    },
    async redirectLocation(path) {
      const { response } = (await request(path, 'manual', false))!;
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location)
        fail('redirect', 'GitHub API download did not redirect');
      return location;
    },
  };
}

/**
 * owner/repo of a https://github.com/<owner>/<repo> URL. The allow list also
 * takes Savannah git URLs, but config.ts gives only GitHub repositories to the
 * acquire kinds that call this.
 */
export function repositorySlug(repository: string): string {
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.exec(
      repository,
    );
  if (!match) fail('config-invalid', `repository URL invalid: ${repository}`);
  return match[1]!;
}

/** Tag names may contain '/' and '@' (Biome); each path segment is encoded. */
export const encodeTag = (tag: string) =>
  tag.split('/').map(encodeURIComponent).join('/');
