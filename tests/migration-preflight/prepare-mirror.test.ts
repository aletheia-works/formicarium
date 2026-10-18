import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  AssetError,
  sha256,
} from '../../scripts/migration-preflight/assets.js';
import {
  downloadPinned,
  mirrorOrigin,
  publishNewFile,
} from '../../scripts/migration-preflight/prepare-mirror.js';

const bytes = Uint8Array.of(1, 2, 3, 4);
const url = 'https://example.org/fixed';
function fetchReturning(
  response: () => Response,
  observe?: (url: string, options: RequestInit) => void,
): typeof fetch {
  return (async (url, options) => {
    observe?.(String(url), options!);
    return response();
  }) as typeof fetch;
}
test('download pin and TLS credential-free manual mode are mandatory; body snapshot is independent', async () => {
  let calls = 0;
  const expected = await sha256(bytes);
  const result = await downloadPinned({
    url,
    sha256: expected,
    fetch: fetchReturning(
      () => new Response(new Uint8Array(bytes)),
      (requested, options) => {
        calls++;
        assert.equal(requested, url);
        assert.equal(options.redirect, 'manual');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.cache, 'no-store');
      },
    ),
  });
  assert.deepEqual(result.bytes, bytes);
  assert.equal(calls, 1);
  assert.equal(result.redirects, 0);
  assert.equal(result.finalUrl, url);
});
test('every redirect hop is inspected: five accepted, sixth rejected, loops refused', async () => {
  for (const count of [5, 6]) {
    let calls = 0;
    const operation = downloadPinned({
      url,
      sha256: await sha256(bytes),
      fetch: fetchReturning(() => {
        calls++;
        return calls <= count
          ? new Response(null, {
              status: 302,
              headers: {
                location: `https://example.org/hop-${calls}?transient=secret`,
              },
            })
          : new Response(new Uint8Array(bytes));
      }),
    });
    if (count === 5) {
      const result = await operation;
      assert.equal(result.redirects, 5);
      assert.equal(result.finalUrl, 'https://example.org/hop-5');
    } else await assert.rejects(operation, /redirect limit/);
  }
  await assert.rejects(
    downloadPinned({
      url,
      sha256: await sha256(bytes),
      fetch: fetchReturning(
        () => new Response(null, { status: 302, headers: { location: url } }),
      ),
    }),
    /loop/,
  );
});
test('unsafe redirects, absent location and hidden redirect state reject before further fetch', async () => {
  for (const location of [
    'http://example.org/plain',
    'https://credential:secret@example.org/fixed',
    'https://example.org/fixed#fragment',
  ]) {
    let calls = 0;
    await assert.rejects(
      downloadPinned({
        url,
        sha256: await sha256(bytes),
        fetch: fetchReturning(() => {
          calls++;
          return new Response(null, { status: 302, headers: { location } });
        }),
      }),
      AssetError,
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    downloadPinned({
      url,
      sha256: await sha256(bytes),
      fetch: fetchReturning(() => new Response(null, { status: 302 })),
    }),
    /location/,
  );
  const hidden = new Response(new Uint8Array(bytes));
  Object.defineProperty(hidden, 'redirected', { value: true });
  await assert.rejects(
    downloadPinned({
      url,
      sha256: await sha256(bytes),
      fetch: fetchReturning(() => hidden),
    }),
    /unobservable/,
  );
});
test('HTTP errors and digest corruption never retry or publish successful bytes', async () => {
  let calls = 0;
  await assert.rejects(
    downloadPinned({
      url,
      sha256: await sha256(bytes),
      fetch: fetchReturning(() => {
        calls++;
        return new Response('rate limited', { status: 429 });
      }),
    }),
    /HTTP/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    downloadPinned({
      url,
      sha256: 'f'.repeat(64),
      fetch: fetchReturning(() => new Response(new Uint8Array(bytes))),
    }),
    /digest/,
  );
});
test('stream byte bound is inclusive, plus one rejected and C11 cannot be increased', async () => {
  const options = {
    url,
    sha256: await sha256(bytes),
    fetch: fetchReturning(() => new Response(new Uint8Array(bytes))),
  };
  await downloadPinned({ ...options, limit: 4 });
  await assert.rejects(downloadPinned({ ...options, limit: 3 }), /byte limit/);
  await assert.rejects(
    downloadPinned({ ...options, limit: 128 * 1024 * 1024 + 1 }),
    /C11/,
  );
  await assert.rejects(
    downloadPinned({ ...options, timeoutMs: 120001 }),
    /C11/,
  );
});
test('fetch and body deadline/cancellation are distinct failures and cancel the body', async () => {
  const sha = await sha256(bytes);
  const never = (() => new Promise<Response>(() => {})) as typeof fetch;
  await assert.rejects(
    downloadPinned({ url, sha256: sha, fetch: never, timeoutMs: 10 }),
    (error: unknown) => error instanceof AssetError && error.code === 'TIMEOUT',
  );
  let cancelled = false;
  const pendingBody = fetchReturning(
    () =>
      new Response(
        new ReadableStream<Uint8Array>({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  await assert.rejects(
    downloadPinned({ url, sha256: sha, fetch: pendingBody, timeoutMs: 10 }),
    (error: unknown) => error instanceof AssetError && error.code === 'TIMEOUT',
  );
  assert.equal(cancelled, true);
  const controller = new AbortController();
  const pending = downloadPinned({
    url,
    sha256: sha,
    fetch: never,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof AssetError && error.code === 'ABORTED',
  );
});
test('atomic new-file publication preserves prior content and removes staging on collision', async () => {
  const directory = resolve(
    '.artifacts/migration-preflight-mirror-tests',
    randomUUID(),
  );
  await mkdir(directory, { recursive: true });
  try {
    const file = resolve(directory, 'pinned');
    await publishNewFile(file, bytes);
    await assert.rejects(publishNewFile(file, Uint8Array.of(9)), /EEXIST/);
    assert.deepEqual(new Uint8Array(await readFile(file)), bytes);
    assert.deepEqual(await readdir(directory), ['pinned']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('only HTTPS localhost origin on the isolated port is accepted', () => {
  assert.equal(
    mirrorOrigin('https://localhost:4182/'),
    'https://localhost:4182',
  );
  for (const invalid of [
    'http://localhost:4182',
    'https://remote.example:4182',
    'https://localhost:443',
    'https://localhost:4182/path',
    'https://secret@localhost:4182',
  ])
    assert.throws(() => mirrorOrigin(invalid));
});
