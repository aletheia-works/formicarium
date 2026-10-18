import type { RunOptions, RunResult } from '../../types/index.js';
import type { AcquiredAsset, AssetInput } from './assets.js';
import { acquireAsset, sha256 } from './assets.js';
import type { Trial } from './evidence.js';

export interface TrialSession {
  run(options: RunOptions): Promise<RunResult>;
  dispose(): Promise<void>;
}
export interface TrialResult {
  trial: Trial;
  stdout: string;
  stderr: string;
}
export interface RunnerDependencies {
  createSession(): Promise<TrialSession>;
  acquire?: typeof acquireAsset;
  now?: () => number;
  hash?: typeof sha256;
}
export class TrialError extends Error {
  readonly code: 'ABORTED' | 'BUSY' | 'DISPOSED' | 'INVALID_INPUT';
  stage?: string;
  phasesMs?: Partial<Trial['phasesMs']>;
  constructor(code: TrialError['code'], message: string) {
    super(message);
    this.code = code;
  }
}
function checkedDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0)
    throw new TrialError(
      'INVALID_INPUT',
      'missing or invalid monotonic timing',
    );
  return value;
}
/** Each run owns a fresh session. The local epoch only invalidates this trial
 * coordinator; it does not modify the product Session API or registry. */
export function createTrialRunner(dependencies: RunnerDependencies) {
  const acquire = dependencies.acquire ?? acquireAsset;
  const now = dependencies.now ?? (() => performance.now());
  const hash = dependencies.hash ?? sha256;
  let epoch = 0;
  let disposed = false;
  let active:
    | { controller: AbortController; done: Promise<TrialResult> }
    | undefined;
  const current = (generation: number, signal: AbortSignal) => {
    if (signal.aborted || generation !== epoch)
      throw new TrialError('ABORTED', 'trial cancelled or obsolete');
  };
  async function execute(
    input: AssetInput,
    options: { browser: Trial['browser']; trial: Trial['trial'] },
    signal: AbortSignal,
    generation: number,
  ): Promise<TrialResult> {
    let session: TrialSession | undefined;
    let stage = 'acquire';
    const measured: Partial<Trial['phasesMs']> = {};
    try {
      current(generation, signal);
      const asset: AcquiredAsset = await acquire(input, { signal });
      current(generation, signal);
      for (const phase of ['fetch', 'extract', 'digest', 'validate'] as const)
        checkedDuration(asset.phasesMs[phase]);
      Object.assign(measured, asset.phasesMs);
      stage = 'register';
      const start = now();
      const guest = new Uint8Array(asset.bytes);
      session = await dependencies.createSession();
      current(generation, signal);
      // U1's register phase is session initialization and private validated-byte
      // handoff. It is not the future product registerValidatedGuest operation.
      const register = checkedDuration(now() - start);
      measured.register = register;
      stage = 'run';
      const runStart = now();
      const result = await session.run({
        guest,
        args: ['--version'],
        timeoutMs: 600_000,
        signal,
      });
      const run = checkedDuration(now() - runStart);
      measured.run = run;
      current(generation, signal);
      if (
        !(result.stdout instanceof Uint8Array) ||
        !(result.stderr instanceof Uint8Array) ||
        !Number.isInteger(result.exitCode)
      )
        throw new TrialError('INVALID_INPUT', 'invalid run output');
      const stdout = new Uint8Array(result.stdout);
      const stderr = new Uint8Array(result.stderr);
      stage = 'stdout-digest';
      const stdoutDigest = await hash(stdout);
      current(generation, signal);
      return {
        trial: {
          tool: input.tool,
          browser: options.browser,
          trial: options.trial,
          version: input.version,
          url: input.url,
          finalUrl: asset.finalUrl,
          digest: input.elfSha256,
          cors: 'passed',
          exitCode: result.exitCode,
          stdoutDigest,
          phasesMs: { ...asset.phasesMs, register, run },
        },
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr),
      };
    } catch (caught) {
      const error =
        caught instanceof TrialError
          ? caught
          : new Error(
              caught instanceof Error ? caught.message : 'trial failed',
              { cause: caught },
            );
      Object.assign(error, {
        stage,
        phasesMs: { ...measured },
        code:
          caught && typeof caught === 'object' && 'code' in caught
            ? caught.code
            : 'EXECUTION',
      });
      throw error;
    } finally {
      try {
        await session?.dispose();
      } catch (caught) {
        const error = new Error('trial session cleanup failed', {
          cause: caught,
        });
        Object.assign(error, {
          stage: 'cleanup',
          phasesMs: { ...measured },
          code: 'EXECUTION',
        });
        // biome-ignore lint/correctness/noUnsafeFinally: a failed session cleanup must fail the trial, replacing its result.
        throw error;
      }
    }
  }
  return {
    run(
      raw: AssetInput,
      options: {
        browser: Trial['browser'];
        trial: Trial['trial'];
        signal?: AbortSignal;
      },
    ): Promise<TrialResult> {
      if (disposed)
        return Promise.reject(
          new TrialError('DISPOSED', 'trial runner disposed'),
        );
      if (active)
        return Promise.reject(new TrialError('BUSY', 'trial already running'));
      const input = structuredClone(raw);
      const controller = new AbortController();
      const selection = { browser: options.browser, trial: options.trial };
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) controller.abort();
      const done = execute(input, selection, controller.signal, epoch).finally(
        () => {
          options.signal?.removeEventListener('abort', abort);
          active = undefined;
        },
      );
      active = { controller, done };
      return done;
    },
    async reset(): Promise<void> {
      if (disposed) throw new TrialError('DISPOSED', 'trial runner disposed');
      epoch++;
      const pending = active;
      pending?.controller.abort();
      // The owning run retains its failure. reset waits until resources settle.
      if (pending)
        await pending.done.then(
          () => {},
          () => {},
        );
    },
    async dispose(): Promise<void> {
      disposed = true;
      epoch++;
      const pending = active;
      pending?.controller.abort();
      if (pending)
        await pending.done.then(
          () => {},
          () => {},
        );
    },
  };
}
