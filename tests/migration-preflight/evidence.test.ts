import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  PreflightEvidence,
  Trial,
} from '../../scripts/migration-preflight/evidence.js';
import {
  assessEvidence,
  BASELINE_SOURCE,
  BROWSERS,
  TOOLS,
} from '../../scripts/migration-preflight/evidence.js';

function fixture(): PreflightEvidence {
  return {
    schemaVersion: 1,
    evidenceId: 'fixture-only',
    sourceCommit: 'a'.repeat(40),
    recordedAt: '2026-10-12T12:00:00+09:00',
    environment: { host: 'fixture' },
    trials: TOOLS.flatMap((tool) =>
      BROWSERS.flatMap((browser) =>
        Array.from({ length: 6 }, (_, trial) => ({
          tool,
          browser,
          trial: trial as Trial['trial'],
          version: '1.0.0',
          url: `https://example.org/${tool}`,
          finalUrl: `https://example.org/${tool}`,
          digest: 'b'.repeat(64),
          cors: 'passed' as const,
          exitCode: 0,
          stdoutDigest: 'c'.repeat(64),
          phasesMs: {
            fetch: 5000,
            extract: 100,
            digest: 100,
            validate: 100,
            register: 100,
            run: trial === 0 ? 6000 : 100,
          },
        })),
      ),
    ),
    baseline: {
      source: { ...BASELINE_SOURCE },
      buildKey: 'd'.repeat(64),
      firstDigest: 'e'.repeat(64),
      reusedDigest: 'e'.repeat(64),
      compileSkipped: true,
      versionExitCode: 0,
      ciRunUrl: 'https://github.com/example/vivarium/actions/runs/123',
    },
  };
}
test('36 rows aggregate cold, median, maximum and fetch separately', () => {
  const summary = assessEvidence(fixture());
  assert.equal(summary.length, 6);
  assert.equal(summary[0].firstNonDownloadMs, 6400);
  assert.equal(summary[0].medianNonDownloadMs, 500);
  assert.equal(summary[0].maxNonDownloadMs, 6400);
  assert.deepEqual(summary[0].fetchMs, Array(6).fill(5000));
});
test('missing and duplicate trials cannot improve the median', () => {
  const evidence = fixture();
  assert.throws(
    () => assessEvidence({ ...evidence, trials: evidence.trials.slice(1) }),
    /36/,
  );
  assert.throws(
    () =>
      assessEvidence({
        ...evidence,
        trials: [...evidence.trials.slice(1), evidence.trials[1]],
      }),
    /duplicate/,
  );
});
test('failed CORS or nonzero exit in a cold trial rejects the whole evidence', () => {
  for (const change of [{ cors: 'failed' }, { exitCode: 1 }]) {
    const evidence = fixture();
    Object.assign(evidence.trials[0], change);
    assert.throws(() => assessEvidence(evidence), /CORS and exit/);
  }
});
test('3000ms median is inclusive and an increase is rejected', () => {
  const evidence = fixture();
  for (const trial of evidence.trials) trial.phasesMs.run = 2600;
  assert.equal(assessEvidence(evidence)[0].medianNonDownloadMs, 3000);
  for (const trial of evidence.trials) trial.phasesMs.run = 2600.001;
  assert.throws(() => assessEvidence(evidence), /median exceeds/);
});
test('negative, nonfinite, missing and summed overflow timings reject', () => {
  for (const time of [-1, NaN, Infinity, undefined, Number.MAX_VALUE]) {
    const evidence = fixture();
    Object.assign(evidence.trials[0].phasesMs, {
      run: time,
      extract: time === Number.MAX_VALUE ? time : 100,
    });
    assert.throws(() => assessEvidence(evidence), /time|overflow/);
  }
});
test('baseline identity, key, digest, reuse and CI URL are mandatory', () => {
  for (const change of [
    { source: { ...BASELINE_SOURCE, commit: 'f'.repeat(40) } },
    { buildKey: 'bad' },
    { reusedDigest: 'f'.repeat(64) },
    { compileSkipped: false },
    { versionExitCode: 1 },
    { ciRunUrl: 'https://example.org/actions/runs/123' },
  ]) {
    const evidence = fixture();
    Object.assign(evidence.baseline, change);
    assert.throws(() => assessEvidence(evidence), /baseline/);
  }
});
test('schema, timestamp, environment and source identity reject malformed values', () => {
  for (const change of [
    { schemaVersion: 2 },
    { sourceCommit: 'main' },
    { recordedAt: '2026-10-12T12:00:00' },
    { environment: {} },
    { environment: { host: '' } },
    { evidenceId: 'x'.repeat(129) },
  ])
    assert.throws(() => assessEvidence({ ...fixture(), ...change }));
});
test('fixed version, digest and stdout identity cannot change between trials', () => {
  for (const change of [
    { version: '2.0.0' },
    { digest: 'f'.repeat(64) },
    { stdoutDigest: 'f'.repeat(64) },
  ]) {
    const evidence = fixture();
    Object.assign(evidence.trials[1], change);
    assert.throws(() => assessEvidence(evidence), /identity mismatch/);
  }
});
test('credentials, non-HTTPS URLs, unknown combinations and invalid digest reject', () => {
  for (const change of [
    { url: 'https://secret@example.org/aube' },
    { finalUrl: 'http://example.org/aube' },
    { browser: 'safari' },
    { tool: 'unknown' },
    { trial: 6 },
    { digest: 'A'.repeat(64) },
  ]) {
    const evidence = fixture();
    Object.assign(evidence.trials[0], change);
    assert.throws(() => assessEvidence(evidence));
  }
});
