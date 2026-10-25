import type { ErrorCode } from '../types/index.js';
import type {
  FsEntry,
  Identity,
  OutputChunk,
  RunResult,
  Streams,
} from './contracts.js';
import { isRecord } from './contracts.js';
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
  | { type: 'error'; code: ErrorCode };

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
        message.stderr instanceof Uint8Array,
    );
    return { type: 'error', code: message.code };
  }
  throw failure('EXECUTION', 'Worker sent an unknown current-run message');
}
export function workerErrorMessage(
  run: Identity,
  code: string,
  streams: Streams,
) {
  return {
    ...identity(run),
    type: 'error',
    code: validCode(code) ? code : 'EXECUTION',
    message: 'Guest execution failed',
    stdout: joinBytes(streams.stdout),
    stderr: joinBytes(streams.stderr),
  };
}
