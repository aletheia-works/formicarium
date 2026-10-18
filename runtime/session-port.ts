import type { RunOptions, RunResult, Session } from '../types/index.js';
import { invalid } from './errors.js';
import type { GuestHandle } from './guest-validation.js';
export interface Reservation {
  readonly token: symbol;
  readonly epoch: number;
  readonly operationId: string;
  readonly signal: AbortSignal;
}
export interface BuiltinResult {
  kind: 'builtin';
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
}
export interface SessionPort {
  acquire(kind: 'run' | 'install' | 'fs'): Promise<Reservation>;
  commitGuest(
    reservation: Reservation,
    tool: string,
    guest: GuestHandle,
  ): Promise<void>;
  runInstalled(
    reservation: Reservation,
    tool: string,
    args: readonly string[],
    options: Omit<RunOptions, 'guest' | 'args'>,
  ): Promise<RunResult>;
  builtin(
    reservation: Reservation,
    argv: readonly string[],
  ): Promise<BuiltinResult>;
  release(reservation: Reservation): Promise<void>;
  /**
   * Synchronously resolves a guest path against the current cwd with the
   * normalizePath rules (absolute stays absolute; empty, NUL and `..` are
   * INVALID_INPUT). It reads the cwd only and never changes session state.
   * The result is a snapshot of the cwd at call time. Unlike the other
   * methods it takes no reservation, does not check dispose, reset or abort,
   * and throws INVALID_INPUT synchronously instead of rejecting. Callers use
   * the value while they hold a reservation or within the same tick (BR2.12).
   */
  resolvePath(path: string): string;
}
const ports = new WeakMap<Session, SessionPort>();
export function bindSessionPort(session: Session, port: SessionPort): void {
  ports.set(session, Object.freeze(port));
}
export function sessionPort(session: Session): SessionPort {
  const port = ports.get(session);
  invalid(
    port !== undefined,
    'session belongs to another package or is forged',
  );
  return port;
}
