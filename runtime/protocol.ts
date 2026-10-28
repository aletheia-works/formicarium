import type { ErrorCode } from '../types/index.js';
import type {
  FsEntry,
  Identity,
  OutputChunk,
  RunResult,
  Streams,
} from './contracts.js';
import { errorCode, isRecord } from './contracts.js';
import { ERROR_CODES, failure } from './errors.js';
import { equalBytes } from './validation.js';

export const PROTOCOL_VERSION = 2;
export const identity = (run: Identity) => ({
  protocolVersion: PROTOCOL_VERSION,
  sessionId: run.sessionId,
  runId: run.runId,
  generation: run.generation,
});
export const joinBytes = (chunks: readonly Uint8Array[]) => {
  const bytes = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};
function requireMessage(condition: unknown): asserts condition {
  if (!condition)
    throw failure('EXECUTION', 'Worker sent an invalid current-run message');
}
function validCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' && ERROR_CODES.some((code) => code === value)
  );
}
export type InspectedMessage =
  | { type: 'output'; chunk: OutputChunk }
  | { type: 'done'; result: RunResult; snapshot: FsEntry[] }
  | { type: 'error'; code: ErrorCode; detail: FailureDetail[] };

/** One error of a Worker failure's cause chain, outermost first. */
export interface FailureDetail {
  name: string;
  /** PaludariumError's kind, such as `internal`. */
  kind?: string;
  message?: string;
}
const DETAIL_DEPTH = 4;
const MESSAGE_LIMIT = 300;
const DETAIL_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const DETAIL_KIND = /^[a-z][a-z0-9-]{0,31}$/;
// The engine, WebAssembly and the core write these messages themselves. Other
// errors can carry caller data (paths, arguments, env values), so only their
// name crosses the Worker boundary. Node's own RangeErrors carry an ERR_ code
// and can quote the value they received, so they are among the others.
function engineMessage(error: Error): boolean {
  return (
    (error instanceof RangeError && errorCode(error) === undefined) ||
    error instanceof WebAssembly.RuntimeError ||
    error instanceof WebAssembly.CompileError ||
    error instanceof WebAssembly.LinkError ||
    (error.name === 'PaludariumError' &&
      DETAIL_KIND.test(String((error as { kind?: unknown }).kind)))
  );
}
/** What may be told about a failure in the Worker: names, and engine or core messages. */
export function failureDetail(error: unknown): FailureDetail[] {
  const detail: FailureDetail[] = [];
  let current = error;
  while (current instanceof Error && detail.length < DETAIL_DEPTH) {
    const name = DETAIL_NAME.test(current.name) ? current.name : 'Error';
    if (!engineMessage(current)) detail.push({ name });
    else
      detail.push({
        name,
        ...(name === 'PaludariumError'
          ? { kind: String((current as { kind?: unknown }).kind) }
          : {}),
        message: current.message
          .replace(/\p{Cc}/gu, ' ')
          .slice(0, MESSAGE_LIMIT),
      });
    current = current.cause;
  }
  return detail;
}
function validDetail(value: unknown): value is FailureDetail[] {
  return (
    Array.isArray(value) &&
    value.length <= DETAIL_DEPTH &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        DETAIL_NAME.test(item.name) &&
        (item.kind === undefined ||
          (typeof item.kind === 'string' && DETAIL_KIND.test(item.kind))) &&
        (item.message === undefined ||
          (typeof item.message === 'string' &&
            item.message.length <= MESSAGE_LIMIT)),
    )
  );
}
/** The detail as an Error chain, for ExecutionError's cause. */
export function detailCause(detail: readonly FailureDetail[]) {
  let cause: Error | undefined;
  for (const item of [...detail].reverse()) {
    const error = new Error(
      item.message ?? item.name,
      cause ? { cause } : undefined,
    );
    error.name = item.name;
    if (item.kind !== undefined) Object.assign(error, { kind: item.kind });
    cause = error;
  }
  return cause;
}

/** Return null for old identities; reject malformed payloads from the active run. */
export function inspectMessage(
  message: unknown,
  run: Identity & { sequence: number },
  streams: Streams,
): InspectedMessage | null {
  requireMessage(isRecord(message));
  if (
    message.sessionId !== run.sessionId ||
    message.runId !== run.runId ||
    message.generation !== run.generation
  )
    return null;
  requireMessage(message.protocolVersion === PROTOCOL_VERSION);
  if (message.type === 'output') {
    const chunk = message.chunk;
    requireMessage(isRecord(chunk));
    requireMessage(
      chunk.runId === run.runId &&
        chunk.sequence === run.sequence &&
        (chunk.stream === 'stdout' || chunk.stream === 'stderr') &&
        chunk.bytes instanceof Uint8Array,
    );
    return {
      type: 'output',
      chunk: {
        runId: run.runId,
        sequence: run.sequence,
        stream: chunk.stream,
        bytes: new Uint8Array(chunk.bytes),
      },
    };
  }
  if (message.type === 'done') {
    const result = message.result;
    requireMessage(isRecord(result));
    requireMessage(
      result.runId === run.runId &&
        typeof result.exitCode === 'number' &&
        Number.isInteger(result.exitCode) &&
        result.exitCode >= 0 &&
        result.exitCode <= 255,
    );
    requireMessage(
      typeof result.elapsedMs === 'number' &&
        Number.isFinite(result.elapsedMs) &&
        result.elapsedMs >= 0 &&
        result.stdout instanceof Uint8Array &&
        result.stderr instanceof Uint8Array,
    );
    requireMessage(
      equalBytes(result.stdout, joinBytes(streams.stdout)) &&
        equalBytes(result.stderr, joinBytes(streams.stderr)),
    );
    if (!Array.isArray(message.snapshot))
      throw failure('SNAPSHOT', 'Worker did not provide a complete snapshot');
    // SessionState validates every snapshot entry before it can be committed.
    return {
      type: 'done',
      result: {
        runId: run.runId,
        exitCode: result.exitCode,
        elapsedMs: result.elapsedMs,
        stdout: new Uint8Array(result.stdout),
        stderr: new Uint8Array(result.stderr),
      },
      snapshot: message.snapshot,
    };
  }
  if (message.type === 'error') {
    requireMessage(
      validCode(message.code) &&
        typeof message.message === 'string' &&
        message.stdout instanceof Uint8Array &&
        message.stderr instanceof Uint8Array &&
        (message.detail === undefined || validDetail(message.detail)),
    );
    return {
      type: 'error',
      code: message.code,
      detail: (message.detail ?? []).map((item) => ({ ...item })),
    };
  }
  throw failure('EXECUTION', 'Worker sent an unknown current-run message');
}
export function workerErrorMessage(
  run: Identity,
  code: string,
  streams: Streams,
  error?: unknown,
) {
  return {
    ...identity(run),
    type: 'error',
    code: validCode(code) ? code : 'EXECUTION',
    message: 'Guest execution failed',
    detail: failureDetail(error),
    stdout: joinBytes(streams.stdout),
    stderr: joinBytes(streams.stderr),
  };
}
