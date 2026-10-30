import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { externalSources } from '../../scripts/check-site.ts';
import {
  injectCsp,
  injectTerminalPages,
  inlineScripts,
  isTerminalPage,
  scriptHash,
  terminalPolicy,
} from '../../scripts/inject-csp.ts';
import {
  RELAY_CONNECT_SOURCES,
  RELAY_TOKEN_URL,
} from '../../src/terminal/relay.ts';
import { tempDir, writeFiles } from './helpers.ts';

const page = `<!doctype html><html><head><meta charset="utf-8"><script>document.documentElement.dataset.theme='dark'</script><script type="module" src="/formicarium/_astro/page.js"></script><script is:inline>window.x = "日本"</script></head><body><div data-terminal-host="{}"></div></body></html>`;

test('only inline scripts are hashed, as base64 SHA256 of their UTF-8 text', () => {
  assert.deepEqual(inlineScripts(page), [
    "document.documentElement.dataset.theme='dark'",
    'window.x = "日本"',
  ]);
  assert.equal(
    scriptHash('window.x = "日本"'),
    createHash('sha256').update('window.x = "日本"', 'utf8').digest('base64'),
  );
});

test('the policy allows self and wasm, and only connect-src names the relay', () => {
  const policy = terminalPolicy(['abc=']);
  assert.equal(
    policy,
    "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'sha256-abc='; worker-src 'self'; connect-src 'self' https://wge67yvaiqhmeesmsze62m3bom0gstwg.lambda-url.ap-northeast-1.on.aws wss://*.lambda-microvm.ap-northeast-1.on.aws; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'",
  );
  // The token function's origin and the relay's WebSocket host, nowhere else.
  assert.deepEqual(
    [...RELAY_CONNECT_SOURCES],
    [
      new URL(RELAY_TOKEN_URL).origin,
      'wss://*.lambda-microvm.ap-northeast-1.on.aws',
    ],
  );
  const others = policy
    .split('; ')
    .filter((directive) => !directive.startsWith('connect-src '))
    .join('; ');
  assert.doesNotMatch(others, /https?:|wss?:|\*|blob:/);
  assert.doesNotMatch(policy, /blob:/);
  assert.equal(externalSources(policy), false);
});

test("a source beyond the relay's two, or the relay outside connect-src, is external", () => {
  const policy = terminalPolicy([]);
  for (const changed of [
    policy.replace(
      "connect-src 'self'",
      "connect-src 'self' https://example.com",
    ),
    policy.replace("connect-src 'self'", "connect-src 'self' wss://*"),
    policy.replace("connect-src 'self'", "connect-src 'self' example.com"),
    policy.replace(
      "img-src 'self'",
      `img-src 'self' ${RELAY_CONNECT_SOURCES[0]}`,
    ),
    policy.replace("worker-src 'self'", "worker-src 'self' blob:"),
    policy.replace("script-src 'self'", "script-src 'self' *"),
  ])
    assert.equal(externalSources(changed), true, changed);
});

test('the meta CSP becomes the first element of <head> with every inline hash', () => {
  const { html, policy } = injectCsp(page);
  assert.ok(
    html.startsWith(
      '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="',
    ),
  );
  for (const body of inlineScripts(page))
    assert.ok(policy.includes(`'sha256-${scriptHash(body)}'`));
  assert.throws(() => injectCsp(html), /already has a CSP/);
  assert.throws(() => injectCsp('<p>no head</p>'), /no <head>/);
});

test('terminal pages are recognised by the data-terminal-host attribute only', () => {
  assert.ok(isTerminalPage(page));
  assert.ok(
    !isTerminalPage(
      '<html><head></head><body><p>data-terminal-host in prose</p></body></html>',
    ),
  );
});

test('injectTerminalPages rewrites listed terminal pages and refuses a documentation page', async () => {
  const root = await tempDir('csp');
  await writeFiles(root, {
    'terminal/index.html': page,
    'guides/index.html': '<html><head></head><body></body></html>',
  });
  const policies = await injectTerminalPages(root, ['terminal/index.html']);
  assert.equal(policies.size, 1);
  assert.match(
    await readFile(join(root, 'terminal/index.html'), 'utf8'),
    /Content-Security-Policy/,
  );
  await assert.rejects(
    injectTerminalPages(root, ['guides/index.html']),
    /csp-invalid: guides\/index\.html is not a terminal page/,
  );
});
