import type {
  Assets,
  ErrorCode,
  FsEntry,
  RunOptions,
  RunResult,
  Session,
} from '../types/index.js';
import type {
  Identity,
  RunRequest,
  SpawnWorker,
  Streams,
  WorkerHandle,
} from './contracts.js';
import {
  copyNetwork,
  errorCode,
  INSTALLED_GUEST_DIRECTORY,
} from './contracts.js';
import { invalid } from './errors.js';
import type { GuestHandle } from './guest-validation.js';
import { bindSessionPort, type Reservation } from './session-port.js';
import type { SessionState } from './state.js';

interface Decision {
  error?: ExecutionError;
  snapshot?: FsEntry[];
  result?: RunResult;
}
interface ActiveRun extends Identity {
  reservation: Reservation;
  releaseOnFinish: boolean;
  completed: Promise<void>;
  complete(): void;
  input: ReturnType<typeof validateRun>;
  phase: 'preparing' | 'running' | 'terminating' | 'settled';
  startedAt: number;
  deadline: number;
  sequence: number;
  streams: Streams;
  decision: Decision;
  deadlineTimer?: ReturnType<typeof setTimeout>;
  worker?: WorkerHandle;
  resolve(result: RunResult): void;
  reject(error: unknown): void;
  abort(): void;
  disposeResolve?: () => void;
  disposeReject?: (error: unknown) => void;
  /** Stops reading `stdin` when the run settles. */
  stopInput?: () => void;
}
interface LifecycleOptions {
  spawn: SpawnWorker;
  assets?: Assets;
  clock?: () => number;
  timers?: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;
  cleanupTimeoutMs?: number;
  sessionId?: string;
}
function spawnErrorCode(error: unknown): ErrorCode {
  const code = errorCode(error);
  return code === 'UNSUPPORTED_ENV' || code === 'ASSET_LOAD'
    ? code
    : 'EXECUTION';
}

import type { ExecutionError } from './errors.js';
import { failure, safeCause } from './errors.js';
import {
  detailCause,
  identity,
  inspectMessage,
  joinBytes,
} from './protocol.js';
import { normalizePath, validateRun } from './validation.js';

/** Largest stdin chunk sent to the Worker in one message. */
export const MAX_INPUT_CHUNK = 65536;
let nextSessionId = 0;
const defaultClock = () => globalThis.performance?.now() ?? Date.now();

/** Adapter injection is internal; public package exports only environment APIs. */
export function createLifecycle(
  state: SessionState,
  {
    spawn,
    assets = { loaderURL: '', wasmURL: '', workerURL: '', buildInfoURL: '' },
    clock = defaultClock,
    timers = globalThis,
    cleanupTimeoutMs = 1000,
    sessionId = `session-${++nextSessionId}`,
  }: LifecycleOptions,
): Session {
  let active: ActiveRun | null = null;
  let generation = 0;
  let disposal: Promise<void> | null = null;
  let disposalFinished = false;
  let resetting: Promise<void> | null = null;
  let cleanupFailure: unknown;

  const received = (run: ActiveRun) => ({
    runId: run.runId,
    stdout: joinBytes(run.streams.stdout),
    stderr: joinBytes(run.streams.stderr),
  });
  const runFailure = (run: ActiveRun, code: ErrorCode, cause?: Error) =>
    failure(code, `Run failed: ${code}`, {
      ...received(run),
      ...(cause ? { cause } : {}),
    });
  const stopDeadline = (run: ActiveRun) =>
    timers.clearTimeout(run.deadlineTimer);

  function scheduleDeadline(run: ActiveRun) {
    // A run with stdin and no timeoutMs has no deadline.
    if (!Number.isFinite(run.deadline)) return;
    const remaining = run.deadline - clock();
    if (remaining <= 0) {
      terminate(run, { error: runFailure(run, 'TIMEOUT') });
      return;
    }
    run.deadlineTimer = timers.setTimeout(
      () => scheduleDeadline(run),
      Math.min(remaining, 2_147_483_647),
    );
  }

  function finish(run: ActiveRun, cleanupError: boolean) {
    stopDeadline(run);
    run.stopInput?.();
    run.input.signal?.removeEventListener('abort', run.abort);
    let error = run.decision.error;
    if (cleanupError) {
      error = failure('EXECUTION', 'Worker cleanup could not be confirmed', {
        ...received(run),
        cause: safeCause(error?.code ?? 'EXECUTION'),
      });
      cleanupFailure = error;
      state.dispose();
    }
    if (state.isDisposed) state.dispose();
    else if (!error) {
      try {
        state.commit(run.decision.snapshot, run.reservation);
      } catch (cause) {
        error = runFailure(
          run,
          errorCode(cause) === 'SNAPSHOT'
            ? 'SNAPSHOT'
            : errorCode(cause) === 'ABORTED'
              ? 'ABORTED'
              : 'EXECUTION',
        );
      }
    }
    if (run.releaseOnFinish) state.release(run.reservation);
    active = null;
    run.phase = 'settled';
    run.complete();
    if (error) run.reject(error);
    else
      run.resolve({
        ...run.decision.result!,
        elapsedMs: Math.max(0, clock() - run.startedAt),
      });
    if (run.disposeResolve) {
      if (cleanupError) run.disposeReject?.(error);
      else run.disposeResolve();
    }
  }

  function terminate(run: ActiveRun, decision: Decision) {
    if (run.phase === 'settled') return;
    if (run.phase === 'terminating') {
      // Abort/dispose can invalidate a validated done candidate during cleanup.
      if (decision.error?.code === 'ABORTED' && !run.decision.error)
        run.decision = decision;
      if (state.isDisposed)
        run.decision = { error: runFailure(run, 'ABORTED') };
      return;
    }
    run.phase = 'terminating';
    run.decision = decision;
    stopDeadline(run);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise((_, reject) => {
      watchdog = timers.setTimeout(
        () => reject(new Error('cleanup deadline')),
        cleanupTimeoutMs,
      );
    });
    const cleanup = Promise.resolve().then(() => {
      run.worker?.detach?.();
      return run.worker?.terminate();
    });
    Promise.race([cleanup, deadline]).then(
      () => {
        timers.clearTimeout(watchdog);
        finish(run, false);
      },
      () => {
        timers.clearTimeout(watchdog);
        finish(run, true);
      },
    );
  }

  /**
   * Sends `stdin` to the Worker in order, at most MAX_INPUT_CHUNK bytes per
   * message, then `input-end`. A stream that errors ends the input the same
   * way; a chunk that is not a Uint8Array ends the run with INVALID_INPUT.
   */
  async function pumpInput(run: ActiveRun, stdin: ReadableStream<Uint8Array>) {
    const reader = stdin.getReader();
    run.stopInput = () => void reader.cancel().catch(() => {});
    const live = () => run.phase === 'preparing' || run.phase === 'running';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !live()) break;
        if (!(value instanceof Uint8Array)) {
          terminate(run, {
            error: failure(
              'INVALID_INPUT',
              'stdin chunks must be Uint8Array',
              received(run),
            ),
          });
          return;
        }
        for (let start = 0; start < value.length; start += MAX_INPUT_CHUNK)
          run.worker?.send?.({
            ...identity(run),
            type: 'input',
            bytes: value.slice(start, start + MAX_INPUT_CHUNK),
          });
      }
    } catch {
      // An errored stream gives the guest end of file, like a closed one.
    }
    if (live()) run.worker?.send?.({ ...identity(run), type: 'input-end' });
  }

  function message(run: ActiveRun, value: unknown) {
    if (run.phase === 'terminating' || run.phase === 'settled') return;
    if (clock() >= run.deadline) {
      terminate(run, { error: runFailure(run, 'TIMEOUT') });
      return;
    }
    if (run.input.signal?.aborted || state.isDisposed) {
      terminate(run, { error: runFailure(run, 'ABORTED') });
      return;
    }
    try {
      const parsed = inspectMessage(value, run, run.streams);
      if (!parsed) return;
      if (parsed.type === 'output') {
        run.sequence++;
        run.streams[parsed.chunk.stream].push(
          new Uint8Array(parsed.chunk.bytes),
        );
        run.input.onOutput?.({
          ...parsed.chunk,
          bytes: new Uint8Array(parsed.chunk.bytes),
        });
      } else if (parsed.type === 'error')
        terminate(run, {
          error: runFailure(run, parsed.code, detailCause(parsed.detail)),
        });
      else {
        const snapshot = state.validateSnapshot(parsed.snapshot);
        terminate(run, { snapshot, result: parsed.result });
      }
    } catch (error) {
      terminate(run, {
        error: runFailure(
          run,
          errorCode(error) === 'SNAPSHOT' ? 'SNAPSHOT' : 'EXECUTION',
        ),
      });
    }
  }

  function run(
    options: RunOptions,
    reserved?: Reservation,
    program?: string,
  ): Promise<RunResult> {
    let input: ReturnType<typeof validateRun>;
    let entries: FsEntry[];
    let tools: RunRequest['tools'];
    let reservation: Reservation;
    try {
      if (reserved) state.assertCurrent(reserved);
      else state.assertIdle();
      input = validateRun(options, state.home);
      reservation = reserved ?? state.acquire('run');
      entries = state.snapshot(reservation);
      tools = state.installedGuests(reservation);
      input.signal = input.signal
        ? AbortSignal.any([input.signal, reservation.signal])
        : reservation.signal;
    } catch (error) {
      return Promise.reject(error);
    }
    generation++;
    const startedAt = clock();
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const handle: ActiveRun = {
      reservation,
      releaseOnFinish: !reserved,
      completed,
      complete,
      sessionId,
      runId: `${sessionId}:${generation}`,
      generation,
      input,
      phase: 'preparing',
      startedAt,
      deadline: startedAt + input.timeoutMs,
      sequence: 0,
      streams: { stdout: [], stderr: [] },
      decision: {},
      resolve: () => {},
      reject: () => {},
      abort: () => {},
    };
    active = handle;
    const result = new Promise<RunResult>((resolve, reject) => {
      handle.resolve = resolve;
      handle.reject = reject;
    });
    handle.abort = () =>
      terminate(handle, { error: runFailure(handle, 'ABORTED') });
    input.signal?.addEventListener('abort', handle.abort, { once: true });
    // Until pumpInput takes it over, a settled run still cancels the stream.
    handle.stopInput = () => void input.stdin?.cancel().catch(() => {});
    scheduleDeadline(handle);
    try {
      const request: RunRequest = {
        ...identity(handle),
        type: 'run',
        assets: { ...assets },
        guest: input.guest,
        ...(program ? { program } : {}),
        tools,
        args: input.args,
        env: input.env,
        cwd: state.cwd,
        home: state.home,
        entries,
        snapshotRoots: [...state.roots],
        ...(input.stdin ? { interactive: true } : {}),
        ...(input.terminal ? { terminal: { ...input.terminal } } : {}),
        ...(input.network ? { network: copyNetwork(input.network) } : {}),
      };
      handle.worker = spawn(request, {
        message: (value) => message(handle, value),
        error: (error) =>
          terminate(handle, {
            error: runFailure(handle, spawnErrorCode(error)),
          }),
        exit: () => {
          if (handle.phase !== 'terminating' && handle.phase !== 'settled')
            terminate(handle, { error: runFailure(handle, 'EXECUTION') });
        },
      });
      handle.phase = handle.phase === 'preparing' ? 'running' : handle.phase;
      if (input.stdin) void pumpInput(handle, input.stdin);
    } catch (error) {
      const code = spawnErrorCode(error);
      terminate(handle, { error: runFailure(handle, code) });
    }
    return result;
  }

  function dispose(): Promise<void> {
    if (disposal && !disposalFinished) return disposal;
    if (state.isDisposed && !active) return Promise.resolve();
    const waiting = state.beginDispose();
    disposal = waiting
      .then(() => {
        state.dispose();
        if (cleanupFailure) throw cleanupFailure;
      })
      .finally(() => {
        disposalFinished = true;
      });
    return disposal;
  }
  function reset(): Promise<void> {
    if (state.isDisposed)
      return Promise.reject(failure('DISPOSED', 'Session has been disposed'));
    if (resetting) return resetting;
    const waiting = state.beginReset();
    resetting = waiting
      .then(() => {
        if (cleanupFailure) throw cleanupFailure;
        state.finishReset();
      })
      .finally(() => {
        resetting = null;
      });
    return resetting;
  }

  const operation =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): Promise<R> => {
      try {
        return Promise.resolve(fn(...args));
      } catch (error) {
        return Promise.reject(error);
      }
    };
  const fsOperation =
    <A extends unknown[], R>(fn: (reservation: Reservation, ...args: A) => R) =>
    (...args: A): Promise<R> => {
      let reservation: Reservation;
      try {
        reservation = state.acquire('fs');
      } catch (error) {
        return Promise.reject(error);
      }
      try {
        return Promise.resolve(fn(reservation, ...args));
      } catch (error) {
        return Promise.reject(error);
      } finally {
        state.release(reservation);
      }
    };
  const session = Object.freeze({
    // Only an installed guest's run chooses where the guest runs from.
    run: (options: RunOptions) => run(options),
    dispose,
    readFile: fsOperation((r, path: string) => state.readFile(path, r)),
    remove: fsOperation((r, path: string) => state.remove(path, r)),
    listEntries: fsOperation((r, path?: string) => state.listEntries(path, r)),
    setCwd: fsOperation((r, path: string) => state.setCwd(path, r)),
    reset,
  });
  bindSessionPort(session, {
    acquire: operation((kind: 'run' | 'install' | 'fs') => state.acquire(kind)),
    commitGuest: operation((r: Reservation, tool: string, guest: GuestHandle) =>
      state.commitGuest(r, tool, guest),
    ),
    runInstalled: (r, tool, args, options) => {
      try {
        return run(
          { ...options, guest: state.installedGuest(r, tool), args },
          r,
          `${INSTALLED_GUEST_DIRECTORY}/${tool}`,
        );
      } catch (error) {
        return Promise.reject(error);
      }
    },
    release: async (r) => {
      const current = active;
      if (current?.reservation === r) await current.completed;
      state.release(r);
    },
    builtin: operation((r: Reservation, argv: readonly string[]) => {
      state.assertCurrent(r);
      invalid(
        Array.isArray(argv) &&
          argv.every((arg) => typeof arg === 'string' && !arg.includes('\0')),
        'builtin argv invalid',
      );
      let stdout = new Uint8Array();
      if (argv[0] === 'ls' && argv.length <= 2)
        stdout = new TextEncoder().encode(
          state
            .listEntries(argv[1], r)
            .map((entry) => entry.path.slice(entry.path.lastIndexOf('/') + 1))
            .join('\n') + '\n',
        );
      else if (argv[0] === 'cat' && argv.length === 2)
        stdout = state.readFile(argv[1]!, r);
      else if (argv[0] === 'cd' && argv.length === 2) state.setCwd(argv[1]!, r);
      else if (argv[0] === 'rm' && argv[1] === '-rf' && argv.length === 3)
        state.remove(argv[2]!, r);
      else if (argv[0] === 'cp' && argv.length === 3)
        state.copy(argv[1]!, argv[2]!, false, r);
      else if (argv[0] === 'cp' && argv[1] === '-r' && argv.length === 4)
        state.copy(argv[2]!, argv[3]!, true, r);
      else if (argv[0] === 'mv' && argv.length === 3)
        state.move(argv[1]!, argv[2]!, r);
      else invalid(false, 'builtin argv unsupported');
      return {
        kind: 'builtin' as const,
        exitCode: 0,
        stdout,
        stderr: new Uint8Array(),
      };
    }),
    resolvePath: (path: string) => {
      invalid(
        typeof path === 'string' && path !== '',
        'path must be non-empty',
      );
      return normalizePath(
        path.startsWith('/') ? path : `${state.cwd}/${path}`,
      );
    },
  });
  return session;
}
