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

// This worker is registered as a classic script; do not add the ESM marker.
await writeFile(
  resolve('web/coi-sw.js'),
  (await readFile(resolve('.build/web/coi-sw.js'), 'utf8')).replace(
    /^export \{\};\r?\n?/m,
    '',
  ),
);

// Browsers start the import-free Worker; build it from the copied modules.
buildWorkerBundle({ root: resolve('.') });

// The development harness and package staging read the core from
// dist/paludarium, with the digests the runtime checks before loading it.
const coreSource = resolve('node_modules', CORE_PACKAGE);
const coreTarget = resolve('dist/paludarium');
await rm(coreTarget, { recursive: true, force: true });
await mkdir(coreTarget, { recursive: true });
const files: Record<string, string> = {};
for (const name of [...CORE_FILES, 'LICENSE']) {
  await copyFile(resolve(coreSource, name), resolve(coreTarget, name));
  if (name !== 'LICENSE')
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
