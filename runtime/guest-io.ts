import type {
  ByteSink,
  CoreModule,
  FileSystem,
  FsEntry,
  GuestOptions,
  GuestResult,
  LegacyEntry,
  ModuleOptions,
  SessionStep,
} from './contracts.js';
// ゲストの入出力を扱う、コアに依存しない共通部（Node.js とブラウザの両方で使う）。
//
// 「コア」は x86-64 を解釈するエミュレータで、wasm モジュール 1 つと、それを起動する
// JS（Emscripten の MODULARIZE 形式のファクトリ）として扱う。いまのコアは blink の fork
// だが、将来 paludarium（Rust 版 blink）に置き換えても、このファイルは変えずに済むように、
// コア固有の知識は runtime/core.js の記述子（コマンドラインの組み立て方など）に閉じ込める。
//
// ここで提供するもの：
//   - ゲストのバイナリと入力ファイルを仮想ファイルシステム（Emscripten の FS）に置く
//   - stdout・stderr をバイト単位で受け取る
//   - 終了コードを取り出す
//   - 複数のコマンドを順に実行するために、ファイルシステムの中身を写し取って次へ渡す

/** 1 回の実行に使う既定の作業ディレクトリ */
export const DEFAULT_CWD = '/work';
/** ゲストのバイナリを置くディレクトリ */
export const GUEST_DIR = '/guest';

const now = () => globalThis.performance?.now() ?? Date.now();

const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

/** ゲストの実行が終了コードを返せずに終わったときのエラー */
export class GuestRunError extends Error {
  stdout?: Uint8Array;
  stderr?: Uint8Array;
  constructor(
    message: string,
    {
      cause,
      stdout,
      stderr,
    }: { cause?: unknown; stdout?: Uint8Array; stderr?: Uint8Array } = {},
  ) {
    super(message, { cause });
    this.name = 'GuestRunError';
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * 仮想ファイルシステムに置くエントリの検証。境界での入力チェック。
 * @param {Array<{path: string, type?: 'file'|'dir'|'symlink', data?: Uint8Array|string, target?: string, mode?: number}>} entries
 */
export function validateEntries(entries: readonly LegacyEntry[]) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  for (const entry of entries) {
    if (typeof entry?.path !== 'string' || !entry.path.startsWith('/')) {
      throw new TypeError(
        `entry path must be an absolute string: ${JSON.stringify(entry?.path)}`,
      );
    }
    if (entry.path.split('/').includes('..')) {
      throw new TypeError(`entry path must not contain "..": ${entry.path}`);
    }
    const type = entry.type ?? 'file';
    if (!['file', 'dir', 'symlink'].includes(type)) {
      throw new TypeError(`unknown entry type for ${entry.path}: ${type}`);
    }
    if (type === 'symlink' && typeof entry.target !== 'string') {
      throw new TypeError(`symlink ${entry.path} needs a string target`);
    }
    if (
      type === 'file' &&
      !(entry.data instanceof Uint8Array) &&
      typeof entry.data !== 'string'
    ) {
      throw new TypeError(`file ${entry.path} needs Uint8Array or string data`);
    }
  }
  return entries;
}

/** `path` の親ディレクトリを（なければ）作る。 */
function mkdirParents(FS: FileSystem, path: string) {
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (const part of parts.slice(0, -1)) {
    current += `/${part}`;
    mkdirIfMissing(FS, current);
  }
}

function mkdirIfMissing(FS: FileSystem, path: string, mode = 0o755) {
  const found = FS.analyzePath(path);
  if (found.exists) {
    if (!FS.isDir(FS.lstat(path).mode)) {
      throw new Error(
        `cannot create directory ${path}: a non-directory exists there`,
      );
    }
    return;
  }
  FS.mkdir(path, mode);
}

/**
 * エントリを仮想ファイルシステムに置く。親ディレクトリは自動で作る。
 * @param {object} FS Emscripten の FS
 */
export function populateFs(FS: FileSystem, entries: readonly LegacyEntry[]) {
  validateEntries(entries);
  const inodes = new Map<string, string>();
  const ordered = [...entries].sort(
    (a, b) =>
      (a.type === 'dir' ? 0 : a.type === 'symlink' ? 2 : 1) -
      (b.type === 'dir' ? 0 : b.type === 'symlink' ? 2 : 1),
  );
  for (const entry of ordered) {
    const type = entry.type ?? 'file';
    mkdirParents(FS, entry.path);
    if (type === 'dir') {
      mkdirIfMissing(FS, entry.path, entry.mode ?? 0o755);
    } else if (type === 'symlink') {
      FS.symlink(entry.target!, entry.path);
    } else {
      const peer = entry.inodeId && inodes.get(entry.inodeId);
      if (peer) FS.link(peer, entry.path);
      else {
        FS.writeFile(entry.path, entry.data!);
        FS.chmod(entry.path, entry.mode ?? 0o644);
        if (entry.inodeId) inodes.set(entry.inodeId, entry.path);
      }
    }
  }
  for (const entry of entries)
    if (entry.type === 'dir') FS.chmod(entry.path, entry.mode ?? 0o755);
}

/**
 * `root` 以下を写し取り、populateFs にそのまま渡せるエントリの配列にする。
 * inode identity、mode、linkを保持する。特殊fileは完全snapshotにできないので拒否する。
 */
export function snapshotFs(FS: FileSystem, root: string): FsEntry[] {
  const entries: FsEntry[] = [];
  const walk = (path: string): void => {
    const stat = FS.lstat(path);
    const kind = stat.mode & S_IFMT;
    const mode = stat.mode & 0o7777;
    if (kind === S_IFDIR) {
      entries.push({ path, type: 'dir', mode });
      for (const name of FS.readdir(path)) {
        if (name === '.' || name === '..') continue;
        walk(path === '/' ? `/${name}` : `${path}/${name}`);
      }
    } else if (kind === S_IFLNK) {
      entries.push({ path, type: 'symlink', target: FS.readlink(path) });
    } else if (kind === S_IFREG) {
      entries.push({
        path,
        type: 'file',
        data: new Uint8Array(FS.readFile(path)),
        mode,
        inodeId: `inode:${stat.ino}`,
      });
    } else
      throw new GuestRunError('snapshot contains an unsupported special file');
  };
  if (FS.analyzePath(root).exists) walk(root);
  return entries;
}

/** `path` 以下を消す（rm -rf 相当）。存在しなければ何もしない。 */
export function removeTree(FS: FileSystem, path: string) {
  const found = FS.analyzePath(path, true);
  if (!found.exists) return;
  const stat = FS.lstat(path);
  if ((stat.mode & S_IFMT) === S_IFDIR) {
    for (const name of FS.readdir(path)) {
      if (name === '.' || name === '..') continue;
      removeTree(FS, `${path}/${name}`);
    }
    FS.rmdir(path);
  } else {
    FS.unlink(path);
  }
}

/**
 * stdout・stderr をバイト単位で受け取り、ためながら sink にも流す。
 * Emscripten の FS.init は 1 バイトずつ呼ぶので、sink には適度にまとめて渡す。
 */
export function createOutputCollector({
  onStdout,
  onStderr,
}: {
  onStdout?: ByteSink;
  onStderr?: ByteSink;
} = {}) {
  const make = (sink?: ByteSink) => {
    const chunks: Uint8Array[] = [];
    let pending: number[] = [];
    const flush = () => {
      if (pending.length === 0) return;
      const chunk = Uint8Array.from(pending);
      pending = [];
      chunks.push(chunk);
      if (sink) sink(chunk);
    };
    return {
      byte(code: number | null | undefined) {
        if (code === null || code === undefined) return;
        pending.push(code & 0xff);
        if (code === 10 || pending.length >= 4096) flush();
      },
      flush,
      bytes() {
        flush();
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        return out;
      },
    };
  };
  return { stdout: make(onStdout), stderr: make(onStderr) };
}

function writeLine(stream: { byte(code: number): void }, line: string) {
  for (const b of new TextEncoder().encode(`${line}
`))
    stream.byte(b);
}

/**
 * コアでゲストを 1 回実行する。
 * @param {object} options
 * @param {(moduleOptions: object) => Promise<object>} options.createModule コアのファクトリ
 * @param {{ argv: (guestPath: string, args: string[]) => string[] }} options.core コアの記述子
 * @param {string} options.guestPath 仮想ファイルシステム上のゲストのパス
 * @param {string[]} [options.args] ゲストに渡す引数
 * @param {Array} [options.entries] 実行前に置くエントリ（ゲストのバイナリを含む）
 * @param {Record<string,string>} [options.env] 環境変数
 * @param {string} [options.cwd] 作業ディレクトリ
 * @param {string[]} [options.snapshotRoots] 終了時に写し取るディレクトリ
 * @param {string[]} [options.coreFlags] コア自身へのフラグ（診断用）
 * @param {(b: Uint8Array) => void} [options.onStdout]
 * @param {(b: Uint8Array) => void} [options.onStderr]
 * @returns {Promise<{exitCode: number, stdout: Uint8Array, stderr: Uint8Array, snapshot?: Array}>}
 */
export function runGuest(options: GuestOptions): Promise<GuestResult> {
  const {
    createModule,
    core,
    guestPath,
    args = [],
    entries = [],
    env = {},
    cwd = DEFAULT_CWD,
    snapshotRoots = [],
    coreFlags = [],
    onStdout,
    onStderr,
  } = options;
  if (typeof createModule !== 'function')
    throw new TypeError('createModule must be a function');
  if (typeof core?.argv !== 'function')
    throw new TypeError('core.argv must be a function');
  if (typeof guestPath !== 'string' || !guestPath.startsWith('/')) {
    throw new TypeError(`guestPath must be an absolute path: ${guestPath}`);
  }
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new TypeError('args must be an array of strings');
  }
  validateEntries(entries);
  const output = createOutputCollector({ onStdout, onStderr });

  return new Promise((resolve, reject) => {
    let settled = false;
    let moduleRef: CoreModule | null = null;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      output.stdout.flush();
      output.stderr.flush();
      let snapshot: FsEntry[] | undefined;
      try {
        if (snapshotRoots.length && moduleRef?.FS) {
          snapshot = snapshotRoots.flatMap((root) =>
            snapshotFs(moduleRef!.FS, root),
          );
        }
      } catch (error) {
        reject(
          Object.assign(
            new GuestRunError('failed to snapshot guest filesystem', {
              cause: error,
            }),
            { code: 'SNAPSHOT' },
          ),
        );
        return;
      }
      resolve({
        exitCode,
        stdout: output.stdout.bytes(),
        stderr: output.stderr.bytes(),
        snapshot,
      });
    };
    const fail = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      reject(
        new GuestRunError(message, {
          cause,
          stdout: output.stdout.bytes(),
          stderr: output.stderr.bytes(),
        }),
      );
    };

    const moduleOptions: ModuleOptions = {
      arguments: core.argv(guestPath, args, coreFlags),
      noInitialRun: false,
      preRun: [
        (mod) => {
          moduleRef = core.captureModule?.(mod) ?? mod;
          const FS = mod.FS;
          FS.init(() => null, output.stdout.byte, output.stderr.byte);
          populateFs(FS, entries);
          mkdirParents(FS, cwd);
          mkdirIfMissing(FS, cwd);
          FS.chdir(cwd);
          Object.assign(mod.ENV, {
            HOME: '/root',
            PATH: '/usr/bin:/bin',
            ...env,
          });
        },
      ],
      onExit: (code) => finish(code),
      quit: (code, toThrow) => {
        // Emscripten の既定は Node で process.exit を呼ぶので、ここで受け止める。
        if (toThrow && toThrow.name !== 'ExitStatus') {
          fail(
            `core quit with an error: ${toThrow.message ?? toThrow}`,
            toThrow,
          );
          return;
        }
        finish(code);
      },
      onAbort: (what) => fail(`core aborted: ${what}`),
      print: (line) => writeLine(output.stdout, line),
      printErr: (line) => writeLine(output.stderr, line),
    };
    Promise.resolve()
      .then(() => createModule(moduleOptions))
      .then((mod) => {
        moduleRef = mod;
      })
      .catch((error) =>
        fail(`failed to start the core: ${error?.message ?? error}`, error),
      );
  });
}

/**
 * 引き継いでいるエントリから、通常のファイル 1 つの中身を読む（手順の cat）。
 * persist の範囲の外、存在しない、ディレクトリ、symlink のときは Error を投げる
 * （黙って空の出力を返すと、native との比較で原因が分からなくなるため）。
 * @param {Array} carried runSession が次のステップへ渡すエントリ
 * @param {string} target 仮想ファイルシステム上の絶対パス
 * @param {string[]} roots persist のディレクトリ
 * @returns {Uint8Array}
 */
export function readCarriedFile(
  carried: readonly LegacyEntry[],
  target: string,
  roots: readonly string[],
) {
  const inRoots = (path: string) =>
    roots.some((r) => path === r || path.startsWith(`${r}/`));
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.split('/').includes('..')
  ) {
    throw new TypeError(
      `catFile must be an absolute path without "..": ${target}`,
    );
  }
  if (!inRoots(target)) {
    throw new TypeError(
      `catFile must be inside ${roots.join(' or ')}: ${target}`,
    );
  }
  const entry = carried.findLast((e) => e.path === target);
  if (!entry) throw new Error(`cat: no such file: ${target}`);
  const type = entry.type ?? 'file';
  if (type === 'dir') throw new Error(`cat: is a directory: ${target}`);
  if (type !== 'file')
    throw new Error(`cat: not a regular file (${type}): ${target}`);
  return typeof entry.data === 'string'
    ? new TextEncoder().encode(entry.data)
    : Uint8Array.from(entry.data!);
}

/**
 * 複数のコマンドを順に実行する（例：aube #1645 の手順）。各ステップは新しいコアの
 * インスタンスで動き、persist に挙げたディレクトリ（既定は作業ディレクトリと HOME）の
 * 中身は前のステップから引き継ぐ。
 * ステップは { args: [...] }（ゲストの実行）、{ removeTree: '/path' }（JS 側で rm -rf）、
 * { catFile: '/path' }（JS 側で cat。引き継いでいるファイルの中身を stdout に返す）のどれか。
 * removeTree と catFile はコアを起動しない。
 * 各結果の elapsedMs は、コアの起動（wasm の読み込み）を含む、そのステップの実時間。
 * @returns {Promise<Array<{step: object, exitCode: number, stdout: Uint8Array, stderr: Uint8Array, elapsedMs: number}>>}
 */
export async function runSession({
  createModule,
  core,
  guestPath,
  guestEntry,
  steps,
  entries = [],
  env = {},
  cwd = DEFAULT_CWD,
  persist,
  coreFlags = [],
  onStdout,
  onStderr,
}: Omit<GuestOptions, 'snapshotRoots'> & {
  guestEntry: LegacyEntry;
  steps: SessionStep[];
  persist?: string[];
}) {
  if (!Array.isArray(steps) || steps.length === 0)
    throw new TypeError('steps must be a non-empty array');
  if (guestEntry?.path !== guestPath)
    throw new TypeError('guestEntry.path must equal guestPath');
  const roots = persist ?? [cwd, env.HOME ?? '/root'];
  const inRoots = (path: string) =>
    roots.some((r) => path === r || path.startsWith(`${r}/`));
  let carried = [...entries];
  const results = [];
  for (const step of steps) {
    if (step.removeTree !== undefined) {
      const target = step.removeTree;
      if (
        typeof target !== 'string' ||
        !inRoots(target) ||
        roots.includes(target)
      ) {
        throw new TypeError(
          `removeTree must be inside ${roots.join(' or ')}: ${target}`,
        );
      }
      const prefix = `${target}/`;
      carried = carried.filter(
        (e) => e.path !== target && !e.path.startsWith(prefix),
      );
      results.push({
        step,
        exitCode: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        elapsedMs: 0,
      });
      continue;
    }
    if (step.catFile !== undefined) {
      const stdout = readCarriedFile(carried, step.catFile, roots);
      results.push({
        step,
        exitCode: 0,
        stdout,
        stderr: new Uint8Array(),
        elapsedMs: 0,
      });
      continue;
    }
    const started = now();
    const result = await runGuest({
      createModule,
      core,
      guestPath,
      args: step.args,
      entries: [guestEntry, ...carried],
      env,
      cwd,
      snapshotRoots: roots,
      coreFlags,
      onStdout,
      onStderr,
    });
    const elapsedMs = now() - started;
    carried = [
      ...entries.filter((e) => !inRoots(e.path)),
      ...(result.snapshot ?? []),
    ];
    results.push({
      step,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      elapsedMs,
    });
  }
  return results;
}
