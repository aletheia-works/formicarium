import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validateB1Pack } from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import {
  installPack,
  type PackRecord,
  packDistribute,
  packVerify,
} from '../scripts/pack.ts';
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
const b1 = validateB1Pack({
  schemaVersion: 1,
  releaseTag: `b1-${packSha.slice(0, 12)}`,
  packAsset: 'aletheia-works-formicarium-0.3.0.tgz',
  packSha256: packSha,
  evidenceAsset: 'api-acceptance.json',
  evidenceSha256: 'f'.repeat(64),
})!;
const evidence = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    schemaVersion: 1,
    evidenceId: 'b1',
    sourceCommit: commit('b1'),
    packageVersion: '0.3.0',
    packSha256: packSha,
    inventorySha256: 'a'.repeat(64),
    checks: [
      {
        name: 'types',
        status: 'passed',
        environment: 'host',
        logSha256: 'b'.repeat(64),
      },
    ],
    preflightEvidenceId: 'u1',
    ...overrides,
  });
const release = `https://github.com/owner/repo/releases/download/${b1.releaseTag}`;
function distributeWith(packBytes: Uint8Array, evidenceText: string) {
  return fakeFetch({
    [`${release}/${b1.packAsset}`]: bytes(packBytes),
    [`${release}/${b1.evidenceAsset}`]: bytes(
      new TextEncoder().encode(evidenceText),
    ),
  });
}

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
      releaseTag: null,
      evidenceSha256: null,
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
      'b1-pack-mismatch',
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

test('distribute fails closed without a B1 Release', async () => {
  await withLayout(async (layout) => {
    await rejects(
      packDistribute({ b1: null, repository: 'owner/repo', layout }),
      'b1-pack-unavailable',
    );
    await rejects(
      packDistribute({
        b1,
        repository: 'owner/repo',
        layout,
        fetchImpl: fakeFetch({}),
      }),
      'b1-pack-unavailable',
    );
  });
});

test('distribute refuses a pack or acceptance evidence that does not match', async () => {
  const fixedEvidence = (text: string) => ({
    ...b1,
    evidenceSha256: sha(text),
  });
  await withLayout(async (layout) => {
    const text = evidence();
    await rejects(
      packDistribute({
        b1: fixedEvidence(text),
        repository: 'owner/repo',
        layout,
        fetchImpl: distributeWith(packTgz('other'), text),
      }),
      'b1-pack-mismatch',
    );
    await rejects(
      packDistribute({
        b1,
        repository: 'owner/repo',
        layout,
        fetchImpl: distributeWith(tarball, text),
      }),
      'b1-pack-mismatch',
    );
    for (const wrong of [
      evidence({ packSha256: '0'.repeat(64) }),
      evidence({
        checks: [
          {
            name: 'types',
            status: 'unverified',
            environment: 'host',
            logSha256: 'b'.repeat(64),
          },
        ],
      }),
    ])
      await rejects(
        packDistribute({
          b1: fixedEvidence(wrong),
          repository: 'owner/repo',
          layout,
          fetchImpl: distributeWith(tarball, wrong),
        }),
        'b1-pack-mismatch',
      );
  });
});

test('distribute accepts the B1 pack and takes formicariumSourceCommit from the evidence', async () => {
  await withLayout(async (layout) => {
    const text = evidence();
    const record = await packDistribute({
      b1: { ...b1, evidenceSha256: sha(text) },
      repository: 'owner/repo',
      layout,
      fetchImpl: distributeWith(tarball, text),
    });
    assert.equal(record.mode, 'distribute');
    assert.equal(record.packSha256, packSha);
    assert.equal(record.formicariumSourceCommit, commit('b1'));
    assert.equal(record.releaseTag, b1.releaseTag);
  });
});
