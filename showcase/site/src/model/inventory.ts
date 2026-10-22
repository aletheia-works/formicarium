import { canonicalSha256 } from '../../../scripts/build-key.ts';
import {
  checkRelativePath,
  comparePaths,
  exactKeys,
  isRecord,
  reject,
  SHA256_HEX,
} from './model-error.ts';

export interface InventoryFile {
  path: string;
  sha256: string;
  bytes: number;
}
/** Every file of the built site (dotfiles included), path order. */
export interface SiteInventory {
  schemaVersion: 1;
  files: InventoryFile[];
  /** canonicalSha256(files): siteInventorySha256. */
  sha256: string;
}

const CODE = 'inventory-invalid';
const MAX_PATH_BYTES = 4096;

/** Checks shape, path rules, strict order and uniqueness of the file list. */
export function validateInventoryFiles(value: unknown): InventoryFile[] {
  if (!Array.isArray(value)) reject(CODE, 'files must be an array');
  if (value.length === 0) reject(CODE, 'inventory must not be empty');
  const files = value.map((item): InventoryFile => {
    if (!isRecord(item)) reject(CODE, 'file must be an object');
    exactKeys(CODE, item, ['path', 'sha256', 'bytes']);
    const path = checkRelativePath(CODE, item.path, MAX_PATH_BYTES);
    if (typeof item.sha256 !== 'string' || !SHA256_HEX.test(item.sha256))
      reject(CODE, `sha256 of ${path}`);
    if (!Number.isSafeInteger(item.bytes) || (item.bytes as number) < 0)
      reject(CODE, `bytes of ${path}`);
    return { path, sha256: item.sha256, bytes: item.bytes as number };
  });
  files.forEach((file, index) => {
    const previous = files[index - 1];
    if (previous && comparePaths(previous.path, file.path) >= 0)
      reject(CODE, `files out of order or duplicated: ${file.path}`);
  });
  return files;
}

export const inventorySha256 = (files: readonly InventoryFile[]) =>
  canonicalSha256(validateInventoryFiles([...files]));

export function siteInventory(files: readonly InventoryFile[]): SiteInventory {
  const checked = validateInventoryFiles([...files]);
  return { schemaVersion: 1, files: checked, sha256: canonicalSha256(checked) };
}

/** Reads a recorded inventory and recomputes its digest. */
export function validateSiteInventory(value: unknown): SiteInventory {
  if (!isRecord(value)) reject(CODE, 'inventory must be an object');
  exactKeys(CODE, value, ['schemaVersion', 'files', 'sha256']);
  if (value.schemaVersion !== 1) reject(CODE, 'schemaVersion must be 1');
  const inventory = siteInventory(validateInventoryFiles(value.files));
  if (value.sha256 !== inventory.sha256)
    reject(CODE, 'recorded sha256 differs from the files');
  return inventory;
}

export const totalBytes = (files: readonly InventoryFile[]) =>
  files.reduce((sum, file) => sum + file.bytes, 0);
