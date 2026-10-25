import type {
  ByteSink,
  CoreEntry,
  FsEntry,
  GuestOptions,
  GuestResult,
  LegacyEntry,
  SessionStep,
} from './contracts.js';
// ゲストの入出力を扱う、コアに依存しない共通部（Node.js とブラウザの両方で使う）。
//
// コアの起動と照合は runtime/core.ts が受け持つ。ここでは、起動したコア（launcher）に対して、
//   - ゲストのバイナリと入力ファイルを新しいファイルシステムに置く
//   - stdout・stderr をバイト列で受け取る
//   - 終了コードを取り出す
//   - 複数のコマンドを順に実行するために、ファイルシステムの中身を写し取って次へ渡す
// を行う。

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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** `/a/b/c` の親ディレクトリ（`/a`、`/a/b`）。 */
const parentsOf = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  return parts
    .slice(0, -1)
    .map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
};

/**
 * エントリをコアのファイルシステムの形にする。足りない親ディレクトリと directories は 0755 で補う。
 * 同じ inodeId を持つファイルは、同じ inode 番号にして hard link にする。
 */
export function toCoreEntries(
  entries: readonly LegacyEntry[],
  directories: readonly string[] = [],
): CoreEntry[] {
  validateEntries(entries);
  const byPath = new Map<string, CoreEntry>();
  const inodes = new Map<string, number>();
  for (const entry of entries) {
    const type = entry.type ?? 'file';
    if (type === 'dir')
      byPath.set(entry.path, {
        path: entry.path,
        mode: S_IFDIR | ((entry.mode ?? 0o755) & 0o7777),
      });
    else if (type === 'symlink')
      byPath.set(entry.path, {
        path: entry.path,
        mode: S_IFLNK | 0o777,
        content: encoder.encode(entry.target),
      });
    else {
      const row: CoreEntry = {
        path: entry.path,
        mode: S_IFREG | ((entry.mode ?? 0o644) & 0o7777),
        content:
          typeof entry.data === 'string'
            ? encoder.encode(entry.data)
            : new Uint8Array(entry.data!),
      };
      if (entry.inodeId) {
        if (!inodes.has(entry.inodeId))
          inodes.set(entry.inodeId, inodes.size + 1);
        row.inode = inodes.get(entry.inodeId);
      }
      byPath.set(entry.path, row);
    }
  }
  const wanted = [
    ...[...byPath.keys()].flatMap(parentsOf),
    ...directories.flatMap((path) => [...parentsOf(path), path]),
  ];
  for (const path of wanted) {
    const existing = byPath.get(path);
    if (!existing) byPath.set(path, { path, mode: S_IFDIR | 0o755 });
    else if ((existing.mode & S_IFMT) !== S_IFDIR)
      throw new TypeError(`parent directory is a non-directory: ${path}`);
  }
  return [...byPath.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

/** コアの写しを、roots の中だけのエントリにする。特殊ファイルは完全な写しにできないので拒否する。 */
export function fromCoreSnapshot(
  snapshot: readonly CoreEntry[],
  roots: readonly string[],
): FsEntry[] {
  const inRoots = (path: string) =>
    roots.some((root) => path === root || path.startsWith(`${root}/`));
  const entries: FsEntry[] = [];
  for (const row of snapshot) {
    if (!inRoots(row.path)) continue;
    const kind = row.mode & S_IFMT;
    const mode = row.mode & 0o7777;
    if (kind === S_IFDIR) entries.push({ path: row.path, type: 'dir', mode });
    else if (kind === S_IFLNK)
      entries.push({
        path: row.path,
        type: 'symlink',
        target: decoder.decode(row.content),
      });
    else if (kind === S_IFREG)
      entries.push({
        path: row.path,
        type: 'file',
        data: new Uint8Array(row.content ?? []),
        mode,
        inodeId: `inode:${row.inode}`,
      });
    else
      throw new GuestRunError('snapshot contains an unsupported special file');
  }
  return entries;
}

/** stdout・stderr の流れを読み、ためながら sink にも渡す。 */
async function collect(stream: ReadableStream<Uint8Array>, sink?: ByteSink) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = new Uint8Array(value);
    chunks.push(chunk);
    sink?.(chunk);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * コアでゲストを 1 回実行する。ファイルシステムは実行ごとに新しく作る（ADR 0008）。
 * シグナルで終わったゲストの終了コードは、シェルと同じく 128 + シグナル番号にする。
 */
export async function runGuest(options: GuestOptions): Promise<GuestResult> {
  const {
    launcher,
    guestPath,
    args = [],
    entries = [],
    env = {},
    cwd = DEFAULT_CWD,
    snapshotRoots = [],
    onStdout,
    onStderr,
    stdin,
    terminal,
  } = options;
  if (typeof launcher?.run !== 'function')
    throw new TypeError('launcher must be a started core');
  if (typeof guestPath !== 'string' || !guestPath.startsWith('/')) {
    throw new TypeError(`guestPath must be an absolute path: ${guestPath}`);
  }
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new TypeError('args must be an array of strings');
  }
  const filesystem = await launcher.createFileSystem({
    entries: toCoreEntries(entries, [cwd]),
  });
  try {
    const guest = launcher.run({
      program: guestPath,
      // argv[0] is the path the guest was started from, as with execve.
      args: [guestPath, ...args],
      env: { HOME: '/root', PATH: '/usr/bin:/bin', ...env },
      cwd,
      filesystem,
      ...(terminal ? { tty: terminal } : {}),
    });
    if (!stdin) await guest.stdin.close();
    // An input stream that errors gives the guest end of file. Input stops at
    // the guest's exit, and pipeTo then cancels the stream.
    const input = new AbortController();
    const piped = stdin
      ?.pipeTo(guest.stdin, { signal: input.signal, preventAbort: true })
      .catch(() => guest.stdin.close().catch(() => {}));
    let exit: Awaited<typeof guest.exited>;
    let stdout: Uint8Array;
    let stderr: Uint8Array;
    try {
      [stdout, stderr, exit] = await Promise.all([
        collect(guest.stdout, onStdout),
        collect(guest.stderr, onStderr),
        guest.exited,
      ]);
    } catch (error) {
      throw new GuestRunError('core failed to run the guest', {
        cause: error,
      });
    } finally {
      input.abort();
      await piped;
    }
    const exitCode = exit.kind === 'exited' ? exit.code : 128 + exit.signal;
    let snapshot: FsEntry[] | undefined;
    if (snapshotRoots.length) {
      try {
        snapshot = fromCoreSnapshot(await filesystem.snapshot(), snapshotRoots);
      } catch (error) {
        throw Object.assign(
          new GuestRunError('failed to snapshot guest filesystem', {
            cause: error,
          }),
          { code: 'SNAPSHOT' },
        );
      }
    }
    return { exitCode, stdout, stderr, snapshot };
  } finally {
    await filesystem.dispose();
  }
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
    ? encoder.encode(entry.data)
    : Uint8Array.from(entry.data!);
}

/**
 * 複数のコマンドを順に実行する（例：aube #1645 の手順）。各ステップは新しいファイルシステムで動き、
 * persist に挙げたディレクトリ（既定は作業ディレクトリと HOME）の中身は前のステップから引き継ぐ。
 * ステップは { args: [...] }（ゲストの実行）、{ removeTree: '/path' }（JS 側で rm -rf）、
 * { catFile: '/path' }（JS 側で cat。引き継いでいるファイルの中身を stdout に返す）のどれか。
 * removeTree と catFile はコアを使わない。
 * 各結果の elapsedMs は、そのステップの実時間。
 * @returns {Promise<Array<{step: object, exitCode: number, stdout: Uint8Array, stderr: Uint8Array, elapsedMs: number}>>}
 */
export async function runSession({
  launcher,
  guestPath,
  guestEntry,
  steps,
  entries = [],
  env = {},
  cwd = DEFAULT_CWD,
  persist,
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
      launcher,
      guestPath,
      args: step.args,
      entries: [guestEntry, ...carried],
      env,
      cwd,
      snapshotRoots: roots,
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
