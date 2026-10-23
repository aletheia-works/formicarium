import { readFile } from 'node:fs/promises';
import { parentPort } from 'node:worker_threads';
import type { ControlMessage, RunRequest } from '../contracts.js';
import { createCoreResourceClient } from '../core.js';
import { identity, workerErrorMessage } from '../protocol.js';
import { executeWorkerRequest } from '../worker-execution.js';

export async function readNodeAsset(value: string | URL) {
  const url = new URL(value);
  if (url.protocol === 'file:') return new Uint8Array(await readFile(url));
  const response = await fetch(url);
  if (!response.ok) throw new Error('Asset response failed');
  return new Uint8Array(await response.arrayBuffer());
}

let request: RunRequest | undefined;
if (parentPort) {
  parentPort.once('message', (value) => {
    request = value;
    if (value?.type !== 'run' || value.protocolVersion !== 1) {
      parentPort?.postMessage({
        ...identity(value ?? {}),
        type: 'error',
        code: 'EXECUTION',
        message: 'Invalid Worker request',
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
      });
      return;
    }
    const resources = createCoreResourceClient({
      post: (message) =>
        parentPort?.postMessage({ ...identity(value), ...message }),
      subscribe(listener) {
        const callback = (
          message: ControlMessage & import('../contracts.js').Identity,
        ) => {
          if (
            message?.protocolVersion === value.protocolVersion &&
            message.sessionId === value.sessionId &&
            message.runId === value.runId &&
            message.generation === value.generation
          )
            listener(message);
        };
        parentPort?.on('message', callback);
        return () => parentPort?.off('message', callback);
      },
    });
    void executeWorkerRequest(value, {
      post: (message) => parentPort?.postMessage(message),
      readBytes: readNodeAsset,
      resources,
    });
  });
  const uncaught = () => {
    if (request)
      parentPort?.postMessage(
        workerErrorMessage(request, 'EXECUTION', { stdout: [], stderr: [] }),
      );
  };
  process.on('uncaughtException', uncaught);
  process.on('unhandledRejection', uncaught);
}
