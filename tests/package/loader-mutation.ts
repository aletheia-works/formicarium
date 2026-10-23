import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CORE_FILES,
  coreAssets,
  createCoreResourceOwner,
} from '../../runtime/core.js';

/** The real core files; the loader gains an observable test-only prefix after it is read. */
export async function mutatedLoaderFixture(
  directory: string,
  assetsRoot: string,
) {
  // The loader's directory holds the real core files and build information.
  for (const name of [...CORE_FILES, 'build-info.json'])
    await copyFile(join(assetsRoot, name), join(directory, name));
  const loaderURL = pathToFileURL(join(directory, 'index.mjs'));
  const original = await readFile(loaderURL);
  const marker = `__formicarium_unverified_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const changed = Buffer.concat([
    Buffer.from(
      `globalThis[${JSON.stringify(marker)}] = (globalThis[${JSON.stringify(marker)}] ?? 0) + 1;\n`,
    ),
    original,
  ]);
  let switched = false;
  const resources = createCoreResourceOwner();
  return {
    marker,
    resources,
    async dispose() {
      await resources.dispose();
    },
    assets: coreAssets(
      pathToFileURL(`${directory}/`),
      pathToFileURL(join(directory, 'unused.mjs')),
    ),
    // The loader changes on disk right after its verified bytes were read.
    async readBytes(url: string | URL) {
      if (String(url) === loaderURL.href && !switched) {
        switched = true;
        await writeFile(loaderURL, changed);
        return new Uint8Array(original);
      }
      return new Uint8Array(await readFile(new URL(url)));
    },
  };
}
