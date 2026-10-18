import { constants } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { CIInputPolicy } from '../migration-session/ci-inputs.js';
import {
  CI_INPUT_LIMITS,
  CI_INPUT_PATHS,
  inspectCIInputs,
  installCIInputs,
  validateCIInputManifest,
} from '../migration-session/ci-inputs.js';
import { sha256 } from '../package/stage-package.js';
import {
  readBoundedFile,
  safeAssetPath,
} from '../release/publication-assets.js';
import { installSourceInventory } from './stage.js';

export const INSTALL_SITE_ARCHIVE =
  '.artifacts/migration-install/actual-site-v2.tar.gz';
export const INSTALL_SITE_DESTINATION =
  '.artifacts/migration-install/actual-site';
export const INSTALL_SITE_REFERENCE = Object.freeze({
  source: 'dist/guests/aube',
  path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest',
  bytes: 36948544,
  sha256: 'c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e',
});
export const INSTALL_ACTUAL_SITE_FILES = Object.freeze([
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/build-info.json',
    bytes: 1112,
    sha256: '994ad5923dcd8383c887228987b3cf656a541bc658747d4ce76e6f219b90f5fd',
  },
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/fixture-e6149f95eadefc92a559dd4f39b4836064a087b2f95c954bf13b6b786c8798f3.json',
    bytes: 366,
    sha256: '17e2c1f140570536c0fd73f9d91cc12b9b4aaa76361c2396b611005966989454',
  },
  {
    path: 'dist/aube/5a75abb5b2ff53ed9b89f85a9695e29fa8dae3a4fda6f25046f39ac04a413d92/guest',
    bytes: 36497472,
    sha256: 'd973c97da25ed13e49943b0836c88fd5d9e51ac422faa5b38a3df997ad1ceef9',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/build-info.json',
    bytes: 1112,
    sha256: '18248d1d2cfdd3933b5608ea795bc78473e2d400791c8d5204d63be9755102d5',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/fixture-e6149f95eadefc92a559dd4f39b4836064a087b2f95c954bf13b6b786c8798f3.json',
    bytes: 366,
    sha256: '17e2c1f140570536c0fd73f9d91cc12b9b4aaa76361c2396b611005966989454',
  },
  {
    path: 'dist/aube/83a42e281acf38e98fbbddf590e77746dcb9dfdb12cce4b27d1eb1926e1e5b5d/guest',
    bytes: 36948544,
    sha256: 'c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e',
  },
  {
    path: 'dist/builds.json',
    bytes: 3558,
    sha256: '0377f69859e2fb98160cdafeebf44c8199b60f63dfd8ae3e244161d515d170d2',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/build-info.json',
    bytes: 1141,
    sha256: '6a1eedbda36acfadf448a1e0ce2a1d6236d5bbca70d8950b6177777310daccdd',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/fixture-70fa4ab004890168522fa83941f86a1e0a28818246b6a065e4b0ef685e8035b3.json',
    bytes: 151,
    sha256: '081abc73542d06df09d28cdad88bfda1628634ab5482a3f8238134a25951583a',
  },
  {
    path: 'dist/pitchfork/1e8d2cbbd4fbfa46deb8c024e62368762d88b1e34a9fa75f0e8079207164dbbd/guest',
    bytes: 39596008,
    sha256: '67bcb90c31e8525f95f49c9ef5ff9b6526f36e79471f4804bc533b192a772a23',
  },
  {
    path: 'tools.json',
    bytes: 207,
    sha256: '64a712e6ed381694d69cb434bba07b5f5e49daf13a7238709e039b3f2e96cae4',
  },
]);

function ensureSite(value: unknown, message: string): asserts value {
  if (!value) throw Error(`U3 actual site ${message}`);
}
export function validateInstallSiteEntry(path: string, bytes: number): void {
  safeAssetPath(path);
  ensureSite(
    Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= CI_INPUT_LIMITS.file,
    'file byte limit',
  );
  ensureSite(
    !path.endsWith('.json') || bytes <= CI_INPUT_LIMITS.metadata,
    'metadata limit',
  );
  ensureSite(
    INSTALL_ACTUAL_SITE_FILES.some((row) => row.path === path),
    'unknown path',
  );
  ensureSite(
    path !== INSTALL_SITE_REFERENCE.path,
    'reference guest excluded from archive',
  );
}
const archiveFiles = INSTALL_ACTUAL_SITE_FILES.filter(
  (row) => row.path !== INSTALL_SITE_REFERENCE.path,
);
export function validateInstallSiteReferenceManifest(
  files: readonly { path: string; bytes: number; sha256: string }[],
): void {
  const sources = files.filter(
    (row) => row.path === INSTALL_SITE_REFERENCE.source,
  );
  ensureSite(
    sources.length === 1 &&
      sources[0]!.bytes === INSTALL_SITE_REFERENCE.bytes &&
      sources[0]!.sha256 === INSTALL_SITE_REFERENCE.sha256,
    'fixed reference source missing/differs',
  );
}
export async function readInstallSiteReference(root: string): Promise<Buffer> {
  await siteAncestors(root, INSTALL_SITE_REFERENCE.source);
  const bytes = await readBoundedFile(
    resolve(root, INSTALL_SITE_REFERENCE.source),
    CI_INPUT_LIMITS.file,
  );
  ensureSite(
    bytes.length === INSTALL_SITE_REFERENCE.bytes &&
      sha256(bytes) === INSTALL_SITE_REFERENCE.sha256,
    'fixed reference source size/digest mismatch',
  );
  return bytes;
}
export function validateInstallSiteBudget(
  total: number,
  entries: number,
): void {
  ensureSite(
    Number.isSafeInteger(total) && total >= 0 && total <= CI_INPUT_LIMITS.total,
    'expanded total limit',
  );
  ensureSite(
    Number.isSafeInteger(entries) &&
      entries >= 0 &&
      entries <= CI_INPUT_LIMITS.entries,
    'entry limit',
  );
}
/** Exactly ten sealed regular files; the remaining guest comes only from its fixed CI input. */
export function decodeInstallSiteArchive(
  bytes: Uint8Array,
): Map<string, Buffer> {
  ensureSite(bytes.byteLength <= CI_INPUT_LIMITS.file, 'compressed byte limit');
  const archive = gunzipSync(bytes, { maxOutputLength: CI_INPUT_LIMITS.total });
  ensureSite(archive.length % 512 === 0, 'tar block alignment');
  const files = new Map<string, Buffer>();
  let offset = 0,
    total = 0,
    entries = 0,
    ended = false;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      ensureSite(
        archive.length - offset >= 1024 &&
          archive.subarray(offset).every((byte) => byte === 0),
        'tar end/trailing data',
      );
      ended = true;
      break;
    }
    validateInstallSiteBudget(total, ++entries);
    const text = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .split('\0')[0]!;
    const octal = (start: number, length: number) => {
      const value = text(start, length).trim();
      ensureSite(/^[0-7]+$/.test(value), 'tar numeric');
      const number = Number.parseInt(value, 8);
      ensureSite(Number.isSafeInteger(number), 'tar numeric limit');
      return number;
    };
    const checksum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0,
    );
    ensureSite(checksum === octal(148, 8), 'tar checksum');
    ensureSite(
      header[156] === 0 || header[156] === 48,
      'symlink/special tar entry',
    );
    ensureSite(text(257, 6) === 'ustar', 'tar format');
    const prefix = text(345, 155),
      name = text(0, 100);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = octal(124, 12);
    validateInstallSiteEntry(path, size);
    ensureSite(!files.has(path), 'duplicate path');
    total += size;
    validateInstallSiteBudget(total, entries);
    const start = offset + 512,
      end = start + size;
    const next = start + Math.ceil(size / 512) * 512;
    ensureSite(
      next <= archive.length &&
        archive.subarray(end, next).every((byte) => byte === 0),
      'tar truncation/padding',
    );
    files.set(path, archive.subarray(start, end));
    offset = next;
  }
  ensureSite(
    ended && files.size === archiveFiles.length,
    'missing inventory/end',
  );
  for (const row of archiveFiles) {
    const file = files.get(row.path);
    ensureSite(
      file && file.length === row.bytes && sha256(file) === row.sha256,
      'file size/digest mismatch',
    );
  }
  return files;
}
async function siteAncestors(
  root: string,
  path: string,
  absent = false,
): Promise<boolean> {
  const parts = safeAssetPath(path).split('/');
  for (let index = 1; index <= parts.length; index++) {
    try {
      const stat = await lstat(resolve(root, ...parts.slice(0, index)));
      ensureSite(
        !stat.isSymbolicLink() &&
          (index === parts.length ? stat.isFile() : stat.isDirectory()),
        'symlink/special file',
      );
    } catch (error) {
      if (absent && (error as NodeJS.ErrnoException).code === 'ENOENT')
        return false;
      throw error;
    }
  }
  return true;
}
export async function inspectInstallActualSite(site: string): Promise<string> {
  site = resolve(site);
  ensureSite((await realpath(site)) === site, 'symlink root/ancestor');
  const paths: string[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      ensureSite(!entry.isSymbolicLink(), 'symlink entry');
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        const directoryPath = relative(site, path) + '/';
        ensureSite(
          INSTALL_ACTUAL_SITE_FILES.some((row) =>
            row.path.startsWith(directoryPath),
          ),
          'extra directory',
        );
        await walk(path);
      } else {
        ensureSite(entry.isFile(), 'special entry');
        const filePath = relative(site, path);
        ensureSite(
          INSTALL_ACTUAL_SITE_FILES.some((row) => row.path === filePath),
          'unknown file',
        );
        paths.push(filePath);
      }
    }
  };
  await walk(site);
  ensureSite(
    JSON.stringify(paths.sort()) ===
      JSON.stringify(INSTALL_ACTUAL_SITE_FILES.map((row) => row.path).sort()),
    'missing/extra inventory',
  );
  let total = 0;
  for (const row of INSTALL_ACTUAL_SITE_FILES) {
    await siteAncestors(site, row.path);
    const content = await readBoundedFile(
      resolve(site, row.path),
      row.path.endsWith('.json')
        ? CI_INPUT_LIMITS.metadata
        : CI_INPUT_LIMITS.file,
    );
    ensureSite(
      content.length === row.bytes && sha256(content) === row.sha256,
      'file size/digest mismatch',
    );
    total += content.length;
    validateInstallSiteBudget(total, INSTALL_ACTUAL_SITE_FILES.length);
  }
  return site;
}
export async function requireInstallActualSite(root: string): Promise<string> {
  const expected = resolve(root, INSTALL_SITE_DESTINATION);
  ensureSite(
    process.env.U2_ACTUAL_SITE &&
      resolve(process.env.U2_ACTUAL_SITE) === expected,
    'required restored path missing/differs',
  );
  return inspectInstallActualSite(expected);
}
export async function prepareInstallSiteArchive(root: string, site: string) {
  await inspectInstallActualSite(site);
  await readInstallSiteReference(root);
  const members: Buffer[] = [];
  for (const row of archiveFiles) {
    const content = await readBoundedFile(
      resolve(site, row.path),
      CI_INPUT_LIMITS.file,
    );
    ensureSite(
      content.length === row.bytes && sha256(content) === row.sha256,
      'source changed while archiving',
    );
    const header = Buffer.alloc(512);
    const slash = row.path.lastIndexOf('/');
    const name = row.path.length <= 100 ? row.path : row.path.slice(slash + 1);
    const prefix = row.path.length <= 100 ? '' : row.path.slice(0, slash);
    ensureSite(
      Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155,
      'tar path limit',
    );
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(row.bytes.toString(8).padStart(11, '0') + '\0', 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257);
    header.write('00', 263);
    header.write(prefix, 345, 155, 'utf8');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    members.push(
      header,
      content,
      Buffer.alloc((512 - (content.length % 512)) % 512),
    );
  }
  members.push(Buffer.alloc(1024));
  const raw = Buffer.concat(members);
  ensureSite(
    raw.length <= CI_INPUT_LIMITS.total,
    'expanded archive total limit',
  );
  const compressed = gzipSync(raw, { level: 9 });
  decodeInstallSiteArchive(compressed);
  const path = resolve(root, INSTALL_SITE_ARCHIVE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, compressed, { flag: 'wx' });
  return {
    path,
    bytes: compressed.length,
    expandedBytes: raw.length,
    sha256: sha256(compressed),
    archiveFiles: archiveFiles.length,
    reference: INSTALL_SITE_REFERENCE,
  };
}
export async function restoreInstallActualSite(root: string): Promise<string> {
  const reference = await readInstallSiteReference(root);
  const files = decodeInstallSiteArchive(
    await readBoundedFile(
      resolve(root, INSTALL_SITE_ARCHIVE),
      CI_INPUT_LIMITS.file,
    ),
  );
  files.set(INSTALL_SITE_REFERENCE.path, reference);
  validateInstallSiteBudget(
    [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0),
    files.size,
  );
  const site = resolve(root, INSTALL_SITE_DESTINATION);
  try {
    await lstat(site);
    return await inspectInstallActualSite(site);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await siteAncestors(root, `${INSTALL_SITE_DESTINATION}/tools.json`, true);
  await mkdir(site);
  try {
    for (const [path, bytes] of files) {
      await mkdir(dirname(resolve(site, path)), { recursive: true });
      await siteAncestors(site, path, true);
      await writeFile(resolve(site, path), bytes, { flag: 'wx' });
    }
    return await inspectInstallActualSite(site);
  } catch (error) {
    await rm(site, { recursive: true, force: true });
    throw error;
  }
}

export const INSTALL_INPUT_POLICY: CIInputPolicy = Object.freeze({
  schema: 'migration-install-ci-inputs',
  paths: Object.freeze([
    ...CI_INPUT_PATHS,
    '.artifacts/migration-preflight/mirror-assets-attempt-1/aube.tar.gz',
    '.artifacts/migration-preflight/mirror-assets-attempt-1/biome.elf',
    INSTALL_SITE_ARCHIVE,
  ]),
  sourcePrefix: 'ci/migration-install/',
});
export async function inspectInstallInputs(root: string, path: string) {
  const inspected = await inspectCIInputs(root, path, INSTALL_INPUT_POLICY);
  validateInstallSiteReferenceManifest(inspected.manifest.files);
  const source = inspected.manifest.files.find(
    (row) => row.path === INSTALL_SITE_REFERENCE.source,
  )!;
  // inspectCIInputs has checked this blob's digest, bytes, type and exact inventory.
  const reference = await readBoundedFile(
    resolve(inspected.bundleRoot, `payload/${source.sha256}.bin`),
    CI_INPUT_LIMITS.file,
  );
  ensureSite(
    reference.length === INSTALL_SITE_REFERENCE.bytes &&
      sha256(reference) === INSTALL_SITE_REFERENCE.sha256,
    'fixed reference blob differs',
  );
  const row = inspected.manifest.files.find(
    (entry) => entry.path === INSTALL_SITE_ARCHIVE,
  )!;
  decodeInstallSiteArchive(
    await readBoundedFile(
      resolve(inspected.bundleRoot, `payload/${row.sha256}.bin`),
      CI_INPUT_LIMITS.file,
    ),
  );
  return inspected;
}
export async function restoreInstallInputs(root: string, path: string) {
  await inspectInstallInputs(root, path);
  const installed = await installCIInputs(root, path, INSTALL_INPUT_POLICY);
  return { ...installed, actualSite: await restoreInstallActualSite(root) };
}
export async function prepareInstallInputs(root: string, out: string) {
  const destination = resolve(root, out);
  if (destination !== resolve(root, 'ci/migration-install'))
    throw Error('U3 CI input destination must be ci/migration-install');
  const files = [];
  for (const path of INSTALL_INPUT_POLICY.paths) {
    const bytes = await readBoundedFile(
      resolve(root, path),
      CI_INPUT_LIMITS.file,
    );
    files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const sourceFiles = await installSourceInventory(root);
  validateInstallSiteReferenceManifest(files);
  const manifest = validateCIInputManifest(
    {
      schema: INSTALL_INPUT_POLICY.schema,
      version: 1,
      producer: 'main-session-observed-inputs',
      files,
      sourceFiles,
    },
    INSTALL_INPUT_POLICY,
  );
  await mkdir(destination, { recursive: false });
  await mkdir(resolve(destination, 'payload'));
  const copied = new Set<string>();
  for (const row of files) {
    if (copied.has(row.sha256)) continue;
    await copyFile(
      resolve(root, row.path),
      resolve(destination, `payload/${row.sha256}.bin`),
      constants.COPYFILE_EXCL,
    );
    copied.add(row.sha256);
  }
  const path = resolve(destination, 'inputs.bundle.json');
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
  });
  await inspectInstallInputs(root, path);
  return path;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, path, ...extra] = process.argv.slice(2);
  if (mode === 'prepare-site' && path && !extra.length)
    console.log(
      JSON.stringify(
        await prepareInstallSiteArchive(process.cwd(), resolve(path)),
      ),
    );
  else if (mode === 'inspect-site' && path && !extra.length) {
    const bytes = await readBoundedFile(resolve(path), CI_INPUT_LIMITS.file);
    await readInstallSiteReference(process.cwd());
    console.log(
      JSON.stringify({
        bytes: bytes.length,
        sha256: sha256(bytes),
        reference: INSTALL_SITE_REFERENCE,
        files: [...decodeInstallSiteArchive(bytes)].map(([path, content]) => ({
          path,
          bytes: content.length,
          sha256: sha256(content),
        })),
      }),
    );
  } else if (mode === 'restore' && path && !extra.length)
    console.log(
      JSON.stringify(await restoreInstallInputs(process.cwd(), path)),
    );
  else if (mode === 'prepare' && path && !extra.length)
    console.log(await prepareInstallInputs(process.cwd(), path));
  else if (mode === 'inspect' && path && !extra.length)
    console.log(
      JSON.stringify(await inspectInstallInputs(process.cwd(), path)),
    );
  else
    throw Error(
      'usage: U3 ci-inputs.js prepare-site <fixed-site> | inspect-site <archive> | prepare ci/migration-install | inspect <manifest> | restore <manifest>',
    );
}
