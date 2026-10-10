import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// This receipt describes observed dependency jobs, not publication authority.
// U3 obtains final ci-required and producer/run metadata independently via API.
const sourceSha = process.env.SOURCE_SHA ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';
const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
if (
  !/^[a-f0-9]{40}$/.test(sourceSha) ||
  !/^\d+$/.test(runId) ||
  !Number.isSafeInteger(runAttempt) ||
  runAttempt < 1
)
  throw Error('source/run/attempt receipt identity required');
const lockDigest = createHash('sha256')
  .update(await readFile('bun.lock'))
  .digest('hex');
const observedJobs = JSON.parse(process.env.OBSERVED_JOBS ?? '{}') as Record<
  string,
  { result: string }
>;
const jobs = ['quality', 'commit-format'].map((name) => {
  const state = observedJobs[name]?.result;
  if (!['success', 'failure', 'skipped', 'cancelled'].includes(state ?? ''))
    throw Error(`missing dependency job outcome: ${name}`);
  return { name, state, sourceSha, runId };
});
await mkdir('.artifacts/ordinary-ci', { recursive: true });
await writeFile(
  resolve('.artifacts/ordinary-ci/receipt.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      repository: process.env.GITHUB_REPOSITORY,
      sourceSha,
      runId,
      runAttempt,
      workflowIdentity: '.github/workflows/ci.yml',
      workflowRef: process.env.GITHUB_WORKFLOW_REF,
      purpose: 'ordinary-ci',
      expectedToolchain: { node: '24.21.0', bun: '1.4.2', lockDigest },
      receiptNodeVersion: process.versions.node,
      observedJobs: jobs,
      limits:
        'Final check conclusions, producer identity, executed SHA and artifact digest require independent GitHub API reconciliation.',
    },
    null,
    2,
  ),
);
