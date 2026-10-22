/** fetchDeadlineMs and the page fetch bounds. */
export const FETCH_DEADLINE_MS = 120000;
export const MAX_CATALOG_BYTES = 4194304;
export const MAX_FIXTURE_INDEX_BYTES = 268435456;

export type FetchFailureKind =
  | 'http-status'
  | 'offline'
  | 'deadline'
  | 'aborted'
  | 'size-limit'
  | 'digest-mismatch'
  | 'bad-body';

/** A page fetch that failed; `url` never carries a query or fragment. */
export class FetchFailure extends Error {
  readonly kind: FetchFailureKind;
  readonly url: string;
  constructor(kind: FetchFailureKind, url: string, detail: string) {
    super(`${kind}: ${detail} (${url})`);
    this.name = 'FetchFailure';
    this.kind = kind;
    this.url = url;
  }
}

export function displayUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
const realTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface FetchLimitedOptions {
  maxBytes: number;
  /** Aborted on pagehide by the terminal host. */
  signal?: AbortSignal;
  deadlineMs?: number;
  fetchImpl?: typeof fetch;
  timers?: Timers;
}

/**
 * One GET without credentials or retry. The deadline covers the response and
 * the whole body; the body is bounded by the streamed total, not by
 * Content-Length.
 */
export async function fetchLimited(
  url: string,
  options: FetchLimitedOptions,
): Promise<Uint8Array> {
  const shown = displayUrl(url);
  // A page that is already leaving starts no request and no deadline timer.
  if (options.signal?.aborted)
    throw new FetchFailure('aborted', shown, 'request cancelled');
  const timers = options.timers ?? realTimers;
  const controller = new AbortController();
  let timedOut = false;
  const timer = timers.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.deadlineMs ?? FETCH_DEADLINE_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const failure = (error: unknown): never => {
    if (error instanceof FetchFailure) throw error;
    if (timedOut)
      throw new FetchFailure('deadline', shown, 'deadline exceeded');
    if (options.signal?.aborted)
      throw new FetchFailure('aborted', shown, 'request cancelled');
    throw new FetchFailure('offline', shown, 'network request failed');
  };
  try {
    let response: Response;
    try {
      response = await (options.fetchImpl ?? globalThis.fetch)(url, {
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      });
    } catch (error) {
      return failure(error);
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw new FetchFailure('http-status', shown, `HTTP ${response.status}`);
    }
    if (!response.body) throw new FetchFailure('bad-body', shown, 'no body');
    return await readBounded(response.body, options.maxBytes, shown).catch(
      failure,
    );
  } finally {
    timers.clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function readBounded(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  shown: string,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.length;
      if (received > maxBytes)
        throw new FetchFailure(
          'size-limit',
          shown,
          `exceeds ${maxBytes} bytes`,
        );
      chunks.push(chunk.value);
    }
  } catch (error) {
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

/** Lowercase hex SHA256 through Web Crypto (browser and Node). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Fetches, then refuses bytes whose SHA256 differs from the embedded value. */
export async function fetchVerified(
  url: string,
  expectedSha256: string,
  options: FetchLimitedOptions,
): Promise<Uint8Array> {
  const bytes = await fetchLimited(url, options);
  if ((await sha256Hex(bytes)) !== expectedSha256)
    throw new FetchFailure(
      'digest-mismatch',
      displayUrl(url),
      'SHA256 differs',
    );
  return bytes;
}

export function decodeJson(bytes: Uint8Array, url: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new FetchFailure('bad-body', displayUrl(url), 'not UTF-8 JSON');
  }
}
