// Hands a browser the relay's WebSocket URL and a short-lived token for it.
//
// One MicroVM runs the relay for every visitor. This function finds it, or
// starts it when none is running, and asks Lambda for a token that reaches
// only the relay's port. It calls the Lambda MicroVMs REST API directly, signed
// with SigV4, so the deployment package needs no SDK: the runtime's bundled
// SDK may not have the MicroVMs client yet.
import { createHash, createHmac } from 'node:crypto';

const API_VERSION = '2025-09-09';
const RELAY_PORT = 8080;
/** States in which the shared MicroVM can still take connections. */
const LIVE_STATES = new Set(['PENDING', 'RUNNING', 'SUSPENDING', 'SUSPENDED']);
/** How long to wait for a new MicroVM to reach RUNNING. */
const START_TIMEOUT_MS = 20_000;
const POLL_MS = 1_000;

/** The settings this function reads from its environment, checked once. */
export function settings(env = process.env) {
  const required = [
    'RELAY_IMAGE_ARN',
    'RELAY_ORIGIN',
    'RELAY_INGRESS_CONNECTOR',
    'RELAY_EGRESS_CONNECTOR',
  ];
  for (const name of required)
    if (!env[name]) throw new Error(`${name} is not set`);
  return {
    region: env.AWS_REGION,
    imageArn: env.RELAY_IMAGE_ARN,
    origin: env.RELAY_ORIGIN,
    ingressConnector: env.RELAY_INGRESS_CONNECTOR,
    egressConnector: env.RELAY_EGRESS_CONNECTOR,
    tokenMinutes: Number(env.RELAY_TOKEN_MINUTES ?? 15),
    idlePolicy: {
      autoResumeEnabled: true,
      maxIdleDurationSeconds: Number(env.RELAY_IDLE_SECONDS ?? 300),
      suspendedDurationSeconds: Number(env.RELAY_SUSPENDED_SECONDS ?? 3600),
    },
    maximumDurationInSeconds: Number(env.RELAY_MAX_SECONDS ?? 28_800),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN,
    },
  };
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
// RFC 3986 unreserved characters stay; SigV4 encodes everything else.
const encode = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Signs a request with AWS Signature Version 4 and returns its headers.
 * `query` is a plain object; `body` is a string.
 */
export function sign({
  method,
  host,
  path,
  query = {},
  body = '',
  service,
  region,
  credentials,
  date = new Date(),
}) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = {
    host,
    'x-amz-date': amzDate,
    ...(credentials.sessionToken
      ? { 'x-amz-security-token': credentials.sessionToken }
      : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
  };
  const names = Object.keys(headers).sort();
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encode(key)}=${encode(String(query[key]))}`)
    .join('&');
  const canonical = [
    method,
    path.split('/').map(encode).join('/'),
    canonicalQuery,
    names.map((name) => `${name}:${String(headers[name]).trim()}\n`).join(''),
    names.join(';'),
    sha256(body),
  ].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join(
    '\n',
  );
  let key = `AWS4${credentials.secretAccessKey}`;
  for (const part of [day, region, service, 'aws4_request'])
    key = hmac(key, part);
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}

/** A client for the few MicroVMs calls this function makes. */
export function microvms(config, fetchImpl = fetch) {
  const host = `lambda.${config.region}.amazonaws.com`;
  async function call(method, path, { query = {}, body } = {}) {
    const text = body === undefined ? '' : JSON.stringify(body);
    const fullPath = `/${API_VERSION}${path}`;
    const headers = sign({
      method,
      host,
      path: fullPath,
      query,
      body: text,
      service: 'lambda',
      region: config.region,
      credentials: config.credentials,
    });
    const search = new URLSearchParams(query).toString();
    const response = await fetchImpl(
      `https://${host}${fullPath}${search ? `?${search}` : ''}`,
      { method, headers, ...(text ? { body: text } : {}) },
    );
    const answer = await response.text();
    if (!response.ok)
      throw new Error(
        `${method} ${path} failed with ${response.status}: ${answer.slice(0, 500)}`,
      );
    return answer ? JSON.parse(answer) : {};
  }
  return {
    list: (imageIdentifier, nextToken) =>
      call('GET', '/microvms', {
        query: { imageIdentifier, ...(nextToken ? { nextToken } : {}) },
      }),
    get: (id) => call('GET', `/microvms/${encodeURIComponent(id)}`),
    run: (body) => call('POST', '/microvms', { body }),
    token: (id, body) =>
      call('POST', `/microvms/${encodeURIComponent(id)}/auth-token`, { body }),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The shared MicroVM: a live one of the relay's image, else a new one. */
export async function sharedMicrovm(config, api, { now = Date.now } = {}) {
  let nextToken;
  do {
    const page = await api.list(config.imageArn, nextToken);
    const live = (page.items ?? []).find((item) => LIVE_STATES.has(item.state));
    if (live) return api.get(live.microvmId);
    nextToken = page.nextToken;
  } while (nextToken);
  let microvm = await api.run({
    imageIdentifier: config.imageArn,
    ingressNetworkConnectors: [config.ingressConnector],
    egressNetworkConnectors: [config.egressConnector],
    idlePolicy: config.idlePolicy,
    maximumDurationInSeconds: config.maximumDurationInSeconds,
    // Two calls in the same minute start one MicroVM between them. Digits
    // only, since idempotency tokens are often limited to [A-Za-z0-9_-].
    clientToken: `relay-${new Date(now())
      .toISOString()
      .slice(0, 16)
      .replace(/\D/g, '')}`,
  });
  const deadline = now() + START_TIMEOUT_MS;
  while (microvm.state === 'PENDING' && now() < deadline) {
    await sleep(POLL_MS);
    microvm = await api.get(microvm.microvmId);
  }
  return microvm;
}

/** The relay options for formicarium's `network.relay`. */
export async function relayOptions(config, api, options) {
  const microvm = await sharedMicrovm(config, api, options);
  if (!microvm.endpoint || !LIVE_STATES.has(microvm.state))
    throw new Error(`the relay MicroVM is ${microvm.state}`);
  const { authToken } = await api.token(microvm.microvmId, {
    expirationInMinutes: config.tokenMinutes,
    allowedPorts: [{ port: RELAY_PORT }],
  });
  const token = authToken?.['X-aws-proxy-auth'];
  if (!token) throw new Error('Lambda returned no token');
  return {
    url: `wss://${microvm.endpoint}/`,
    protocols: [
      'lambda-microvms',
      `lambda-microvms.authentication.${token}`,
      `lambda-microvms.port.${RELAY_PORT}`,
    ],
    expiresInMinutes: config.tokenMinutes,
  };
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

let cached;
/** The function URL handler. CORS headers come from the URL's configuration. */
export async function handler(event) {
  cached ??= settings();
  const method = event?.requestContext?.http?.method;
  if (method !== 'GET') return json(405, { error: 'GET only' });
  // A browser cannot forge Origin; this keeps other pages from using the
  // relay, though not clients outside a browser.
  if (event.headers?.origin !== cached.origin)
    return json(403, { error: 'origin not allowed' });
  try {
    return json(200, await relayOptions(cached, microvms(cached)));
  } catch (error) {
    console.error(error);
    return json(503, { error: 'the relay is unavailable' });
  }
}
