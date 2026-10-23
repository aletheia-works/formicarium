// Test-only wrapper: observe the core's real Worker activity without changing tgz bytes.
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { parentPort } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const threads =
  require('node:worker_threads') as typeof import('node:worker_threads');
const OriginalWorker = threads.Worker;
const counters = new SharedArrayBuffer(16);
const view = new Int32Array(counters);
parentPort?.postMessage({ type: 'nested-inspection', counters });
threads.Worker = class extends OriginalWorker {
  constructor(
    url: string | URL,
    options: import('node:worker_threads').WorkerOptions = {},
  ) {
    Atomics.add(view, 0, 1);
    const code = `import {createRequire,syncBuiltinESMExports} from 'node:module';
const threads=createRequire(process.cwd()+'/observer.cjs')('node:worker_threads');
const bridge=threads.workerData; threads.workerData=bridge.original; syncBuiltinESMExports();
const view=new Int32Array(bridge.counters); Atomics.add(view,1,1);
Atomics.add(view,2,1); setInterval(()=>Atomics.add(view,2,1),5);
await import(bridge.target);`;
    super(new URL(`data:text/javascript,${encodeURIComponent(code)}`), {
      ...options,
      workerData: {
        original: options.workerData,
        counters,
        target: String(url),
      },
    });
    this.once('exit', () => Atomics.add(view, 3, 1));
  }
};
syncBuiltinESMExports();
// The installed Worker handles the first request after its import completes.
const queued: unknown[] = [];
const queue = (message: unknown) => queued.push(message);
parentPort?.on('message', queue);
await import(process.env.FORMICARIUM_OBSERVED_WORKER!);
parentPort?.off('message', queue);
for (const message of queued) parentPort?.emit('message', message);
