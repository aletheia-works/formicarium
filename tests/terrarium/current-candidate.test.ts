import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { PACKAGE_FILES } from '../../scripts/package/stage-package.js';
import {
  copyCurrentBundle,
  createCurrentRoot,
  currentCandidatePaths,
  currentTerminalOracle,
  currentTools,
  validateCurrentPackageManifest,
  validateCurrentPitchforkProvenance,
  verifyCurrentFilePins,
} from '../../scripts/terrarium/current-candidate.js';
import {
  sha256,
  verifyInstalledPackage,
} from '../../scripts/terrarium/evidence.js';

async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'u3-current-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'input'), 'original');
  return {
    root,
    pins: [{ path: 'input', size: 8, sha256: sha256('original') }],
  };
}
test('current supplier validates exact original bytes and separate site roots', async (t) => {
  const { root, pins } = await fixture(t);
  await verifyCurrentFilePins(root, pins, 1);
  const paths = currentCandidatePaths({ out: join(root, 'candidate') });
  assert.equal(paths.browserWebRoot, join(paths.siteRoot, 'web'));
  assert.notEqual(paths.siteRoot, paths.browserWebRoot);
  const bundle = { path: join(root, 'input'), sha256: sha256('original') };
  const output = join(root, 'assembled.mjs');
  await copyCurrentBundle(root, bundle, output);
  assert.equal(await readFile(output, 'utf8'), 'original');
  await assert.rejects(
    copyCurrentBundle(root, { ...bundle, sha256: sha256('modified') }, output),
    /digest differs/,
  );
  await assert.rejects(
    copyCurrentBundle(join(root, 'different'), bundle, output),
    /outside local candidate/,
  );
});
test('current supplier rejects missing and same-size changed bytes', async (t) => {
  const { root, pins } = await fixture(t);
  await rm(join(root, 'input'));
  await assert.rejects(verifyCurrentFilePins(root, pins, 1), /ENOENT/);
  await writeFile(join(root, 'input'), 'modified');
  await assert.rejects(verifyCurrentFilePins(root, pins, 1), /digest differs/);
});
test('current supplier rejects count and duplicate inventories', async (t) => {
  const { root, pins } = await fixture(t);
  await assert.rejects(
    verifyCurrentFilePins(root, [], 1),
    /count or duplicate/,
  );
  await assert.rejects(
    verifyCurrentFilePins(root, [...pins, ...pins], 2),
    /count or duplicate/,
  );
  const packageRoot = join(root, 'package'),
    manifestPath = join(root, 'manifest.json');
  for (const path of PACKAGE_FILES) {
    await mkdir(dirname(join(packageRoot, path)), { recursive: true });
    await writeFile(join(packageRoot, path), path);
  }
  const manifest = {
    package: '@aletheia-works/formicarium',
    version: 'fixture',
    blinkSourceDirty: false,
    files: PACKAGE_FILES.map((path) => ({ path, sha256: sha256(path) })),
  };
  assert.equal(manifest.files.length, PACKAGE_FILES.length);
  await writeFile(manifestPath, JSON.stringify(manifest));
  await verifyInstalledPackage({
    packageRoot,
    manifestPath,
    tarballPath: join(root, 'input'),
  });
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, files: manifest.files.slice(1) }),
  );
  await assert.rejects(
    verifyInstalledPackage({
      packageRoot,
      manifestPath,
      tarballPath: join(root, 'input'),
    }),
    /fixed package inventory differs/,
  );
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(join(packageRoot, PACKAGE_FILES[0]!), 'tamper');
  await assert.rejects(
    verifyInstalledPackage({
      packageRoot,
      manifestPath,
      tarballPath: join(root, 'input'),
    }),
    /installed package changed/,
  );
});
test('current supplier rejects size drift without repinning bytes', async (t) => {
  const { root, pins } = await fixture(t);
  await assert.rejects(
    verifyCurrentFilePins(root, [{ ...pins[0], size: 7 }], 1),
    /size differs/,
  );
  const generatorPath = 'packages/terrarium/scripts/gen-css.ts';
  const generatorPins = [
    { path: generatorPath, size: 8, sha256: sha256('original') },
  ];
  await mkdir(dirname(join(root, generatorPath)), { recursive: true });
  await writeFile(join(root, generatorPath), 'original');
  await verifyCurrentFilePins(root, generatorPins, 1);
  await writeFile(join(root, generatorPath), 'modified');
  await assert.rejects(
    verifyCurrentFilePins(root, generatorPins, 1),
    /digest differs/,
  );
  await rm(join(root, generatorPath));
  await assert.rejects(verifyCurrentFilePins(root, generatorPins, 1), /ENOENT/);
  const manifest = {
    blinkCommit: 'a882fb2f3df14115b7e46f6812fb296eef5934d7',
    blinkSourceDirty: false,
  };
  validateCurrentPackageManifest(manifest);
  assert.throws(
    () =>
      validateCurrentPackageManifest({ ...manifest, blinkSourceDirty: true }),
    /core identity differs/,
  );
  assert.throws(
    () =>
      validateCurrentPackageManifest({
        ...manifest,
        blinkCommit: '4'.repeat(40),
      }),
    /core identity differs/,
  );
});
test('current supplier rejects traversal and symlink inputs', async (t) => {
  const { root, pins } = await fixture(t);
  await assert.rejects(
    verifyCurrentFilePins(root, [{ ...pins[0], path: '../input' }], 1),
    /unsafe relative/,
  );
  await symlink(join(root, 'input'), join(root, 'alias'));
  await assert.rejects(
    verifyCurrentFilePins(root, [{ ...pins[0], path: 'alias' }], 1),
    /noncanonical or special/,
  );
});
test('current transaction rejects existing output and external owner writes', async (t) => {
  const { root } = await fixture(t);
  const owner = join(root, 'owner'),
    out = join(root, 'candidate');
  await mkdir(owner);
  await writeFile(join(owner, 'source'), 'untouched');
  await createCurrentRoot(owner, out);
  await assert.rejects(createCurrentRoot(owner, out), /EEXIST/);
  await assert.rejects(
    createCurrentRoot(owner, join(owner, 'candidate')),
    /outside external owner/,
  );
  assert.equal(await readFile(join(owner, 'source'), 'utf8'), 'untouched');
});
test('current terminal transformation changes only three pinned version oracles', () => {
  const original =
    "title unchanged; ref='v2.30.0'; expected='pitchfork 2.30.0\\n'; ready='v2.30.0'; aube2.7.0";
  assert.equal(
    currentTerminalOracle(original),
    "title unchanged; ref='v2.30.1'; expected='pitchfork 2.30.1\\n'; ready='v2.30.1'; aube2.7.0",
  );
  assert.throws(
    () =>
      currentTerminalOracle(
        original.replace("ready='v2.30.0'", "ready='other'"),
      ),
    /oracle count differs/,
  );
  const tools = {
    aube: { default: 'v2.7.0', fixture: 'aube-local-deps', cwd: '/work/app' },
    pitchfork: {
      default: 'v2.30.0',
      fixture: 'pitchfork-basic',
      cwd: '/work/app',
    },
  };
  assert.deepEqual(currentTools(tools), {
    ...tools,
    pitchfork: { ...tools.pitchfork, default: 'v2.30.1' },
  });
  assert.equal(tools.pitchfork.default, 'v2.30.0');
  assert.throws(
    () =>
      currentTools({
        ...tools,
        pitchfork: { ...tools.pitchfork, cwd: '/other' },
      }),
    /tools contract differs/,
  );
  const pins = {
    guestSha256:
      'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e',
    rawInfoSha256:
      'e733951d3039b2bd4f8af861a663797c27c8f915fa099ba7539c12b767446498',
  };
  const normalized = {
    tool: 'pitchfork',
    ref: 'v2.30.1',
    source: { commit: '1054549e85470b08d9507e2c82c850959a4b3914' },
    provenanceKind: 'observed-local-build',
    evidence: {
      guestSha256: pins.guestSha256,
      rawBuildInfoSha256: pins.rawInfoSha256,
    },
  };
  const raw = 'v2.30.1 1054549e85470b08d9507e2c82c850959a4b3914';
  validateCurrentPitchforkProvenance(normalized, raw, pins);
  assert.throws(
    () =>
      validateCurrentPitchforkProvenance(
        { ...normalized, ref: 'v2.30.0' },
        raw,
        pins,
      ),
    /provenance differs/,
  );
  assert.throws(
    () =>
      validateCurrentPitchforkProvenance(
        { ...normalized, provenanceKind: 'inferred' },
        raw,
        pins,
      ),
    /provenance differs/,
  );
  assert.throws(
    () =>
      validateCurrentPitchforkProvenance(normalized, raw, {
        ...pins,
        guestSha256: '0'.repeat(64),
      }),
    /provenance differs/,
  );
});
