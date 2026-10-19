import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type Clock,
  identityUrl,
  POLL_INTERVAL_MS,
  waitForDeployment,
} from '../../scripts/post-deploy-check.ts';
import { siteIdentityText } from '../../src/model/site-identity.ts';
import { COMMIT, SHA } from './helpers.ts';

const expected = {
  schemaVersion: 1 as const,
  runNumber: 42,
  sourceCommit: COMMIT,
  candidateId: SHA,
};
const PAGE = 'https://aletheia-works.github.io/formicarium/';

function fakeClock(): Clock & { slept: number[] } {
  let time = 0;
  const slept: number[] = [];
  return {
    slept,
    now: () => time,
    async sleep(ms) {
      slept.push(ms);
      time += ms;
    },
  };
}
const answers = (...responses: (() => Response)[]) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let index = 0;
  const fetchImpl = (async (url: URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses[Math.min(index++, responses.length - 1)]!;
    return next();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};
const identity =
  (value = expected) =>
  () =>
    new Response(siteIdentityText(value));

test('the identity URL is below page_url with the run id, and HTTPS only', () => {
  assert.equal(
    identityUrl(PAGE, '123').href,
    `${PAGE}site-identity.json?run=123`,
  );
  assert.equal(
    identityUrl(PAGE.slice(0, -1), '1').href,
    `${PAGE}site-identity.json?run=1`,
  );
  assert.throws(() => identityUrl('http://example.com/', '1'), /HTTPS/);
});

test('a matching identity ends the wait at once, read with no-store', async () => {
  const { calls, fetchImpl } = answers(identity());
  const attempts = await waitForDeployment({
    pageUrl: PAGE,
    runId: '99',
    expected,
    fetchImpl,
    clock: fakeClock(),
  });
  assert.deepEqual(attempts, [{ at: 0, result: 'match' }]);
  assert.equal(calls[0]!.init?.cache, 'no-store');
  assert.equal(calls[0]!.init?.credentials, 'omit');
});

test('404, offline and the previous site are retried every 30 s until they match', async () => {
  const clock = fakeClock();
  const { fetchImpl } = answers(
    () => new Response('missing', { status: 404 }),
    () => {
      throw new TypeError('offline');
    },
    identity({ ...expected, runNumber: 41 }),
    identity(),
  );
  const attempts = await waitForDeployment({
    pageUrl: PAGE,
    runId: '99',
    expected,
    fetchImpl,
    clock,
  });
  assert.deepEqual(
    attempts.map((item) => item.result),
    ['HTTP 404', 'offline', `run 41 / ${SHA.slice(0, 12)}`, 'match'],
  );
  assert.deepEqual(clock.slept, [
    POLL_INTERVAL_MS,
    POLL_INTERVAL_MS,
    POLL_INTERVAL_MS,
  ]);
});

test('no match within 10 minutes fails the job (fake clock)', async () => {
  const clock = fakeClock();
  const { calls, fetchImpl } = answers(
    identity({ ...expected, candidateId: 'f'.repeat(64) }),
  );
  await assert.rejects(
    waitForDeployment({
      pageUrl: PAGE,
      runId: '99',
      expected,
      fetchImpl,
      clock,
    }),
    (error: unknown) =>
      error instanceof Error &&
      /deployment-mismatch/.test(error.message) &&
      !error.message.includes('?run='),
  );
  // Attempts at 0 s, 30 s, ... 600 s: the last one at the 10 minute mark.
  assert.equal(calls.length, 21);
  assert.equal(clock.now(), 600000);
});

test('an identity file that is not valid JSON identity counts as a failed attempt', async () => {
  const clock = fakeClock();
  const { fetchImpl } = answers(
    () => new Response('{"runNumber":42}'),
    identity(),
  );
  const attempts = await waitForDeployment({
    pageUrl: PAGE,
    runId: '1',
    expected,
    fetchImpl,
    clock,
  });
  assert.deepEqual(
    attempts.map((item) => item.result),
    ['invalid identity', 'match'],
  );
});
