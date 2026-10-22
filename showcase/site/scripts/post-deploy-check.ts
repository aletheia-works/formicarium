import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUniqueJson } from '../../scripts/build-key.ts';
import {
  type SiteIdentity,
  sameSiteIdentity,
  validateSiteIdentity,
} from '../src/model/site-identity.ts';
import { IDENTITY_FILE } from './build-site-identity.ts';
import { fail, runCli, siteLayout, summary, withoutQuery } from './common.ts';

/** Every 30 s, for at most 10 minutes. */
export const POLL_INTERVAL_MS = 30000;
export const POLL_TIMEOUT_MS = 600000;

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}
const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
};

export interface Attempt {
  at: number;
  result: string;
}

/** The deployed identity URL: below page_url, no-store, with this run id. */
export function identityUrl(pageUrl: string, runId: string): URL {
  const base = new URL(pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`);
  if (base.protocol !== 'https:')
    fail('config-invalid', 'page_url must be HTTPS');
  const url = new URL(IDENTITY_FILE, base);
  url.searchParams.set('run', runId);
  return url;
}

async function observe(
  url: URL,
  expected: SiteIdentity,
  fetchImpl: typeof fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
  } catch {
    return 'offline';
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    return `HTTP ${response.status}`;
  }
  try {
    const actual = validateSiteIdentity(parseUniqueJson(await response.text()));
    return sameSiteIdentity(actual, expected)
      ? 'match'
      : `run ${actual.runNumber} / ${actual.candidateId.slice(0, 12)}`;
  } catch {
    return 'invalid identity';
  }
}

/** Polls until the deployed identity names this run; 10 minutes, then fails. */
export async function waitForDeployment(options: {
  pageUrl: string;
  runId: string;
  expected: SiteIdentity;
  fetchImpl?: typeof fetch;
  clock?: Clock;
}): Promise<Attempt[]> {
  const clock = options.clock ?? realClock;
  const url = identityUrl(options.pageUrl, options.runId);
  const started = clock.now();
  const attempts: Attempt[] = [];
  while (true) {
    const result = await observe(
      url,
      options.expected,
      options.fetchImpl ?? globalThis.fetch,
    );
    attempts.push({ at: clock.now() - started, result });
    if (result === 'match') return attempts;
    if (clock.now() - started + POLL_INTERVAL_MS > POLL_TIMEOUT_MS)
      fail(
        'deployment-mismatch',
        `${withoutQuery(url.href)} did not show run ${options.expected.runNumber} within 10 minutes (last: ${result})`,
      );
    await clock.sleep(POLL_INTERVAL_MS);
  }
}

if (import.meta.main)
  await runCli('verify-deployment', async () => {
    const pageUrl = process.env.SHOWCASE_PAGE_URL ?? '';
    const expected = validateSiteIdentity(
      parseUniqueJson(
        await readFile(join(siteLayout().work, 'build', IDENTITY_FILE), 'utf8'),
      ),
    );
    const attempts = await waitForDeployment({
      pageUrl,
      runId: process.env.GITHUB_RUN_ID ?? '0',
      expected,
    });
    await summary(
      `- deployed identity matches run ${expected.runNumber} at ${withoutQuery(pageUrl)} after ${attempts.length} attempt(s)`,
    );
  });
