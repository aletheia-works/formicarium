import { convertFixture, selectFixture } from './fixtures.js';
import type { GuestBuild, GuestSelection, SelectedGuest } from './index.js';
import {
  assertResponseUrl,
  isRecord,
  normalizeBase,
  resolveAssetUrl,
  selectBuild,
} from './manifest.js';

async function fetchBytes(url: string, base: string, target: string) {
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'error' });
  } catch {
    throw new Error(`${target}: fetch failed (network or redirect)`, {
      cause: new Error('HTTP request refused'),
    });
  }
  assertResponseUrl(response, url, base, target);
  if (!response.ok) throw new Error(`${target}: HTTP ${response.status}`);
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new Error(`${target}: response body unavailable`);
  }
}

function parseJson(bytes: Uint8Array, target: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`${target}: invalid UTF-8 JSON`, {
      cause: new Error('JSON decoding failed'),
    });
  }
}

async function verifiedAsset(
  asset: { url: string; sha256: string },
  base: string,
  target: string,
) {
  const bytes = await fetchBytes(
    resolveAssetUrl(asset.url, base, target),
    base,
    target,
  );
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  const hex = [...hash]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (hex !== asset.sha256) throw new Error(`${target}: SHA-256 mismatch`);
  return bytes;
}

/** Provenance is explicit metadata; an ELF header alone cannot prove musl. */
export function validateProvenance(info: unknown, build: GuestBuild) {
  if (
    !isRecord(info) ||
    info.schemaVersion !== 1 ||
    info.tool !== build.tool ||
    info.ref !== build.ref ||
    info.built_at !== build.built_at
  ) {
    throw new Error('build-info: schema/tool/ref/time mismatch');
  }
  if (!isRecord(info.source))
    throw new Error('build-info: source identity mismatch');
  for (const field of ['url', 'ref', 'commit'] as const) {
    if (info.source?.[field] !== build.source[field])
      throw new Error('build-info: source identity mismatch');
  }
  if (
    typeof info.target !== 'string' ||
    !['x86_64-linux-musl', 'x86_64-unknown-linux-musl'].includes(info.target) ||
    info.linkage !== 'static' ||
    info.libc !== 'musl'
  ) {
    throw new Error('build-info: static musl target provenance required');
  }
  return info;
}

/** Validate bounds before converting ELF offsets from bigint to number. */
export function validateGuestElf(guest: unknown): Uint8Array<ArrayBuffer> {
  if (!(guest instanceof Uint8Array) || guest.length < 64)
    throw new Error('guest: missing ELF64 header');
  const bytes = new Uint8Array(guest);
  const header = new DataView(bytes.buffer);
  if (
    ![127, 69, 76, 70, 2, 1, 1].every((byte, index) => bytes[index] === byte) ||
    ![2, 3].includes(header.getUint16(16, true)) ||
    header.getUint16(18, true) !== 62 ||
    header.getUint32(20, true) !== 1 ||
    header.getUint16(52, true) !== 64
  ) {
    throw new Error('guest: expected little-endian x86-64 ELF64 executable');
  }
  const offset = header.getBigUint64(32, true);
  const count = header.getUint16(56, true);
  const size = header.getUint16(54, true);
  if (
    count < 1 ||
    count > 256 ||
    size !== 56 ||
    offset < 64n ||
    offset + BigInt(count) * BigInt(size) > BigInt(bytes.length)
  ) {
    throw new Error('guest: program header bounds invalid');
  }
  validateSegments(header, offset, count, bytes.length);
  return bytes;
}

function validateSegments(
  header: DataView,
  offset: bigint,
  count: number,
  length: number,
) {
  let hasLoad = false;
  for (let index = 0; index < count; index++) {
    const start = Number(offset) + index * 56;
    const type = header.getUint32(start, true);
    if (type === 3) throw new Error('guest: dynamic PT_INTERP refused');
    hasLoad ||= type === 1;
    const fileOffset = header.getBigUint64(start + 8, true);
    const fileSize = header.getBigUint64(start + 32, true);
    if (
      fileOffset + fileSize > BigInt(length) ||
      (type === 1 && fileSize > header.getBigUint64(start + 40, true))
    ) {
      throw new Error('guest: ELF segment bounds invalid');
    }
  }
  if (!hasLoad) throw new Error('guest: missing loadable segment');
}

/** C3: no runtime execution, retries or implicit ref fallback at this boundary. */
export async function resolveGuest(
  input: GuestSelection,
): Promise<SelectedGuest> {
  if (!input || typeof input !== 'object')
    throw new Error('selection: expected object');
  const base = normalizeBase(input.base);
  const tools = parseJson(
    await fetchBytes(resolveAssetUrl('tools.json', base), base, 'tools'),
    'tools',
  );
  const manifest = parseJson(
    await fetchBytes(
      resolveAssetUrl('dist/builds.json', base),
      base,
      'catalogue',
    ),
    'catalogue',
  );
  const choice = selectBuild(
    { tools, builds: isRecord(manifest) ? manifest.builds : undefined },
    { ...input, base },
  );
  // Own the selected JSON metadata; later catalogue mutation cannot change it.
  const build = structuredClone(choice.build);
  const fixture = selectFixture(choice.tool, input.fixture, build.fixtures);
  const info = parseJson(
    await verifiedAsset(build.buildInfo, base, 'build-info'),
    'build-info',
  );
  validateProvenance(info, build);
  const guest = validateGuestElf(
    await verifiedAsset(build.guest, base, 'guest'),
  );
  const entries = fixture.name
    ? convertFixture(
        parseJson(
          await verifiedAsset(build.fixtures[fixture.name]!, base, 'fixture'),
          'fixture',
        ),
        { cwd: fixture.cwd },
      )
    : [];
  return { build, guest, entries, cwd: fixture.cwd };
}
