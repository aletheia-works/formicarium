import { appendFile } from 'node:fs/promises';
import {
  readConfigFile,
  type TrustedCallers,
  validateTrustedCallers,
} from './config.ts';
import { fail, runCli } from './errors.ts';

export type Mode = 'verify' | 'distribute';
export interface ModeContext {
  /** `inputs.mode` of workflow_call; empty for every other trigger. */
  inputMode: string | undefined;
  eventName: string | undefined;
  ref: string | undefined;
  workflowRef: string | undefined;
  repository: string | undefined;
}

/**
 * In a called workflow the github context belongs to the caller, so
 * distribute is accepted only when main's trusted U8 workflow, started by
 * schedule or workflow_dispatch on main, asked for it. Every direct trigger
 * of showcase.yml (pull_request, push, workflow_dispatch) has no mode input
 * and stays verify.
 */
export function acceptMode(
  context: ModeContext,
  trusted: TrustedCallers,
): Mode {
  const mode = context.inputMode ?? '';
  if (mode === '' || mode === 'verify') return 'verify';
  if (mode !== 'distribute') fail('mode-rejected', `unknown mode ${mode}`);
  if (
    context.eventName !== 'schedule' &&
    context.eventName !== 'workflow_dispatch'
  )
    fail('mode-rejected', `distribute refused for event ${context.eventName}`);
  if (context.ref !== 'refs/heads/main')
    fail('mode-rejected', 'distribute requires refs/heads/main');
  if (!context.repository || !/^[\w.-]+\/[\w.-]+$/.test(context.repository))
    fail('mode-rejected', 'repository unknown');
  const expected = `${context.repository}/${trusted.distributeCaller}@refs/heads/main`;
  if (context.workflowRef !== expected)
    fail('mode-rejected', 'distribute caller is not the trusted main workflow');
  return 'distribute';
}

export function modeFromEnvironment(env: NodeJS.ProcessEnv): ModeContext {
  return {
    inputMode: env.SHOWCASE_MODE,
    eventName: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    workflowRef: env.GITHUB_WORKFLOW_REF,
    repository: env.GITHUB_REPOSITORY,
  };
}

if (import.meta.main)
  await runCli('mode', async () => {
    const mode = acceptMode(
      modeFromEnvironment(process.env),
      validateTrustedCallers(await readConfigFile('trusted-callers.json')),
    );
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
    console.log(`mode=${mode}`);
  });
