import type {
  Assets,
  FsEntry,
  OutputChunk,
  RunOptions,
  RunResult,
} from '../types/index.js';

export type { Assets, FsEntry, OutputChunk, RunOptions, RunResult };
export type ByteSink = (bytes: Uint8Array) => void;
export interface LegacyEntry {
  path: string;
  type?: 'dir' | 'file' | 'symlink';
  mode?: number;
  inodeId?: string;
  data?: Uint8Array | string;
  target?: string;
}
/** One entry of a core filesystem, in the shape paludarium's snapshot() uses. */
export interface CoreEntry {
  path: string;
  /** Type bits and permissions, as in st_mode. */
  mode: number;
  /** Regular file bytes or symlink target bytes; empty for directories. */
  content?: Uint8Array;
  /** Entries that share an inode are hard links to one file. */
  inode?: bigint | number;
}
export interface CoreFileSystem {
  snapshot(): Promise<CoreEntry[]>;
  dispose(): Promise<void>;
}
export type CoreExit =
  | { kind: 'exited'; code: number }
  | { kind: 'signaled'; signal: number };
export interface CoreGuest {
  stdin: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<CoreExit>;
  kill(): void;
}
/** The part of the core's launcher that the runtime uses. */
export interface CoreLauncher {
  createFileSystem(options: {
    files?: Record<string, Uint8Array>;
    fileModes?: Record<string, number>;
    entries?: readonly CoreEntry[];
  }): Promise<CoreFileSystem>;
  run(options: {
    program: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
    filesystem: CoreFileSystem;
    tty?: { columns: number; rows: number } | null;
    network?: NetworkRequest;
  }): CoreGuest;
  dispose(): Promise<void>;
}
export interface GuestOptions {
  launcher: CoreLauncher;
  guestPath: string;
  args?: readonly string[];
  entries?: readonly LegacyEntry[];
  env?: Readonly<Record<string, string>>;
  cwd?: string;
  snapshotRoots?: readonly string[];
  onStdout?: ByteSink;
  onStderr?: ByteSink;
  /** Bytes for the guest's stdin; without it the guest reads end of file at once. */
  stdin?: ReadableStream<Uint8Array>;
  /** Makes the guest's standard streams a terminal of this size. */
  terminal?: { columns: number; rows: number };
  /** The TCP destinations the guest may reach; without it the guest has no network. */
  network?: NetworkRequest;
}
export interface GuestResult {
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  snapshot?: FsEntry[];
}
export interface SessionStep {
  args?: string[];
  removeTree?: string;
  catFile?: string;
}
export interface Identity {
  protocolVersion?: number;
  sessionId: string;
  runId: string;
  generation: number;
}
/**
 * Where every run finds the session's installed guests, one file per tool.
 * It is on the guest's default PATH and lies outside the persistence roots,
 * so the files are placed again for each run and never snapshotted.
 */
export const INSTALLED_GUEST_DIRECTORY = '/usr/bin';
export interface RunRequest extends Identity {
  type: 'run';
  assets: Assets;
  guest: Uint8Array;
  /**
   * Where an installed guest runs from (INSTALLED_GUEST_DIRECTORY/<tool>), so
   * its argv[0] is that path, as when another guest runs it. Absent for a
   * guest given to Session.run, which runs from /guest/program.
   */
  program?: string;
  /** The session's installed guests, placed at INSTALLED_GUEST_DIRECTORY/<tool>. */
  tools: { tool: string; bytes: Uint8Array }[];
  args: string[];
  env: Record<string, string>;
  cwd: string;
  home: string;
  entries: FsEntry[];
  snapshotRoots: string[];
  /** True when the host sends `input` messages and then `input-end`. */
  interactive?: boolean;
  terminal?: { columns: number; rows: number };
  network?: NetworkRequest;
}
/** Host to Worker, after the run request: guest stdin bytes, then its end. */
export type InputMessage = Identity &
  ({ type: 'input'; bytes: Uint8Array } | { type: 'input-end' });
export interface Streams {
  stdout: Uint8Array[];
  stderr: Uint8Array[];
}
export interface WorkerHandle {
  /** Delivers an input message to the run's Worker, in order. */
  send?(message: InputMessage): void;
  detach?(): void;
  terminate(): void | Promise<void>;
}
export interface WorkerHandlers {
  message(value: unknown): void;
  error(error: unknown): void;
  exit(code?: number): void;
}
export type SpawnWorker = (
  request: RunRequest,
  handlers: WorkerHandlers,
) => WorkerHandle;
/** Verified core files written where the core can import them (Node.js). */
export interface ResourceDescriptor {
  resourceId: number;
  /** URL of the core's entry module. */
  moduleURL: string;
  /** URL of the core's wasm binary. */
  wasmURL: string;
}
export interface ResourceAllocator {
  allocate(files: Record<string, Uint8Array>): Promise<ResourceDescriptor>;
}
export type ControlMessage =
  | {
      type: 'resource-ready';
      resourceRequestId: number;
      descriptor: ResourceDescriptor;
    }
  | { type: 'resource-error'; resourceRequestId: number }
  | { type: 'unrelated' };
export interface ControlChannel {
  post(message: object, transfer?: Transferable[]): void;
  subscribe(
    listener: (message: ControlMessage, ports?: readonly MessagePort[]) => void,
  ): () => void;
}
export interface HostOptions {
  guest: string;
  args?: string[];
  copyIn?: { host: string; guest: string }[];
  env?: Record<string, string>;
  cwd?: string;
  steps?: SessionStep[];
  persist?: string[];
  onStdout?: ByteSink;
  onStderr?: ByteSink;
  timeoutMs?: number;
  network?: NetworkRequest;
}
export interface HostResult {
  results: (GuestResult & { step: SessionStep; elapsedMs: number })[];
}
export interface CoreLoadOptions {
  assets: Assets;
  readBytes(url: string | URL): Promise<Uint8Array>;
  /** Present in Node.js: writes the verified files where they can be imported. */
  resources?: ResourceAllocator;
  importModule?: (url: string) => Promise<Record<string, unknown>>;
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
/** A run's network after validation: its destinations and, outside Node.js, its relay. */
export interface NetworkRequest {
  allow: string[];
  relay?: { url: string; protocols: string[] };
}
/** A copy that the caller can no longer change. */
export function copyNetwork(network: NetworkRequest): NetworkRequest {
  return {
    allow: [...network.allow],
    ...(network.relay
      ? {
          relay: {
            url: network.relay.url,
            protocols: [...network.relay.protocols],
          },
        }
      : {}),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
