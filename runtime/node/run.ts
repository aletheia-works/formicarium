#!/usr/bin/env node
// usage: node runtime/node/run.js [options] <guest> [args...]
//
// Node.js の Worker 上のコア（blink）で、x86-64 Linux のゲストを実行する。
// stdout・stderr はそのまま流し、ゲストの終了コードを自分の終了コードにする。
// ゲストが見つからないときは、エラーメッセージを出して終了コード 127 で終わる。
//
// options:
//   --copy-in <host>:<guest>  ホストのディレクトリ（またはファイル）を仮想 FS に写す（複数可）
//   --cwd <dir>               仮想 FS 上の作業ディレクトリ（既定 /work）
//   --env <KEY=VALUE>         環境変数（複数可）
//   --timeout <seconds>       これを過ぎたら止めて終了コード 124 で終わる
//   --core-flag <flag>        コア自身へのフラグ（診断用。例：--core-flag -s で blink のシステムコール記録）
import process from 'node:process';
import type { HostOptions } from '../contracts.js';
import { errorText } from '../contracts.js';

import { EXIT_NOT_FOUND, GuestNotFoundError, runInWorker } from './host.js';

const EXIT_USAGE = 2;
const EXIT_TIMEOUT = 124;
const EXIT_INTERNAL = 70;

function usage(message?: string) {
  if (message) process.stderr.write(`run.js: ${message}\n`);
  process.stderr.write(
    'usage: node runtime/node/run.js [--copy-in host:guest] [--cwd dir] [--env K=V] [--timeout s] [--core-flag f] <guest> [args...]\n',
  );
  return EXIT_USAGE;
}

/** コマンドラインを解釈する。ゲストより後ろの引数は、すべてゲストに渡す。 */
function parseArgs(argv: string[]) {
  const options: Omit<HostOptions, 'guest'> = {
    copyIn: [],
    env: {},
    coreFlags: [],
  };
  let i = 0;
  for (; i < argv.length; ++i) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) break;
    if (arg === '--') {
      ++i;
      break;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`${arg} needs a value`);
    switch (arg) {
      case '--copy-in': {
        const sep = value.lastIndexOf(':/');
        if (sep <= 0)
          throw new Error(`--copy-in needs host:/guest/path, got ${value}`);
        options.copyIn?.push({
          host: value.slice(0, sep),
          guest: value.slice(sep + 1),
        });
        break;
      }
      case '--cwd':
        if (!value.startsWith('/'))
          throw new Error('--cwd must be an absolute path');
        options.cwd = value;
        break;
      case '--env': {
        const eq = value.indexOf('=');
        if (eq <= 0) throw new Error(`--env needs KEY=VALUE, got ${value}`);
        options.env![value.slice(0, eq)] = value.slice(eq + 1);
        break;
      }
      case '--core-flag':
        if (!value.startsWith('-'))
          throw new Error(`--core-flag takes a flag such as -s, got ${value}`);
        options.coreFlags?.push(value);
        break;
      case '--timeout': {
        const seconds = Number(value);
        if (!Number.isFinite(seconds) || seconds <= 0)
          throw new Error('--timeout must be a positive number');
        options.timeoutMs = seconds * 1000;
        break;
      }
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  if (i >= argv.length) throw new Error('missing guest');
  return { ...options, guest: argv[i]!, args: argv.slice(i + 1) };
}

async function main(argv: string[]) {
  let options: ReturnType<typeof parseArgs>;
  try {
    options = parseArgs(argv);
  } catch (error) {
    return usage(errorText(error));
  }
  try {
    const { results } = await runInWorker({
      ...options,
      onStdout: (chunk) => process.stdout.write(chunk),
      onStderr: (chunk) => process.stderr.write(chunk),
    });
    return results.at(-1)?.exitCode;
  } catch (error) {
    if (error instanceof GuestNotFoundError) {
      process.stderr.write(`run.js: ${errorText(error)}\n`);
      return EXIT_NOT_FOUND;
    }
    process.stderr.write(`run.js: ${errorText(error)}\n`);
    return /timed out/.test(errorText(error)) ? EXIT_TIMEOUT : EXIT_INTERNAL;
  }
}

const code = await main(process.argv.slice(2));
// stdout を流し切ってから終える（process.exit は書き込み途中のデータを捨てることがある）
process.exitCode = code;
