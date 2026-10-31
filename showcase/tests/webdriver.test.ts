// The safaridriver client against a fake driver: a session that Safari fails
// to start is asked for again after a relaunch, a set number of times.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

let failures = 0;
let requests = 0;
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url === '/status') {
    response.end(JSON.stringify({ value: { ready: true } }));
    return;
  }
  requests++;
  if (requests <= failures) {
    response.statusCode = 500;
    response.end(
      JSON.stringify({ value: { error: 'session not created', message: '' } }),
    );
    return;
  }
  response.end(
    JSON.stringify({
      value: {
        sessionId: 'abc',
        capabilities: { browserVersion: '26.0', platformName: 'mac' },
      },
    }),
  );
});
let webdriver: typeof import('./webdriver.ts');

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  process.env.SHOWCASE_SAFARIDRIVER = `http://127.0.0.1:${port}`;
  webdriver = await import('./webdriver.ts');
});
after(() => server.close());

test('a session that Safari fails to start is asked for again after a relaunch', async () => {
  failures = 2;
  requests = 0;
  let relaunches = 0;
  const session = await webdriver.createSession({
    retryDelayMs: 0,
    relaunch: () => relaunches++,
  });
  assert.deepEqual(session, {
    id: 'abc',
    browserVersion: '26.0',
    platformName: 'mac',
  });
  assert.equal(requests, 3);
  assert.equal(relaunches, 2);
});

test('the last failure is reported after the set number of attempts', async () => {
  failures = 10;
  requests = 0;
  let relaunches = 0;
  await assert.rejects(
    webdriver.createSession({
      retryDelayMs: 0,
      relaunch: () => relaunches++,
    }),
    /session not created/,
  );
  assert.equal(requests, webdriver.SESSION_ATTEMPTS);
  assert.equal(relaunches, webdriver.SESSION_ATTEMPTS - 1);
});
