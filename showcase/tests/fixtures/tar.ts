import { crc32, gzipSync } from 'node:zlib';

export interface TarSpec {
  name: string;
  type?: '0' | '1' | '2' | '5' | 'x' | 'L' | 'g' | '3';
  body?: Uint8Array | string;
  linkname?: string;
  mode?: number;
}
const encoder = new TextEncoder();
const bytesOf = (value: Uint8Array | string | undefined) =>
  typeof value === 'string'
    ? encoder.encode(value)
    : (value ?? new Uint8Array());

function put(
  header: Uint8Array,
  offset: number,
  length: number,
  value: string,
) {
  const bytes = encoder.encode(value);
  if (bytes.length > length) throw Error(`tar field too long: ${value}`);
  header.set(bytes, offset);
}
const octal = (value: number, length: number) =>
  `${value.toString(8).padStart(length - 1, '0')}\0`;

/** One ustar header block with a correct checksum. */
export function header(spec: TarSpec, size: number): Uint8Array {
  const block = new Uint8Array(512);
  put(block, 0, 100, spec.name);
  put(block, 100, 8, octal(spec.mode ?? 0o644, 8));
  put(block, 108, 8, octal(0, 8));
  put(block, 116, 8, octal(0, 8));
  put(block, 124, 12, octal(size, 12));
  put(block, 136, 12, octal(0, 12));
  put(block, 148, 8, '        ');
  put(block, 156, 1, spec.type ?? '0');
  if (spec.linkname) put(block, 157, 100, spec.linkname);
  put(block, 257, 6, 'ustar\0');
  put(block, 263, 2, '00');
  let sum = 0;
  for (const byte of block) sum += byte;
  put(block, 148, 8, `${sum.toString(8).padStart(6, '0')}\0 `);
  return block;
}

/** PAX records (`<len> key=value\n`). */
export function pax(records: Record<string, string>): Uint8Array {
  let text = '';
  for (const [key, value] of Object.entries(records)) {
    const line = ` ${key}=${value}\n`;
    let length = line.length;
    while (`${length}${line}`.length !== length)
      length = `${length}${line}`.length;
    text += `${length}${line}`;
  }
  return encoder.encode(text);
}

export function tar(entries: TarSpec[], options: { trailer?: boolean } = {}) {
  const blocks: Uint8Array[] = [];
  for (const spec of entries) {
    const body = bytesOf(spec.body);
    blocks.push(header(spec, body.length), body);
    const padding = (512 - (body.length % 512)) % 512;
    blocks.push(new Uint8Array(padding));
  }
  if (options.trailer !== false) blocks.push(new Uint8Array(1024));
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  return result;
}

export const tgz = (entries: TarSpec[], options?: { trailer?: boolean }) =>
  new Uint8Array(gzipSync(tar(entries, options)));

/** Stored (method 0) ZIP with central directory, like a small Actions artifact. */
export function zip(files: Record<string, Uint8Array | string>): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const data = bytesOf(value);
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const size = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}
