import type { RunRequest, WorkerHandlers } from '../../runtime/contracts.js';
import { validateGuest } from '../../runtime/guest-validation.js';
import type { GuestCatalog } from '../../runtime/install-catalog.js';
import { createLifecycle } from '../../runtime/lifecycle.js';
import { identity } from '../../runtime/protocol.js';
import { registerValidatedGuest } from '../../runtime/public.js';
import { SessionState } from '../../runtime/state.js';
import type { FsEntry } from '../../types/index.js';
import { elf, expectation } from '../migration-session/fixtures.js';

/** How the fake Worker answers the next spawned run. */
export interface GuestPlan {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: 'EXECUTION' | 'CORE_INIT';
  pending?: boolean;
}
const encoder = new TextEncoder();
export const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
export const file = (path: string, value: string | Uint8Array): FsEntry => ({
  path,
  type: 'file',
  mode: 0o644,
  inodeId: path,
  data: typeof value === 'string' ? encoder.encode(value) : value,
});
export const dir = (path: string): FsEntry => ({
  path,
  type: 'dir',
  mode: 0o755,
});

function deliver(
  request: RunRequest,
  handlers: WorkerHandlers,
  plan: GuestPlan,
) {
  if (plan.error) {
    handlers.message({
      ...identity(request),
      type: 'error',
      code: plan.error,
      message: plan.error,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
    return;
  }
  const stdout = encoder.encode(plan.stdout ?? '');
  const stderr = encoder.encode(plan.stderr ?? '');
  let sequence = 0;
  for (const [stream, bytes] of [
    ['stdout', stdout],
    ['stderr', stderr],
  ] as const)
    if (bytes.length)
      handlers.message({
        ...identity(request),
        type: 'output',
        chunk: { runId: request.runId, sequence: sequence++, stream, bytes },
      });
  handlers.message({
    ...identity(request),
    type: 'done',
    result: {
      runId: request.runId,
      exitCode: plan.exitCode ?? 0,
      elapsedMs: 0,
      stdout,
      stderr,
    },
    snapshot: request.entries,
  });
}

/**
 * Real SessionState, lifecycle, reservation and internal port. Only the Worker
 * is replaced, so exclusion and failure contracts are the production ones.
 */
export function harness(
  entries: FsEntry[] = [
    file('/work/a.txt', 'alpha'),
    dir('/work/sub'),
    file('/work/sub/b.txt', 'beta'),
  ],
) {
  const state = new SessionState({ entries });
  const plans: GuestPlan[] = [];
  const requests: RunRequest[] = [];
  const delays: number[] = [];
  let terminated = 0;
  let pending: (() => void) | undefined;
  const session = createLifecycle(state, {
    clock: () => 0,
    timers: {
      setTimeout: ((callback: () => void, ms?: number) => {
        delays.push(ms ?? 0);
        return setTimeout(callback, ms);
      }) as typeof setTimeout,
      clearTimeout,
    },
    spawn(request, handlers) {
      requests.push(request);
      const plan = plans.shift() ?? {};
      if (plan.pending)
        pending = () => deliver(request, handlers, { ...plan, pending: false });
      else deliver(request, handlers, plan);
      return {
        terminate() {
          terminated++;
        },
      };
    },
  });
  /** Resolves once the pending fake Worker has actually been spawned. */
  const started = async () => {
    for (let turn = 0; !pending; turn++) {
      if (turn > 1000) throw Error('pending guest run was never spawned');
      await new Promise((done) => setImmediate(done));
    }
  };
  const bytes = elf();
  const register = async (tool = 'fixture') =>
    registerValidatedGuest(
      session,
      tool,
      validateGuest(new Uint8Array(bytes), expectation(bytes)),
    );
  return {
    state,
    session,
    bytes,
    plans,
    requests,
    delays,
    register,
    terminated: () => terminated,
    started,
    /** Completes the currently pending fake Worker run. */
    async finishPending() {
      await started();
      const finish = pending;
      pending = undefined;
      finish?.();
    },
  };
}

/** A C04 catalog whose single entry serves `bytes` from a mocked fetch. */
export function catalogFor(
  bytes: Uint8Array<ArrayBuffer>,
  tool = 'fixture',
  versionOrName = '1.0.0',
): GuestCatalog {
  const expected = expectation(bytes, { tool, versionOrName });
  const info = expected.identity;
  return {
    schemaVersion: 1,
    catalogId: 'u4-command-test',
    defaults: { [tool]: versionOrName },
    entries: [
      {
        tool,
        versionOrName,
        url: `https://example.test/${tool}`,
        format: 'elf',
        downloadSha256: info.elfSha256,
        downloadBytes: bytes.length,
        elfBytes: bytes.length,
        buildInfo: info,
        buildInfoSha256: expected.buildInfoSha256,
      },
    ],
  };
}

/** Merges catalogs for several tools into one valid C04 catalog. */
export function mergeCatalogs(...catalogs: GuestCatalog[]): GuestCatalog {
  return {
    schemaVersion: 1,
    catalogId: 'u4-command-test',
    defaults: Object.assign({}, ...catalogs.map((value) => value.defaults)),
    entries: catalogs.flatMap((value) => value.entries),
  };
}
