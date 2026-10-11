import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import type { DistributionInput } from '../../scripts/guest-distribution/stage.js';
import { stageDistribution } from '../../scripts/guest-distribution/stage.js';

const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
function elf(marker: number) {
  const bytes = Buffer.alloc(128);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  bytes.writeUInt16LE(2, 16);
  bytes.writeUInt16LE(62, 18);
  bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(1, 56);
  bytes.writeUInt32LE(1, 64);
  bytes.writeBigUInt64LE(128n, 96);
  bytes.writeBigUInt64LE(128n, 104);
  bytes[127] = marker;
  return bytes;
}
async function inputs(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'guest-stage-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const existingRoot = join(dir, 'existing-root');
  await mkdir(join(existingRoot, 'dist/legacy'), { recursive: true });
  await writeFile(
    join(existingRoot, 'dist/legacy/old.wasm'),
    Buffer.from([0, 255, 17]),
  );
  const builds: import('../../scripts/guest-distribution/stage.js').BuildInput[] =
    [];
  for (const [index, ref] of ['main', 'feature/guest'].entries()) {
    const guestPath = join(dir, `guest-${index}`),
      buildInfoPath = join(dir, `info-${index}.json`);
    const fixturePath = join(dir, `fixture-${index}.json`);
    await writeFile(guestPath, elf(index + 1));
    await writeFile(
      buildInfoPath,
      JSON.stringify({
        schemaVersion: 1,
        tool: 'aube',
        ref,
        source: {
          url: 'https://example.test/source',
          ref,
          commit: String(index + 1).repeat(40),
        },
        built_at: '2026-10-08T00:00:00Z',
        target: 'x86_64-unknown-linux-musl',
        linkage: 'static',
        libc: 'musl',
      }),
    );
    await writeFile(fixturePath, JSON.stringify({ 'app/name': ref }));
    builds.push({
      tool: 'aube',
      ref,
      guestPath,
      buildInfoPath,
      fixturePaths: { seed: fixturePath },
    });
  }
  return {
    dir,
    output: join(dir, 'site'),
    input: {
      existingRoot,
      tools: {
        aube: { default: 'main', fixture: 'seed', cwd: '/work/app' },
        legacy: { label: 'legacy' },
      } as import('../../scripts/guest-distribution/stage.js').DistributionInput['tools'],
      manifest: {
        note: 'keep wrapper',
        builds: {
          aube: {
            main: {
              upstream_pr: null,
              custom: 'keep',
              source: { type: 'repository' },
            },
          },
          legacy: {
            old: {
              source: { type: 'legacy' },
              custom: 42,
              wasm: 'dist/legacy/old.wasm',
            },
          },
        },
      },
      builds,
    },
  };
}

test('normal candidate hashes guest, fixture and exact provenance bytes independently', async (t) => {
  const { input, output } = await inputs(t);
  const result = await stageDistribution(input, output);
  const manifest = JSON.parse(
    await readFile(join(output, 'dist/builds.json'), 'utf8'),
  );
  for (const build of Object.values(
    manifest.builds?.aube,
  ) as import('../../integration/terrarium/guest-distribution/index.js').GuestBuild[]) {
    for (const asset of [
      build.guest,
      build.buildInfo,
      ...Object.values(build.fixtures),
    ]) {
      assert.equal(hash(await readFile(join(output, asset.url))), asset.sha256);
    }
  }
  assert.ok(result.files.length >= 8);
});

test('two refs use separated asset paths without interpreting branch slashes as directories', async (t) => {
  const { input, output } = await inputs(t);
  const { manifest } = await stageDistribution(input, output);
  const first = manifest.builds!.aube.main,
    second = manifest.builds!.aube['feature/guest'];
  assert.notEqual(first.guest?.url, second.guest?.url);
  assert.notEqual(first.guest?.sha256, second.guest?.sha256);
  assert.notEqual(first.source?.commit, second.source?.commit);
  assert.ok(!second.guest?.url.includes('feature/guest'));
});

test('legacy wrappers, tools and old selected-entry metadata survive unchanged', async (t) => {
  const { input, output } = await inputs(t);
  const before = structuredClone(input);
  const { manifest } = await stageDistribution(input, output);
  assert.equal(manifest.note, 'keep wrapper');
  assert.deepEqual(manifest.builds?.legacy, before.manifest.builds?.legacy);
  assert.equal(manifest.builds?.aube.main.custom, 'keep');
  assert.equal(manifest.builds?.aube.main.upstream_pr, null);
  assert.equal(manifest.builds?.aube.main.source?.type, 'repository');
  assert.deepEqual(
    JSON.parse(await readFile(join(output, 'tools.json'), 'utf8')),
    input.tools,
  );
  assert.deepEqual(input, before);
});

test('missing inputs and source commit stop before any candidate is created', async (t) => {
  const { input, output } = await inputs(t);
  const original = input.builds[0].guestPath;
  input.builds[0].guestPath += '.absent';
  await assert.rejects(
    stageDistribution(input, output),
    /guest: input asset unavailable/,
  );
  input.builds[0].guestPath = original;
  const info = JSON.parse(
    await readFile(input.builds[0].buildInfoPath, 'utf8'),
  );
  delete info.source.commit;
  await writeFile(input.builds[0].buildInfoPath, JSON.stringify(info));
  await assert.rejects(stageDistribution(input, output), /commit/);
  await assert.rejects(readFile(join(output, 'tools.json')), {
    code: 'ENOENT',
  });
});

test('target and identity cannot be substituted; unpatched pitchfork can be staged', async (t) => {
  const { input, output } = await inputs(t);
  const infoPath = input.builds[0].buildInfoPath;
  const original = JSON.parse(await readFile(infoPath, 'utf8'));
  for (const change of [
    { target: 'x86_64-unknown-linux-gnu' },
    { tool: 'pitchfork' },
    { ref: 'other' },
  ]) {
    await writeFile(infoPath, JSON.stringify({ ...original, ...change }));
    await assert.rejects(stageDistribution(input, output), /build-info/);
  }
  input.tools.pitchfork = {};
  input.builds[0].tool = 'pitchfork';
  await writeFile(infoPath, JSON.stringify({ ...original, tool: 'pitchfork' }));
  await assert.doesNotReject(stageDistribution(input, output));
});

test('dynamic ELF, invalid fixture and duplicate refs fail atomically; prior candidate stays intact', async (t) => {
  const { input, output } = await inputs(t);
  const bytes = elf(1);
  bytes.writeUInt32LE(3, 64);
  await writeFile(input.builds[0].guestPath, bytes);
  await assert.rejects(stageDistribution(input, output), /PT_INTERP/);
  await writeFile(input.builds[0].guestPath, elf(1));
  const fixturePath = input.builds[0].fixturePaths!.seed;
  await writeFile(fixturePath, JSON.stringify({ '../outside': 'secret' }));
  await assert.rejects(stageDistribution(input, output), /parent path/);
  await writeFile(fixturePath, '{}');
  input.builds.push({ ...input.builds[0] });
  await assert.rejects(stageDistribution(input, output), /duplicate/);
  input.builds.pop();
  await mkdir(output);
  await writeFile(join(output, 'existing'), 'keep');
  await assert.rejects(stageDistribution(input, output), /staging failed/);
  assert.equal(await readFile(join(output, 'existing'), 'utf8'), 'keep');
});

test('candidate supply remains outside fixed npm files/exports', async (t) => {
  const { input, output } = await inputs(t);
  await stageDistribution(input, output);
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.ok(
    packageJson.files.every(
      (path: string) =>
        !path.startsWith('integration/') &&
        !path.startsWith('scripts/guest-distribution'),
    ),
  );
  assert.ok(
    !JSON.stringify(packageJson.exports).includes('guest-distribution'),
  );
});

test('standalone additions preserve retained ref assets and refuse unsafe prior supply', async (t) => {
  await t.test(
    'legacy-only retained asset requires root even without retained C3 refs',
    async (context) => {
      const { input, dir, output } = await inputs(context);
      const legacy = { wasm: 'dist/legacy/old.wasm' };
      const { existingRoot: _existingRoot, ...withoutRoot } = input;
      const next: DistributionInput = {
        ...withoutRoot,
        manifest: { builds: { legacy: { old: legacy } } },
        builds: [input.builds[0]],
      };
      await assert.rejects(
        stageDistribution(next, output),
        /retained|existing|asset|root/,
      );
      await assert.rejects(readFile(join(output, 'tools.json')), {
        code: 'ENOENT',
      });
      const existingRoot = join(dir, 'legacy-root');
      const legacyBytes = Buffer.from([0, 255, 17]);
      await mkdir(join(existingRoot, 'dist/legacy'), { recursive: true });
      await writeFile(join(existingRoot, legacy.wasm), legacyBytes);
      const result = await stageDistribution({ ...next, existingRoot }, output);
      assert.deepEqual(result.manifest.builds!.legacy.old, legacy);
      assert.deepEqual(await readFile(join(output, legacy.wasm)), legacyBytes);
    },
  );
  async function prior(context: TestContext) {
    const fixture = await inputs(context);
    const old = await stageDistribution(
      { ...fixture.input, builds: [fixture.input.builds[0]] },
      fixture.output,
    );
    const next: DistributionInput & { existingRoot: string } = Object.assign(
      {},
      fixture.input,
      {
        manifest: old.manifest,
        builds: [fixture.input.builds[1]],
        existingRoot: fixture.output,
      },
    );
    return { ...fixture, old, next, candidate: join(fixture.dir, 'candidate') };
  }
  await t.test(
    'retained guest, all fixtures, provenance and legacy bytes exist in candidate',
    async (context) => {
      const { next, output, candidate } = await prior(context);
      const legacyBytes = Buffer.from([0, 255, 17]);
      await mkdir(join(output, 'dist/legacy'), { recursive: true });
      await writeFile(join(output, 'dist/legacy/old.wasm'), legacyBytes);
      next.manifest.builds!.legacy.old.wasm = 'dist/legacy/old.wasm';
      const { manifest } = await stageDistribution(next, candidate);
      const retained = manifest.builds!.aube.main;
      for (const asset of [
        retained.guest!,
        retained.buildInfo!,
        ...Object.values(retained.fixtures!),
      ]) {
        const bytes = await readFile(join(candidate, asset.url));
        assert.equal(hash(bytes), asset.sha256);
        assert.deepEqual(bytes, await readFile(join(output, asset.url)));
      }
      assert.deepEqual(
        await readFile(join(candidate, 'dist/legacy/old.wasm')),
        legacyBytes,
      );
      assert.deepEqual(manifest.builds!.legacy, next.manifest.builds!.legacy);
    },
  );
  await t.test(
    'retained ref requires existing root and missing assets fail before output',
    async (context) => {
      const { next, output, candidate } = await prior(context);
      const { existingRoot: _existingRoot, ...withoutRoot } = next;
      await assert.rejects(
        stageDistribution(withoutRoot, candidate),
        /retained|existing|asset|root/,
      );
      await rm(join(output, next.manifest.builds!.aube.main.guest!.url));
      await assert.rejects(
        stageDistribution(next, candidate),
        /retained|asset|unavailable|missing/,
      );
      await assert.rejects(readFile(join(candidate, 'tools.json')), {
        code: 'ENOENT',
      });
    },
  );
  await t.test(
    'retained digest tamper, root escape and symlink are refused',
    async (context) => {
      const { next, output, candidate } = await prior(context);
      const guest = next.manifest.builds!.aube.main.guest!;
      const original = guest.url;
      const bytes = await readFile(join(output, original));
      await writeFile(join(output, original), Buffer.from('tampered'));
      await assert.rejects(
        stageDistribution(next, candidate),
        /digest|SHA|mismatch|retained/,
      );
      await writeFile(join(output, original), bytes);
      guest.url = '../outside';
      await assert.rejects(
        stageDistribution(next, candidate),
        /path|outside|relative|retained/,
      );
      guest.url = original;
      await rm(join(output, original));
      const outside = join(next.existingRoot, '..', 'outside-guest');
      await writeFile(outside, bytes);
      await symlink(outside, join(output, original));
      await assert.rejects(
        stageDistribution(next, candidate),
        /symlink|symbolic|retained/,
      );
      await assert.rejects(readFile(join(candidate, 'tools.json')), {
        code: 'ENOENT',
      });
    },
  );
});
