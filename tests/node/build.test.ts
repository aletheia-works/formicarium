// blink の fork を固定したコミットで取得し、wasm にビルドできること。
// pitchfork：dist/guests/pitchfork が
// static な x86-64 の ELF で、取得したコミットと UI の node が記録され、ローカルパッチがないこと。
// 前提：bash mise-tasks/build/blink-wasm.sh と bash mise-tasks/build/guests.sh pitchfork を実行済み
//       （README の「テスト」を参照）。
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
  missingArtifacts,
  PT_INTERP,
  readElfInfo,
  readLock,
  root,
  runScript,
} from './helpers.js';

const lock = readLock(readFileSync(path.join(root, 'blink.lock'), 'utf8'));
const scratch = mkdtempSync(path.join(tmpdir(), 'formicarium-build-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

describe('blink の wasm ビルド', () => {
  it('dist/blink に blink.mjs と wasm が生成されている', () => {
    assert.equal(
      missingArtifacts(['dist/blink/blink.mjs', 'dist/blink/blink.wasm']),
      null,
    );
    const wasm = readFileSync(path.join(root, 'dist/blink/blink.wasm'));
    // wasm のマジックナンバー "\0asm" とバージョン 1
    assert.deepEqual(
      [...wasm.subarray(0, 8)],
      [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    );
    const loader = readFileSync(
      path.join(root, 'dist/blink/blink.mjs'),
      'utf8',
    );
    assert.match(loader, /export default createBlink/);
  });

  it('ビルド物は blink.lock のコミットから、JIT なしで作られている', () => {
    const info = JSON.parse(
      readFileSync(path.join(root, 'dist/blink/build-info.json'), 'utf8'),
    );
    assert.match(lock.commit, /^[0-9a-f]{40}$/);
    assert.equal(info.blinkCommit, lock.commit);
    assert.equal(info.blinkSourceDirty, false);
    assert.match(info.configure, /--disable-jit/);
    assert.match(info.link, /-sPROXY_TO_PTHREAD/);
    // WebKit が上限まで確保するのを抑えるため 1GB（ADR 0010）
    assert.match(info.link, /-sMAXIMUM_MEMORY=1GB/);
    assert.doesNotMatch(info.link, /-sMAXIMUM_MEMORY=4GB/);
  });
});

describe('fork の取得', () => {
  it('取得物（.vendor/blink）の HEAD は blink.lock のコミットと一致し、upstream との差分を一覧できる', () => {
    const head = execFileSync(
      'git',
      ['-C', path.join(root, '.vendor/blink'), 'rev-parse', 'HEAD'],
      {
        encoding: 'utf8',
      },
    ).trim();
    assert.equal(head, lock.commit);
    const changed = execFileSync(
      'git',
      [
        '-C',
        path.join(root, '.vendor/blink'),
        'diff',
        '--name-only',
        lock.upstream_commit,
        lock.commit,
      ],
      { encoding: 'utf8' },
    );
    assert.match(changed, /blink\/emufd\.c/);
  });

  it('コミットの書式が不正なロックではエラーで止まる', () => {
    const badLock = path.join(scratch, 'bad-format.lock');
    writeFileSync(
      badLock,
      readFileSync(path.join(root, 'blink.lock'), 'utf8').replace(
        /^commit=.*$/m,
        'commit=main',
      ),
    );
    const result = runScript('mise-tasks/build/fetch-blink.sh', {
      env: {
        BLINK_LOCK: badLock,
        BLINK_DEST: path.join(scratch, 'blink-bad-format'),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /40 桁の 16 進数/);
  });

  it('fork に存在しないコミットを指すロックではエラーで止まる', () => {
    const missingLock = path.join(scratch, 'missing-commit.lock');
    writeFileSync(
      missingLock,
      readFileSync(path.join(root, 'blink.lock'), 'utf8').replace(
        /^commit=.*$/m,
        `commit=${'0'.repeat(40)}`,
      ),
    );
    const dest = path.join(scratch, 'blink-missing-commit');
    const result = runScript('mise-tasks/build/fetch-blink.sh', {
      env: { BLINK_LOCK: missingLock, BLINK_DEST: dest },
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /に取得しました/);
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
