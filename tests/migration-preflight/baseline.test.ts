import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  truncate,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import type { BaselineInputs } from '../../scripts/migration-preflight/baseline.js';
import {
  BASELINE_COMMIT,
  BASELINE_REPOSITORY,
  baselineBuilderHash,
  baselineKey,
  fetchMakePackage,
  MAKE_PACKAGE,
  readAccepted,
  runBaseline,
  validateBaselineElf,
} from '../../scripts/migration-preflight/baseline.js';

test('make APK identity changes the canonical build key', () => {
  const original = inputs();
  original.dependencies = [
    {
      tool: 'make',
      repository: MAKE_PACKAGE.repository,
      commit: MAKE_PACKAGE.commit,
      digest: MAKE_PACKAGE.digest,
    },
  ];
  const changed = structuredClone(original);
  changed.dependencies = [
    { ...original.dependencies[0]!, digest: 'f'.repeat(64) },
  ];
  assert.notEqual(baselineKey(original), baselineKey(changed));
});
test('make APK bounded acquisition rejects HTTP, excess, truncation, digest and abort', async () => {
  for (const response of [
    new Response(null, { status: 404 }),
    new Response(new Uint8Array(MAKE_PACKAGE.bytes + 1)),
    new Response(new Uint8Array(1)),
    new Response(new Uint8Array(MAKE_PACKAGE.bytes)),
  ]) {
    const fetcher = (async (_url: unknown, init: RequestInit) => {
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      return response;
    }) as typeof fetch;
    await assert.rejects(
      fetchMakePackage(new AbortController().signal, fetcher),
      /make APK/,
    );
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchMakePackage(
      controller.signal,
      (async () => new Response(new Uint8Array(1))) as typeof fetch,
    ),
  );
});

// Explicit local fixtures: these are not real remote CI build/reuse evidence.
function inputs(): BaselineInputs {
  const value: BaselineInputs = {
    schemaVersion: 1,
    tool: 'biome',
    versionOrName: 'fixture-baseline',
    repository: BASELINE_REPOSITORY,
    commit: BASELINE_COMMIT,
    target: 'x86_64-unknown-linux-musl',
    builderInventory: { 'fixture-script': 'a'.repeat(64) },
    builderHash: 'b'.repeat(64),
    image: `example.org/fixture@sha256:${'c'.repeat(64)}`,
    rustc: 'rustc fixture',
    cargo: 'cargo fixture',
    cargoLockSha256: 'd'.repeat(64),
    sourceFileDigests: {
      'Cargo.lock': 'd'.repeat(64),
      'Cargo.toml': 'e'.repeat(64),
      'rust-toolchain.toml': 'f'.repeat(64),
      '.cargo/config.toml': 'a'.repeat(64),
    },
    dependencies: [],
    sourcePatches: [],
    cargoArgs: [
      'build',
      '--locked',
      '--release',
      '--target',
      'x86_64-unknown-linux-musl',
      '--package',
      'biome_cli',
    ],
    environment: { RUSTUP_TOOLCHAIN: 'fixture', CARGO_INCREMENTAL: '0' },
  };
  value.builderHash = baselineBuilderHash(value);
  return value;
}
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
async function scratch(run: (directory: string) => Promise<void>) {
  const directory = resolve(
    '.artifacts/migration-preflight-baseline-tests',
    randomUUID(),
  );
  await mkdir(directory, { recursive: true });
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
async function build(staging: string) {
  const file = resolve(staging, 'fixture-elf');
  await writeFile(file, elf());
  return { elf: file, versionExitCode: 0 };
}
test('canonical key is stable for reordered inventory keys and changes for every build input', () => {
  const original = inputs();
  const key = baselineKey(original);
  const reordered = {
    ...original,
    environment: { CARGO_INCREMENTAL: '0', RUSTUP_TOOLCHAIN: 'fixture' },
  };
  assert.equal(baselineKey(reordered), key);
  for (const change of [
    (value: BaselineInputs) => {
      value.image = `example.org/other@sha256:${'f'.repeat(64)}`;
    },
    (value: BaselineInputs) => {
      value.rustc = 'rustc changed';
    },
    (value: BaselineInputs) => {
      value.cargo = 'cargo changed';
    },
    (value: BaselineInputs) => {
      value.environment = { ...value.environment, CARGO_INCREMENTAL: '1' };
    },
    (value: BaselineInputs) => {
      value.cargoLockSha256 = 'e'.repeat(64);
      value.sourceFileDigests = {
        ...value.sourceFileDigests,
        'Cargo.lock': 'e'.repeat(64),
      };
    },
    (value: BaselineInputs) => {
      value.builderInventory = { 'fixture-script': 'e'.repeat(64) };
    },
  ]) {
    const value = structuredClone(original);
    change(value);
    value.builderHash = baselineBuilderHash(value);
    assert.notEqual(baselineKey(value), key);
  }
});
test('fixed commit, immutable image, inventory binding, source pins and compile recipe are mandatory', () => {
  for (const change of [
    { commit: 'main' },
    { image: 'rust:latest' },
    { builderHash: 'f'.repeat(64) },
    { sourcePatches: [{ name: 'unapproved', sha256: 'f'.repeat(64) }] },
    { cargoArgs: ['build'] },
    { sourceFileDigests: {} },
  ])
    assert.throws(() =>
      baselineKey({ ...inputs(), ...change } as BaselineInputs),
    );
});
test('first fixture build is atomically accepted; same-key second call skips compilation and checks version', async () =>
  scratch(async (cache) => {
    let compiles = 0;
    let versions = 0;
    const value = inputs();
    const options = {
      inputs: value,
      cache,
      build: async (directory: string) => {
        compiles++;
        return build(directory);
      },
      checkVersion: async () => {
        versions++;
        return 0;
      },
    };
    const first = await runBaseline(options);
    const second = await runBaseline(options);
    assert.equal(first.compileSkipped, false);
    assert.equal(second.compileSkipped, true);
    assert.equal(first.elfSha256, second.elfSha256);
    assert.equal(first.buildKey, second.buildKey);
    assert.equal(compiles, 1);
    assert.equal(versions, 1);
    assert.equal(
      first.elfSha256,
      createHash('sha256').update(elf()).digest('hex'),
    );
    assert.deepEqual(await readdir(cache), [baselineKey(value)]);
  }));
test('tampered ELF or metadata refuses reuse rather than silently recompiling', async () =>
  scratch(async (cache) => {
    const value = inputs();
    await runBaseline({ inputs: value, cache, build });
    const accepted = resolve(cache, baselineKey(value));
    const info = await readFile(resolve(accepted, 'build-info.json'));
    const bytes = elf();
    bytes[119] = 1;
    await writeFile(resolve(accepted, 'biome'), bytes);
    await assert.rejects(
      runBaseline({ inputs: value, cache, build, checkVersion: async () => 0 }),
      /digest mismatch/,
    );
    await writeFile(resolve(accepted, 'biome'), elf());
    const metadata = JSON.parse(info.toString('utf8'));
    metadata.source.commit = 'f'.repeat(40);
    await writeFile(
      resolve(accepted, 'build-info.json'),
      JSON.stringify(metadata),
    );
    await assert.rejects(readAccepted(accepted, value), /identity/);
  }));
test('cached metadata with duplicate keys, escaped aliases or over 1 MiB refuses reuse', async () =>
  scratch(async (cache) => {
    const value = inputs();
    await runBaseline({ inputs: value, cache, build });
    const accepted = resolve(cache, baselineKey(value));
    const path = resolve(accepted, 'build-info.json');
    const original = (await readFile(path)).toString('utf8');
    assert.equal((await readAccepted(accepted, value)).compileSkipped, true);
    const variants = [
      original.replace('{', '{"tool":"evil",'),
      original.replace('{', '{"t\\u006fol":"evil",'),
      original + ' '.repeat(1024 * 1024 + 1 - Buffer.byteLength(original)),
    ];
    for (const variant of variants) {
      await writeFile(path, variant);
      await assert.rejects(
        readAccepted(accepted, value),
        /duplicate JSON key|metadata exceeds 1 MiB/,
      );
      await assert.rejects(
        runBaseline({
          inputs: value,
          cache,
          build,
          checkVersion: async () => 0,
        }),
        /duplicate JSON key|metadata exceeds 1 MiB/,
      );
    }
    await writeFile(
      path,
      original + ' '.repeat(1024 * 1024 - Buffer.byteLength(original)),
    );
    assert.equal((await readAccepted(accepted, value)).compileSkipped, true);
    await writeFile(path, original);
    assert.equal((await readAccepted(accepted, value)).compileSkipped, true);
  }));
test('oversized cached metadata is refused from its size before the file is read', async () =>
  scratch(async (cache) => {
    const value = inputs();
    await runBaseline({ inputs: value, cache, build });
    const accepted = resolve(cache, baselineKey(value));
    // A sparse 3 GiB file: reading it whole would fail with a size error, not the limit.
    await truncate(resolve(accepted, 'build-info.json'), 3 * 1024 ** 3);
    await assert.rejects(
      readAccepted(accepted, value),
      /metadata exceeds 1 MiB/,
    );
  }));
test('partial accepted artifact and failed reused version are hard failures', async () =>
  scratch(async (cache) => {
    const value = inputs();
    const accepted = resolve(cache, baselineKey(value));
    await mkdir(accepted);
    await assert.rejects(
      runBaseline({ inputs: value, cache, build, checkVersion: async () => 0 }),
      /ENOENT/,
    );
    await rm(accepted, { recursive: true });
    await runBaseline({ inputs: value, cache, build });
    await assert.rejects(
      runBaseline({ inputs: value, cache, build, checkVersion: async () => 1 }),
      /version failed/,
    );
  }));
test('same key has one writer and a failed competing call preserves the first writer lock', async () =>
  scratch(async (cache) => {
    const value = inputs();
    let entered!: () => void;
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = runBaseline({
      inputs: value,
      cache,
      build: async (directory) => {
        entered();
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return build(directory);
      },
    });
    await ready;
    await assert.rejects(
      runBaseline({ inputs: value, cache, build }),
      /EEXIST/,
    );
    assert.ok((await readdir(cache)).includes(`${baselineKey(value)}.lock`));
    finish();
    await first;
  }));
test('deadline or interruption removes staging/lock and preserves previously accepted different-key output', async () =>
  scratch(async (cache) => {
    const original = inputs();
    await runBaseline({ inputs: original, cache, build });
    const changed = inputs();
    changed.environment = { CARGO_INCREMENTAL: '1' };
    changed.builderHash = baselineBuilderHash(changed);
    const waiting = async (
      _directory: string,
      signal: AbortSignal,
    ): Promise<{ elf: string; versionExitCode: number }> =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(Error('fixture cancelled')),
          { once: true },
        );
      });
    await assert.rejects(
      runBaseline({ inputs: changed, cache, build: waiting, timeoutMs: 10 }),
      /cancelled/,
    );
    assert.deepEqual(await readdir(cache), [baselineKey(original)]);
    assert.equal(
      (await readAccepted(resolve(cache, baselineKey(original)), original))
        .compileSkipped,
      true,
    );
  }));
test('ELF dynamic/bounds faults and failed initial version never create an accepted artifact', async () =>
  scratch(async (cache) => {
    const dynamic = elf();
    new DataView(dynamic.buffer).setUint32(64, 3, true);
    assert.throws(() => validateBaselineElf(dynamic), /dynamic/);
    const truncated = elf();
    new DataView(truncated.buffer).setBigUint64(32, 100n, true);
    assert.throws(() => validateBaselineElf(truncated), /headers/);
    await assert.rejects(
      runBaseline({
        inputs: inputs(),
        cache,
        build: async (directory) => ({
          ...(await build(directory)),
          versionExitCode: 1,
        }),
      }),
      /version failed/,
    );
    assert.deepEqual(await readdir(cache), []);
  }));
