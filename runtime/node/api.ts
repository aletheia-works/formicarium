import { existsSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import type { Session, SessionOptions } from '../../types/index.js';
import type { RunRequest, WorkerHandle, WorkerHandlers } from '../contracts.js';
import { isRecord } from '../contracts.js';
import { createCoreResourceOwner, packageAssets } from '../core.js';
import { failure, invalid } from '../errors.js';
import { createLifecycle } from '../lifecycle.js';
import { identity } from '../protocol.js';
import { SessionState } from '../state.js';
import { validateAssets } from '../validation.js';

function spawnNodeWorker(
  request: RunRequest,
  handlers: WorkerHandlers,
): WorkerHandle {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw failure('UNSUPPORTED_ENV', 'Node >=24 is required');
  const url = new URL(request.assets.workerURL);
  if (url.protocol !== 'file:' || !existsSync(url))
    throw failure('ASSET_LOAD', 'Package Worker file is unavailable');
  let worker: Worker;
  try {
    worker = new Worker(url);
  } catch {
    throw failure('ASSET_LOAD', 'Package Worker could not be created');
  }
  const resources = createCoreResourceOwner();
  let terminated = false;
  let allocation = false;
  const message = (value: unknown) => {
    if (
      !isRecord(value) ||
      typeof value.type !== 'string' ||
      !value.type.startsWith('resource-')
    ) {
      handlers.message(value);
      return;
    }
    if (
      terminated ||
      value.sessionId !== request.sessionId ||
      value.runId !== request.runId ||
      value.generation !== request.generation
    )
      return;
    if (
      value.protocolVersion !== request.protocolVersion ||
      value.type !== 'resource-create' ||
      allocation ||
      typeof value.resourceRequestId !== 'number' ||
      !Number.isSafeInteger(value.resourceRequestId) ||
      value.resourceRequestId < 1 ||
      !value.files ||
      typeof value.files !== 'object'
    ) {
      handlers.error(failure('EXECUTION', 'Resource control failed'));
      return;
    }
    allocation = true;
    void resources.allocate(value.files as Record<string, Uint8Array>).then(
      (descriptor) => {
        if (!terminated)
          worker.postMessage({
            ...identity(request),
            type: 'resource-ready',
            resourceRequestId: value.resourceRequestId,
            descriptor,
          });
      },
      () => {
        if (!terminated)
          handlers.error(
            failure('ASSET_LOAD', 'Verified loader resource failed'),
          );
      },
    );
  };
  const callbacks = {
    message,
    error: handlers.error,
    messageerror: handlers.error,
    exit: handlers.exit,
  };
  for (const [event, callback] of Object.entries(callbacks))
    worker.on(event, callback);
  worker.postMessage(request);
  return {
    send(message) {
      if (!terminated) worker.postMessage(message);
    },
    detach() {
      for (const [event, callback] of Object.entries(callbacks))
        worker.off(event, callback);
    },
    async terminate() {
      terminated = true;
      await worker.terminate();
      await resources.dispose();
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
  const assets = validateAssets(
    options.assets ??
      packageAssets(new URL('./package-worker.js', import.meta.url)),
  );
  const state = new SessionState(options);
  return createLifecycle(state, { assets, spawn: spawnNodeWorker });
}
