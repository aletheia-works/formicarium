import type { RelayOptions } from '@aletheia-works/formicarium';
import {
  decodeJson,
  FetchFailure,
  type FetchLimitedOptions,
  fetchLimited,
  type Timers,
} from './fetch-limited.ts';

/**
 * The site's relay (infra/aws relay.tf, output `relay_token_url`): a Lambda
 * function URL that answers GET from https://aletheia-works.github.io only,
 * with the relay's WebSocket URL and a token in its subprotocols.
 */
export const RELAY_TOKEN_URL =
  'https://wge67yvaiqhmeesmsze62m3bom0gstwg.lambda-url.ap-northeast-1.on.aws/';
/** The relay's WebSocket URLs: one Lambda MicroVM of this region. */
export const RELAY_SOCKET_SOURCE =
  'wss://*.lambda-microvm.ap-northeast-1.on.aws';
/** Where network tools may connect; the relay allows only this too. */
export const RELAY_ALLOW: readonly string[] = Object.freeze(['github.com:443']);
/** The connect-src sources the terminal pages add for the relay. */
export const RELAY_CONNECT_SOURCES: readonly string[] = Object.freeze([
  new URL(RELAY_TOKEN_URL).origin,
  RELAY_SOCKET_SOURCE,
]);

/** Page data `relay`: the token function and the allow list. */
export interface RelaySettings {
  tokenUrl: string;
  allow: string[];
}
export const SITE_RELAY: RelaySettings = {
  tokenUrl: RELAY_TOKEN_URL,
  allow: [...RELAY_ALLOW],
};

/** A token answer is small; the function may start a MicroVM first (20 s). */
export const MAX_TOKEN_BYTES = 16384;
export const TOKEN_DEADLINE_MS = 60000;
/** A token is reused until this long before it expires. */
export const TOKEN_MARGIN_MS = 60000;
/** The function's tokens last 15 minutes; a day is far beyond any answer. */
const MAX_TOKEN_MINUTES = 1440;
const PROTOCOL = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** The relay's token could not be had: the run must not start. */
export class RelayUnavailable extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RelayUnavailable';
  }
}

/** Checks the function's answer: a wss: URL, its protocols and a lifetime. */
export function parseToken(value: unknown): {
  relay: RelayOptions;
  minutes: number;
} {
  const answer = value as {
    url?: unknown;
    protocols?: unknown;
    expiresInMinutes?: unknown;
  } | null;
  let url: URL | null = null;
  try {
    if (typeof answer?.url === 'string') url = new URL(answer.url);
  } catch {
    // Refused below.
  }
  const protocols = answer?.protocols;
  const minutes = answer?.expiresInMinutes;
  if (
    url?.protocol !== 'wss:' ||
    url.username ||
    url.password ||
    (answer!.url as string).includes('#') ||
    !Array.isArray(protocols) ||
    protocols.length > 8 ||
    !protocols.every(
      (protocol) =>
        typeof protocol === 'string' &&
        protocol.length <= 4096 &&
        PROTOCOL.test(protocol),
    ) ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    minutes > MAX_TOKEN_MINUTES
  )
    throw new RelayUnavailable('the relay token is invalid');
  return {
    relay: { url: answer!.url as string, protocols: [...protocols] },
    minutes,
  };
}

export interface RelayTokensOptions {
  tokenUrl: string;
  fetchImpl?: typeof fetch;
  timers?: Timers;
  now?: () => number;
}

/**
 * The relay options of the network runs: one GET of the token function,
 * reused until a minute before the token expires. The lifetime counts from
 * before the request, so a slow answer only shortens the reuse.
 */
export class RelayTokens {
  readonly #options: RelayTokensOptions;
  #cached: { relay: RelayOptions; refreshAt: number } | null = null;

  constructor(options: RelayTokensOptions) {
    this.#options = options;
  }

  /**
   * The relay for one run. Aborting `signal` rejects with the FetchFailure
   * `aborted`; any other failure is a RelayUnavailable.
   */
  async get(signal: AbortSignal): Promise<RelayOptions> {
    const now = this.#options.now ?? Date.now;
    const started = now();
    if (this.#cached && started < this.#cached.refreshAt)
      return copy(this.#cached.relay);
    this.#cached = null;
    const fetchOptions: FetchLimitedOptions = {
      maxBytes: MAX_TOKEN_BYTES,
      deadlineMs: TOKEN_DEADLINE_MS,
      signal,
      fetchImpl: this.#options.fetchImpl,
      timers: this.#options.timers,
    };
    let token: ReturnType<typeof parseToken>;
    try {
      token = parseToken(
        decodeJson(
          await fetchLimited(this.#options.tokenUrl, fetchOptions),
          this.#options.tokenUrl,
        ),
      );
    } catch (error) {
      if (error instanceof FetchFailure && error.kind === 'aborted')
        throw error;
      if (error instanceof RelayUnavailable) throw error;
      throw new RelayUnavailable(
        error instanceof Error ? error.message : 'the relay token failed',
        { cause: error },
      );
    }
    this.#cached = {
      relay: token.relay,
      refreshAt: started + token.minutes * 60000 - TOKEN_MARGIN_MS,
    };
    return copy(token.relay);
  }
}

const copy = (relay: RelayOptions): RelayOptions => ({
  url: relay.url,
  protocols: [...(relay.protocols ?? [])],
});
