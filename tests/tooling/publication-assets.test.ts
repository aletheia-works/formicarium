import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { deflateRawSync, gzipSync } from 'node:zlib';

const {
  ASSET_LIMITS,
  NPM_ASSET,
  boundedBody,
  crc32,
  fetchAsset,
  npmFiles,
  unpackTar,
  unpackZip,
  verifyNpmIntegrity,
  readBoundedFile,
} = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/publication-assets.js'))
    .href
)) as typeof import('../../scripts/release/publication-assets.js');
function zip(
  members: {
    name: string;
    bytes: Uint8Array;
    mode?: number;
    method?: number;
  }[],
): Uint8Array {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const member of members) {
    const name = Buffer.from(member.name),
      bytes = Buffer.from(member.bytes);
    const method = member.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(bytes) : bytes;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x0314, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(crc32(bytes), 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(((member.mode ?? 0x81a4) << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, compressed);
    central.push(directory, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function tar(
  members: { name: string; value: string; type?: string }[],
): Uint8Array {
  const rows: Buffer[] = [];
  for (const member of members) {
    const bytes = Buffer.from(member.value),
      header = Buffer.alloc(512);
    header.write(member.name, 0);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write(member.type ?? '0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    rows.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  return gzipSync(Buffer.concat([...rows, Buffer.alloc(1024)]));
}
let fixedNpm: Promise<Buffer> | undefined;
function npmArchive() {
  fixedNpm ??= readFile('/private/tmp/formicarium-u4-npm-11.19.0.tgz').catch(
    () => fetchAsset(NPM_ASSET.url, ASSET_LIMITS.npmBytes),
  );
  return fixedNpm;
}

test('actual fixed official npm asset matches tracked URL integrity version and safe files', async () => {
  const tracked = JSON.parse(
    await readFile('.github/publication/trusted-policy.json', 'utf8'),
  );
  assert.deepEqual(tracked.npm, NPM_ASSET);
  const bytes = await npmArchive();
  verifyNpmIntegrity(bytes);
  const files = npmFiles(bytes);
  const existing = (await import(
    pathToFileURL(resolve(process.cwd(), 'scripts/terrarium/coverage.js')).href
  )) as typeof import('../../scripts/terrarium/coverage.js');
  const isolated = (await import(
    pathToFileURL(resolve(process.cwd(), 'scripts/release/inventory.js')).href
  )) as typeof import('../../scripts/release/inventory.js');
  assert.deepEqual(isolated.FILES, existing.FILES);
  assert.deepEqual(isolated.REQUIRED_U1_REALMS, existing.REQUIRED_U1_REALMS);
  assert.deepEqual(isolated.BROWSER_TITLES, existing.BROWSER_TITLES);
  assert.equal(
    JSON.parse(files.get('package/package.json')!.toString()).version,
    '11.19.0',
  );
  assert.ok(files.has('package/bin/npm-cli.js'));
  assert.ok(files.size <= 4096);
});
test('same length npm integrity mutation refuses before extraction', async () => {
  const bytes = Buffer.from(await npmArchive());
  bytes[0] ^= 1;
  assert.throws(() => npmFiles(bytes), /INTEGRITY/);
});
test('stream boundary accepts exact cap and cancels cap plus one without trusting Content-Length', async (t) => {
  for (const extra of [0, 1])
    await t.test(
      `filesystem read grows ${extra ? 'past cap' : 'to exact cap'} with deterministic port`,
      async () => {
        let supplied = 0,
          closed = false;
        const available = ASSET_LIMITS.metadataBytes + extra;
        const acquire = async () => ({
          read: async (buffer: Buffer) => {
            const count = Math.min(buffer.length, available - supplied);
            buffer.fill(0x20, 0, count);
            supplied += count;
            return count;
          },
          close: async () => {
            closed = true;
          },
        });
        if (extra)
          await assert.rejects(
            readBoundedFile(
              'deterministic-growing-file',
              ASSET_LIMITS.metadataBytes,
              acquire,
            ),
            /JSON_METADATA_LIMIT/,
          );
        else
          assert.equal(
            (
              await readBoundedFile(
                'deterministic-growing-file',
                ASSET_LIMITS.metadataBytes,
                acquire,
              )
            ).length,
            ASSET_LIMITS.metadataBytes,
          );
        assert.equal(supplied, available);
        assert.equal(closed, true);
      },
    );
  await t.test(
    'metadata source grows after the advertised exact cap and is cancelled',
    async () => {
      let pulls = 0,
        stopped = false;
      const growing = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          controller.enqueue(
            new Uint8Array(pulls === 1 ? ASSET_LIMITS.metadataBytes : 1),
          );
        },
        cancel() {
          stopped = true;
        },
      });
      await assert.rejects(
        boundedBody(
          new Response(growing, {
            headers: { 'Content-Length': String(ASSET_LIMITS.metadataBytes) },
          }),
          ASSET_LIMITS.metadataBytes,
        ),
        /BYTE_LIMIT/,
      );
      assert.ok(pulls >= 2);
      assert.equal(stopped, true);
    },
  );
  assert.equal(
    (await boundedBody(new Response(new Uint8Array(32)), 32)).length,
    32,
  );
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(33));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    boundedBody(new Response(body, { headers: { 'Content-Length': '1' } }), 32),
    /BYTE_LIMIT/,
  );
  assert.equal(cancelled, true);
});
test('expanded bytes and member caps reject tar and ZIP before extraction', async (t) => {
  for (const name of [
    'request.json',
    'publication.json',
    'envelopes/evidence.json',
  ]) {
    await t.test(`${name} individual metadata exact 8MiB and plus one`, () => {
      const exact = '{}'.padEnd(ASSET_LIMITS.metadataBytes, ' ');
      assert.equal(
        unpackTar(
          tar([{ name, value: exact }]),
          ASSET_LIMITS.expandedBytes,
          ASSET_LIMITS.members,
        ).get(name)?.length,
        ASSET_LIMITS.metadataBytes,
      );
      assert.throws(
        () =>
          unpackTar(
            tar([{ name, value: exact + ' ' }]),
            ASSET_LIMITS.expandedBytes,
            ASSET_LIMITS.members,
          ),
        /JSON|METADATA|metadata|limit/i,
      );
      const dishonest = Buffer.from(
        zip([{ name, bytes: Buffer.from(exact + ' '), method: 8 }]),
      );
      const end = dishonest.length - 22,
        central = dishonest.readUInt32LE(end + 16);
      dishonest.writeUInt32LE(ASSET_LIMITS.metadataBytes, 22);
      dishonest.writeUInt32LE(ASSET_LIMITS.metadataBytes, central + 24);
      assert.throws(
        () => unpackZip(dishonest),
        /JSON|METADATA|metadata|limit|buffer|larger|size|CRC/i,
      );
    });
  }
  assert.throws(
    () => unpackTar(tar([{ name: 'safe', value: '12345' }]), 4, 10),
    /EXPANDED|buffer|Buffer|larger/,
  );
  assert.throws(
    () =>
      unpackTar(
        tar([
          { name: 'a', value: '' },
          { name: 'b', value: '' },
        ]),
        32,
        1,
      ),
    /MEMBER/,
  );
  const bytes = zip([{ name: 'safe', bytes: new Uint8Array(1000), method: 8 }]);
  assert.throws(() => unpackZip(bytes, 999, 16), /EXPANDED/);
  assert.throws(
    () =>
      unpackZip(
        zip([
          { name: 'a', bytes: new Uint8Array() },
          { name: 'b', bytes: new Uint8Array() },
        ]),
        32,
        1,
      ),
    /MEMBER/,
  );
});
test('unsafe path link special duplicate and unsupported tar metadata refuse', () => {
  for (const name of ['../evil', '/evil', 'a/.npmrc', 'a/../evil', 'a\\evil']) {
    assert.throws(() => unpackTar(tar([{ name, value: 'bad' }]), 100, 10));
    assert.throws(() =>
      unpackZip(zip([{ name, bytes: new Uint8Array() }]), 100, 10),
    );
  }
  for (const type of ['1', '2', 'x', 'g', '6'])
    assert.throws(
      () => unpackTar(tar([{ name: 'a', value: 'bad', type }]), 100, 10),
      /SPECIAL/,
    );
  assert.throws(
    () =>
      unpackTar(
        tar([
          { name: 'a', value: '1' },
          { name: 'a', value: '2' },
        ]),
        100,
        10,
      ),
    /DUPLICATE/,
  );
  assert.throws(
    () =>
      unpackZip(
        zip([{ name: 'a', bytes: new Uint8Array(), mode: 0xa1ff }]),
        100,
        10,
      ),
    /SPECIAL/,
  );
  for (const mode of [0xc000, 0x6000, 0x2000, 0x1000])
    assert.throws(
      () =>
        unpackZip(zip([{ name: 'a', bytes: new Uint8Array(), mode }]), 100, 10),
      /SPECIAL/,
    );
  for (const limit of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => unpackTar(tar([]), limit, 10), /LIMIT_INVALID/);
    assert.throws(() => unpackZip(zip([]), 100, limit), /LIMIT_INVALID/);
  }
  assert.throws(
    () =>
      unpackZip(
        zip([
          { name: 'a', bytes: new Uint8Array() },
          { name: 'a', bytes: new Uint8Array() },
        ]),
        100,
        10,
      ),
    /DUPLICATE/,
  );
});
test('only trusted HTTPS redirects are allowed and credentials never follow', async () => {
  const requests: RequestInit[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    requests.push(init ?? {});
    return requests.length === 1
      ? new Response(null, {
          status: 302,
          headers: { location: 'https://artifact.example/a' },
        })
      : new Response('bytes');
  };
  await fetchAsset(
    'https://api.github.com/a',
    32,
    fetcher,
    { Authorization: 'Bearer secret' },
    ['artifact.example'],
  );
  const first = requests[0];
  assert.ok(first);
  assert.equal(
    (first.headers as Record<string, string>).Authorization,
    'Bearer secret',
  );
  assert.equal(requests[1]?.headers, undefined);
  await assert.rejects(
    fetchAsset(
      'https://api.github.com/a',
      32,
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/a' },
        }),
      {},
      ['artifact.example'],
    ),
    /REDIRECT/,
  );
  await assert.rejects(fetchAsset('http://registry.npmjs.org/a', 32), /URL/);
});
test('timeout cancels an unfinished stream and never returns partial success', async () => {
  let cancelled = false;
  const keepalive = setInterval(() => {}, 100);
  try {
    const fetcher: typeof fetch = async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      );
    await assert.rejects(
      fetchAsset('https://api.github.com/a', 32, fetcher, {}, [], 10),
      /TIMEOUT/,
    );
    assert.equal(cancelled, true);
  } finally {
    clearInterval(keepalive);
  }
});
