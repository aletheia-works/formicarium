// paludarium のコアが、固定した版から照合用の digest つきで dist/paludarium に写され、
// wasm の memory の上限が 1 GB であること。
// pitchfork：dist/guests/pitchfork が
// static な x86-64 の ELF で、取得したコミットと UI の node が記録され、ローカルパッチがないこと。
// 前提：bun run build と bash mise-tasks/build/guests.sh pitchfork を実行済み
//       （README の「テスト」を参照）。
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { missingArtifacts, PT_INTERP, readElfInfo, root } from './helpers.js';

const CORE = path.join(root, 'dist/paludarium');
/** 1 GiB（64 KiB のページで 16384）。WebKit が上限まで確保するのを抑える（ADR 0010、サイトの開発の節）。 */
const MEMORY_PAGES_1GB = 16384;

/** wasm が import する memory の上限（ページ数）。import がなければ null。 */
function importedMemoryMaximum(wasm: Uint8Array) {
  let offset = 8;
  const leb = () => {
    let value = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = wasm[offset++]!;
      value += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return value;
  };
  const skipName = () => {
    const length = leb();
    offset += length;
  };
  while (offset < wasm.length) {
    const id = wasm[offset++];
    const size = leb();
    const end = offset + size;
    if (id === 2) {
      for (let count = leb(); count > 0; count--) {
        skipName();
        skipName();
        const kind = wasm[offset++];
        if (kind === 0) leb();
        else if (kind === 1) {
          offset++;
          const flags = wasm[offset++]!;
          leb();
          if (flags & 1) leb();
        } else if (kind === 2) {
          const flags = wasm[offset++]!;
          leb();
          return flags & 1 ? leb() : Number.POSITIVE_INFINITY;
        } else if (kind === 3) offset += 2;
        else if (kind === 4) {
          offset++;
          leb();
        } else throw new Error(`unknown import kind ${kind}`);
      }
    }
    offset = end;
  }
  return null;
}

describe('paludarium のコア', () => {
  const info = () =>
    JSON.parse(readFileSync(path.join(CORE, 'build-info.json'), 'utf8'));

  it('dist/paludarium は package.json で固定した版から、照合用の digest つきで写されている', () => {
    assert.equal(missingArtifacts(['dist/paludarium/build-info.json']), null);
    const pkg = JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    const pinned = pkg.devDependencies['@aletheia-works/paludarium-wasm'];
    assert.match(pinned, /^\d+\.\d+\.\d+$/);
    const build = info();
    assert.equal(build.core, 'paludarium');
    assert.equal(build.version, pinned);
    for (const [name, digest] of Object.entries(build.files))
      assert.equal(
        createHash('sha256')
          .update(readFileSync(path.join(CORE, name)))
          .digest('hex'),
        digest,
        name,
      );
  });

  it('wasm の memory は共有で、上限は 1 GB', () => {
    const wasm = readFileSync(path.join(CORE, 'paludarium.wasm'));
    // wasm のマジックナンバー "\0asm" とバージョン 1
    assert.deepEqual(
      [...wasm.subarray(0, 8)],
      [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    );
    assert.equal(importedMemoryMaximum(wasm), MEMORY_PAGES_1GB);
    const loader = readFileSync(path.join(CORE, 'index.mjs'), 'utf8');
    assert.match(
      loader,
      new RegExp(`maximum: ${MEMORY_PAGES_1GB}, shared: true`),
    );
  });
});

/** テスト用の最小の ELF64 ヘッダとプログラムヘッダを作る。 */
function fakeElf(programHeaderTypes: number[]) {
  const buf = Buffer.alloc(64 + 56 * programHeaderTypes.length);
  buf.writeUInt32BE(0x7f454c46, 0);
  buf[4] = 2; // ELFCLASS64
  buf[5] = 1; // ELFDATA2LSB
  buf.writeUInt16LE(0x3e, 18); // EM_X86_64
  buf.writeBigUInt64LE(64n, 32); // e_phoff
  buf.writeUInt16LE(56, 54); // e_phentsize
  buf.writeUInt16LE(programHeaderTypes.length, 56); // e_phnum
  programHeaderTypes.forEach((type, i) => {
    buf.writeUInt32LE(type, 64 + i * 56);
  });
  return buf;
}

describe('static な ELF の判定（readElfInfo、build-guests.sh と同じ判定）', () => {
  it('PT_INTERP がなければ static、あれば動的リンクと判定する', () => {
    // PT_LOAD=1、PT_DYNAMIC=2（static-pie にもある）、PT_GNU_STACK
    assert.equal(readElfInfo(fakeElf([1, 1, 2, 0x6474e551])).isStatic, true);
    const dynamic = readElfInfo(fakeElf([6, PT_INTERP, 1]));
    assert.equal(dynamic.isStatic, false);
    assert.equal(dynamic.machine, 0x3e);
  });

  it('ELF でないもの・プログラムヘッダが壊れたものは Error になる', () => {
    assert.throws(
      () =>
        readElfInfo(
          Buffer.from('#!/bin/sh\necho not an elf\n'.padEnd(80, ' ')),
        ),
      /not an ELF/,
    );
    const truncated = fakeElf([1, 1]).subarray(0, 64 + 56);
    assert.throws(() => readElfInfo(truncated), /invalid program header table/);
    const elf32 = fakeElf([1]);
    elf32[4] = 1; // ELFCLASS32
    assert.throws(() => readElfInfo(elf32), /ELF64/);
  });
});

describe('pitchfork ゲストのビルド', () => {
  it('dist/guests/pitchfork は static な x86-64 の ELF で、取得したコミットが記録されている', () => {
    assert.equal(
      missingArtifacts([
        'dist/guests/pitchfork',
        'dist/guests/pitchfork.commit',
      ]),
      null,
    );
    const info = readElfInfo(
      readFileSync(path.join(root, 'dist/guests/pitchfork')),
    );
    assert.equal(info.machine, 0x3e);
    assert.equal(
      info.isStatic,
      true,
      `program headers: ${info.programHeaderTypes.join(',')}`,
    );
    assert.match(
      readFileSync(
        path.join(root, 'dist/guests/pitchfork.commit'),
        'utf8',
      ).trim(),
      /^[0-9a-f]{40}$/,
    );
  });

  it('pitchfork.build-info に当てたパッチ・UI の node・UI の成果物が記録され、今のパッチと一致する', () => {
    assert.equal(
      missingArtifacts([
        'dist/guests/pitchfork.build-info',
        'dist/guests/pitchfork.commit',
      ]),
      null,
    );
    const fields = Object.fromEntries(
      readFileSync(path.join(root, 'dist/guests/pitchfork.build-info'), 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((line) => [
          line.slice(0, line.indexOf('=')),
          line.slice(line.indexOf('=') + 1),
        ]),
    );
    assert.equal(fields.ref, 'v2.30.1');
    // Official v2.30.1 tag commit observed independently of local build-info.
    assert.equal(fields.commit, '1054549e85470b08d9507e2c82c850959a4b3914');
    assert.equal(
      fields.commit,
      readFileSync(
        path.join(root, 'dist/guests/pitchfork.commit'),
        'utf8',
      ).trim(),
    );
    assert.equal(fields.patch, undefined);
    assert.match(fields['ui-node'], /^v\d+\.\d+\.\d+$/);
    assert.ok(Number(fields['ui-node'].slice(1).split('.')[0]) >= 26);
    assert.match(fields['ui-index-sha256'], /^[0-9a-f]{64}$/);
  });
});
