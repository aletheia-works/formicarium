/** Minimal static ELF64 x86-64 executable accepted by the public validateGuest. */
export function staticElf(size = 120, marker = 0): Uint8Array {
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
  if (size > 120) bytes[size - 1] = marker;
  return bytes;
}

/** Same header with a second program header of type PT_INTERP (dynamic). */
export function dynamicElf(): Uint8Array {
  const bytes = new Uint8Array(200);
  bytes.set(staticElf(120).subarray(0, 120));
  const view = new DataView(bytes.buffer);
  view.setUint16(56, 2, true);
  view.setUint32(120, 3, true);
  return bytes;
}
