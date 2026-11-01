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

/**
 * The start-up of every run's core in this page, one at a time. Under
 * cross-origin isolation from a service worker, WebKit sometimes loads a
 * Worker script past the service worker when two runs start core Workers at
 * once, and COEP then refuses it (CORE_INIT or EXECUTION). A run's Worker is
 * created after the run before it reported `started`, ended or was stopped,
 * or STARTUP_HOLD_MS after its turn began, so a start-up that stalls
 * does not hold the page's other runs; guests still run side by side.
 */
const STARTUP_HOLD_MS = 10_000;
let startupTail: Promise<void> = Promise.resolve();
function startupTurn() {
  let resolve!: () => void;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const released = new Promise<void>((done) => {
    resolve = done;
  });
  const turn = startupTail;
  startupTail = startupTail.then(() => released);
  const release = () => {
    clearTimeout(timer);
    resolve();
  };
  /** Starts the longest wait for this run's `started`, at its turn. */
  const hold = () => {
    timer = setTimeout(release, STARTUP_HOLD_MS);
  };
  return { turn, release, hold };
}

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
  // A page has no TCP sockets, so the core connects through a WebSocket
  // relay there (ADR 0015).
  if (request.network && !request.network.relay)
    throw failure(
      'UNSUPPORTED_ENV',
      'The guest network in a browser needs network.relay',
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
  const startup = startupTurn();
  let terminated = false;
  // Input sent before the Worker exists follows the run request in order.
  const queued: object[] = [];
  const callbacks = {
    message: (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === 'started' || type === 'done' || type === 'error')
        startup.release();
      if (type !== 'started') handlers.message(event.data);
    },
    error: (event: ErrorEvent) => {
      event.preventDefault();
      startup.release();
      handlers.error(event.error);
    },
    messageerror: () =>
      handlers.error(new Error('Worker message could not be decoded')),
  };
  // Return ownership immediately; deadline/abort can cancel before creation.
  void (async () => {
    try {
      // The hold starts with the turn, so a stalled script fetch counts too.
      await startup.turn;
      if (terminated) return;
      startup.hold();
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
      startup.release();
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
      startup.release();
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
