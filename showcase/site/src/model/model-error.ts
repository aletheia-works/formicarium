/** Cause codes of the site's data model checks; each failure carries one. */
export type ModelErrorCode =
  | 'fixture-index-invalid'
  | 'identity-invalid'
  | 'inventory-invalid'
  | 'evidence-invalid';

/** A rejected model value. The message names the field, never secret data. */
export class ModelError extends Error {
  readonly code: ModelErrorCode;
  constructor(code: ModelErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ModelError';
    this.code = code;
  }
}

export function reject(code: ModelErrorCode, message: string): never {
  throw new ModelError(code, message);
}

export const SHA256_HEX = /^[a-f0-9]{64}$/;
export const COMMIT_HEX = /^[a-f0-9]{40}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/** Refuses a record whose keys differ from the expected set. */
export function exactKeys(
  code: ModelErrorCode,
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  for (const key of required)
    if (!Object.hasOwn(value, key)) reject(code, `missing field ${key}`);
  for (const key of Object.keys(value))
    if (!required.includes(key) && !optional.includes(key))
      reject(code, `unknown field ${key}`);
}

const encoder = new TextEncoder();
export const utf8Bytes = (text: string) => encoder.encode(text).length;

/** Code-unit order, the same order the build writes paths in. */
export const comparePaths = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * A relative POSIX path: no leading slash, no empty, `.` or `..` segment, no
 * NUL or backslash, at most `maxBytes` UTF-8 bytes.
 */
export function checkRelativePath(
  code: ModelErrorCode,
  path: unknown,
  maxBytes: number,
): string {
  if (typeof path !== 'string' || path === '')
    reject(code, 'path must be a non-empty string');
  if (path.includes('\0')) reject(code, 'path contains NUL');
  if (path.includes('\\')) reject(code, 'path contains a backslash');
  if (path.startsWith('/')) reject(code, `absolute path refused: ${path}`);
  if (utf8Bytes(path) > maxBytes)
    reject(code, `path exceeds ${maxBytes} bytes`);
  for (const segment of path.split('/')) {
    if (segment === '') reject(code, `empty path segment: ${path}`);
    if (segment === '.' || segment === '..')
      reject(code, `relative segment refused: ${path}`);
  }
  return path;
}
