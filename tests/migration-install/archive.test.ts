import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { failure } from '../../runtime/errors.js';
import { extractArchive } from '../../runtime/install-archive.js';
import type { InstallControl } from '../../runtime/install-transfer.js';

interface Item {
  name: string;
  type?: string;
  data?: Uint8Array;
  link?: string;
}
const encoder = new TextEncoder();
function archive(items: Item[], end = true): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const item of items) {
    const header = new Uint8Array(512);
    const body = item.data ?? new Uint8Array();
    const write = (start: number, value: string) =>
      header.set(encoder.encode(value), start);
    write(0, item.name);
    write(100, '0000755\0');
    write(108, '0000000\0');
    write(116, '0000000\0');
    write(124, `${body.length.toString(8).padStart(11, '0')}\0`);
    write(136, '00000000000\0');
    header.fill(32, 148, 156);
    write(156, item.type ?? '0');
    write(157, item.link ?? '');
    write(257, 'ustar\0');
    write(263, '00');
    const sum = header.reduce((value, byte) => value + byte, 0);
    write(148, `${sum.toString(8).padStart(6, '0')}\0 `);
    blocks.push(
      header,
      body,
      new Uint8Array((512 - (body.length % 512)) % 512),
    );
  }
  if (end) blocks.push(new Uint8Array(1024));
  const result = new Uint8Array(
    blocks.reduce((sum, block) => sum + block.length, 0),
  );
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  return result;
}
function control(): InstallControl {
  return { signal: new AbortController().signal, check() {}, async yield() {} };
}
const file = { name: 'bin/demo', data: new Uint8Array([127, 69, 76, 70]) };
async function unpack(items: Item[], selection = file.name) {
  return extractArchive(
    gzipSync(archive(items)),
    selection,
    control(),
    () => undefined,
  );
}
function paxRecord(key: string, value: string): string {
  const body = `${key}=${value}\n`;
  let length = encoder.encode(body).length + 2;
  while (length !== encoder.encode(`${length} ${body}`).length)
    length = encoder.encode(`${length} ${body}`).length;
  return `${length} ${body}`;
}
test('USTAR regular, directory, symlink and hardlink inspect whole archive and select owned bytes', async () => {
  const items: Item[] = [
    { name: 'bin/', type: '5' },
    file,
    { name: 'bin/alias', type: '2', link: 'demo' },
    { name: 'hard', type: '1', link: 'bin/demo' },
  ];
  assert.deepEqual([...(await unpack(items))], [...file.data]);
  assert.deepEqual([...(await unpack(items, 'bin/alias'))], [...file.data]);
  assert.deepEqual([...(await unpack(items, 'hard'))], [...file.data]);
});
test('selected file does not hide later traversal, absolute, duplicate or unsupported entry', async () => {
  for (const evil of [
    { name: '../evil' },
    { name: '/evil' },
    { name: './bin/demo' },
    { name: 'evil', type: '3' },
    { name: 'evil', type: 'S' },
  ])
    await assert.rejects(unpack([file, evil]), { code: 'INVALID_INPUT' });
});
test('every link rejects missing target, root escape and direct or mutual cycles', async () => {
  const cases: Item[][] = [
    [{ name: 'bad', type: '2', link: '../outside' }],
    [{ name: 'bad', type: '2', link: 'missing' }],
    [{ name: 'bad', type: '2', link: 'bad' }],
    [
      { name: 'bad', type: '2', link: 'other' },
      { name: 'other', type: '2', link: 'bad' },
    ],
    [{ name: 'bad', type: '1', link: '/outside' }],
  ];
  for (const items of cases)
    await assert.rejects(unpack([file, ...items]), { code: 'INVALID_INPUT' });
});
test('parent symlinks are resolved and cannot hide root escape or non-directory parent', async () => {
  await assert.rejects(
    unpack([
      file,
      { name: 'alias', type: '2', link: '../escape' },
      { name: 'alias/inside', data: new Uint8Array([1]) },
    ]),
    { code: 'INVALID_INPUT' },
  );
  await assert.rejects(unpack([file, { name: 'bin/demo/inside' }]), {
    code: 'INVALID_INPUT',
  });
  const items: Item[] = [
    { name: 'real', type: '5' },
    { name: 'alias', type: '2', link: 'real' },
    { name: 'real/demo', data: file.data },
  ];
  assert.deepEqual([...(await unpack(items, 'alias/demo'))], [...file.data]);
});
test('header checksum, numeric overflow, truncated body and malformed end markers reject', async () => {
  const corrupted = archive([file]);
  corrupted[0] ^= 1;
  await assert.rejects(
    extractArchive(gzipSync(corrupted), file.name, control(), () => undefined),
    { code: 'INVALID_INPUT' },
  );
  for (const raw of [
    archive([file], false),
    archive([file]).subarray(0, 600),
    archive([file]).subarray(0, 1536),
  ])
    await assert.rejects(
      extractArchive(gzipSync(raw), file.name, control(), () => undefined),
      { code: 'INVALID_INPUT' },
    );
  const trailing = new Uint8Array(archive([file]).length + 1);
  trailing.set(archive([file]));
  await assert.rejects(
    extractArchive(gzipSync(trailing), file.name, control(), () => undefined),
    { code: 'INVALID_INPUT' },
  );
});
test('gzip corruption and truncated compressed stream cannot yield an early selected entry', async () => {
  const zipped = gzipSync(archive([file]));
  for (const raw of [
    new Uint8Array([1, 2, 3]),
    zipped.subarray(0, zipped.length - 1),
  ])
    await assert.rejects(
      extractArchive(raw, file.name, control(), () => undefined),
      { code: 'INVALID_INPUT' },
    );
});
test('PAX preserves next-entry scope and rejects raw duplicate, length and unsupported keys', async () => {
  const extension = {
    name: 'PaxHeader',
    type: 'x',
    data: encoder.encode(paxRecord('path', 'bin/demo')),
  };
  assert.deepEqual(
    [...(await unpack([extension, { name: 'short', data: file.data }]))],
    [...file.data],
  );
  for (const data of [
    paxRecord('path', 'a') + paxRecord('path', 'b'),
    '99 path=a\n',
    paxRecord('GNU.sparse.name', 'x'),
    paxRecord('path', '../bad'),
  ])
    await assert.rejects(
      unpack([
        { ...extension, data: encoder.encode(data) },
        { name: 'short', data: file.data },
      ]),
      { code: 'INVALID_INPUT' },
    );
  await assert.rejects(unpack([extension]), { code: 'INVALID_INPUT' });
});
test('GNU long names validate UTF8 byte boundaries and terminators', async () => {
  const name = 'x'.repeat(4096);
  assert.deepEqual(
    [
      ...(await unpack(
        [
          {
            name: '././@LongLink',
            type: 'L',
            data: encoder.encode(`${name}\0`),
          },
          { name: 'short', data: file.data },
        ],
        name,
      )),
    ],
    [...file.data],
  );
  for (const extended of [`${'x'.repeat(4097)}\0`, 'bad', '../bad\0'])
    await assert.rejects(
      unpack([
        { name: '././@LongLink', type: 'L', data: encoder.encode(extended) },
        { name: 'short', data: file.data },
      ]),
      { code: 'INVALID_INPUT' },
    );
});
test('metadata counts toward 4096 entry bound including extension headers', async () => {
  const items: Item[] = Array.from({ length: 4095 }, (_, index) => ({
    name: `entry-${index}`,
    type: '5',
  }));
  assert.deepEqual([...(await unpack([...items, file]))], [...file.data]);
  await assert.rejects(
    unpack([...items, { name: 'one-more', type: '5' }, file]),
    { code: 'INVALID_INPUT' },
  );
});
test('selection missing, directory and hardlink-to-directory reject', async () => {
  await assert.rejects(unpack([file], 'missing'), { code: 'INVALID_INPUT' });
  await assert.rejects(unpack([{ name: 'dir', type: '5' }], 'dir'), {
    code: 'INVALID_INPUT',
  });
  await assert.rejects(
    unpack([
      file,
      { name: 'dir', type: '5' },
      { name: 'hard', type: '1', link: 'dir' },
    ]),
    { code: 'INVALID_INPUT' },
  );
});
test('cancel during decompression terminates before candidate return', async () => {
  const controller = new AbortController();
  const lifetime: InstallControl = {
    signal: controller.signal,
    check() {
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async yield() {
      this.check();
    },
  };
  await assert.rejects(
    extractArchive(gzipSync(archive([file])), file.name, lifetime, () =>
      controller.abort(failure('ABORTED')),
    ),
    { code: 'ABORTED' },
  );
});
test('U1 accepted real aube archive extracts without fetching or rebuilding', async () => {
  const compressed = new Uint8Array(
    await readFile(
      new URL(
        '../../.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
        import.meta.url,
      ),
    ),
  );
  const result = await extractArchive(
    compressed,
    'aube',
    control(),
    () => undefined,
  );
  assert.deepEqual([...result.subarray(0, 4)], [127, 69, 76, 70]);
});
