import { createHash } from 'node:crypto';
import {
  type GuestBuildInfo,
  type GuestExpectation,
  guestBuildKey,
  guestCanonical,
} from '../../runtime/guest-validation.js';
export const digest = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
export function elf(size = 120): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([127, 69, 76, 70, 2, 1, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 2, true);
  view.setUint16(18, 62, true);
  view.setUint32(20, 1, true);
  view.setBigUint64(32, 64n, true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint32(64, 1, true);
  return bytes;
}
export function expectation(
  bytes = elf(),
  extra: Record<string, unknown> = {},
): GuestExpectation {
  const info: GuestBuildInfo = {
    schemaVersion: 1,
    tool: 'fixture',
    versionOrName: '1.0.0',
    source: {
      repository: 'https://example.org/fixture',
      commit: 'a'.repeat(40),
    },
    target: 'x86_64-unknown-linux-musl',
    rustc: null,
    sourcePatches: [],
    dependencies: [],
    builderHash: 'b'.repeat(64),
    buildKey: 'c'.repeat(64),
    elfSha256: digest(bytes),
    ...extra,
  };
  info.buildKey = guestBuildKey(info);
  return {
    elfSha256: info.elfSha256,
    buildInfoSha256: digest(guestCanonical(info)),
    identity: info,
  };
}
