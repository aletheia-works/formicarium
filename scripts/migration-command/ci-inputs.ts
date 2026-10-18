import { constants } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  decodeInstallSiteArchive,
  INSTALL_INPUT_POLICY,
  INSTALL_SITE_ARCHIVE,
  INSTALL_SITE_REFERENCE,
  restoreInstallActualSite,
  validateInstallSiteReferenceManifest,
} from '../migration-install/ci-inputs.js';
import type { CIInputPolicy } from '../migration-session/ci-inputs.js';
import {
  CI_INPUT_LIMITS,
  inspectCIInputs,
  installCIInputs,
  validateCIInputManifest,
} from '../migration-session/ci-inputs.js';
import { sha256 } from '../package/stage-package.js';
import { readBoundedFile } from '../release/publication-assets.js';
import { commandSourceInventory } from './stage.js';

export const COMMAND_INPUT_DIRECTORY = 'ci/migration-command';
/**
 * Same fixed input rows as U3 (core, guests, mirror assets, actual site
 * archive), in a U4-owned bundle whose sourceFiles are the U4 inventory. The
 * U2 manifest type admits only its two schema names, so the U3 schema name is
 * reused; the U4 directory and U4 source inventory distinguish the bundle.
 */
export const COMMAND_INPUT_POLICY: CIInputPolicy = Object.freeze({
  schema: INSTALL_INPUT_POLICY.schema,
  paths: INSTALL_INPUT_POLICY.paths,
  sourcePrefix: `${COMMAND_INPUT_DIRECTORY}/`,
});

export async function inspectCommandInputs(root: string, path: string) {
  if (
    resolve(path) !==
    resolve(root, COMMAND_INPUT_DIRECTORY, 'inputs.bundle.json')
  )
    throw Error('U4 CI inputs must be the U4-owned bundle');
  const inspected = await inspectCIInputs(root, path, COMMAND_INPUT_POLICY);
  validateInstallSiteReferenceManifest(inspected.manifest.files);
  const payload = async (row: { sha256: string }) =>
    readBoundedFile(
      resolve(inspected.bundleRoot, `payload/${row.sha256}.bin`),
      CI_INPUT_LIMITS.file,
    );
  const source = inspected.manifest.files.find(
    (row) => row.path === INSTALL_SITE_REFERENCE.source,
  )!;
  const reference = await payload(source);
  if (
    reference.length !== INSTALL_SITE_REFERENCE.bytes ||
    sha256(reference) !== INSTALL_SITE_REFERENCE.sha256
  )
    throw Error('U4 fixed reference blob differs');
  const archive = inspected.manifest.files.find(
    (row) => row.path === INSTALL_SITE_ARCHIVE,
  )!;
  decodeInstallSiteArchive(await payload(archive));
  return inspected;
}
export async function restoreCommandInputs(root: string, path: string) {
  await inspectCommandInputs(root, path);
  const installed = await installCIInputs(root, path, COMMAND_INPUT_POLICY);
  return { ...installed, actualSite: await restoreInstallActualSite(root) };
}
/** Main-session preparation of the U4 bundle from already observed local inputs. */
export async function prepareCommandInputs(root: string, out: string) {
  const destination = resolve(root, out);
  if (destination !== resolve(root, COMMAND_INPUT_DIRECTORY))
    throw Error('U4 CI input destination must be ci/migration-command');
  const files = [];
  for (const path of COMMAND_INPUT_POLICY.paths) {
    const bytes = await readBoundedFile(
      resolve(root, path),
      CI_INPUT_LIMITS.file,
    );
    files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  validateInstallSiteReferenceManifest(files);
  const manifest = validateCIInputManifest(
    {
      schema: COMMAND_INPUT_POLICY.schema,
      version: 1,
      producer: 'main-session-observed-inputs',
      files,
      sourceFiles: await commandSourceInventory(root),
    },
    COMMAND_INPUT_POLICY,
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
  await inspectCommandInputs(root, path);
  return path;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [mode, path, ...extra] = process.argv.slice(2);
  if (mode === 'prepare' && path && !extra.length)
    console.log(await prepareCommandInputs(process.cwd(), path));
  else if (mode === 'inspect' && path && !extra.length)
    console.log(
      JSON.stringify(await inspectCommandInputs(process.cwd(), path)),
    );
  else if (mode === 'restore' && path && !extra.length)
    console.log(
      JSON.stringify(await restoreCommandInputs(process.cwd(), path)),
    );
  else
    throw Error(
      'usage: U4 ci-inputs.js prepare ci/migration-command | inspect <manifest> | restore <manifest>',
    );
}
