import type { ErrorCode } from '../types/index.js';
export const ERROR_CODES = Object.freeze([
  'INVALID_INPUT',
  'ASSET_LOAD',
  'UNSUPPORTED_ENV',
  'CORE_INIT',
  'EXECUTION',
  'SNAPSHOT',
  'TIMEOUT',
  'ABORTED',
  'BUSY',
  'DISPOSED',
  'NOT_FOUND',
  'NOT_FILE',
] as const);

/** Public failures preserve received bytes without serializing caller secrets. */
export class ExecutionError extends Error {
  code: ErrorCode;
  declare runId?: string;
  stdout: Uint8Array;
  stderr: Uint8Array;
  constructor(
    code: ErrorCode,
    message: string = code,
    {
      runId,
      stdout,
      stderr,
      cause,
    }: {
      runId?: string;
      stdout?: Uint8Array;
      stderr?: Uint8Array;
      cause?: unknown;
    } = {},
  ) {
    if (!ERROR_CODES.includes(code))
      throw new TypeError('unknown execution error code');
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ExecutionError';
    this.code = code;
    if (runId !== undefined) this.runId = runId;
    this.stdout = stdout ? new Uint8Array(stdout) : new Uint8Array();
    this.stderr = stderr ? new Uint8Array(stderr) : new Uint8Array();
  }
}

export function failure(
  code: ErrorCode,
  message?: string,
  details?: ConstructorParameters<typeof ExecutionError>[2],
) {
  return new ExecutionError(code, message, details);
}

export function invalid(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw failure('INVALID_INPUT', message);
}

/** A cleanup failure keeps only its code and a fixed description in the cause. */
export function safeCause(code: ErrorCode) {
  return Object.freeze({
    code: ERROR_CODES.includes(code) ? code : 'EXECUTION',
    message: 'Run failed before cleanup completed',
  });
}
