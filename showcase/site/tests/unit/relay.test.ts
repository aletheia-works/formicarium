import assert from 'node:assert/strict';
import test from 'node:test';
import { FetchFailure } from '../../src/terminal/fetch-limited.ts';
import {
  MAX_TOKEN_BYTES,
  parseToken,
  RELAY_ALLOW,
  RELAY_TOKEN_URL,
  RelayTokens,
  RelayUnavailable,
  SITE_RELAY,
  TOKEN_DEADLINE_MS,
} from '../../src/terminal/relay.ts';
import { chunked, fakeTimers } from './helpers.ts';

const answer = {
  url: 'wss://abc.lambda-microvm.ap-northeast-1.on.aws/',
  protocols: [
    'lambda-microvms',
    'lambda-microvms.authentication.token',
    'lambda-microvms.port.8080',
  ],
  expiresInMinutes: 15,
};

test('the site relay is the AWS token function and github.com:443 only', () => {
  assert.equal(
    RELAY_TOKEN_URL,
    'https://wge67yvaiqhmeesmsze62m3bom0gstwg.lambda-url.ap-northeast-1.on.aws/',
  );
  assert.deepEqual(RELAY_ALLOW, ['github.com:443']);
  assert.deepEqual(SITE_RELAY, {
    tokenUrl: RELAY_TOKEN_URL,
    allow: ['github.com:443'],
  });
});

test('a token answer is a wss: URL, protocol tokens and a lifetime', () => {
  assert.deepEqual(parseToken(answer), {
    relay: { url: answer.url, protocols: answer.protocols },
    minutes: 15,
  });
  for (const bad of [
    null,
    'x',
    { ...answer, url: 'ws://abc.test/' },
    { ...answer, url: 'https://abc.test/' },
    { ...answer, url: 'wss://user:pw@abc.test/' },
    { ...answer, url: 'wss://abc.test/#x' },
    { ...answer, url: 'not a url' },
    { ...answer, url: 1 },
    { ...answer, protocols: 'lambda-microvms' },
    { ...answer, protocols: ['has space'] },
    { ...answer, protocols: [1] },
    { ...answer, protocols: Array.from({ length: 9 }, (_, i) => `p${i}`) },
    { ...answer, protocols: ['x'.repeat(4097)] },
    { ...answer, expiresInMinutes: 0 },
    { ...answer, expiresInMinutes: -1 },
    { ...answer, expiresInMinutes: 1441 },
    { ...answer, expiresInMinutes: '15' },
    { ...answer, expiresInMinutes: Number.NaN },
    { error: 'the relay is unavailable' },
  ])
    assert.throws(() => parseToken(bad), RelayUnavailable, JSON.stringify(bad));
});

test('the token GET is bounded in size and time; an abort is not a relay failure', async () => {
  const encode = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value));
  // Too large: refused as unavailable before parsing.
  const large = new RelayTokens({
    tokenUrl: RELAY_TOKEN_URL,
    fetchImpl: (async () =>
      chunked([
        new Uint8Array(MAX_TOKEN_BYTES + 1),
      ])) as unknown as typeof fetch,
  });
  await assert.rejects(large.get(new AbortController().signal), (error) => {
    assert.ok(error instanceof RelayUnavailable);
    assert.match(error.message, /size-limit/);
    return true;
  });
  // The deadline: the fake clock fires the timer the token GET armed.
  const clock = fakeTimers();
  let armed = 0;
  const slow = new RelayTokens({
    tokenUrl: RELAY_TOKEN_URL,
    timers: {
      setTimeout(callback, ms) {
        armed = ms;
        return clock.timers.setTimeout(callback, ms);
      },
      clearTimeout: clock.timers.clearTimeout,
    },
    fetchImpl: ((_url: string, init: RequestInit) =>
      new Promise((_done, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        ),
      )) as unknown as typeof fetch,
  });
  const pending = slow.get(new AbortController().signal);
  await new Promise((done) => setImmediate(done));
  clock.fire();
  await assert.rejects(pending, (error) => {
    assert.ok(error instanceof RelayUnavailable);
    assert.match(error.message, /deadline/);
    return true;
  });
  assert.equal(armed, TOKEN_DEADLINE_MS);
  // An aborted run rejects with the FetchFailure `aborted`, not unavailable.
  const run = new AbortController();
  run.abort();
  await assert.rejects(
    new RelayTokens({
      tokenUrl: RELAY_TOKEN_URL,
      fetchImpl: (async () =>
        chunked([encode(answer)])) as unknown as typeof fetch,
    }).get(run.signal),
    (error) => error instanceof FetchFailure && error.kind === 'aborted',
  );
  // The cached relay is a copy: changing what one run got changes no other.
  const tokens = new RelayTokens({
    tokenUrl: RELAY_TOKEN_URL,
    fetchImpl: (async () =>
      chunked([encode(answer)])) as unknown as typeof fetch,
  });
  const first = await tokens.get(new AbortController().signal);
  (first.protocols as string[]).push('changed');
  assert.deepEqual(
    (await tokens.get(new AbortController().signal)).protocols,
    answer.protocols,
  );
});
