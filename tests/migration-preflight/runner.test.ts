import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  AcquiredAsset,
  AssetInput,
} from '../../scripts/migration-preflight/assets.js';
import type {
  RunnerDependencies,
  TrialSession,
} from '../../scripts/migration-preflight/runner.js';
import {
  createTrialRunner,
  TrialError,
} from '../../scripts/migration-preflight/runner.js';

function fixture(): AssetInput {
  return {
    tool: 'aube',
    version: '1.0.0',
    url: 'https://example.org/fixture-only',
    elfSha256: 'a'.repeat(64),
    buildInfo: { fixtureOnly: true },
  } as unknown as AssetInput;
}
function asset(input: AssetInput): AcquiredAsset {
  return {
    input,
    bytes: Uint8Array.of(1, 2, 3),
    finalUrl: input.url,
    phasesMs: { fetch: 5, extract: 1, digest: 2, validate: 3 },
  };
}
function dependencies(overrides: Partial<RunnerDependencies> = {}) {
  let sessions = 0;
  let cleanup = 0;
  let clock = 0;
  return {
    counts: () => ({ sessions, cleanup }),
    dependencies: {
      acquire: async (input: AssetInput) => asset(input),
      now: () => clock++,
      hash: async () => 'b'.repeat(64),
      createSession: async () => {
        sessions++;
        return {
          run: async () => ({
            runId: 'fixture',
            exitCode: 0,
            stdout: new TextEncoder().encode('<script>text only</script>'),
            stderr: new Uint8Array(),
            elapsedMs: 1,
          }),
          dispose: async () => {
            cleanup++;
          },
        };
      },
      ...overrides,
    } satisfies RunnerDependencies,
  };
}
const options = { browser: 'chromium', trial: 1 } as const;
test('every successful trial creates and disposes a fresh session and records all timings', async () => {
  const state = dependencies();
  const runner = createTrialRunner(state.dependencies);
  const first = await runner.run(fixture(), options);
  await runner.run(fixture(), options);
  assert.deepEqual(state.counts(), { sessions: 2, cleanup: 2 });
  assert.deepEqual(first.trial.phasesMs, {
    fetch: 5,
    extract: 1,
    digest: 2,
    validate: 3,
    register: 1,
    run: 1,
  });
  assert.equal(first.stdout, '<script>text only</script>');
  assert.equal(first.trial.stdoutDigest, 'b'.repeat(64));
});
test('input and validated byte copies remain unchanged after caller mutation', async () => {
  const input = fixture();
  const verified = asset(input);
  let observed: Uint8Array | undefined;
  const state = dependencies({
    acquire: async (snapshot) => {
      input.version = 'changed';
      return { ...verified, input: snapshot };
    },
    createSession: async () => {
      verified.bytes.fill(9);
      return {
        run: async ({ guest }) => {
          observed = guest;
          verified.bytes.fill(8);
          return {
            runId: 'copy',
            exitCode: 0,
            stdout: new Uint8Array(),
            stderr: new Uint8Array(),
            elapsedMs: 1,
          };
        },
        dispose: async () => {},
      };
    },
  });
  const result = await createTrialRunner(state.dependencies).run(
    input,
    options,
  );
  assert.equal(result.trial.version, '1.0.0');
  assert.deepEqual(observed, Uint8Array.of(1, 2, 3));
});
test('missing acquisition timing and nonmonotonic clock fail instead of becoming zero', async () => {
  for (const phase of ['fetch', 'extract', 'digest', 'validate'] as const) {
    const state = dependencies({
      acquire: async (input) => {
        const acquired = asset(input);
        acquired.phasesMs[phase] = NaN;
        return acquired;
      },
    });
    await assert.rejects(
      createTrialRunner(state.dependencies).run(fixture(), options),
      /timing/,
    );
  }
  const state = dependencies({
    now: (() => {
      let time = 1;
      return () => time--;
    })(),
  });
  await assert.rejects(
    createTrialRunner(state.dependencies).run(fixture(), options),
    /timing/,
  );
});
test('acquisition failure creates no session and cannot produce a passed row', async () => {
  const state = dependencies({
    acquire: async () => {
      throw Error('redirect refused');
    },
  });
  await assert.rejects(
    createTrialRunner(state.dependencies).run(fixture(), options),
    (error: unknown) => {
      assert.ok(error instanceof Error && error.message.includes('redirect'));
      assert.deepEqual((error as Error & { phasesMs: unknown }).phasesMs, {});
      assert.equal((error as Error & { stage: string }).stage, 'acquire');
      return true;
    },
  );
  assert.deepEqual(state.counts(), { sessions: 0, cleanup: 0 });
});
test('nonzero exit is preserved and thrown execution failure still cleans up', async () => {
  let cleanup = 0;
  const createSession =
    (fails: boolean): (() => Promise<TrialSession>) =>
    async () => ({
      run: async () => {
        if (fails) throw Error('execution failed');
        return {
          runId: 'nonzero',
          exitCode: 2,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          elapsedMs: 1,
        };
      },
      dispose: async () => {
        cleanup++;
      },
    });
  const normal = dependencies({ createSession: createSession(false) });
  assert.equal(
    (await createTrialRunner(normal.dependencies).run(fixture(), options)).trial
      .exitCode,
    2,
  );
  const failure = dependencies({ createSession: createSession(true) });
  await assert.rejects(
    createTrialRunner(failure.dependencies).run(fixture(), options),
    (error: unknown) => {
      assert.ok(
        error instanceof Error && error.message.includes('execution failed'),
      );
      assert.equal((error as Error & { stage: string }).stage, 'run');
      assert.deepEqual((error as Error & { phasesMs: unknown }).phasesMs, {
        fetch: 5,
        extract: 1,
        digest: 2,
        validate: 3,
        register: 1,
      });
      return true;
    },
  );
  assert.equal(cleanup, 2);
});
test('reset invalidates a late acquisition and waits before permitting the next trial', async () => {
  let release!: (value: AcquiredAsset) => void;
  const state = dependencies({
    acquire: async () =>
      new Promise<AcquiredAsset>((resolve) => {
        release = resolve;
      }),
  });
  const runner = createTrialRunner(state.dependencies);
  const pending = runner.run(fixture(), options);
  await assert.rejects(
    runner.run(fixture(), options),
    (error: unknown) => error instanceof TrialError && error.code === 'BUSY',
  );
  const reset = runner.reset();
  release(asset(fixture()));
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof TrialError && error.code === 'ABORTED',
  );
  await reset;
  assert.equal(state.counts().sessions, 0);
  const next = runner.run(fixture(), options);
  release(asset(fixture()));
  await next;
  assert.equal(state.counts().sessions, 1);
});
test('caller cancellation discards late output and cleans up the active session', async () => {
  let finish!: () => void;
  let cleanup = 0;
  const state = dependencies({
    createSession: async () => ({
      run: async () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              runId: 'late',
              exitCode: 0,
              stdout: new Uint8Array(),
              stderr: new Uint8Array(),
              elapsedMs: 1,
            });
        }),
      dispose: async () => {
        cleanup++;
      },
    }),
  });
  const controller = new AbortController();
  const runner = createTrialRunner(state.dependencies);
  const pending = runner.run(fixture(), {
    ...options,
    signal: controller.signal,
  });
  while (!finish) await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort();
  finish();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof TrialError && error.code === 'ABORTED',
  );
  assert.equal(cleanup, 1);
});
test('dispose is final and rejects later run or reset without allocating resources', async () => {
  const state = dependencies();
  const runner = createTrialRunner(state.dependencies);
  await runner.dispose();
  await runner.dispose();
  await assert.rejects(
    runner.run(fixture(), options),
    (error: unknown) =>
      error instanceof TrialError && error.code === 'DISPOSED',
  );
  await assert.rejects(
    runner.reset(),
    (error: unknown) =>
      error instanceof TrialError && error.code === 'DISPOSED',
  );
  assert.deepEqual(state.counts(), { sessions: 0, cleanup: 0 });
});
