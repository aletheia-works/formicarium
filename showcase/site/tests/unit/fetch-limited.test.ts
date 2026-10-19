import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeJson,
  FetchFailure,
  fetchLimited,
  fetchVerified,
  sha256Hex,
} from '../../src/terminal/fetch-limited.ts';
import { chunked, fakeTimers } from './helpers.ts';

const URL_WITH_QUERY =
  'https://localhost/formicarium/catalog.json?token=secret#x';
const failsWith = async (kind: string, run: () => Promise<unknown>) =>
  assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FetchFailure, String(error));
    assert.equal(error.kind, kind);
    assert.equal(error.url, 'https://localhost/formicarium/catalog.json');
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });

test('returns the body and sends no credentials, no redirect and no retry', async () => {
  const calls: RequestInit[] = [];
  const bytes = await fetchLimited(URL_WITH_QUERY, {
    maxBytes: 10,
    fetchImpl: async (_url, init) => {
      calls.push(init!);
      return chunked([new Uint8Array([1, 2]), new Uint8Array([3])]);
    },
  });
  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.credentials, 'omit');
  assert.equal(calls[0]!.redirect, 'error');
});

test('the streamed total is bounded: limit -1 and limit pass, limit +1 fails', async () => {
  const body = (size: number) => async () =>
    chunked([new Uint8Array(size - 1), new Uint8Array(1)], {
      status: 200,
      headers: { 'content-length': '1' },
    });
  for (const size of [99, 100])
    assert.equal(
      (
        await fetchLimited(URL_WITH_QUERY, {
          maxBytes: 100,
          fetchImpl: body(size),
        })
      ).length,
      size,
    );
  await failsWith('size-limit', () =>
    fetchLimited(URL_WITH_QUERY, { maxBytes: 100, fetchImpl: body(101) }),
  );
});

test('a non-2xx answer and an offline network are classified', async () => {
  await failsWith('http-status', () =>
    fetchLimited(URL_WITH_QUERY, {
      maxBytes: 10,
      fetchImpl: async () => new Response('missing', { status: 404 }),
    }),
  );
  await failsWith('offline', () =>
    fetchLimited(URL_WITH_QUERY, {
      maxBytes: 10,
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    }),
  );
});

/** A response that only ends when its signal aborts (a slow server). */
const hanging: typeof fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });

test('a response slower than the 120 s deadline fails as deadline (fake clock)', async () => {
  const clock = fakeTimers();
  const pending = fetchLimited(URL_WITH_QUERY, {
    maxBytes: 10,
    fetchImpl: hanging,
    timers: clock.timers,
  });
  assert.equal(clock.pending, 1);
  clock.fire();
  await failsWith('deadline', () => pending);
});

test('pagehide cancellation aborts the request and leaves no timer behind', async () => {
  const clock = fakeTimers();
  const controller = new AbortController();
  const pending = fetchLimited(URL_WITH_QUERY, {
    maxBytes: 10,
    fetchImpl: hanging,
    signal: controller.signal,
    timers: clock.timers,
  });
  controller.abort();
  await failsWith('aborted', () => pending);
  assert.equal(clock.pending, 0);
  const already = new AbortController();
  already.abort();
  await failsWith('aborted', () =>
    fetchLimited(URL_WITH_QUERY, {
      maxBytes: 10,
      fetchImpl: hanging,
      signal: already.signal,
    }),
  );
});

test('fetchVerified refuses bytes whose SHA256 differs from the embedded value', async () => {
  const bytes = new TextEncoder().encode('{"a":1}');
  const fetchImpl = async () => chunked([bytes]);
  const digest = await sha256Hex(bytes);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    await fetchVerified(URL_WITH_QUERY, digest, { maxBytes: 100, fetchImpl }),
    bytes,
  );
  await failsWith('digest-mismatch', () =>
    fetchVerified(URL_WITH_QUERY, 'f'.repeat(64), { maxBytes: 100, fetchImpl }),
  );
});

test('decodeJson accepts UTF-8 JSON only', () => {
  assert.deepEqual(
    decodeJson(new TextEncoder().encode('{"a":"日本"}'), URL_WITH_QUERY),
    { a: '日本' },
  );
  assert.throws(
    () => decodeJson(new Uint8Array([0xff, 0xfe]), URL_WITH_QUERY),
    FetchFailure,
  );
  assert.throws(
    () => decodeJson(new TextEncoder().encode('{'), URL_WITH_QUERY),
    /bad-body/,
  );
});
