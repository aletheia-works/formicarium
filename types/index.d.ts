export interface Assets {
  loaderURL: string | URL;
  wasmURL: string | URL;
  workerURL: string | URL;
  buildInfoURL: string | URL;
}
export interface GuestBuildInfo {
  schemaVersion: 1;
  tool: string;
  versionOrName: string;
  source: { repository: string; commit: string };
  target: 'x86_64-unknown-linux-musl';
  rustc: string | null;
  sourcePatches: readonly { name: string; sha256: string }[];
  dependencies: readonly {
    tool: string;
    repository: string;
    commit: string;
    digest: string;
  }[];
  builderHash: string;
  buildKey: string;
  elfSha256: string;
  [key: string]: unknown;
}
export interface GuestExpectation {
  elfSha256: string;
  buildInfoSha256: string;
  identity: GuestBuildInfo;
}
export interface GuestHandle {
  readonly digest: string;
  readonly buildInfo: GuestBuildInfo;
}
export interface CatalogEntry {
  tool: string;
  versionOrName: string;
  url: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
  downloadSha256: string;
  downloadBytes: number;
  elfBytes: number;
  buildInfo: GuestBuildInfo;
  buildInfoSha256: string;
  [key: string]: unknown;
}
export interface GuestCatalog {
  schemaVersion: 1;
  catalogId: string;
  defaults: Readonly<Record<string, string>>;
  entries: readonly CatalogEntry[];
  [key: string]: unknown;
}
export interface Progress {
  operationId: string;
  sequence: number;
  phase: 'fetch' | 'extract' | 'digest' | 'validate' | 'register';
  processedBytes: number;
  totalBytes: number | null;
}
export interface InstallOptions {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
}
export interface InstallResult {
  operationId: string;
  tool: string;
  versionOrName: string;
  digest: string;
  buildKey: string;
}
export interface Installer {
  install(selection: string, options?: InstallOptions): Promise<InstallResult>;
}
export declare function createInstaller(
  session: Session,
  catalog: GuestCatalog,
): Installer;
/**
 * Options for one {@link CommandSession.execute} call.
 *
 * - `signal`: checked before any reservation; an already aborted signal
 *   rejects with `ABORTED` and changes nothing. The builtins `ls`, `cat`,
 *   `cd` and `rm` complete synchronously inside U2 once started, so a signal
 *   raised after they start does not interrupt or change their result.
 *   `install` and guest runs forward the signal to the installer and to the
 *   session run.
 * - `onProgress`: forwarded unchanged from the installer. `totalBytes: null`
 *   means unknown and is distinct from `0`.
 * - `onOutput`: forwarded unchanged from the guest run.
 *
 * There is no timeout option: guest runs use the session run default
 * (600000 ms) and install keeps its own 120 s fetch / 180 s total deadlines.
 */
export interface CommandOptions {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  onOutput?: (chunk: OutputChunk) => void;
}
/**
 * Result of one command. `stdout`/`stderr` are new caller-owned original
 * bytes on every call; they are never truncated, decoded or evaluated as
 * HTML/code. Decoding for display, the display limits (1048576 bytes /
 * 10000 lines), control-character handling, loading/empty/error states,
 * keyboard operation, progress unknown-vs-zero and timestamp offsets belong to
 * the embedding UI (U6/U8), not to this API.
 */
export interface CommandResult {
  kind: 'empty' | 'builtin' | 'install' | 'guest';
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  /** Present only for `kind: 'guest'`. */
  runId?: string;
  /** Present only for `kind: 'install'`; identifies it by `operationId`. */
  installation?: InstallResult;
}
/**
 * One line interpreter over a Session. Syntax: ASCII space/tab separate
 * arguments; single quotes are literal; inside double quotes only `\"` and
 * `\\` are escapes; outside quotes `\x` is `x`. Unquoted `|`, `&`, `;`,
 * `<`, `>`, `$`, backtick, `*`, `?`, `(`, `)`, `{` and `}`, unterminated
 * quotes, a trailing backslash, LF/CR/NUL, lone surrogates and inputs over
 * 65536 UTF-8 bytes reject with `INVALID_INPUT` before any reservation.
 * Nothing is expanded. An input of only spaces/tabs (or empty) resolves as
 * `kind: 'empty'` with exit code 0 and takes no reservation.
 *
 * Routing is by exact `argv[0]`: `ls [path]`, `cat path`, `cd path` and
 * `rm -rf path` are builtins, `install <selection>` installs through the
 * catalog, and any other name runs the registered guest of that name
 * (`NOT_FOUND` when absent; a nonzero guest exit still resolves).
 * `ls`, `cat`, `rm`, `cd` and `install` are reserved: a guest registered under
 * one of these names (for example by `install ls@x`) cannot be run from a
 * command, and the builtin keeps running. Paths are guest paths resolved by the
 * Session: a relative path resolves against its current cwd, and an empty
 * path or one containing `..` or NUL is `INVALID_INPUT`. Each call takes the Session's single reservation once, so it
 * competes with direct Session/installer calls and other command sessions on
 * the same Session with `BUSY`; after dispose it rejects with `DISPOSED`.
 */
export interface CommandSession {
  execute(input: string, options?: CommandOptions): Promise<CommandResult>;
}
/** Builds a command session; a forged Session or invalid catalog is `INVALID_INPUT`. */
export declare function createCommandSession(
  session: Session,
  options: { catalog: GuestCatalog },
): CommandSession;
export declare function validateGuest(
  bytes: Uint8Array,
  expected: GuestExpectation,
): GuestHandle;
export declare function fixtureToFsEntries(
  entries: readonly FsEntry[],
): readonly FsEntry[];
export declare function runValidatedGuest(
  session: Session,
  guest: GuestHandle,
  options?: Omit<RunOptions, 'guest'>,
): Promise<RunResult>;
export declare function registerValidatedGuest(
  session: Session,
  tool: string,
  guest: GuestHandle,
  options?: { signal?: AbortSignal },
): Promise<void>;
export type FsEntry =
  | { path: string; type: 'dir'; mode: number }
  | {
      path: string;
      type: 'file';
      mode: number;
      inodeId: string;
      data: Uint8Array;
    }
  | { path: string; type: 'symlink'; target: string };
export interface SessionOptions {
  assets?: Assets;
  cwd?: string;
  home?: string;
  entries?: readonly FsEntry[];
}
export interface OutputChunk {
  runId: string;
  sequence: number;
  stream: 'stdout' | 'stderr';
  bytes: Uint8Array;
}
export interface RunOptions {
  guest: Uint8Array;
  args?: readonly string[];
  env?: Readonly<Record<string, string>>;
  timeoutMs?: number;
  signal?: AbortSignal;
  onOutput?: (chunk: OutputChunk) => void;
}
export interface RunResult {
  runId: string;
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  elapsedMs: number;
}
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'ASSET_LOAD'
  | 'UNSUPPORTED_ENV'
  | 'CORE_INIT'
  | 'EXECUTION'
  | 'SNAPSHOT'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'BUSY'
  | 'DISPOSED'
  | 'NOT_FOUND'
  | 'NOT_FILE';
export class ExecutionError extends Error {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: {
      runId?: string;
      stdout?: Uint8Array;
      stderr?: Uint8Array;
      cause?: unknown;
    },
  );
  code: ErrorCode;
  runId?: string;
  stdout: Uint8Array;
  stderr: Uint8Array;
  cause?: unknown;
}
export const ERROR_CODES: readonly ErrorCode[];
export interface Session {
  run(options: RunOptions): Promise<RunResult>;
  readFile(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  listEntries(path?: string): Promise<readonly FsEntry[]>;
  setCwd(path: string): Promise<void>;
  reset(): Promise<void>;
  dispose(): Promise<void>;
}
export function decodeUtf8(bytes: Uint8Array): string;
