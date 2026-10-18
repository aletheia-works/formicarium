import type { FsEntry } from './contracts.js';
import { isRecord } from './contracts.js';
import { invalid } from './errors.js';
import { equalBytes, validateElf } from './validation.js';

export interface GuestBuildInfo {
  schemaVersion: 1;
  tool: string;
  versionOrName: string;
  source: { repository: string; commit: string };
  target: 'x86_64-unknown-linux-musl';
  rustc: string | null;
  sourcePatches: readonly { name: string; sha256: string }[];
  dependencies: readonly {
    tool: string;
    repository: string;
    commit: string;
    digest: string;
  }[];
  builderHash: string;
  buildKey: string;
  elfSha256: string;
  [key: string]: unknown;
}
export interface GuestExpectation {
  elfSha256: string;
  buildInfoSha256: string;
  identity: GuestBuildInfo;
}
export interface GuestHandle {
  readonly digest: string;
  readonly buildInfo: GuestBuildInfo;
}
export const GUEST_LIMITS = Object.freeze({
  elf: 134217728,
  metadata: 1048576,
  fixture: 268435456,
  entries: 4096,
  path: 4096,
});
const encoder = new TextEncoder();
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotate = (value: number, bits: number) =>
  (value >>> bits) | (value << (32 - bits));
/** Synchronous SHA256 uses one block of scratch memory, independent of input size. */
export function guestSha256(bytes: Uint8Array): string {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const block = new Uint8Array(64);
  const words = new Uint32Array(64);
  const view = new DataView(block.buffer);
  const blocks = Math.ceil((bytes.length + 9) / 64);
  for (let index = 0; index < blocks; index++) {
    block.fill(0);
    const start = index * 64;
    block.set(bytes.subarray(start, Math.min(start + 64, bytes.length)));
    if (start <= bytes.length && bytes.length < start + 64)
      block[bytes.length - start] = 0x80;
    if (index === blocks - 1)
      view.setBigUint64(56, BigInt(bytes.length) * 8n, false);
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15]!;
      const y = words[i - 2]!;
      words[i] =
        ((rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
          words[i - 16]! +
          (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)) +
          words[i - 7]!) >>>
        0;
    }
    let a = state[0]!;
    let b = state[1]!;
    let c = state[2]!;
    let d = state[3]!;
    let e = state[4]!;
    let f = state[5]!;
    let g = state[6]!;
    let h = state[7]!;
    for (let i = 0; i < 64; i++) {
      const t1 =
        (h +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[i]! +
          words[i]!) >>>
        0;
      const t2 =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) >>>
        0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    state[0] = (state[0]! + a) >>> 0;
    state[1] = (state[1]! + b) >>> 0;
    state[2] = (state[2]! + c) >>> 0;
    state[3] = (state[3]! + d) >>> 0;
    state[4] = (state[4]! + e) >>> 0;
    state[5] = (state[5]! + f) >>> 0;
    state[6] = (state[6]! + g) >>> 0;
    state[7] = (state[7]! + h) >>> 0;
  }
  return [...state]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
}
function validString(value: string): void {
  invalid(
    !/[\uD800-\uDFFF]/u.test(
      value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''),
    ),
    'canonical text contains a lone surrogate',
  );
}
export function guestCanonical(
  value: unknown,
  seen = new Set<object>(),
): string {
  if (value === null || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'string') {
    validString(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    invalid(
      Number.isSafeInteger(value),
      'canonical number must be a safe integer',
    );
    return JSON.stringify(value);
  }
  invalid(
    typeof value === 'object' &&
      value !== null &&
      (Array.isArray(value) ||
        Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
    'canonical JSON value required',
  );
  invalid(!seen.has(value), 'canonical value contains a cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      invalid(
        Object.keys(value).length === value.length,
        'canonical array must be dense',
      );
      return `[${value.map((item) => guestCanonical(item, seen)).join(',')}]`;
    }
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        validString(key);
        return `${JSON.stringify(key)}:${guestCanonical((value as Record<string, unknown>)[key], seen)}`;
      })
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}
const digest = (value: unknown) =>
  invalid(
    typeof value === 'string' && /^[0-9a-f]{64}$/.test(value),
    'guest digest is invalid',
  );
function name(value: unknown, max = 128): asserts value is string {
  invalid(
    typeof value === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) &&
      encoder.encode(value).length <= max,
    'guest identifier is invalid',
  );
}
function source(value: unknown): void {
  invalid(isRecord(value), 'guest source required');
  invalid(
    typeof value.repository === 'string' && value.repository.length > 0,
    'guest repository required',
  );
  validString(value.repository);
  let url: URL;
  try {
    url = new URL(value.repository);
  } catch {
    invalid(false, 'guest repository URL invalid');
  }
  invalid(
    url!.protocol === 'https:' && !url!.username && !url!.password,
    'guest repository must be public HTTPS',
  );
  invalid(
    typeof value.commit === 'string' && /^[0-9a-f]{40}$/.test(value.commit),
    'guest full source commit required',
  );
}
export function guestBuildKey(info: GuestBuildInfo): string {
  const dependencies = [...info.dependencies].sort((a, b) => {
    const x = `${a.tool}/${a.repository}/${a.commit}`;
    const y = `${b.tool}/${b.repository}/${b.commit}`;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return guestSha256(
    encoder.encode(
      guestCanonical({
        tool: info.tool,
        repository: info.source.repository,
        commit: info.source.commit,
        builderHash: info.builderHash,
        target: info.target,
        rustc: info.rustc,
        sourcePatches: info.sourcePatches,
        dependencies,
      }),
    ),
  );
}
function validateInfo(value: unknown): GuestBuildInfo {
  invalid(
    isRecord(value) && value.schemaVersion === 1,
    'guest metadata schema invalid',
  );
  name(value.tool, 64);
  name(value.versionOrName);
  source(value.source);
  invalid(value.target === 'x86_64-unknown-linux-musl', 'guest target invalid');
  invalid(
    value.rustc === null ||
      (typeof value.rustc === 'string' && value.rustc.length > 0),
    'guest rustc identity invalid',
  );
  invalid(
    Array.isArray(value.sourcePatches) && Array.isArray(value.dependencies),
    'guest patches/dependencies required',
  );
  const patches = new Set<string>();
  for (const patch of value.sourcePatches) {
    invalid(isRecord(patch), 'guest patch invalid');
    invalid(
      typeof patch.name === 'string' && patch.name.length > 0,
      'guest patch name invalid',
    );
    digest(patch.sha256);
    invalid(!patches.has(patch.name), 'duplicate guest patch');
    patches.add(patch.name);
  }
  const dependencies = new Set<string>();
  for (const dependency of value.dependencies) {
    invalid(isRecord(dependency), 'guest dependency invalid');
    name(dependency.tool, 64);
    source(dependency);
    digest(dependency.digest);
    const key = `${dependency.tool}/${dependency.repository}/${dependency.commit}`;
    invalid(!dependencies.has(key), 'duplicate guest dependency');
    dependencies.add(key);
  }
  digest(value.builderHash);
  digest(value.buildKey);
  digest(value.elfSha256);
  const info = value as unknown as GuestBuildInfo;
  invalid(guestBuildKey(info) === info.buildKey, 'guest build key mismatch');
  return info;
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}
const owned = new WeakMap<
  GuestHandle,
  { bytes: Uint8Array<ArrayBuffer>; info: GuestBuildInfo }
>();
export function validateGuest(
  bytes: Uint8Array,
  expected: GuestExpectation,
): GuestHandle {
  invalid(
    bytes instanceof Uint8Array && bytes.length <= GUEST_LIMITS.elf,
    'guest ELF size/type invalid',
  );
  invalid(isRecord(expected), 'guest expectation required');
  digest(expected.elfSha256);
  digest(expected.buildInfoSha256);
  const snapshot = validateElf(bytes);
  const metadata = guestCanonical(expected.identity);
  invalid(
    encoder.encode(metadata).length <= GUEST_LIMITS.metadata,
    'guest metadata size exceeded',
  );
  const info = validateInfo(JSON.parse(metadata));
  const view = new DataView(snapshot.buffer);
  const offset = Number(view.getBigUint64(32, true));
  const count = view.getUint16(56, true);
  for (let i = 0; i < count; i++) {
    const start = offset + i * 56;
    const address = view.getBigUint64(start + 16, true);
    const memory = view.getBigUint64(start + 40, true);
    invalid(
      address + memory <= 0xffffffffffffffffn,
      'guest memory segment overflow',
    );
  }
  const elfSha256 = guestSha256(snapshot);
  invalid(
    elfSha256 === expected.elfSha256 && info.elfSha256 === elfSha256,
    'guest ELF digest mismatch',
  );
  invalid(
    guestSha256(encoder.encode(metadata)) === expected.buildInfoSha256,
    'guest metadata digest mismatch',
  );
  const publicInfo = JSON.parse(metadata) as GuestBuildInfo;
  freeze(publicInfo);
  const handle = Object.freeze({ digest: elfSha256, buildInfo: publicInfo });
  owned.set(handle, { bytes: snapshot, info });
  return handle;
}
/** Internal package consumer; never reconstitute authority from public metadata. */
export function guestSnapshot(handle: GuestHandle): {
  bytes: Uint8Array<ArrayBuffer>;
  info: GuestBuildInfo;
} {
  const value = owned.get(handle);
  invalid(
    value !== undefined,
    'guest handle belongs to another package or is forged',
  );
  return {
    bytes: new Uint8Array(value.bytes),
    info: JSON.parse(guestCanonical(value.info)),
  };
}

function path(value: unknown): string {
  invalid(
    typeof value === 'string' && value.startsWith('/') && !value.includes('\0'),
    'fixture guest absolute path required',
  );
  validString(value);
  invalid(
    encoder.encode(value).length <= GUEST_LIMITS.path,
    'fixture path size exceeded',
  );
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      invalid(parts.length > 0, 'fixture root escape');
      parts.pop();
    } else parts.push(part);
  }
  return `/${parts.join('/')}`;
}
function targetPath(entry: Extract<FsEntry, { type: 'symlink' }>): string {
  const target = entry.target;
  invalid(
    typeof target === 'string' && target.length > 0 && !target.includes('\0'),
    'fixture symlink target invalid',
  );
  return path(
    target.startsWith('/')
      ? target
      : `${entry.path.slice(0, entry.path.lastIndexOf('/'))}/${target}`,
  );
}
export function fixtureToFsEntries(
  entries: readonly FsEntry[],
): readonly FsEntry[] {
  invalid(
    Array.isArray(entries) && entries.length <= GUEST_LIMITS.entries,
    'fixture entry limit/type invalid',
  );
  let expanded = 0;
  const found = new Map<string, FsEntry>();
  const inodes = new Map<string, Extract<FsEntry, { type: 'file' }>>();
  for (const raw of entries) {
    invalid(isRecord(raw), 'fixture entry object required');
    const normalized = path(raw.path);
    invalid(!found.has(normalized), 'fixture duplicate normalized path');
    let entry: FsEntry;
    if (raw.type === 'symlink') {
      invalid(typeof raw.target === 'string', 'fixture symlink target invalid');
      const link: Extract<FsEntry, { type: 'symlink' }> = {
        path: normalized,
        type: 'symlink',
        target: raw.target,
      };
      targetPath(link);
      entry = link;
    } else {
      invalid(
        raw.type === 'dir' || raw.type === 'file',
        'fixture type invalid',
      );
      invalid(
        typeof raw.mode === 'number' &&
          Number.isInteger(raw.mode) &&
          raw.mode >= 0 &&
          raw.mode <= 0o7777,
        'fixture mode invalid',
      );
      if (raw.type === 'dir')
        entry = { path: normalized, type: 'dir', mode: raw.mode };
      else {
        invalid(
          raw.data instanceof Uint8Array &&
            typeof raw.inodeId === 'string' &&
            raw.inodeId.length > 0 &&
            !raw.inodeId.includes('\0'),
          'fixture file bytes/inode required',
        );
        expanded += raw.data.length;
        invalid(
          Number.isSafeInteger(expanded) && expanded <= GUEST_LIMITS.fixture,
          'fixture expanded size exceeded',
        );
        const peer = inodes.get(raw.inodeId);
        invalid(
          !peer || (peer.mode === raw.mode && equalBytes(peer.data, raw.data)),
          'fixture hardlink identity mismatch',
        );
        const file: Extract<FsEntry, { type: 'file' }> = {
          path: normalized,
          type: 'file',
          mode: raw.mode,
          inodeId: raw.inodeId,
          data: new Uint8Array(raw.data),
        };
        inodes.set(file.inodeId, file);
        entry = file;
      }
    }
    invalid(
      normalized !== '/' || entry.type === 'dir',
      'fixture root must be directory',
    );
    found.set(normalized, entry);
  }
  const resolveLinks = (input: string, visited = new Set<string>()): string => {
    const parts = input.split('/').filter(Boolean);
    const resolved: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (part === '.') continue;
      if (part === '..') {
        invalid(resolved.length > 0, 'fixture symlink root escape');
        resolved.pop();
        continue;
      }
      resolved.push(part);
      const prefix = `/${resolved.join('/')}`;
      const link = found.get(prefix);
      if (link?.type !== 'symlink') {
        invalid(
          i === parts.length - 1 || !link || link.type === 'dir',
          'fixture parent is not directory',
        );
        continue;
      }
      invalid(!visited.has(prefix), 'fixture symlink loop');
      visited.add(prefix);
      const target = link.target.startsWith('/')
        ? link.target
        : `/${resolved.slice(0, -1).join('/')}/${link.target}`;
      // A link remains active only while its own target is being resolved.
      // The finite caller suffix may legally traverse the same link again.
      const resolvedTarget = resolveLinks(target, visited);
      visited.delete(prefix);
      return resolveLinks(
        `${resolvedTarget}/${parts.slice(i + 1).join('/')}`,
        visited,
      );
    }
    return `/${resolved.join('/')}`;
  };
  for (const entry of found.values()) {
    if (entry.type === 'symlink') resolveLinks(entry.path);
    else {
      const parent = entry.path.slice(0, entry.path.lastIndexOf('/')) || '/';
      const resolved = resolveLinks(parent);
      const parentEntry = found.get(resolved);
      invalid(
        !parentEntry || parentEntry.type === 'dir',
        'fixture parent is not directory',
      );
    }
  }
  return [...found.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}
