import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorCode } from '../../runtime/contracts.js';
import {
  CORE_FILES,
  CORE_PACKAGE,
  validateCoreBuildInfo,
} from '../../runtime/core.js';
import { WORKER_BUNDLE } from './worker-bundle.js';

export const FIRST_PARTY_JS = Object.freeze([
  'runtime/contracts.js',
  'runtime/public.js',
  'runtime/errors.js',
  'runtime/validation.js',
  'runtime/guest-validation.js',
  'runtime/session-port.js',
  'runtime/install-catalog.js',
  'runtime/install-transfer.js',
  'runtime/install-archive.js',
  'runtime/install-lifecycle.js',
  'runtime/install.js',
  'runtime/command-parse.js',
  'runtime/command.js',
  'runtime/state.js',
  'runtime/lifecycle.js',
  'runtime/protocol.js',
  'runtime/worker-execution.js',
  'runtime/core.js',
  'runtime/guest-io.js',
  'runtime/node/api.js',
  'runtime/node/package-worker.js',
  'runtime/web/api.js',
  'runtime/web/package-worker.js',
]);
export const PACKAGE_FILES = Object.freeze([
  ...FIRST_PARTY_JS,
  // Generated from FIRST_PARTY_JS; coverage counts it against those files.
  WORKER_BUNDLE,
  'types/index.d.ts',
  'types/node.d.ts',
  'types/browser.d.ts',
  ...CORE_FILES.map((name) => `assets/paludarium/${name}`),
  'assets/paludarium/build-info.json',
  'assets/paludarium/LICENSE',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'package.json',
]);
export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const workspace = fileURLToPath(new URL('../../', import.meta.url));

/** Stage only the reviewed inventory; missing artifacts are an error. */
export async function stagePackage({
  out,
  root = workspace,
}: {
  out?: string;
  root?: string;
} = {}) {
  if (typeof out !== 'string' || !out) throw new TypeError('--out is required');
  const destination = resolve(root, out);
  if (!relative(resolve(root), destination).startsWith('.artifacts/')) {
    throw new Error('staging destination must be below workspace .artifacts/');
  }
  try {
    if ((await readdir(destination)).length > 0)
      throw new Error('staging destination must be new or empty');
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  // The core is the exact version pinned in package.json, copied by the build
  // with the digests the runtime checks before loading it.
  const manifest = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const buildInfo = validateCoreBuildInfo(
    JSON.parse(
      await readFile(resolve(root, 'dist/paludarium/build-info.json'), 'utf8'),
    ),
  );
  if (buildInfo.version !== manifest.devDependencies?.[CORE_PACKAGE])
    throw new Error('core version must match the pinned devDependency');
  for (const [name, digest] of Object.entries(buildInfo.files))
    if (
      sha256(await readFile(resolve(root, 'dist/paludarium', name))) !== digest
    )
      throw new Error(`core file differs from its build information: ${name}`);
  const sources = new Map(
    PACKAGE_FILES.map((path) => [
      path,
      path.startsWith('assets/paludarium/')
        ? `dist/paludarium/${path.slice(18)}`
        : path,
    ]),
  );
  // Validate every source before creating a partial candidate.
  for (const source of sources.values()) {
    const metadata = await stat(resolve(root, source));
    if (!metadata.isFile() || metadata.size === 0)
      throw new Error(`missing package file: ${source}`);
  }
  const files = [];
  for (const [path, source] of sources) {
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    if (path === 'package.json') {
      const { devDependencies, scripts, ...packageManifest } = manifest;
      void devDependencies;
      void scripts;
      await writeFile(target, `${JSON.stringify(packageManifest, null, 2)}\n`);
    } else await copyFile(resolve(root, source), target);
    files.push({ path, sha256: sha256(await readFile(target)) });
  }
  const candidate = {
    schemaVersion: 1,
    package: manifest.name,
    version: manifest.version,
    core: { package: CORE_PACKAGE, version: buildInfo.version },
    files,
    firstPartyJS: files.filter(({ path }) => FIRST_PARTY_JS.includes(path)),
    stagedDirectory: destination,
  };
  // Evidence lives beside the package, so it cannot enter npm's inventory.
  await writeFile(
    `${destination}.manifest.json`,
    `${JSON.stringify(candidate, null, 2)}\n`,
  );
  return candidate;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out')
    throw new Error('usage: stage-package.js --out .artifacts/<directory>');
  const candidate = await stagePackage({ out: args[1] });
  console.log(JSON.stringify(candidate));
}
