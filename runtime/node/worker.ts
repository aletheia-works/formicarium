// runtime/node/host.js から起動される Worker。コアを読み込み、ゲストを実行して結果を返す。
// メッセージ：{type:'stdout'|'stderr', chunk} を逐次、最後に {type:'done', results} か
// {type:'error', message}。
import { lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import type {
  CoreLauncher,
  HostOptions,
  HostResult,
  LegacyEntry,
} from '../contracts.js';
import {
  coreAssets,
  createCoreResourceOwner,
  loadPackageCore,
} from '../core.js';
import { GUEST_DIR, runGuest, runSession } from '../guest-io.js';

/** ホストのディレクトリ（またはファイル）を、仮想ファイルシステムのエントリに変換する。 */
function readHostTree(hostPath: string, guestPath: string) {
  const entries: LegacyEntry[] = [];
  const walk = (h: string, g: string): void => {
    const stat = lstatSync(h);
    if (stat.isDirectory()) {
      entries.push({ path: g, type: 'dir', mode: 0o755 });
      for (const name of readdirSync(h).sort())
        walk(path.join(h, name), `${g}/${name}`);
    } else if (stat.isSymbolicLink()) {
      entries.push({ path: g, type: 'symlink', target: readlinkSync(h) });
    } else if (stat.isFile()) {
      entries.push({
        path: g,
        type: 'file',
        data: readFileSync(h),
        mode: stat.mode & 0o777 || 0o644,
      });
    }
  };
  walk(hostPath, guestPath);
  return entries;
}

function post(type: 'stdout' | 'stderr', chunk: Uint8Array) {
  // 受け取る側で使えるように、コピーして渡す
  parentPort?.postMessage({ type, chunk: Uint8Array.from(chunk) });
}

type WorkerData = HostOptions & {
  coreDirectory: string;
  guestHostPath: string;
  copyIn: { host: string; guest: string }[];
};

async function main() {
  const data = workerData as WorkerData;
  // パッケージと同じく、照合したコアのファイルを専用の一時ディレクトリに置いてから読み込む
  const resources = createCoreResourceOwner();
  try {
    const { launcher, cleanup } = await loadPackageCore({
      assets: coreAssets(
        pathToFileURL(`${data.coreDirectory}/`),
        import.meta.url,
      ),
      readBytes: async (url) => new Uint8Array(await readFile(new URL(url))),
      resources,
    });
    try {
      parentPort?.postMessage({
        type: 'done',
        results: (await runAll(launcher, data)).map((r) => ({
          step: r.step,
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
          elapsedMs: r.elapsedMs,
        })),
      });
    } finally {
      await cleanup();
    }
  } finally {
    await resources.dispose();
  }
}

async function runAll(
  launcher: CoreLauncher,
  {
    guestHostPath,
    args,
    copyIn,
    env,
    cwd,
    steps,
    persist,
    network,
  }: WorkerData,
): Promise<HostResult['results']> {
  const guestPath = `${GUEST_DIR}/${path.basename(guestHostPath)}`;
  const guestEntry: LegacyEntry = {
    path: guestPath,
    type: 'file',
    data: readFileSync(guestHostPath),
    mode: 0o755,
  };
  const entries = copyIn.flatMap((c) => readHostTree(c.host, c.guest));
  const common = {
    launcher,
    guestPath,
    env,
    cwd,
    ...(network ? { network } : {}),
    onStdout: (chunk: Uint8Array) => post('stdout', chunk),
    onStderr: (chunk: Uint8Array) => post('stderr', chunk),
  };
  if (steps)
    return await runSession({
      ...common,
      guestEntry,
      steps,
      entries,
      persist,
    });
  const started = performance.now();
  const result = await runGuest({
    ...common,
    args,
    entries: [guestEntry, ...entries],
  });
  return [
    { ...result, step: { args }, elapsedMs: performance.now() - started },
  ];
}

// 想定外の例外は、ホスト側に伝えてから終わる。
function onUncaught(error: unknown) {
  parentPort?.postMessage({
    type: 'error',
    message: `uncaught exception in worker: ${error instanceof Error ? error.stack : String(error)}`,
  });
}
process.on('uncaughtException', onUncaught);
process.on('unhandledRejection', onUncaught);

main().catch((error) => {
  parentPort?.postMessage({
    type: 'error',
    message: error?.message ?? String(error),
    stdout: error?.stdout,
    stderr: error?.stderr,
  });
});
