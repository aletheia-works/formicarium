// Node.js でゲストを実行するための API。コアは Worker（worker_threads）の中で動かす。
//
//   const { results } = await runInWorker({ guest: 'dist/guests/probe' });
//
// guest はホスト上のファイル。コアの仮想ファイルシステムの /guest/<名前> に置いて実行する。
// copyIn で、ホストのディレクトリを仮想ファイルシステムに写してから実行できる。
// steps を渡すと、複数のコマンドを順に実行する（runtime/guest-io.js の runSession）。
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { HostOptions, HostResult } from '../contracts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '..', '..');
/** 開発用のコア（bun run build が node_modules の paludarium から写す） */
export const coreDirectory = path.join(projectRoot, 'dist', 'paludarium');

/** ゲストが見つからないときの終了コード（シェルと同じ） */
export const EXIT_NOT_FOUND = 127;

/** ゲストのファイルが見つからないことを表すエラー */
export class GuestNotFoundError extends Error {
  guest: string;
  constructor(guest: string) {
    super(`guest not found: ${guest}`);
    this.name = 'GuestNotFoundError';
    this.guest = guest;
  }
}

/**
 * @param {object} options
 * @param {string} options.guest ホスト上のゲストのパス
 * @param {string[]} [options.args]
 * @param {Array<{host: string, guest: string}>} [options.copyIn]
 * @param {Record<string,string>} [options.env]
 * @param {string} [options.cwd] 仮想ファイルシステム上の作業ディレクトリ
 * @param {Array<{args?: string[], removeTree?: string, catFile?: string}>} [options.steps]
 * @param {string[]} [options.persist] steps の間で中身を引き継ぐディレクトリ（既定は cwd と HOME）
 * @param {(chunk: Uint8Array) => void} [options.onStdout]
 * @param {(chunk: Uint8Array) => void} [options.onStderr]
 * @param {number} [options.timeoutMs] これを過ぎたら Worker を止めてエラーにする
 * @param {{allow: string[], relay?: {url: string, protocols: string[]}}} [options.network]
 *   ゲストが TCP でつないでよい行き先と、渡したときは通る WebSocket の relay
 */
export async function runInWorker(options: HostOptions): Promise<HostResult> {
  const {
    guest,
    args = [],
    copyIn = [],
    env = {},
    cwd,
    steps,
    persist,
    onStdout,
    onStderr,
    timeoutMs,
    network,
  } = options;
  if (typeof guest !== 'string' || guest.length === 0)
    throw new TypeError('guest must be a path');
  const guestHostPath = path.resolve(guest);
  if (!existsSync(guestHostPath) || !statSync(guestHostPath).isFile()) {
    throw new GuestNotFoundError(guest);
  }
  if (!existsSync(path.join(coreDirectory, 'build-info.json'))) {
    throw new Error(`core not found: ${coreDirectory} (run: bun run build)`);
  }
  for (const item of copyIn) {
    if (!existsSync(item.host))
      throw new Error(`copy-in source not found: ${item.host}`);
  }

  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    workerData: {
      coreDirectory,
      guestHostPath,
      args,
      copyIn: copyIn.map((c) => ({
        host: path.resolve(c.host),
        guest: c.guest,
      })),
      env,
      cwd,
      steps,
      persist,
      network,
    },
  });
  return await new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const done = <T>(fn: (value: T) => void, value: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate().finally(() => fn(value));
    };
    if (timeoutMs) {
      timer = setTimeout(
        () =>
          done(reject, new Error(`guest run timed out after ${timeoutMs} ms`)),
        timeoutMs,
      );
    }
    worker.on('message', (message) => {
      switch (message.type) {
        case 'stdout':
          onStdout?.(message.chunk);
          break;
        case 'stderr':
          onStderr?.(message.chunk);
          break;
        case 'done':
          done(resolve, message);
          break;
        case 'error':
          done(
            reject,
            Object.assign(new Error(message.message), {
              stdout: message.stdout,
              stderr: message.stderr,
            }),
          );
          break;
        default:
          done(
            reject,
            new Error(`unexpected message from worker: ${message.type}`),
          );
      }
    });
    worker.on('error', (error) => done(reject, error));
    worker.on('exit', (code) => {
      // done() が先に呼ばれていれば、ここは terminate による終了なので何もしない。
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(new Error(`worker exited unexpectedly with code ${code}`));
    });
  });
}
