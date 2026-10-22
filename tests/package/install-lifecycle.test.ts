import assert from 'node:assert/strict';
import test from 'node:test';
import { failure } from '../../runtime/errors.js';
import type { Progress } from '../../runtime/install-lifecycle.js';
import {
  InstallLifetime,
  ProgressReporter,
} from '../../runtime/install-lifecycle.js';
import type { Reservation, SessionPort } from '../../runtime/session-port.js';

function lifetime(
  ownerCode: 'ABORTED' | 'DISPOSED' = 'ABORTED',
  caller?: AbortSignal,
  clock?: () => number,
) {
  const owner = new AbortController();
  let queries = 0;
  const reservation: Reservation = {
    token: Symbol(),
    epoch: 0,
    operationId: 'test',
    signal: owner.signal,
  };
  const port: SessionPort = {
    async builtin(r: Reservation, argv: readonly string[]) {
      queries++;
      assert.equal(r, reservation);
      assert.deepEqual(argv, ['ls']);
      assert.equal(r.signal.aborted, true);
      throw failure(ownerCode);
    },
    async acquire() {
      throw Error('unexpected acquire');
    },
    async commitGuest() {
      throw Error('unexpected commit');
    },
    async runInstalled() {
      throw Error('unexpected run');
    },
    async release() {
      throw Error('unexpected release');
    },
    resolvePath() {
      throw Error('unexpected resolve');
    },
  };
  const control = new InstallLifetime(reservation, port, caller, clock);
  return { control, owner, queries: () => queries };
}
test('lifetime check and yield preserve an active reservation without owner queries', async () => {
  const value = lifetime();
  value.control.check();
  await value.control.yield();
  assert.equal(value.queries(), 0);
  value.control.cleanup();
});
test('caller cancellation fixes ABORTED and does not query a live owner', async () => {
  const caller = new AbortController();
  const value = lifetime('DISPOSED', caller.signal);
  caller.abort();
  assert.throws(() => value.control.check(), { code: 'ABORTED' });
  assert.equal(
    ((await value.control.reason(Error('late'))) as Error & { code: string })
      .code,
    'ABORTED',
  );
  assert.equal(value.queries(), 0);
  value.control.cleanup();
});
test('owner reset and dispose classify only cancelled reservation through current-owner guard', async () => {
  for (const code of ['ABORTED', 'DISPOSED'] as const) {
    const value = lifetime(code);
    value.owner.abort();
    assert.equal(value.control.signal.aborted, true);
    assert.equal(
      ((await value.control.reason(Error('late'))) as Error & { code: string })
        .code,
      code,
    );
    assert.equal(value.queries(), 1);
    value.control.cleanup();
  }
});
test('first caller or owner terminal cause survives later cancellation', async () => {
  const firstCaller = new AbortController();
  const first = lifetime('DISPOSED', firstCaller.signal);
  firstCaller.abort();
  first.owner.abort();
  assert.equal(
    ((await first.control.reason(null)) as Error & { code: string }).code,
    'ABORTED',
  );
  assert.equal(first.queries(), 0);
  first.control.cleanup();
  const secondCaller = new AbortController();
  const second = lifetime('DISPOSED', secondCaller.signal);
  second.owner.abort();
  secondCaller.abort();
  assert.equal(
    ((await second.control.reason(null)) as Error & { code: string }).code,
    'DISPOSED',
  );
  second.control.cleanup();
});
test('monotonic deadline accepts below boundary, rejects exact boundary and stays TIMEOUT', async () => {
  let now = 10;
  const value = lifetime('DISPOSED', undefined, () => now);
  now = 180009;
  value.control.check();
  now = 180010;
  assert.throws(() => value.control.check(), { code: 'TIMEOUT' });
  value.owner.abort();
  assert.equal(
    ((await value.control.reason(null)) as Error & { code: string }).code,
    'TIMEOUT',
  );
  assert.equal(value.queries(), 0);
  value.control.cleanup();
});
test('success completion survives later abort and cleanup detaches both listeners', () => {
  const caller = new AbortController();
  const value = lifetime('DISPOSED', caller.signal);
  value.control.complete();
  value.control.cleanup();
  caller.abort();
  value.owner.abort();
  assert.equal(value.control.signal.aborted, false);
  assert.equal(value.queries(), 0);
  value.control.check();
});
test('a component failure is fixed before asynchronous cleanup can observe owner abort', async () => {
  const value = lifetime('DISPOSED');
  value.control.fail(failure('INVALID_INPUT'));
  value.owner.abort();
  assert.equal(
    ((await value.control.reason(null)) as Error & { code: string }).code,
    'INVALID_INPUT',
  );
  assert.equal(value.queries(), 0);
  value.control.cleanup();
});
test('progress keeps operation identity, increasing sequence and ordered nondecreasing phase bytes', () => {
  const value = lifetime();
  const events: Progress[] = [];
  const reporter = new ProgressReporter('one', value.control, (event) =>
    events.push(event),
  );
  reporter.notify('fetch', 0, null);
  reporter.notify('fetch', 3, null);
  reporter.notify('digest', 0, 3);
  reporter.notify('digest', 3, 3);
  reporter.notify('validate', 3, 3);
  reporter.notify('register', 0, 3);
  assert.deepEqual(
    events.map((event) => event.sequence),
    [0, 1, 2, 3, 4, 5],
  );
  assert.ok(
    events.every(
      (event) => event.operationId === 'one' && Object.isFrozen(event),
    ),
  );
  assert.throws(() => reporter.notify('fetch', 3, null), {
    code: 'INVALID_INPUT',
  });
  value.control.cleanup();
});
test('unknown total and known zero remain distinct and invalid byte regression rejects', () => {
  const value = lifetime();
  const events: Progress[] = [];
  const reporter = new ProgressReporter('one', value.control, (event) =>
    events.push(event),
  );
  reporter.notify('fetch', 0, null);
  reporter.notify('fetch', 0, 0);
  reporter.notify('fetch', 2, 2);
  assert.equal(events[0]!.totalBytes, null);
  assert.equal(events[1]!.totalBytes, 0);
  assert.throws(() => reporter.notify('fetch', 1, 2), {
    code: 'INVALID_INPUT',
  });
  assert.throws(() => reporter.notify('digest', -1, null), {
    code: 'INVALID_INPUT',
  });
  value.control.cleanup();
});
test('progress exceptions become bounded diagnostics without affecting operation', () => {
  const value = lifetime();
  const reporter = new ProgressReporter('one', value.control, () => {
    throw Error('secret callback');
  });
  for (let i = 0; i < 40; i++) reporter.notify('fetch', i, null);
  assert.equal(reporter.notificationFailures, 32);
  value.control.check();
  value.control.cleanup();
});
test('cancel and finish suppress every later progress callback', () => {
  const caller = new AbortController();
  const value = lifetime('ABORTED', caller.signal);
  let calls = 0;
  const reporter = new ProgressReporter('one', value.control, () => {
    calls++;
  });
  reporter.notify('fetch', 0, null);
  caller.abort();
  reporter.notify('fetch', 1, null);
  reporter.finish();
  reporter.notify('register', 1, 1);
  assert.equal(calls, 1);
  value.control.cleanup();
});
