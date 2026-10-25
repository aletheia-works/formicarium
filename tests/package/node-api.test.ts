import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createSession } from '../../runtime/node/api.js';
import { developmentAssets, elfHeader, fileEntry } from './fixtures.js';

test('Node public API copies seed and supports filesystem operations without loading core', async () => {
  const entry = fileEntry();
  const session = await createSession({ entries: [entry] });
  entry.data[0] = 99;
  assert.equal((await session.readFile(entry.path))[0], 1);
  await session.remove(entry.path);
  await assert.rejects(session.readFile(entry.path), { code: 'NOT_FOUND' });
  await session.reset();
  assert.equal((await session.readFile(entry.path))[0], 1);
  await session.dispose();
});
test('Node session creation validates options, assets and seed atomically', async () => {
  for (const options of [
    null,
    [],
    { cwd: '/tmp' },
    { entries: [fileEntry('/outside')] },
    { assets: {} },
  ])
    await assert.rejects(
      createSession(
        options as unknown as import('../../types/index.js').SessionOptions,
      ),
      { code: 'INVALID_INPUT' },
    );
});
test('missing core assets fail as ASSET_LOAD and session remains reusable', async () => {
  const missing = new URL('./missing-core-asset', import.meta.url);
  const session = await createSession({
    assets: {
      loaderURL: missing,
      wasmURL: missing,
      buildInfoURL: missing,
      workerURL: new URL(
        '../../runtime/node/package-worker.js',
        import.meta.url,
      ),
    },
  });
  await assert.rejects(session.run({ guest: elfHeader() }), {
    code: 'ASSET_LOAD',
  });
  assert.deepEqual(await session.listEntries(), []);
  await session.dispose();
});
test('missing explicit Worker asset is ASSET_LOAD before guest starts', async () => {
  const url = new URL('./missing-worker.mjs', import.meta.url);
  const assets = {
    loaderURL: url,
    wasmURL: url,
    workerURL: url,
    buildInfoURL: url,
  };
  const session = await createSession({ assets });
  await assert.rejects(session.run({ guest: elfHeader() }), {
    code: 'ASSET_LOAD',
  });
  await session.dispose();
});
test('real Node Worker runs registry-independent hello with copied args and byte output', async (t) => {
  const session = await createSession({ assets: await developmentAssets(t) });
  t.after(() => session.dispose());
  const guest = new Uint8Array(
    await readFile(new URL('../../dist/guests/hello', import.meta.url)),
  );
  const args = ['one', 'two words'];
  const chunks: import('../../types/index.js').OutputChunk[] = [];
  const running = session.run({
    guest,
    args,
    onOutput: (chunk) => chunks.push(chunk),
  });
  args[0] = 'changed';
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.equal(
    new TextDecoder().decode(result.stdout),
    'hello from formicarium guest\narg: one\narg: two words\n',
  );
  assert.equal(result.stderr.length, 0);
  assert.ok(chunks.length > 0);
  assert.ok(result.elapsedMs >= 0);
  assert.deepEqual(await session.listEntries(), []);
});
test('real Node nonzero guest resolves and immediate second run is not BUSY', async (t) => {
  const session = await createSession({ assets: await developmentAssets(t) });
  t.after(() => session.dispose());
  const guest = new Uint8Array(
    await readFile(new URL('../../dist/guests/exit3', import.meta.url)),
  );
  for (let count = 0; count < 2; count++) {
    const result = await session.run({ guest });
    assert.equal(result.exitCode, 3);
    assert.match(
      new TextDecoder().decode(result.stderr),
      /exiting with status 3/,
    );
  }
});
test('Node abort/reset/dispose produce defined public errors without implicit queue', async () => {
  const session = await createSession();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    session.run({ guest: elfHeader(), signal: controller.signal }),
    { code: 'ABORTED' },
  );
  await session.dispose();
  await session.dispose();
  await assert.rejects(session.reset(), { code: 'DISPOSED' });
  await assert.rejects(session.run({ guest: elfHeader() }), {
    code: 'DISPOSED',
  });
});
