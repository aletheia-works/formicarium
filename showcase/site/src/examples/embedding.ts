// The embedding guide shows this file as it is; the build type-checks it
// against the types of the candidate's pack.
import {
  createCommandSession,
  decodeUtf8,
  type GuestCatalog,
} from '@aletheia-works/formicarium';
import { createSession } from '@aletheia-works/formicarium/browser';

/**
 * Installs one tool from a catalog and prints its version. `packageBase` is
 * the same-origin URL of the package files; the page must be cross-origin
 * isolated (COOP/COEP headers or a service worker such as coi-serviceworker).
 */
export async function toolVersion(
  packageBase: URL,
  catalog: GuestCatalog,
  tool: string,
): Promise<string> {
  const session = await createSession({
    cwd: '/work/app',
    entries: [{ path: '/work/app', type: 'dir', mode: 0o755 }],
    assets: {
      loaderURL: new URL('assets/paludarium/index.mjs', packageBase),
      wasmURL: new URL('assets/paludarium/paludarium.wasm', packageBase),
      workerURL: new URL('runtime/web/package-worker.bundle.js', packageBase),
      buildInfoURL: new URL('assets/paludarium/build-info.json', packageBase),
    },
  });
  try {
    const shell = createCommandSession(session, { catalog });
    await shell.execute(`install ${tool}`, {
      onProgress: (progress) =>
        console.log(progress.phase, progress.processedBytes),
    });
    const result = await shell.execute(`${tool} --version`);
    return decodeUtf8(result.stdout);
  } finally {
    await session.dispose();
  }
}
