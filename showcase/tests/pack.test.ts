import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validateFormicariumRelease } from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import {
  installPack,
  type PackRecord,
  packDistribute,
  packVerify,
  REGISTRY,
  sha512Integrity,
  tagCommitFromListing,
} from '../scripts/pack.ts';
import { pinRelease } from '../scripts/pin-release.ts';
import { bytes, commit, fakeFetch, sha } from './fixtures/github.ts';
import { tgz } from './fixtures/tar.ts';
import { withLayout } from './fixtures/work.ts';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);
const packTgz = (name = '@aletheia-works/formicarium', root = 'package') =>
  tgz([
    { name: root, type: '5' },
    {
      name: `${root}/package.json`,
      body: JSON.stringify({ name, version: '0.3.0' }),
    },
    { name: `${root}/runtime/public.js`, body: 'export {};\n' },
  ]);
const tarball = packTgz();
const packSha = sha(tarball);
const release = validateFormicariumRelease({
  schemaVersion: 1,
  version: '0.4.0',
  integrity: sha512Integrity(tarball),
  sourceCommit: commit('v0.4.0'),
})!;
const metadataUrl = `${REGISTRY}/@aletheia-works%2fformicarium/0.4.0`;
const tarballUrl = `${REGISTRY}/@aletheia-works/formicarium/-/formicarium-0.4.0.tgz`;
const metadata = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: '@aletheia-works/formicarium',
    version: '0.4.0',
    dist: { tarball: tarballUrl, integrity: release.integrity },
    ...overrides,
  });
function registryWith(packBytes: Uint8Array, metadataText = metadata()) {
  return fakeFetch({
    [metadataUrl]: bytes(new TextEncoder().encode(metadataText)),
    [tarballUrl]: bytes(packBytes),
  });
}
const tagAt =
  (sourceCommit: string | null = release.sourceCommit) =>
  (tag: string) =>
    tag === 'v0.4.0' ? sourceCommit : null;

test('verify packs the same commit with the body stager and records its SHA256', async () => {
  await withLayout(async (layout) => {
    const name = 'aletheia-works-formicarium-0.1.0.tgz';
    const calls: string[][] = [];
    const runner = (file: string, args: readonly string[]) => {
      calls.push([file, ...args]);
      if (!args.includes('pack')) return '';
      const destination = args[args.indexOf('--pack-destination') + 1]!;
      writeFileSync(join(destination, name), tarball);
      return JSON.stringify([{ filename: name }]);
    };
    const record = await packVerify({
      sourceCommit: commit('head'),
      layout,
      run: runner,
    });
    assert.equal(record.packSha256, packSha);
    assert.equal(record.mode, 'verify');
    assert.equal(record.formicariumSourceCommit, commit('head'));
    assert.ok(
      calls[0]!.some((arg) => arg.endsWith('scripts/package/stage-package.js')),
    );
    assert.match(
      calls[0]![calls[0]!.indexOf('--out') + 1]!,
      /^\.artifacts\/showcase\/package-/,
    );
    assert.ok(calls[1]!.includes('--ignore-scripts'));
    await rejects(
      packVerify({ sourceCommit: 'main', layout, run: runner }),
      'config-invalid',
    );
    await rejects(
      packVerify({ sourceCommit: commit('head'), layout, run: () => '[]' }),
      'bad-body',
    );
  });
});

test('the pack is extracted only after its SHA256 matches the record', async () => {
  await withLayout(async (layout) => {
    await mkdir(layout.pack, { recursive: true });
    await writeFile(join(layout.pack, 'p.tgz'), tarball);
    const record: PackRecord = {
      schemaVersion: 1,
      mode: 'verify',
      tarball: 'p.tgz',
      packSha256: packSha,
      formicariumSourceCommit: commit('head'),
      npmVersion: null,
      integrity: null,
    };
    const destination = join(layout.root, 'node_modules', 'pkg');
    await installPack(record, { layout, destination });
    assert.match(
      await readFile(join(destination, 'package.json'), 'utf8'),
      /formicarium/,
    );
    await rejects(
      installPack(
        { ...record, packSha256: '0'.repeat(64) },
        { layout, destination },
      ),
      'checksum-mismatch',
    );
    await rejects(
      installPack(
        { ...record, mode: 'distribute', packSha256: '0'.repeat(64) },
        { layout, destination },
      ),
      'pack-mismatch',
    );
    for (const bad of [packTgz('other-package'), packTgz(undefined, 'pkg')]) {
      await writeFile(join(layout.pack, 'bad.tgz'), bad);
      await rejects(
        installPack(
          { ...record, tarball: 'bad.tgz', packSha256: sha(bad) },
          { layout, destination },
        ),
        'archive-invalid',
      );
    }
  });
});

test('distribute fails closed without a pinned release, the registry or the tag', async () => {
  await withLayout(async (layout) => {
    await rejects(
      packDistribute({ release: null, tagCommit: tagAt(), layout }),
      'release-unavailable',
    );
    await rejects(
      packDistribute({
        release,
        tagCommit: tagAt(),
        layout,
        fetchImpl: fakeFetch({}),
      }),
      'release-unavailable',
    );
    await rejects(
      packDistribute({
        release,
        tagCommit: tagAt(null),
        layout,
        fetchImpl: registryWith(tarball),
      }),
      'release-unavailable',
    );
  });
});

test('distribute refuses metadata, bytes or a tag that differ from the pin', async () => {
  await withLayout(async (layout) => {
    for (const fetchImpl of [
      registryWith(packTgz('other')),
      registryWith(tarball, metadata({ version: '0.4.1' })),
      registryWith(tarball, metadata({ name: 'other' })),
      registryWith(
        tarball,
        metadata({
          dist: {
            tarball: tarballUrl,
            integrity: sha512Integrity(packTgz('x')),
          },
        }),
      ),
      registryWith(
        tarball,
        metadata({
          dist: {
            tarball: 'https://example.com/formicarium-0.4.0.tgz',
            integrity: release.integrity,
          },
        }),
      ),
      registryWith(tarball, '{"name":1,"name":2}'),
    ])
      await rejects(
        packDistribute({ release, tagCommit: tagAt(), layout, fetchImpl }),
        'pack-mismatch',
      );
    await rejects(
      packDistribute({
        release,
        tagCommit: tagAt(commit('other')),
        layout,
        fetchImpl: registryWith(tarball),
      }),
      'pack-mismatch',
    );
  });
});

test('distribute accepts the pinned npm release and records its tag commit', async () => {
  await withLayout(async (layout) => {
    const record = await packDistribute({
      release,
      tagCommit: tagAt(),
      layout,
      fetchImpl: registryWith(tarball),
    });
    assert.deepEqual(record, {
      schemaVersion: 1,
      mode: 'distribute',
      tarball: 'aletheia-works-formicarium-0.4.0.tgz',
      packSha256: packSha,
      formicariumSourceCommit: release.sourceCommit,
      npmVersion: '0.4.0',
      integrity: release.integrity,
    });
    assert.deepEqual(
      await readFile(join(layout.pack, record.tarball)),
      Buffer.from(tarball),
    );
  });
});

test('the tag commit is the peeled commit of an annotated tag, else the tag itself', () => {
  const object = commit('tag-object');
  const target = commit('target');
  assert.equal(
    tagCommitFromListing(
      `${object}\trefs/tags/v0.4.0\n${target}\trefs/tags/v0.4.0^{}\n`,
      'v0.4.0',
    ),
    target,
  );
  assert.equal(
    tagCommitFromListing(`${target}\trefs/tags/v0.4.0\n`, 'v0.4.0'),
    target,
  );
  assert.equal(tagCommitFromListing('', 'v0.4.0'), null);
  assert.equal(
    tagCommitFromListing(`${target}\trefs/tags/v0.3.0\n`, 'v0.4.0'),
    null,
  );
  assert.equal(
    tagCommitFromListing('not-a-commit\trefs/tags/v0.4.0\n', 'v0.4.0'),
    null,
  );
});

test('a published stable release is pinned only after it passes the distribute checks', async () => {
  const pinned = await pinRelease('0.4.0', {
    tagCommit: tagAt(),
    fetchImpl: registryWith(tarball),
  });
  assert.deepEqual(pinned, {
    version: '0.4.0',
    integrity: release.integrity,
    sourceCommit: release.sourceCommit,
  });
  await assert.rejects(
    pinRelease('0.4.0-rc.1', {
      tagCommit: tagAt(),
      fetchImpl: registryWith(tarball),
    }),
    (error) => causeOf(error) === 'config-invalid',
  );
  await rejects(
    pinRelease('0.4.0', { tagCommit: tagAt(), fetchImpl: fakeFetch({}) }),
    'release-unavailable',
  );
  await rejects(
    pinRelease('0.4.0', {
      tagCommit: tagAt(null),
      fetchImpl: registryWith(tarball),
    }),
    'release-unavailable',
  );
  await rejects(
    pinRelease('0.4.0', {
      tagCommit: tagAt(),
      fetchImpl: registryWith(packTgz('other')),
    }),
    'pack-mismatch',
  );
});
