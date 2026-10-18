import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Command,
  runSessionCompletion,
  sequential,
} from '../../scripts/migration-session/completion.js';
import { assertSessionNodeRealms } from '../../scripts/migration-session/coverage.js';

// These are fake command execution boundaries, not real build/coverage evidence.
const commands: Command[] = [1, 2, 3].map((value) => ({
  executable: 'fixture',
  args: [String(value)],
  cwd: '.',
}));
const realmRows = () =>
  [
    'node-host',
    ...Array.from({ length: 5 }, (_, index) => `node-worker-${index + 1}`),
  ].map((name) => ({ name, counts: [1, 0, 0] }));
test('U2 aggregation retains the entered cancellation Worker in exact five-Worker inventory', () => {
  assert.doesNotThrow(() => assertSessionNodeRealms(realmRows()));
});
test('U2 aggregation refuses missing, extra and duplicate Node realms', () => {
  const complete = realmRows();
  for (const malformed of [
    complete.slice(0, -1),
    [...complete, { name: 'node-worker-6', counts: [1] }],
    [...complete.slice(0, -1), complete[0]],
  ])
    assert.throws(
      () => assertSessionNodeRealms(malformed),
      /exact Node realm inventory/,
    );
});
test('U2 aggregation refuses a spawned realm that never executed its bootstrap', () => {
  const incomplete = realmRows();
  incomplete[4].counts = [0, 0, 0];
  assert.throws(
    () => assertSessionNodeRealms(incomplete),
    /unregistered Node realm: node-worker-4/,
  );
});
test('completion fake executor runs commands sequentially in declared order', async () => {
  const observed: string[] = [];
  await sequential(commands, async (command) => {
    observed.push(command.args[0]);
  });
  assert.deepEqual(observed, ['1', '2', '3']);
});
test('completion fake executor stops after the first failed child', async () => {
  const observed: string[] = [];
  await assert.rejects(
    sequential(commands, async (command) => {
      observed.push(command.args[0]);
      if (command.args[0] === '2') throw Error('fixture child failed');
    }),
    /fixture child failed/,
  );
  assert.deepEqual(observed, ['1', '2']);
});
test('completion missing prerequisite starts no child', async () => {
  const saved = process.env.FORMICARIUM_CANDIDATE;
  delete process.env.FORMICARIUM_CANDIDATE;
  let spawned = false;
  try {
    await assert.rejects(
      runSessionCompletion({
        execute: async () => {
          spawned = true;
        },
      }),
      /inputs required/,
    );
    assert.equal(spawned, false);
  } finally {
    if (saved === undefined) delete process.env.FORMICARIUM_CANDIDATE;
    else process.env.FORMICARIUM_CANDIDATE = saved;
  }
});
