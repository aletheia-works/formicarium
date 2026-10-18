import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildWorkerBundle } from './package/worker-bundle.js';

// Keep generated browser modules next to their sources so static URLs and
// package staging share the same layout. These outputs are ignored by SCM.
for (const directory of ['runtime', 'web', 'scripts', 'integration', 'tests']) {
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
