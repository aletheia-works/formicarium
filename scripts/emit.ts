import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CORE_FILES,
  CORE_PACKAGE,
  type CoreBuildInfo,
  sha256Hex,
} from '../runtime/core.js';
import { buildWorkerBundle } from './package/worker-bundle.js';

// Keep generated browser modules next to their sources so static URLs and
// package staging share the same layout. These outputs are ignored by SCM.
for (const directory of ['runtime', 'web', 'scripts', 'tests']) {
  await cp(resolve('.build', directory), resolve(directory), {
    recursive: true,
    filter: (source) => !source.endsWith('.ts'),
  });
}
// Playwright loads the checked-in TypeScript configurations directly.

// web/index.html loads the isolation worker of @aletheia-works/coi-serviceworker
// as a classic script. It registers itself with the scope of its own folder,
// so it sits at the root: the scope must also cover the Worker (runtime/web/)
// and the core (dist/paludarium/), or they are loaded without COEP and refused.
await copyFile(
  resolve(
    'node_modules/@aletheia-works/coi-serviceworker/coi-serviceworker.js',
  ),
  resolve('coi-serviceworker.js'),
);

// Browsers start the import-free Worker; build it from the copied modules.
buildWorkerBundle({ root: resolve('.') });

// The development harness and package staging read the core from
// dist/paludarium, with the digests the runtime checks before loading it.
const coreSource = resolve('node_modules', CORE_PACKAGE);
const coreTarget = resolve('dist/paludarium');
await rm(coreTarget, { recursive: true, force: true });
await mkdir(coreTarget, { recursive: true });
// The core's license and the notices of the crates in paludarium.wasm ship
// with it, but the runtime never loads them, so they carry no digest.
const CORE_NOTICES = ['LICENSE', 'THIRD-PARTY-NOTICES.txt'];
const files: Record<string, string> = {};
for (const name of [...CORE_FILES, ...CORE_NOTICES]) {
  await copyFile(resolve(coreSource, name), resolve(coreTarget, name));
  if (!CORE_NOTICES.includes(name))
    files[name] = await sha256Hex(await readFile(resolve(coreTarget, name)));
}
const info: CoreBuildInfo = {
  schemaVersion: 1,
  core: 'paludarium',
  package: CORE_PACKAGE,
  version: JSON.parse(
    await readFile(resolve(coreSource, 'package.json'), 'utf8'),
  ).version,
  files,
};
await writeFile(
  resolve(coreTarget, 'build-info.json'),
  `${JSON.stringify(info, null, 2)}\n`,
);
