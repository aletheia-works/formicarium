import { ExecutionError, failure, invalid } from './errors.js';
import { INSTALL_LIMITS } from './install-catalog.js';
import type { InstallControl } from './install-transfer.js';
import type { Reservation, SessionPort } from './session-port.js';

export interface Progress {
  operationId: string;
  sequence: number;
  phase: 'fetch' | 'extract' | 'digest' | 'validate' | 'register';
  processedBytes: number;
  totalBytes: number | null;
}
const phases = ['fetch', 'extract', 'digest', 'validate', 'register'] as const;
/** The session owns the reservation. This object owns only its operation lifetime. */
export class InstallLifetime implements InstallControl {
  #controller = new AbortController();
  #clock: () => number;
  #deadline: number;
  #lastYield: number;
  #timer: ReturnType<typeof setTimeout>;
  #listeners: (() => void)[] = [];
  #terminal: ExecutionError | undefined;
  #ownerReason: Promise<ExecutionError> | undefined;
  #completed = false;
  readonly signal: AbortSignal;
  constructor(
    reservation: Reservation,
    port: SessionPort,
    caller?: AbortSignal,
    clock = () => performance.now(),
  ) {
    this.signal = this.#controller.signal;
    this.#clock = clock;
    const started = clock();
    this.#deadline = started + INSTALL_LIMITS.installMs;
    this.#lastYield = started;
    this.#timer = setTimeout(
      () => this.#stop(failure('TIMEOUT', 'Install deadline exceeded')),
      INSTALL_LIMITS.installMs,
    );
    const ownerAbort = () => {
      if (this.#terminal || this.#completed) return;
      // U2's signal intentionally carries no reason. Its current-owner guard
      // distinguishes reset/dispose before touching FS, under this same token.
      // Query only an already cancelled reservation; no reacquire or state write.
      this.#ownerReason = port.builtin(reservation, ['ls']).then(
        () => failure('ABORTED', 'Session reservation cancelled'),
        (error: unknown) =>
          error instanceof ExecutionError &&
          ['ABORTED', 'DISPOSED'].includes(error.code)
            ? error
            : failure('ABORTED', 'Session reservation cancelled'),
      );
      this.#stop(failure('ABORTED', 'Session reservation cancelled'));
    };
    const callerAbort = () =>
      this.#stop(failure('ABORTED', 'Install cancelled by caller'));
    this.#listen(reservation.signal, ownerAbort);
    if (caller) this.#listen(caller, callerAbort);
    if (reservation.signal.aborted) ownerAbort();
    else if (caller?.aborted) callerAbort();
  }
  #listen(signal: AbortSignal, listener: () => void): void {
    signal.addEventListener('abort', listener, { once: true });
    this.#listeners.push(() => signal.removeEventListener('abort', listener));
  }
  #stop(error: ExecutionError): void {
    if (this.#terminal || this.#completed) return;
    this.#terminal = error;
    this.#controller.abort(error);
  }
  check(): void {
    if (!this.#terminal && !this.#completed && this.#clock() >= this.#deadline)
      this.#stop(failure('TIMEOUT', 'Install deadline exceeded'));
    if (this.#terminal) throw this.#terminal;
  }
  async yield(): Promise<void> {
    this.check();
    // Chunk checks remain frequent; macrotask yielding is time-bounded instead
    // of paying a browser's clamped timer on every small decompressed chunk.
    if (this.#clock() - this.#lastYield >= 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      this.#lastYield = this.#clock();
    }
    this.check();
  }
  async reason(error: unknown): Promise<unknown> {
    if (this.#ownerReason) return await this.#ownerReason;
    return this.#terminal ?? error;
  }
  fail(error: ExecutionError): void {
    this.#stop(error);
  }
  /** Call only after the owner confirmed its atomic commit. */
  complete(): void {
    this.#completed = true;
    this.#terminal = undefined;
    this.#ownerReason = undefined;
  }
  cleanup(): void {
    clearTimeout(this.#timer);
    for (const detach of this.#listeners) detach();
    this.#listeners = [];
  }
}
export class ProgressReporter {
  #sequence = 0;
  #phase = -1;
  #processed = 0;
  #finished = false;
  #failures = 0;
  #operationId: string;
  #control: InstallControl;
  #callback: ((value: Progress) => void) | undefined;
  constructor(
    operationId: string,
    control: InstallControl,
    callback?: (value: Progress) => void,
  ) {
    this.#operationId = operationId;
    this.#control = control;
    this.#callback = callback;
  }
  get notificationFailures(): number {
    return this.#failures;
  }
  notify(
    phase: Progress['phase'],
    processedBytes: number,
    totalBytes: number | null,
  ): void {
    if (this.#finished || this.#control.signal.aborted) return;
    this.#control.check();
    const index = phases.indexOf(phase);
    invalid(
      index >= this.#phase && index >= 0,
      'Install progress phase order invalid',
    );
    invalid(
      Number.isSafeInteger(processedBytes) &&
        processedBytes >= 0 &&
        (index !== this.#phase || processedBytes >= this.#processed),
      'Install progress byte order invalid',
    );
    invalid(
      totalBytes === null ||
        (Number.isSafeInteger(totalBytes) && totalBytes >= 0),
      'Install progress total invalid',
    );
    this.#phase = index;
    this.#processed = processedBytes;
    const value = Object.freeze({
      operationId: this.#operationId,
      sequence: this.#sequence++,
      phase,
      processedBytes,
      totalBytes,
    });
    try {
      this.#callback?.(value);
    } catch {
      this.#failures = Math.min(32, this.#failures + 1);
    }
  }
  finish(): void {
    this.#finished = true;
  }
}
