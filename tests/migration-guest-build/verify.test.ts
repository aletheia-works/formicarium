import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  guestBuildKey,
  guestCanonical,
} from '../../runtime/guest-validation.js';
import { createSession } from '../../runtime/node/api.js';
import {
  type BuildReceipt,
  checkReuse,
  checkSet,
  sha256,
  verifySet,
} from '../../scripts/migration-guest-build/verify.js';
import type { GuestBuildInfo } from '../../types/index.js';
import { developmentAssets } from '../package/fixtures.js';

const encoder = new TextEncoder();
const SOURCE = {
  repository: 'https://github.com/biomejs/biome',
  commit: '2405c7620169bd0719166af09a8d89cc76fb37fb',
};

function setFor(elf: Uint8Array, tool = 'biome') {
  const partial: GuestBuildInfo = {
    schemaVersion: 1,
    tool,
    versionOrName: SOURCE.commit,
    source: SOURCE,
    target: 'x86_64-unknown-linux-musl',
    rustc: 'rustc 1.98.1 (48a229cea 2026-09-01)',
    sourcePatches: [],
    dependencies: [{ tool: 'cargo-lock', ...SOURCE, digest: 'c'.repeat(64) }],
    builderHash: 'b'.repeat(64),
    buildKey: '',
    elfSha256: sha256(elf),
  };
  const info = { ...partial, buildKey: guestBuildKey(partial) };
  const buildInfo = encoder.encode(guestCanonical(info));
  const catalog = encoder.encode(
    JSON.stringify({
      schemaVersion: 1,
      catalogId: `guest-${tool}-${info.buildKey}`,
      defaults: { [tool]: info.versionOrName },
      entries: [
        {
          tool,
          versionOrName: info.versionOrName,
          url: `https://github.com/aletheia-works/vivarium/releases/download/guest-${tool}-${info.buildKey}/${tool}`,
          format: 'elf',
          downloadSha256: info.elfSha256,
          downloadBytes: elf.byteLength,
          elfBytes: elf.byteLength,
          buildInfo: info,
          buildInfoSha256: sha256(buildInfo),
        },
      ],
    }),
  );
  return {
    files: { elf, buildInfo, catalog },
    expected: { tool, key: info.buildKey, ...SOURCE },
    info,
  };
}

const refused = (pattern: RegExp) => (error: Error) => {
  assert.match(error.message, pattern);
  return true;
};

async function guest(name: string): Promise<Uint8Array> {
  return new Uint8Array(
    await readFile(new URL(`../../dist/guests/${name}`, import.meta.url)),
  );
}

test('a consistent set runs --version through formicarium and records the evidence', async (t) => {
  const session = await createSession({ assets: await developmentAssets(t) });
  t.after(() => session.dispose());
  const { files, expected } = setFor(await guest('aube'), 'aube');
  const evidence = await verifySet(files, expected, session);
  assert.equal(evidence.version.exitCode, 0);
  assert.match(evidence.version.stdout, /^\d+\.\d+\.\d+ /);
  assert.equal(evidence.elfSha256, sha256(files.elf));
  assert.equal(evidence.buildKey, expected.key);
});

test('a guest whose --version exits non-zero is refused, not recorded as success', async (t) => {
  const session = await createSession({ assets: await developmentAssets(t) });
  t.after(() => session.dispose());
  const { files, expected } = setFor(await guest('exit3'), 'exit3');
  await assert.rejects(
    verifySet(files, expected, session),
    refused(/exited with 3/),
  );
});

test('an ELF that differs from build-info is refused', async () => {
  const { files, expected } = setFor(await guest('hello'));
  const elf = new Uint8Array(files.elf);
  elf[elf.length - 1] ^= 1;
  assert.throws(
    () => checkSet({ ...files, elf }, expected),
    refused(/ELF differs/),
  );
});

test('a build-info whose buildKey does not follow from its inputs is refused', async () => {
  const { files, expected, info } = setFor(await guest('hello'));
  const forged = encoder.encode(
    guestCanonical({ ...info, builderHash: 'd'.repeat(64) }),
  );
  assert.throws(
    () => checkSet({ ...files, buildInfo: forged }, expected),
    refused(/does not follow/),
  );
});

test('a build-info that is not canonical JSON is refused', async () => {
  const { files, expected, info } = setFor(await guest('hello'));
  const pretty = encoder.encode(JSON.stringify(info, null, 2));
  assert.throws(
    () => checkSet({ ...files, buildInfo: pretty }, expected),
    refused(/canonical/),
  );
});

test('a set for another key or another repository is refused', async () => {
  const { files, expected } = setFor(await guest('hello'));
  assert.throws(
    () => checkSet(files, { ...expected, key: 'e'.repeat(64) }),
    refused(/another key/),
  );
  assert.throws(
    () =>
      checkSet(files, {
        ...expected,
        repository: 'https://github.com/jambalaya56562/biome',
      }),
    refused(/another source/),
  );
});

test('a catalog that does not match the files is refused', async () => {
  const one = setFor(await guest('hello'));
  const other = setFor(await guest('probe'));
  assert.throws(
    () =>
      checkSet({ ...one.files, catalog: other.files.catalog }, one.expected),
    refused(/catalog entry differs/),
  );
});

test('a build-info with a repeated key or above 1 MiB is refused', async () => {
  const { files, expected } = setFor(await guest('hello'));
  const text = new TextDecoder().decode(files.buildInfo);
  const repeated = encoder.encode(text.replace('{', '{"tool":"x",'));
  assert.throws(
    () => checkSet({ ...files, buildInfo: repeated }, expected),
    refused(/duplicate|repeat/i),
  );
  const large = encoder.encode(
    `${text.slice(0, -1)},"pad":"${'x'.repeat(1_048_576)}"}`,
  );
  assert.throws(
    () => checkSet({ ...files, buildInfo: large }, expected),
    refused(/larger than/),
  );
});

test('reuse needs a compiling first run and a non-compiling second run with the same digests', async () => {
  const { files, expected } = setFor(await guest('hello'));
  const checked = checkSet(files, expected);
  const evidence = {
    schemaVersion: 1 as const,
    tool: expected.tool,
    buildKey: expected.key,
    source: SOURCE,
    elfSha256: checked.elfSha256,
    buildInfoSha256: checked.buildInfoSha256,
    catalogSha256: checked.catalogSha256,
    version: { exitCode: 0, stdout: '', stdoutSha256: sha256('') },
  };
  const receipt = (compiled: boolean): BuildReceipt => ({
    buildKey: expected.key,
    compiled,
    elfSha256: checked.elfSha256,
    buildInfoSha256: checked.buildInfoSha256,
    catalogSha256: checked.catalogSha256,
    source: SOURCE,
  });
  checkReuse(receipt(true), receipt(false), evidence);
  assert.throws(
    () => checkReuse(receipt(true), receipt(true), evidence),
    refused(/must not have compiled/),
  );
  assert.throws(
    () => checkReuse(receipt(false), receipt(false), evidence),
    refused(/must have compiled/),
  );
  assert.throws(
    () =>
      checkReuse(
        receipt(true),
        { ...receipt(false), elfSha256: 'f'.repeat(64) },
        evidence,
      ),
    refused(/other digests/),
  );
});
