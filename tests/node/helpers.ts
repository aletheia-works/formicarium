// テストの共通処理。
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/**
 * スクリプトを実行する bash。Windows では WSL の bash（System32）ではなく Git Bash を使う。
 * FORMICARIUM_BASH で上書きできる。
 */
export function bashPath() {
  if (process.env.FORMICARIUM_BASH) return process.env.FORMICARIUM_BASH;
  if (process.platform === 'win32') {
    for (const candidate of [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'bash';
}

/** プロジェクトのルートでスクリプトを実行し、終了コードと出力を返す。 */
export function runScript(
  script: string,
  { env = {}, timeout = 10 * 60 * 1000 } = {},
) {
  const result = spawnSync(bashPath(), [script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout,
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/** blink.lock の値を読む。 */
export function readLock(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([a-z_]+)=(.*)$/.exec(line);
    if (m) values[m[1]!] = m[2]?.trim();
  }
  return values;
}

/** 必要なビルド物がなければ、理由つきでテストを飛ばすための文字列を返す（あれば null）。 */
export function missingArtifacts(paths: string[]) {
  const missing = paths.filter((p) => !existsSync(path.join(root, p)));
  return missing.length
    ? `missing build artifacts: ${missing.join(', ')}`
    : null;
}

/** ELF の PT_INTERP（動的リンカの指定）。これがなければ static。 */
export const PT_INTERP = 3;

/**
 * ELF64 のヘッダとプログラムヘッダを読み、static かどうかを判定する
 * （.mise/tasks/build-guests の check_static_elf と同じ判定）。ELF でなければ Error を投げる。
 * @param {Uint8Array} bytes ファイルの中身
 * @returns {{ elfClass: number, littleEndian: boolean, machine: number, programHeaderTypes: number[], isStatic: boolean }}
 */
export function readElfInfo(bytes: Uint8Array) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46)
    throw new Error('not an ELF file');
  const elfClass = buf[4];
  const littleEndian = buf[5] === 1;
  if (elfClass !== 2 || !littleEndian)
    throw new Error('only little-endian ELF64 is supported');
  const machine = buf.readUInt16LE(18);
  const phoff = Number(buf.readBigUInt64LE(32));
  const phentsize = buf.readUInt16LE(54);
  const phnum = buf.readUInt16LE(56);
  if (
    phentsize !== 56 ||
    phnum < 1 ||
    phnum > 256 ||
    phoff + phnum * phentsize > buf.length
  ) {
    throw new Error(
      `invalid program header table (phoff=${phoff} phentsize=${phentsize} phnum=${phnum})`,
    );
  }
  const programHeaderTypes = [];
  for (let i = 0; i < phnum; i++)
    programHeaderTypes.push(buf.readUInt32LE(phoff + i * phentsize));
  return {
    elfClass,
    littleEndian,
    machine,
    programHeaderTypes,
    isStatic: !programHeaderTypes.includes(PT_INTERP),
  };
}
