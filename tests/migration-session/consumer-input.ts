import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from '../../scripts/package/stage-package.js';
import type { GuestExpectation } from '../../types/index.js';

/** Every real consumer uses the freshly staged U2 pack, never the U1 pack proof. */
export async function consumerInput() {
  const candidatePath = process.env.FORMICARIUM_CANDIDATE;
  const consumer = process.env.FORMICARIUM_CONSUMER;
  const guestPath = process.env.FORMICARIUM_SESSION_GUEST;
  if (!candidatePath || !consumer || !guestPath)
    throw Error(
      'U2 candidate, independently installed consumer and real guest inputs required',
    );
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  assert.equal(
    candidate.version,
    '0.3.0',
    'staging-only U2 provisional candidate version',
  );
  assert.equal(
    sha256(await readFile(candidate.tarball.path)),
    candidate.tarball.sha256,
  );
  const repository = await realpath(new URL('../../', import.meta.url));
  const consumerRoot = await realpath(consumer);
  assert.ok(
    consumerRoot !== repository && !consumerRoot.startsWith(repository + '/'),
  );
  const packageRoot = resolve(
    consumerRoot,
    'node_modules/@aletheia-works/formicarium',
  );
  for (const file of candidate.files)
    assert.equal(
      sha256(await readFile(resolve(packageRoot, file.path))),
      file.sha256,
      `U2 installed file ${file.path}`,
    );
  for (const file of ['runtime/guest-validation.js', 'runtime/session-port.js'])
    assert.ok(
      candidate.files.some((entry: { path: string }) => entry.path === file),
    );
  const inventory = JSON.parse(
    await readFile(
      new URL(
        '../../docs/results/terrarium-migration-preflight-evidence/mirror-input.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const aube = inventory.assets.find(
    (entry: { tool: string }) => entry.tool === 'aube',
  );
  if (!aube) throw Error('fixed official aube identity missing');
  const bytes = new Uint8Array(await readFile(guestPath));
  assert.equal(sha256(bytes), aube.elfSha256);
  const expected: GuestExpectation = {
    elfSha256: aube.elfSha256,
    buildInfoSha256: aube.buildInfoSha256,
    identity: aube.buildInfo,
  };
  return { packageRoot, consumerRoot, candidate, bytes, expected };
}
