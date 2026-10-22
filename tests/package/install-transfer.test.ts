import assert from 'node:assert/strict';
import test from 'node:test';
import { failure } from '../../runtime/errors.js';
import { guestSha256 } from '../../runtime/guest-validation.js';
import type { CatalogEntry } from '../../runtime/install-catalog.js';
import type { InstallControl } from '../../runtime/install-transfer.js';
import { transferAsset } from '../../runtime/install-transfer.js';

const bytes = new Uint8Array([127, 69, 76, 70]);
function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    tool: 'demo',
    versionOrName: 'fixed',
    url: 'https://example.test/guest',
    format: 'elf',
    downloadBytes: bytes.length,
    elfBytes: bytes.length,
    downloadSha256: guestSha256(bytes),
    buildInfo: {} as CatalogEntry['buildInfo'],
    buildInfoSha256: 'a'.repeat(64),
    ...overrides,
  };
}
function control(controller = new AbortController()): InstallControl {
  return {
    signal: controller.signal,
    check() {
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async yield() {
      this.check();
    },
  };
}
function fetcher(
  run: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (url, init) => run(String(url), init)) as typeof fetch;
}
test('asset transfer copies bounded stream and reports unknown length separately', async () => {
  const events: { processed: number; total: number | null }[] = [];
  const result = await transferAsset(entry(), {
    control: control(),
    progress(processed, total) {
      events.push({ processed, total });
    },
    fetch: fetcher((url, init) => {
      assert.equal(url, 'https://example.test/guest');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.redirect, 'manual');
      return new Response(bytes);
    }),
  });
  assert.deepEqual([...result.bytes], [...bytes]);
  assert.equal(result.finalURL, entry().url);
  assert.deepEqual(events, [
    { processed: 0, total: null },
    { processed: 4, total: null },
  ]);
  assert.ok(result.fetchMs >= 0);
  assert.ok(result.downloadDigestMs >= 0);
});
test('content length is progress advice and never replaces actual byte count', async () => {
  const events: (number | null)[] = [];
  const result = await transferAsset(entry(), {
    control: control(),
    progress(_, total) {
      events.push(total);
    },
    fetch: fetcher(
      () => new Response(bytes, { headers: { 'content-length': '0' } }),
    ),
  });
  assert.equal(result.bytes.length, 4);
  assert.deepEqual(events, [0, 0]);
  await assert.rejects(
    transferAsset(entry({ downloadBytes: 5 }), {
      control: control(),
      progress() {},
      fetch: fetcher(
        () => new Response(bytes, { headers: { 'content-length': '5' } }),
      ),
    }),
    { code: 'INVALID_INPUT' },
  );
});
test('actual chunk overflow rejects and cancels body without a retry', async () => {
  let calls = 0;
  let cancelled = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(5));
    },
    cancel() {
      cancelled++;
    },
  });
  await assert.rejects(
    transferAsset(entry(), {
      control: control(),
      progress() {},
      fetch: fetcher(() => {
        calls++;
        return new Response(stream);
      }),
    }),
    { code: 'INVALID_INPUT' },
  );
  assert.equal(calls, 1);
  assert.equal(cancelled, 1);
  assert.equal(stream.locked, false);
});
test('download SHA mismatch rejects before any archive inspection', async () => {
  await assert.rejects(
    transferAsset(entry({ format: 'tar.gz', downloadSha256: 'a'.repeat(64) }), {
      control: control(),
      progress() {},
      fetch: fetcher(() => new Response(bytes)),
    }),
    { code: 'INVALID_INPUT' },
  );
});
test('Node follows five inspected HTTPS redirects and records final URL', async () => {
  let calls = 0;
  const result = await transferAsset(entry(), {
    control: control(),
    progress() {},
    fetch: fetcher((_, init) => {
      assert.equal(init?.credentials, 'omit');
      calls++;
      return calls <= 5
        ? new Response(null, {
            status: 302,
            headers: { location: `/step-${calls}` },
          })
        : new Response(bytes);
    }),
  });
  assert.equal(calls, 6);
  assert.equal(result.finalURL, 'https://example.test/step-5');
});
test('HTTP, credentials, redirect loops and sixth redirect reject with ASSET_LOAD', async () => {
  for (const location of [
    'http://example.test/guest',
    'https://u:p@example.test/guest',
    '/guest',
  ]) {
    let calls = 0;
    await assert.rejects(
      transferAsset(entry(), {
        control: control(),
        progress() {},
        fetch: fetcher(() => {
          calls++;
          return new Response(null, { status: 302, headers: { location } });
        }),
      }),
      { code: 'ASSET_LOAD' },
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(
    transferAsset(entry(), {
      control: control(),
      progress() {},
      fetch: fetcher(
        () =>
          new Response(null, {
            status: 302,
            headers: { location: `/step-${++calls}` },
          }),
      ),
    }),
    { code: 'ASSET_LOAD' },
  );
  assert.equal(calls, 6);
});
test('browser profile requests redirect:error and rejects an explicit redirect', async () => {
  await assert.rejects(
    transferAsset(entry(), {
      browser: true,
      control: control(),
      progress() {},
      fetch: fetcher((_, init) => {
        assert.equal(init?.redirect, 'error');
        return new Response(null, {
          status: 302,
          headers: { location: '/another' },
        });
      }),
    }),
    { code: 'ASSET_LOAD' },
  );
});
test('network, HTTP and interrupted body failures are ASSET_LOAD without fallback', async () => {
  for (const response of [
    new Response(null, { status: 429 }),
    new Response(null, { status: 404 }),
    new Response(
      new ReadableStream({
        start(c) {
          c.error(Error('offline'));
        },
      }),
    ),
  ]) {
    let calls = 0;
    await assert.rejects(
      transferAsset(entry(), {
        control: control(),
        progress() {},
        fetch: fetcher(() => {
          calls++;
          return response;
        }),
      }),
      { code: 'ASSET_LOAD' },
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    transferAsset(entry(), {
      control: control(),
      progress() {},
      fetch: fetcher(() => {
        throw Error('offline');
      }),
    }),
    { code: 'ASSET_LOAD' },
  );
});
test('caller abort during stalled read cancels reader and emits no later progress', async () => {
  const controller = new AbortController();
  let cancelled = 0;
  let notifications = 0;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled++;
    },
  });
  const installed = transferAsset(entry(), {
    control: control(controller),
    progress() {
      notifications++;
      controller.abort(failure('ABORTED'));
    },
    fetch: fetcher(() => new Response(stream)),
  });
  await assert.rejects(installed, { code: 'ABORTED' });
  assert.equal(cancelled, 1);
  assert.equal(notifications, 1);
  assert.equal(stream.locked, false);
});
test('fetch deadline uses monotonic >= cutoff and preserves TIMEOUT', async () => {
  let now = 0;
  let cancelled = 0;
  await assert.rejects(
    transferAsset(entry(), {
      clock: () => now,
      control: control(),
      progress() {},
      fetch: fetcher(() => {
        now = 120000;
        return new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelled++;
            },
          }),
        );
      }),
    }),
    { code: 'TIMEOUT' },
  );
  assert.equal(cancelled, 1);
});
