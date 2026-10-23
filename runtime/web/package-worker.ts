import type { RunRequest } from '../contracts.js';
import { loadPackageCore } from '../core.js';
import { identity, workerErrorMessage } from '../protocol.js';
import { executeWorkerRequest } from '../worker-execution.js';

export async function readBrowserAsset(url: string | URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Asset response failed');
  return new Uint8Array(await response.arrayBuffer());
}

let request: RunRequest | undefined;
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
  for (const worker of coreWorkers) worker.terminate();
  coreWorkers.clear();
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
    if (request) return;
    request = data;
    if (data?.type !== 'run' || data.protocolVersion !== 1) {
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
    void executeWorkerRequest(data, {
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
