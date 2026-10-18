import { createHash } from 'node:crypto';
import type { GuestBuildInfo } from '@aletheia-works/formicarium';
import { fail } from './errors.ts';

export const sha256 = (bytes: string | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

function checkString(value: string): void {
  if (
    /[\uD800-\uDFFF]/u.test(
      value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''),
    )
  )
    fail('config-invalid', 'canonical text contains a lone surrogate');
}

/**
 * C03 canonical JSON: recursive dictionary key order, array order kept, UTF-8,
 * no whitespace, no trailing newline, only safe integers / strings / booleans /
 * null. Unknown additional fields stay part of the identity.
 */
export function canonicalJson(
  value: unknown,
  seen = new Set<object>(),
): string {
  if (value === null || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'string') {
    checkString(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      fail('config-invalid', 'canonical number must be a safe integer');
    return JSON.stringify(value);
  }
  if (
    typeof value !== 'object' ||
    !(
      Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
  )
    fail('config-invalid', 'canonical JSON value required');
  if (seen.has(value)) fail('config-invalid', 'canonical value has a cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length)
        fail('config-invalid', 'canonical array must be dense');
      return `[${value.map((item) => canonicalJson(item, seen)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => {
        checkString(key);
        if (record[key] === undefined)
          fail('config-invalid', `canonical value missing: ${key}`);
        return `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`;
      })
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export const canonicalSha256 = (value: unknown): string =>
  sha256(canonicalJson(value));

/** JSON.parse silently keeps the last duplicate key, including escaped aliases. */
export function parseUniqueJson(raw: string): unknown {
  let cursor = 0;
  const space = () => {
    while (cursor < raw.length && /[ \t\r\n]/.test(raw[cursor]!)) cursor++;
  };
  const string = (): string => {
    const start = cursor++;
    while (cursor < raw.length) {
      const character = raw[cursor++];
      if (character === '\\') cursor++;
      else if (character === '"') return JSON.parse(raw.slice(start, cursor));
    }
    return fail('bad-body', 'unterminated JSON string');
  };
  const value = (): void => {
    space();
    const opener = raw[cursor];
    if (opener === '{' || opener === '[') {
      cursor++;
      space();
      const closer = opener === '{' ? '}' : ']';
      const keys = new Set<string>();
      if (raw[cursor] === closer) {
        cursor++;
        return;
      }
      while (true) {
        space();
        if (opener === '{') {
          if (raw[cursor] !== '"') fail('bad-body', 'JSON key required');
          const key = string();
          if (keys.has(key)) fail('bad-body', `duplicate JSON key: ${key}`);
          keys.add(key);
          space();
          if (raw[cursor++] !== ':') fail('bad-body', 'JSON colon required');
        }
        value();
        space();
        const delimiter = raw[cursor++];
        if (delimiter === closer) return;
        if (delimiter !== ',') fail('bad-body', 'JSON delimiter required');
      }
    }
    if (opener === '"') {
      string();
      return;
    }
    const start = cursor;
    while (cursor < raw.length && !/[\s,\]}]/.test(raw[cursor]!)) cursor++;
    if (cursor === start) fail('bad-body', 'JSON value required');
  };
  value();
  space();
  if (cursor !== raw.length) fail('bad-body', 'trailing JSON input');
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fail('bad-body', 'JSON syntax invalid', error);
  }
}

/** C03/C07 buildKey: never includes timestamps or output digests. */
export function buildKey(
  info: Pick<
    GuestBuildInfo,
    | 'tool'
    | 'source'
    | 'builderHash'
    | 'target'
    | 'rustc'
    | 'sourcePatches'
    | 'dependencies'
  >,
): string {
  const seen = new Set<string>();
  for (const dependency of info.dependencies) {
    const key = `${dependency.tool}/${dependency.repository}/${dependency.commit}`;
    if (seen.has(key)) fail('config-invalid', `duplicate dependency: ${key}`);
    seen.add(key);
  }
  const dependencies = [...info.dependencies].sort((a, b) => {
    const x = `${a.tool}/${a.repository}/${a.commit}`;
    const y = `${b.tool}/${b.repository}/${b.commit}`;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return canonicalSha256({
    tool: info.tool,
    repository: info.source.repository,
    commit: info.source.commit,
    builderHash: info.builderHash,
    target: info.target,
    rustc: info.rustc,
    sourcePatches: info.sourcePatches,
    dependencies,
  });
}

/** Digest of a builder inventory: files, configuration and toolchain identity. */
export function builderHash(
  files: readonly { path: string; sha256: string }[],
  toolchain: Readonly<Record<string, string | null>>,
): string {
  const paths = new Set<string>();
  for (const file of files) {
    if (paths.has(file.path))
      fail('config-invalid', `duplicate builder file: ${file.path}`);
    paths.add(file.path);
  }
  return canonicalSha256({
    files: [...files].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
    toolchain,
  });
}
