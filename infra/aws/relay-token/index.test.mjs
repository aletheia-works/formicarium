// The relay token function, without AWS: the SigV4 signer against AWS's
// published test vectors, and the MicroVM flow against a stand-in API.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  handler,
  microvms,
  relayOptions,
  settings,
  sharedMicrovm,
  sign,
} from './index.mjs';

// From the AWS Signature Version 4 test suite (get-vanilla and its relatives).
const VECTOR = {
  host: 'example.amazonaws.com',
  service: 'service',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  },
  date: new Date('2015-08-30T12:36:00Z'),
};
const CREDENTIAL =
  'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date';

test('sign matches the get-vanilla test vector', () => {
  const headers = sign({ ...VECTOR, method: 'GET', path: '/' });
  assert.equal(headers['x-amz-date'], '20150830T123600Z');
  assert.equal(
    headers.authorization,
    `${CREDENTIAL}, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31`,
  );
});

test('sign sorts the query as get-vanilla-query-order-key-case does', () => {
  const headers = sign({
    ...VECTOR,
    method: 'GET',
    path: '/',
    query: { Param2: 'value2', Param1: 'value1' },
  });
  assert.equal(
    headers.authorization,
    `${CREDENTIAL}, Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500`,
  );
});

test('sign matches the post-vanilla test vector', () => {
  const headers = sign({ ...VECTOR, method: 'POST', path: '/' });
  assert.equal(
    headers.authorization,
    `${CREDENTIAL}, Signature=5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b`,
  );
});

test('sign signs the session token and the JSON body type', () => {
  const headers = sign({
    ...VECTOR,
    credentials: { ...VECTOR.credentials, sessionToken: 'token' },
    method: 'POST',
    path: '/',
    body: '{}',
  });
  assert.equal(headers['x-amz-security-token'], 'token');
  assert.equal(headers['content-type'], 'application/json');
  assert.match(
    headers.authorization,
    /SignedHeaders=content-type;host;x-amz-date;x-amz-security-token,/,
  );
});

const ENV = {
  AWS_REGION: 'ap-northeast-1',
  AWS_ACCESS_KEY_ID: 'AKIDEXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'secret',
  RELAY_IMAGE_ARN:
    'arn:aws:lambda:ap-northeast-1:123456789012:microvm-image:formicarium-relay',
  RELAY_ORIGIN: 'https://aletheia-works.github.io',
  RELAY_INGRESS_CONNECTOR: 'ingress',
  RELAY_EGRESS_CONNECTOR: 'egress',
};

test('settings refuses a missing setting and fills the defaults', () => {
  assert.throws(
    () => settings({ ...ENV, RELAY_IMAGE_ARN: '' }),
    /RELAY_IMAGE_ARN/,
  );
  const config = settings(ENV);
  assert.equal(config.tokenMinutes, 15);
  assert.deepEqual(config.idlePolicy, {
    autoResumeEnabled: true,
    maxIdleDurationSeconds: 300,
    suspendedDurationSeconds: 3600,
  });
  assert.equal(config.maximumDurationInSeconds, 28_800);
});

test('microvms calls the MicroVMs REST API at the regional Lambda host', async () => {
  const requests = [];
  const api = microvms(settings(ENV), async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  });
  await api.list(ENV.RELAY_IMAGE_ARN);
  await api.token('mvm-1', { expirationInMinutes: 15 });
  assert.equal(
    requests[0].url,
    `https://lambda.ap-northeast-1.amazonaws.com/2025-09-09/microvms?imageIdentifier=${encodeURIComponent(ENV.RELAY_IMAGE_ARN)}`,
  );
  assert.equal(requests[0].init.method, 'GET');
  assert.match(
    requests[0].init.headers.authorization,
    /\/ap-northeast-1\/lambda\/aws4_request/,
  );
  assert.equal(
    requests[1].url,
    'https://lambda.ap-northeast-1.amazonaws.com/2025-09-09/microvms/mvm-1/auth-token',
  );
  assert.equal(requests[1].init.body, '{"expirationInMinutes":15}');

  const failing = microvms(
    settings(ENV),
    async () => new Response('denied', { status: 403 }),
  );
  await assert.rejects(failing.get('mvm-1'), /failed with 403: denied/);
});

/** A stand-in for the MicroVMs API that records what was called. */
function fakeApi({ pages = [{ items: [] }], states = ['RUNNING'] } = {}) {
  const calls = [];
  let page = 0;
  let state = 0;
  return {
    calls,
    list: async (image, nextToken) => {
      calls.push(['list', image, nextToken]);
      return pages[page++] ?? { items: [] };
    },
    get: async (id) => {
      calls.push(['get', id]);
      return {
        microvmId: id,
        state: states[Math.min(state++, states.length - 1)],
        endpoint: `${id}.lambda-microvm.ap-northeast-1.on.aws`,
      };
    },
    run: async (body) => {
      calls.push(['run', body]);
      return { microvmId: 'mvm-new', state: 'PENDING' };
    },
    token: async (id, body) => {
      calls.push(['token', id, body]);
      return { authToken: { 'X-aws-proxy-auth': 'jwe' } };
    },
  };
}

test('sharedMicrovm reuses a live MicroVM, on any page of the list', async () => {
  const api = fakeApi({
    pages: [
      {
        items: [{ microvmId: 'mvm-old', state: 'TERMINATED' }],
        nextToken: 'n',
      },
      { items: [{ microvmId: 'mvm-live', state: 'SUSPENDED' }] },
    ],
    states: ['SUSPENDED'],
  });
  const microvm = await sharedMicrovm(settings(ENV), api);
  assert.equal(microvm.microvmId, 'mvm-live');
  assert.deepEqual(
    api.calls.map(([name]) => name),
    ['list', 'list', 'get'],
  );
  assert.equal(api.calls[1][2], 'n');
});

test('sharedMicrovm starts one MicroVM and waits until it runs', async () => {
  const api = fakeApi({ states: ['RUNNING'] });
  const microvm = await sharedMicrovm(settings(ENV), api, {
    now: () => Date.parse('2026-10-30T01:02:03Z'),
  });
  assert.equal(microvm.state, 'RUNNING');
  const run = api.calls.find(([name]) => name === 'run')[1];
  assert.deepEqual(run, {
    imageIdentifier: ENV.RELAY_IMAGE_ARN,
    ingressNetworkConnectors: ['ingress'],
    egressNetworkConnectors: ['egress'],
    idlePolicy: {
      autoResumeEnabled: true,
      maxIdleDurationSeconds: 300,
      suspendedDurationSeconds: 3600,
    },
    maximumDurationInSeconds: 28_800,
    clientToken: 'relay-202610300102',
  });
});

test('relayOptions returns the URL and subprotocols for network.relay', async () => {
  const api = fakeApi({
    pages: [{ items: [{ microvmId: 'mvm-1', state: 'RUNNING' }] }],
  });
  assert.deepEqual(await relayOptions(settings(ENV), api), {
    url: 'wss://mvm-1.lambda-microvm.ap-northeast-1.on.aws/',
    protocols: [
      'lambda-microvms',
      'lambda-microvms.authentication.jwe',
      'lambda-microvms.port.8080',
    ],
    expiresInMinutes: 15,
  });
  assert.deepEqual(api.calls.at(-1), [
    'token',
    'mvm-1',
    { expirationInMinutes: 15, allowedPorts: [{ port: 8080 }] },
  ]);
});

test('relayOptions refuses a MicroVM that did not come up', async () => {
  const api = fakeApi({
    pages: [{ items: [{ microvmId: 'mvm-1', state: 'RUNNING' }] }],
    states: ['TERMINATED'],
  });
  await assert.rejects(
    relayOptions(settings(ENV), api),
    /the relay MicroVM is TERMINATED/,
  );
});

test('handler answers only GET from the allowed origin', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
  t.after(() => {
    for (const key of Object.keys(ENV)) delete process.env[key];
  });
  const event = (method, origin) => ({
    requestContext: { http: { method } },
    headers: origin ? { origin } : {},
  });
  assert.equal(
    (await handler(event('POST', ENV.RELAY_ORIGIN))).statusCode,
    405,
  );
  assert.equal(
    (await handler(event('GET', 'https://example.com'))).statusCode,
    403,
  );
  assert.equal((await handler(event('GET'))).statusCode, 403);
  // The real API is unreachable with these credentials, so the call fails
  // and the handler hides the cause.
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 500 }),
  );
  const failed = await handler(event('GET', ENV.RELAY_ORIGIN));
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(JSON.parse(failed.body), {
    error: 'the relay is unavailable',
  });
  assert.equal(failed.headers['cache-control'], 'no-store');
});
