import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { deflateRawSync, gzipSync } from 'node:zlib';

const { ASSET_LIMITS, NPM_ASSET, assetDigest, crc32, fetchAsset } =
  (await import(
    pathToFileURL(
      resolve(process.cwd(), 'scripts/release/publication-assets.js'),
    ).href
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

import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type {
  TransferContext,
  TransferObservation,
} from '../../scripts/release/bootstrap.js';

const { executeTransfer, inspectTransfer } = (await import(
  pathToFileURL(resolve(process.cwd(), '.github/publication/bootstrap.mjs'))
    .href
)) as typeof import('../../scripts/release/bootstrap.js');
async function transferFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'bootstrap-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.github/publication'), { recursive: true });
  const policy = JSON.parse(
    await readFile('.github/publication/trusted-policy.json', 'utf8'),
  );
  policy.writerEnabled = true;
  policy.transfer.workflowId = 11;
  policy.transfer.producerAppId = 22;
  const policyBytes = Buffer.from(JSON.stringify(policy));
  const runner = await readFile('.github/publication/runner.mjs');
  const originalManifest = JSON.parse(
    await readFile('.github/publication/runner-manifest.json', 'utf8'),
  );
  assert.equal(
    originalManifest.files.find(
      (item: { path: string }) => item.path === 'runner.mjs',
    ).sha256,
    assetDigest(runner),
  );
  const manifest = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      files: [
        {
          path: 'runner.mjs',
          sha256: assetDigest(runner),
          size: runner.length,
        },
        {
          path: 'trusted-policy.json',
          sha256: assetDigest(policyBytes),
          size: policyBytes.length,
        },
      ],
    }),
  );
  const input = tar([{ name: 'request.json', value: '{}' }]);
  const npm = await npmArchive();
  const files = new Map<string, Uint8Array>([
    ['runner.mjs', runner],
    ['trusted-policy.json', policyBytes],
    ['runner-manifest.json', manifest],
    ['npm.tgz', npm],
    ['inputs.tgz', input],
  ]);
  for (const [name, bytes] of files)
    if (
      ['runner.mjs', 'trusted-policy.json', 'runner-manifest.json'].includes(
        name,
      )
    )
      await writeFile(join(root, '.github/publication', name), bytes);
  const archive = () =>
    zip([...files].map(([name, bytes]) => ({ name, bytes, method: 8 })));
  const bytes = archive();
  const context: TransferContext = {
    repository: 'aletheia-works/formicarium',
    sourceSha: 'a'.repeat(40),
    tag: 'v1.2.3-rc.1',
    runId: 123,
    attempt: 1,
    inputDigest: assetDigest(input),
  };
  const observed: TransferObservation = {
    ...context,
    workflowId: 11,
    workflowPath: '.github/workflows/publish.yml',
    producerAppId: 22,
    job: 'verify',
    jobState: 'success',
    artifactId: 66,
    artifactName: 'publication-assets',
    artifactDigest: `sha256:${assetDigest(bytes)}`,
  };
  const calls: { executable: string; args: string[] }[] = [];
  const execute = (executable: string, args: string[]) => {
    calls.push({ executable, args });
    return 0;
  };
  return {
    root,
    policy,
    files,
    archive,
    bytes,
    context,
    observed,
    calls,
    execute,
  };
}
test('actual tracked bootstrap policy and runner manifest verify before a single runner invocation', async (t) => {
  const f = await transferFixture(t);
  await executeTransfer(
    f.root,
    f.bytes,
    f.context,
    f.observed,
    'publish',
    f.execute,
  );
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]?.executable, process.execPath);
  assert.equal(f.calls[0]?.args[1], 'publish');
});
test('runner and trusted manifest mutations invoke zero runners', async (t) => {
  for (const path of ['runner.mjs', 'runner-manifest.json']) {
    const f = await transferFixture(t);
    f.files.set(path, new TextEncoder().encode('modified'));
    const bytes = f.archive();
    f.observed.artifactDigest = `sha256:${assetDigest(bytes)}`;
    await assert.rejects(
      executeTransfer(
        f.root,
        bytes,
        f.context,
        f.observed,
        'publish',
        f.execute,
      ),
      /MISMATCH/,
    );
    assert.equal(f.calls.length, 0);
  }
});
test('independent API artifact identity digest and job origin cannot be self declared', async (t) => {
  const f = await transferFixture(t);
  for (const patch of [
    { artifactDigest: 'sha256:' + 'f'.repeat(64) },
    { artifactName: 'other' },
    { artifactId: 0 },
    { jobState: 'failure' },
  ]) {
    await assert.rejects(
      executeTransfer(
        f.root,
        f.bytes,
        f.context,
        { ...f.observed, ...patch },
        'publish',
        f.execute,
      ),
    );
    assert.equal(f.calls.length, 0);
  }
});
test('stale producer run attempt source and fake API observations refuse execution', async (t) => {
  const f = await transferFixture(t);
  for (const patch of [
    { producerAppId: 999 },
    { attempt: 2 },
    { runId: 456 },
    { sourceSha: 'b'.repeat(40) },
  ])
    await assert.rejects(
      executeTransfer(
        f.root,
        f.bytes,
        f.context,
        { ...f.observed, ...patch },
        'release',
        f.execute,
      ),
    );
  const fake: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/actions/runs/123'))
      return Response.json({ id: 123, run_attempt: 2 });
    throw Error('unexpected endpoint');
  };
  await assert.rejects(
    inspectTransfer(f.root, f.context, 'token', fake),
    /RUN_MISMATCH/,
  );
  assert.equal(f.calls.length, 0);
});
test('tracked unset workflow producer policy refuses before any artifact execution', async (t) => {
  const f = await transferFixture(t);
  await cp(
    '.github/publication/trusted-policy.json',
    join(f.root, '.github/publication/trusted-policy.json'),
  );
  await assert.rejects(
    executeTransfer(
      f.root,
      f.bytes,
      f.context,
      f.observed,
      'publish',
      f.execute,
    ),
    /POLICY_INCOMPLETE/,
  );
  assert.equal(f.calls.length, 0);
});
test('unsafe member paths special files and duplicate extraction entries never run', async (t) => {
  for (const name of [
    'request.json',
    'publication.json',
    'envelopes/evidence.json',
  ]) {
    for (const extra of [0, 1])
      await t.test(
        `${name} metadata limit ${extra ? 'plus one runner zero' : 'exact verified runner one'}`,
        async () => {
          const f = await transferFixture(t);
          const input = tar([
            {
              name,
              value: '{}'.padEnd(ASSET_LIMITS.metadataBytes + extra, ' '),
            },
          ]);
          f.files.set('inputs.tgz', input);
          f.context.inputDigest = assetDigest(input);
          const bytes = f.archive(),
            observed = {
              ...f.observed,
              artifactDigest: `sha256:${assetDigest(bytes)}`,
            };
          if (extra) {
            await assert.rejects(
              executeTransfer(
                f.root,
                bytes,
                f.context,
                observed,
                'publish',
                f.execute,
              ),
              /JSON|METADATA|metadata|limit/i,
            );
            assert.equal(f.calls.length, 0);
          } else {
            await executeTransfer(
              f.root,
              bytes,
              f.context,
              observed,
              'publish',
              f.execute,
            );
            assert.equal(f.calls.length, 1);
          }
        },
      );
  }
  const f = await transferFixture(t);
  for (const row of [
    { name: '../runner.mjs', bytes: new Uint8Array() },
    { name: 'runner.mjs', bytes: new Uint8Array(), mode: 0xa1ff },
  ]) {
    const bytes = zip([row]);
    const observed = {
      ...f.observed,
      artifactDigest: `sha256:${assetDigest(bytes)}`,
    };
    await assert.rejects(
      executeTransfer(f.root, bytes, f.context, observed, 'publish', f.execute),
    );
    assert.equal(f.calls.length, 0);
  }
});
test('transferred bootstrap cannot replace the independent tag checkout verifier', async (t) => {
  const f = await transferFixture(t);
  f.files.set('bootstrap.mjs', new TextEncoder().encode('evil'));
  const bytes = f.archive();
  await assert.rejects(
    executeTransfer(
      f.root,
      bytes,
      f.context,
      { ...f.observed, artifactDigest: `sha256:${assetDigest(bytes)}` },
      'publish',
      f.execute,
    ),
    /MEMBER_SET/,
  );
  assert.equal(f.calls.length, 0);
});
