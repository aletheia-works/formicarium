import type { Session, SessionOptions } from '../../types/index.js';
import type { RunRequest, WorkerHandle, WorkerHandlers } from '../contracts.js';
import { packageAssets } from '../core.js';
import { failure, invalid } from '../errors.js';
import { createLifecycle } from '../lifecycle.js';
import { SessionState } from '../state.js';
import { validateAssets } from '../validation.js';

/**
 * How long a run's Worker may take to stop the core before it is terminated;
 * shorter than the lifecycle's cleanup deadline.
 */
const STOP_GRACE_MS = 500;

function spawnBrowserWorker(
  request: RunRequest,
  handlers: WorkerHandlers,
): WorkerHandle {
  if (
    typeof Worker !== 'function' ||
    typeof SharedArrayBuffer !== 'function' ||
    globalThis.crossOriginIsolated !== true
  ) {
    throw failure(
      'UNSUPPORTED_ENV',
      'Worker, SharedArrayBuffer and cross-origin isolation are required',
    );
  }
  // The core reaches the network through Node.js sockets only (ADR 0014).
  if (request.network)
    throw failure(
      'UNSUPPORTED_ENV',
      'The guest network is available in Node.js only',
    );
  const url = new URL(request.assets.workerURL);
  if (
    url.origin !== globalThis.location?.origin ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw failure(
      'UNSUPPORTED_ENV',
      'Browser Worker must be served from the same origin',
    );
  let worker: Worker | undefined;
  const preflight = new AbortController();
  let terminated = false;
  // Input sent before the Worker exists follows the run request in order.
  const queued: object[] = [];
  const callbacks = {
    message: (event: MessageEvent) => handlers.message(event.data),
    error: (event: ErrorEvent) => {
      event.preventDefault();
      handlers.error(event.error);
    },
    messageerror: () =>
      handlers.error(new Error('Worker message could not be decoded')),
  };
  // Return ownership immediately; deadline/abort can cancel before creation.
  void (async () => {
    try {
      const response = await fetch(url, { signal: preflight.signal });
      if (terminated) {
        await response.body?.cancel();
        return;
      }
      if (!response.ok) throw new Error('Worker asset response');
      await response.arrayBuffer();
      if (terminated) return;
      worker = new Worker(url, { type: 'module' });
      if (terminated) {
        worker.terminate();
        return;
      }
      worker.addEventListener('message', callbacks.message);
      worker.addEventListener('error', callbacks.error);
      worker.addEventListener('messageerror', callbacks.messageerror);
      worker?.postMessage(request);
      for (const message of queued.splice(0)) worker.postMessage(message);
    } catch {
      if (!terminated)
        handlers.error(
          failure(
            'ASSET_LOAD',
            'Package Worker could not be loaded or created',
          ),
        );
    }
  })();
  return {
    send(message) {
      if (terminated) return;
      if (worker) worker.postMessage(message);
      else queued.push(message);
    },
    detach() {
      worker?.removeEventListener('message', callbacks.message);
      worker?.removeEventListener('error', callbacks.error);
      worker?.removeEventListener('messageerror', callbacks.messageerror);
    },
    async terminate() {
      terminated = true;
      preflight.abort();
      const owned = worker;
      if (!owned) return;
      // The core's Workers run inside this Worker, and a browser ends them only
      // some time after this Worker is terminated. Ask it to stop them first.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, STOP_GRACE_MS);
        owned.addEventListener('message', ({ data }) => {
          if (data?.type !== 'stopped') return;
          clearTimeout(timer);
          resolve();
        });
        owned.postMessage({ type: 'stop' });
      });
      owned.terminate();
    },
  };
}

export async function createSession(
  options: SessionOptions = {},
): Promise<Session> {
  invalid(
    options && typeof options === 'object' && !Array.isArray(options),
    'session options must be an object',
  );
  // The default is the import-free bundle of package-worker.js: WebKit refuses
  // some Worker module imports under service-worker cross-origin isolation.
  const assets = validateAssets(
    options.assets ??
      packageAssets(new URL('./package-worker.bundle.js', import.meta.url)),
  );
  return createLifecycle(new SessionState(options), {
    assets,
    spawn: spawnBrowserWorker,
  });
}
