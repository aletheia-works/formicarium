import type { RunRequest } from '../contracts.js';
import { loadPackageCore } from '../core.js';
import { identity, PROTOCOL_VERSION, workerErrorMessage } from '../protocol.js';
import { executeWorkerRequest, inputChannel } from '../worker-execution.js';

export async function readBrowserAsset(url: string | URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Asset response failed');
  return new Uint8Array(await response.arrayBuffer());
}

/** Time for terminated core Workers to stop; below the host's 500 ms grace. */
const CORE_STOP_WAIT_MS = 50;

let request: RunRequest | undefined;
let input: ReturnType<typeof inputChannel> | undefined;
let core: { cleanup(): Promise<void> } | undefined;
// The core's Workers, started from this Worker. A browser ends the Workers of
// a terminated Worker only later, so the host asks for a stop first.
const coreWorkers = new Set<Worker>();

/** Stops the core and ends its Workers, then tells the host. */
async function stop() {
  try {
    await core?.cleanup();
  } catch {
    // The Workers below are ended either way.
  }
  const terminated = coreWorkers.size;
  for (const worker of coreWorkers) worker.terminate();
  coreWorkers.clear();
  // terminate() returns before the browser has stopped the Worker's thread,
  // which may still run for a few milliseconds; wait before reporting.
  if (terminated)
    await new Promise((resolve) => setTimeout(resolve, CORE_STOP_WAIT_MS));
  self.postMessage({ type: 'stopped' });
}

if (typeof self !== 'undefined') {
  if (typeof Worker === 'function') {
    const NativeWorker = Worker;
    globalThis.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        coreWorkers.add(this);
      }
    };
  }
  self.addEventListener('message', ({ data }) => {
    if (data?.type === 'stop') {
      void stop();
      return;
    }
    if (request) {
      input?.receive(data);
      return;
    }
    request = data;
    if (data?.type !== 'run' || data.protocolVersion !== PROTOCOL_VERSION) {
      self.postMessage({
        ...identity(data ?? {}),
        type: 'error',
        code: 'EXECUTION',
        message: 'Invalid Worker request',
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      });
      return;
    }
    input = data.interactive ? inputChannel(data) : undefined;
    void executeWorkerRequest(data, {
      ...(input ? { stdin: input.stream } : {}),
      post: (message) => self.postMessage(message),
      readBytes: readBrowserAsset,
      loadCore: async (options) => {
        const loaded = await loadPackageCore(options);
        // The run and a stop request share one cleanup.
        let cleaned: Promise<void> | undefined;
        core = {
          ...loaded,
          cleanup: () => {
            cleaned ??= loaded.cleanup();
            return cleaned;
          },
        };
        return core as typeof loaded;
      },
    });
  });
  self.addEventListener('error', (event) => {
    event.preventDefault();
    if (request)
      self.postMessage(
        workerErrorMessage(request, 'EXECUTION', { stdout: [], stderr: [] }),
      );
  });
}
