import type {
  CoreLauncher,
  CoreLoadOptions,
  RunRequest,
  Streams,
} from './contracts.js';
import { errorCode, INSTALLED_GUEST_DIRECTORY, isRecord } from './contracts.js';
import { loadPackageCore } from './core.js';
import { runGuest } from './guest-io.js';
import { identity, workerErrorMessage } from './protocol.js';

/**
 * The guest's stdin inside the Worker: `input` and `input-end` messages of
 * this run, in arrival order. Messages for another run are not consumed.
 * Bytes that arrive before the guest starts wait in the stream.
 */
export function inputChannel(request: RunRequest) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let ended = false;
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  /** Returns false for anything that is not this run's input. */
  const receive = (message: unknown): boolean => {
    if (
      !isRecord(message) ||
      (message.type !== 'input' && message.type !== 'input-end') ||
      message.protocolVersion !== request.protocolVersion ||
      message.sessionId !== request.sessionId ||
      message.runId !== request.runId ||
      message.generation !== request.generation
    )
      return false;
    if (ended) return true;
    // The Session sends only Uint8Array bytes; anything else from a broken
    // host ends the input rather than failing the Worker mid-run.
    if (
      message.type === 'input-end' ||
      !(message.bytes instanceof Uint8Array)
    ) {
      ended = true;
      controller.close();
    } else controller.enqueue(new Uint8Array(message.bytes));
    return true;
  };
  return { stream, receive };
}

/** One request owns one fresh core and never owns the persistent session state. */
export async function executeWorkerRequest(
  request: RunRequest,
  {
    post,
    stdin,
    readBytes = async () => {
      throw new Error('Asset reader is unavailable');
    },
    resources,
    loadCore = loadPackageCore,
    clock = () => performance.now(),
  }: Partial<Omit<CoreLoadOptions, 'assets'>> & {
    post(message: object): void;
    loadCore?: (options: CoreLoadOptions) => Promise<{
      launcher: CoreLauncher;
      cleanup?(): Promise<void>;
    }>;
    clock?: () => number;
    /** Present for an interactive request; see inputChannel. */
    stdin?: ReadableStream<Uint8Array>;
  },
) {
  const streams: Streams = { stdout: [], stderr: [] };
  let sequence = 0;
  let adapter: Awaited<ReturnType<typeof loadCore>> | undefined;
  const output = (stream: keyof Streams) => (bytes: Uint8Array) => {
    const copy = new Uint8Array(bytes);
    streams[stream].push(copy);
    post({
      ...identity(request),
      type: 'output',
      chunk: {
        runId: request.runId,
        sequence: sequence++,
        stream,
        bytes: copy,
      },
    });
  };
  try {
    adapter = await loadCore({
      assets: request.assets,
      readBytes,
      resources,
    });
    const started = clock();
    const result = await runGuest({
      launcher: adapter.launcher,
      // An installed guest is already placed in INSTALLED_GUEST_DIRECTORY.
      guestPath: request.program ?? '/guest/program',
      entries: [
        ...request.entries,
        ...(request.program
          ? []
          : [
              {
                path: '/guest/program',
                type: 'file' as const,
                data: new Uint8Array(request.guest),
                mode: 0o755,
              },
            ]),
        ...request.tools.map(({ tool, bytes }) => ({
          path: `${INSTALLED_GUEST_DIRECTORY}/${tool}`,
          type: 'file' as const,
          data: new Uint8Array(bytes),
          mode: 0o755,
        })),
      ],
      args: request.args,
      env: request.env,
      cwd: request.cwd,
      snapshotRoots: request.snapshotRoots,
      onStdout: output('stdout'),
      onStderr: output('stderr'),
      ...(stdin ? { stdin } : {}),
      ...(request.terminal ? { terminal: request.terminal } : {}),
      ...(request.network ? { network: request.network } : {}),
    });
    if (!Array.isArray(result.snapshot))
      throw Object.assign(new Error('Missing snapshot'), { code: 'SNAPSHOT' });
    await adapter.cleanup?.();
    post({
      ...identity(request),
      type: 'done',
      result: {
        runId: request.runId,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        elapsedMs: Math.max(0, clock() - started),
      },
      snapshot: result.snapshot,
    });
  } catch (error) {
    let failure = error;
    try {
      await adapter?.cleanup?.();
    } catch {
      failure = { code: 'EXECUTION' };
    }
    post(
      workerErrorMessage(
        request,
        errorCode(failure) ??
          (failure instanceof Error ? errorCode(failure.cause) : undefined) ??
          'EXECUTION',
        streams,
        error,
      ),
    );
  }
}
