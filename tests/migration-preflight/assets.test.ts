import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import type {
  AssetInput,
  BuildIdentity,
} from '../../scripts/migration-preflight/assets.js';
import {
  ASSET_LIMITS,
  AssetError,
  acquireAsset,
  buildKey,
  canonicalJson,
  checkSize,
  extractTar,
  sha256,
} from '../../scripts/migration-preflight/assets.js';

const encode = new TextEncoder();
function elf(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(120);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 2, true);
  view.setUint16(18, 62, true);
  view.setUint32(20, 1, true);
  view.setBigUint64(32, 64n, true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint32(64, 1, true);
  return bytes;
}
async function inputFor(bytes: Uint8Array, guest = bytes): Promise<AssetInput> {
  const elfSha256 = await sha256(guest);
  const identity: BuildIdentity = {
    schemaVersion: 1,
    tool: 'aube',
    versionOrName: '2.7.0',
    source: {
      repository: 'https://github.com/aubepkg/aube',
      commit: 'a'.repeat(40),
    },
    target: 'x86_64-unknown-linux-musl',
    rustc: 'rustc fixture',
    sourcePatches: [],
    dependencies: [],
    builderHash: 'b'.repeat(64),
    buildKey: 'c'.repeat(64),
    elfSha256,
    fixtureOnly: true,
  };
  identity.buildKey = await buildKey(identity);
  return {
    tool: 'aube',
    version: '2.7.0',
    url: 'https://example.org/fixture-only',
    format: 'elf',
    downloadSha256: await sha256(bytes),
    elfSha256,
    buildInfo: identity,
    buildInfoSha256: await sha256(encode.encode(canonicalJson(identity))),
  };
}
function fetchBytes(
  bytes: Uint8Array,
  inspect?: (options: RequestInit) => void,
): typeof fetch {
  return (async (_url, options) => {
    inspect?.(options!);
    return new Response(new Uint8Array(bytes));
  }) as typeof fetch;
}
function tar(
  entries: {
    path: string;
    bytes?: Uint8Array;
    kind?: string;
    target?: string;
  }[],
): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(512);
    const content = entry.bytes ?? new Uint8Array();
    header.set(encode.encode(entry.path), 0);
    header.set(
      encode.encode(content.length.toString(8).padStart(11, '0') + '\0'),
      124,
    );
    header.fill(32, 148, 156);
    header.set(encode.encode(entry.kind ?? '0'), 156);
    if (entry.target) header.set(encode.encode(entry.target), 157);
    header.set(encode.encode('ustar\0'), 257);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.set(
      encode.encode(checksum.toString(8).padStart(6, '0') + '\0 '),
      148,
    );
    const padded = new Uint8Array(Math.ceil(content.length / 512) * 512);
    padded.set(content);
    parts.push(header, padded);
  }
  parts.push(new Uint8Array(1024));
  const bytes = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
test('bare ELF acquires a private validated copy with metadata and bounded fetch options', async () => {
  const guest = elf();
  const input = await inputFor(guest);
  const result = await acquireAsset(input, {
    fetch: fetchBytes(guest, (options) => {
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
    }),
  });
  guest[0] = 0;
  input.buildInfo.source.commit = 'f'.repeat(40);
  assert.equal(result.bytes[0], 127);
  assert.equal(result.input.buildInfo.source.commit, 'a'.repeat(40));
  for (const elapsed of Object.values(result.phasesMs))
    assert.ok(Number.isFinite(elapsed) && elapsed >= 0);
  assert.equal(result.phasesMs.extract, 0);
});
test('gzip scans all entries and extracts the selected static ELF', async () => {
  const guest = elf();
  const archive = gzipSync(
    tar([
      { path: 'bin', kind: '5' },
      { path: 'bin/aube', bytes: guest },
      { path: 'safe-link', kind: '2', target: 'bin/aube' },
    ]),
  );
  const input = {
    ...(await inputFor(archive, guest)),
    format: 'tar.gz' as const,
    archiveEntry: 'bin/aube',
  };
  assert.deepEqual(
    (await acquireAsset(input, { fetch: fetchBytes(archive) })).bytes,
    guest,
  );
});
test('digest, source metadata, mandatory inputs, build key and ELF bounds reject', async () => {
  const guest = elf();
  for (const change of [
    (input: AssetInput) => {
      input.downloadSha256 = 'f'.repeat(64);
    },
    (input: AssetInput) => {
      input.buildInfoSha256 = 'f'.repeat(64);
    },
    (input: AssetInput) => {
      input.buildInfo.source.commit = 'main';
    },
    (input: AssetInput) => {
      input.buildInfo.target = 'unknown' as BuildIdentity['target'];
    },
    (input: AssetInput) => {
      input.buildInfo.sourcePatches = undefined as unknown as [];
    },
    (input: AssetInput) => {
      input.buildInfo.buildKey = 'f'.repeat(64);
    },
  ]) {
    const input = await inputFor(guest);
    change(input);
    await assert.rejects(
      acquireAsset(input, { fetch: fetchBytes(guest) }),
      AssetError,
    );
  }
  const dynamic = elf();
  new DataView(dynamic.buffer).setUint32(64, 3, true);
  await assert.rejects(
    acquireAsset(await inputFor(dynamic), { fetch: fetchBytes(dynamic) }),
    /ELF validation/,
  );
  const badKey = await inputFor(guest);
  badKey.buildInfo.buildKey = 'f'.repeat(64);
  badKey.buildInfoSha256 = await sha256(
    encode.encode(canonicalJson(badKey.buildInfo)),
  );
  await assert.rejects(
    acquireAsset(badKey, { fetch: fetchBytes(guest) }),
    /build key/,
  );
});
test('unselected absolute, traversal, duplicate, link escape, loop and parent aliases reject', () => {
  const good = { path: 'guest', bytes: elf() };
  for (const extra of [
    [{ path: '/escape' }],
    [{ path: '../escape' }],
    [{ path: './guest' }],
    [{ path: 'link', kind: '2', target: '../escape' }],
    [
      { path: 'first', kind: '2', target: 'second' },
      { path: 'second', kind: '2', target: 'first' },
    ],
    [{ path: 'link', kind: '2', target: 'guest' }, { path: 'link/child' }],
  ])
    assert.throws(() => extractTar(tar([good, ...extra]), 'guest'), AssetError);
});
test('truncation, checksum corruption, missing end blocks and unknown types reject', () => {
  const archive = tar([{ path: 'guest', bytes: elf() }]);
  assert.throws(
    () => extractTar(archive.subarray(0, 600), 'guest'),
    /truncated/,
  );
  assert.throws(() => extractTar(archive.subarray(0, 1024), 'guest'), /end/);
  const corrupt = new Uint8Array(archive);
  corrupt[0] ^= 1;
  assert.throws(() => extractTar(corrupt, 'guest'), /checksum/);
  assert.throws(
    () => extractTar(tar([{ path: 'guest', kind: 'x' }]), 'guest'),
    /unsupported/,
  );
});
test('all size boundaries are inclusive, plus one is rejected without huge fixtures', async () => {
  for (const [label, limit] of Object.entries(ASSET_LIMITS)) {
    assert.doesNotThrow(() => checkSize(limit, limit, label));
    assert.throws(() => checkSize(limit + 1, limit, label), /limit/);
  }
  const guest = elf();
  const input = await inputFor(guest);
  await acquireAsset(input, {
    fetch: fetchBytes(guest),
    limits: { download: guest.length, elf: guest.length },
  });
  await assert.rejects(
    acquireAsset(input, {
      fetch: fetchBytes(guest),
      limits: { download: guest.length - 1 },
    }),
    /limit/,
  );
  await assert.rejects(
    acquireAsset(input, {
      fetch: fetchBytes(guest),
      limits: { elf: guest.length - 1 },
    }),
    /limit/,
  );
  const archive = tar([{ path: 'guest', bytes: guest }]);
  assert.deepEqual(
    extractTar(archive, 'guest', {
      ...ASSET_LIMITS,
      expanded: archive.length,
      entries: 1,
      path: 5,
    }),
    guest,
  );
  assert.throws(
    () =>
      extractTar(archive, 'guest', {
        ...ASSET_LIMITS,
        expanded: archive.length - 1,
      }),
    /limit/,
  );
  assert.throws(
    () => extractTar(archive, 'guest', { ...ASSET_LIMITS, path: 4 }),
    /limit/,
  );
});
test('HTTP failures, redirect and opaque responses, body/network errors do not retry', async () => {
  const guest = elf();
  const input = await inputFor(guest);
  for (const response of [
    new Response('failure', { status: 429 }),
    new Response('redirect', { status: 302 }),
  ]) {
    let calls = 0;
    await assert.rejects(
      acquireAsset(input, {
        fetch: (async () => {
          calls++;
          return response;
        }) as typeof fetch,
      }),
      (error: unknown) =>
        error instanceof AssetError && error.code === 'ASSET_LOAD',
    );
    assert.equal(calls, 1);
  }
  const opaque = new Response(guest);
  Object.defineProperty(opaque, 'type', { value: 'opaque' });
  await assert.rejects(
    acquireAsset(input, { fetch: (async () => opaque) as typeof fetch }),
    /refused/,
  );
  const redirected = new Response(guest);
  Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(
    acquireAsset(input, { fetch: (async () => redirected) as typeof fetch }),
    /refused/,
  );
  await assert.rejects(
    acquireAsset(input, {
      fetch: (async () => {
        throw Error('offline');
      }) as typeof fetch,
    }),
    /network/,
  );
});
test('fetch deadline, delayed body and external cancellation classify distinctly', async () => {
  const input = await inputFor(elf());
  const never = (() => new Promise<Response>(() => {})) as typeof fetch;
  await assert.rejects(
    acquireAsset(input, { fetch: never, timeoutMs: 10 }),
    (error: unknown) => error instanceof AssetError && error.code === 'TIMEOUT',
  );
  const delayed = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({ start() {} }),
    )) as typeof fetch;
  await assert.rejects(
    acquireAsset(input, { fetch: delayed, timeoutMs: 10 }),
    (error: unknown) => error instanceof AssetError && error.code === 'TIMEOUT',
  );
  const controller = new AbortController();
  const pending = acquireAsset(input, {
    fetch: never,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof AssetError && error.code === 'ABORTED',
  );
});
test('canonical metadata preserves unknown fields and rejects invalid JSON identities', async () => {
  assert.equal(
    canonicalJson({ z: 1, a: { c: true, b: null } }),
    '{"a":{"b":null,"c":true},"z":1}',
  );
  for (const invalid of [NaN, Infinity, 1.5, undefined, '\ud800'])
    assert.throws(() => canonicalJson(invalid), AssetError);
  const guest = elf();
  const input = await inputFor(guest);
  input.buildInfo.fixtureOnly = false;
  await assert.rejects(
    acquireAsset(input, { fetch: fetchBytes(guest) }),
    /digest/,
  );
});
