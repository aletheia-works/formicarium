// The formicarium core assets for a Node Session, from this checkout's dist/.
// The caller removes `directory` (the patched build-info) when it is done.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function nodeAssets() {
  const base = new URL('../../dist/blink/', import.meta.url);
  const loader = await readFile(new URL('blink.mjs', base));
  const wasm = await readFile(new URL('blink.wasm', base));
  const buildInfo = JSON.parse(
    await readFile(new URL('build-info.json', base), 'utf8'),
  );
  const hash = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');
  buildInfo.assetDigests = {
    loaderSha256: hash(loader),
    wasmSha256: hash(wasm),
  };
  const directory = await mkdtemp(join(tmpdir(), 'formicarium-guest-build-'));
  try {
    const infoPath = join(directory, 'build-info.json');
    await writeFile(infoPath, JSON.stringify(buildInfo));
    return {
      directory,
      assets: {
        loaderURL: new URL('blink.mjs', base),
        wasmURL: new URL('blink.wasm', base),
        buildInfoURL: pathToFileURL(infoPath),
        workerURL: new URL(
          '../../runtime/node/package-worker.js',
          import.meta.url,
        ),
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
