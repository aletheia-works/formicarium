import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { readConfigFile, validateTrustedCallers } from '../scripts/config.ts';
import { causeOf, fail, runCli } from '../scripts/errors.ts';
import {
  acceptMode,
  type ModeContext,
  modeFromEnvironment,
} from '../scripts/mode.ts';
import { withLayout } from './fixtures/work.ts';

const trusted = validateTrustedCallers(
  await readConfigFile('trusted-callers.json'),
);
const u8 = `owner/repo/${trusted.distributeCaller}@refs/heads/main`;
const context = (overrides: Partial<ModeContext>): ModeContext => ({
  inputMode: 'distribute',
  eventName: 'push',
  ref: 'refs/heads/main',
  workflowRef: u8,
  repository: 'owner/repo',
  ...overrides,
});
const refused = (overrides: Partial<ModeContext>) =>
  assert.throws(
    () => acceptMode(context(overrides), trusted),
    (error) => causeOf(error) === 'mode-rejected',
  );

test('every direct trigger without a mode input stays verify', () => {
  for (const eventName of ['pull_request', 'push', 'workflow_dispatch'])
    assert.equal(
      acceptMode(
        context({
          inputMode: '',
          eventName,
          workflowRef:
            'owner/repo/.github/workflows/showcase.yml@refs/heads/main',
        }),
        trusted,
      ),
      'verify',
    );
  assert.equal(
    acceptMode(context({ inputMode: undefined }), trusted),
    'verify',
  );
  assert.equal(
    acceptMode(
      context({ inputMode: 'verify', eventName: 'pull_request' }),
      trusted,
    ),
    'verify',
  );
});

test('distribute is accepted only from main U8 started by push or workflow_dispatch', () => {
  assert.equal(acceptMode(context({}), trusted), 'distribute');
  assert.equal(
    acceptMode(context({ eventName: 'workflow_dispatch' }), trusted),
    'distribute',
  );
});

test('distribute from pull_request, schedule or another event is refused', () => {
  for (const eventName of [
    'pull_request',
    'schedule',
    'pull_request_target',
    undefined,
  ])
    refused({ eventName });
});

test('distribute outside main or from another workflow is refused', () => {
  refused({ ref: 'refs/heads/feature' });
  refused({
    workflowRef: 'owner/repo/.github/workflows/showcase.yml@refs/heads/main',
  });
  refused({
    workflowRef: `${u8.replace('@refs/heads/main', '')}@refs/heads/feature`,
  });
  refused({
    workflowRef: `fork/repo/${trusted.distributeCaller}@refs/heads/main`,
  });
  refused({ repository: undefined });
  refused({ inputMode: 'publish' });
});

test('CLI steps record success or the cause code in the job summary only', async (t) => {
  await withLayout(async (layout) => {
    const summary = join(layout.root, 'summary.md');
    await mkdir(layout.root, { recursive: true });
    const errors: unknown[] = [];
    t.mock.method(console, 'error', (...args: unknown[]) =>
      errors.push(args.join(' ')),
    );
    const before = process.exitCode;
    assert.equal(
      await runCli('ok step', async () => undefined, {
        GITHUB_STEP_SUMMARY: summary,
      }),
      true,
    );
    assert.equal(
      await runCli(
        'bad step',
        async () => fail('rate-limit', 'GitHub API answered 429'),
        {
          GITHUB_STEP_SUMMARY: summary,
        },
      ),
      false,
    );
    process.exitCode = before;
    assert.equal(
      await readFile(summary, 'utf8'),
      '- ok step: success\n- bad step: failed (`rate-limit`)\n',
    );
    assert.deepEqual(errors, [
      'bad step failed: rate-limit: GitHub API answered 429',
    ]);
  });
});

test('the context is read from the GitHub Actions environment', () => {
  assert.deepEqual(
    modeFromEnvironment({
      SHOWCASE_MODE: 'distribute',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_WORKFLOW_REF: u8,
      GITHUB_REPOSITORY: 'owner/repo',
    }),
    context({}),
  );
});
