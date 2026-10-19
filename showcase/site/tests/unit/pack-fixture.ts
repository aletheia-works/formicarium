import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tgz } from '../../../tests/fixtures/tar.ts';
import { writeFiles } from './helpers.ts';

/** A small npm-pack-shaped package with the public export layout of 0.3.0. */
export const PACKAGE_FILES: Record<string, string> = {
  'package.json': JSON.stringify({
    name: '@aletheia-works/formicarium',
    version: '0.3.0',
    type: 'module',
    exports: {
      '.': { types: './types/index.d.ts', import: './runtime/public.js' },
      './node': { types: './types/node.d.ts', import: './runtime/node/api.js' },
      './browser': {
        types: './types/browser.d.ts',
        import: './runtime/web/api.js',
      },
      './assets/blink.mjs': './assets/blink.mjs',
      './assets/blink.wasm': './assets/blink.wasm',
      './assets/build-info.json': './assets/build-info.json',
    },
  }),
  'runtime/public.js':
    "export { failure } from './errors.js';\nexport function createCommandSession() {}\n",
  'runtime/errors.js': 'export const failure = 1;\n',
  'runtime/core.js':
    "import { failure } from './errors.js';\nexport const core = failure;\n",
  'runtime/web/api.js':
    "import { core } from '../core.js';\nexport function createSession() { return core; }\n",
  'runtime/web/package-worker.bundle.js': 'self.onmessage = () => {};\n',
  'runtime/node/api.js':
    "import { core } from '../core.js';\nexport { core };\n",
  'assets/blink.mjs': 'export default 1;\n',
  'assets/blink.wasm': '\0asm',
  'assets/build-info.json': '{}',
  'types/index.d.ts': 'export {};\n',
  LICENSE: 'Apache-2.0\n',
  'THIRD_PARTY_NOTICES.md': '# notices\n',
};

const sha = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

/** Writes `<root>/pack/{pack.json,<tarball>}` like U7's pack.ts verify. */
export async function writePack(
  root: string,
  files: Record<string, string> = PACKAGE_FILES,
  recordSha?: string,
): Promise<string> {
  const tarball = 'aletheia-works-formicarium-0.3.0.tgz';
  const bytes = tgz(
    Object.entries(files).map(([name, body]) => ({
      name: `package/${name}`,
      body,
    })),
  );
  const pack = join(root, 'pack');
  await writeFiles(pack, {
    [tarball]: bytes,
    'pack.json': JSON.stringify({
      schemaVersion: 1,
      mode: 'verify',
      tarball,
      packSha256: recordSha ?? sha(bytes),
      formicariumSourceCommit: 'b'.repeat(40),
      releaseTag: null,
      evidenceSha256: null,
    }),
  });
  return pack;
}
