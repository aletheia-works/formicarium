import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { readNodeAsset } from '../../runtime/node/package-worker.js';
import { isolatedDirectory, serveDirectory } from './fixtures.js';

test('Node Worker reads file asset bytes without host filesystem mount', async (t) => {
  const directory = await isolatedDirectory(t);
  const path = join(directory, 'bytes');
  await writeFile(path, Uint8Array.of(0, 255));
  assert.deepEqual(
    await readNodeAsset(pathToFileURL(path)),
    Uint8Array.of(0, 255),
  );
});
test('Node Worker reads successful HTTP asset bytes', async (t) => {
  const directory = await isolatedDirectory(t);
  await writeFile(join(directory, 'bytes'), Uint8Array.of(128));
  const server = await serveDirectory(directory);
  t.after(server.close);
  assert.deepEqual(
    await readNodeAsset(`${server.url}/bytes`),
    Uint8Array.of(128),
  );
});
test('Node asset fetch rejects missing file and HTTP404', async (t) => {
  const directory = await isolatedDirectory(t);
  const server = await serveDirectory(directory);
  t.after(server.close);
  await assert.rejects(
    readNodeAsset(pathToFileURL(join(directory, 'missing'))),
  );
  await assert.rejects(
    readNodeAsset(`${server.url}/missing`),
    /Asset response/,
  );
});
async function workerMessage(t: TestContext, request: object) {
  const worker = new Worker(
    new URL('../../runtime/node/package-worker.js', import.meta.url),
  );
  t.after(() => worker.terminate());
  const message = once(worker, 'message');
  worker.postMessage(request);
  return (await message)[0];
}
test('actual Node Worker rejects unsupported protocol major', async (t) => {
  const result = await workerMessage(t, {
    type: 'run',
    protocolVersion: 1,
    sessionId: 's',
    runId: 'r',
    generation: 1,
  });
  assert.equal(result.type, 'error');
  assert.equal(result.code, 'EXECUTION');
});
test('actual Node Worker rejects unknown request type', async (t) => {
  const result = await workerMessage(t, {
    type: 'other',
    protocolVersion: 2,
    sessionId: 's',
    runId: 'r',
    generation: 1,
  });
  assert.equal(result.code, 'EXECUTION');
});
test('actual Node Worker classifies asset failure and suppresses arbitrary diagnostics', async (t) => {
  const result = await workerMessage(t, {
    type: 'run',
    protocolVersion: 2,
    sessionId: 's',
    runId: 'r',
    generation: 1,
    assets: {
      loaderURL: 'file:///missing-secret',
      wasmURL: 'file:///missing-secret',
      buildInfoURL: 'file:///missing-secret',
    },
  });
  assert.equal(result.code, 'ASSET_LOAD');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(result.runId, 'r');
});
