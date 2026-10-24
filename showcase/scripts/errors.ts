import { appendFile } from 'node:fs/promises';

/**
 * Cause codes recorded in job summaries and logs. Every failure of a
 * showcase step carries exactly one of them; nothing is retried.
 */
export const CAUSE_CODES = Object.freeze([
  'config-invalid',
  'source-not-allowed',
  'http-status',
  'offline',
  'rate-limit',
  'redirect',
  'size-limit',
  'size-mismatch',
  'bad-body',
  'deadline',
  'checksum-mismatch',
  'archive-invalid',
  'elf-invalid',
  'release-invalid',
  'tag-mismatch',
  'commit-unreachable',
  'toolchain-unavailable',
  'build-failed',
  'build-timeout',
  'catalog-invalid',
  'release-unavailable',
  'pack-mismatch',
  'boundary-violation',
  'acceptance-row-missing',
  'mode-rejected',
  'output-exists',
] as const);
export type CauseCode = (typeof CAUSE_CODES)[number];

export class ShowcaseError extends Error {
  readonly code: CauseCode;
  constructor(code: CauseCode, message: string, options?: { cause?: unknown }) {
    super(`${code}: ${message}`, options);
    this.name = 'ShowcaseError';
    this.code = code;
  }
}

export function fail(code: CauseCode, message: string, cause?: unknown): never {
  throw new ShowcaseError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

/** Unknown errors stay distinguishable from classified showcase failures. */
export function causeOf(error: unknown): CauseCode | 'unexpected' {
  return error instanceof ShowcaseError ? error.code : 'unexpected';
}

/**
 * CLI wrapper: writes the step result and cause code to the job summary and
 * prints only the message (never a response body or a token), exit code 1.
 */
export async function runCli(
  step: string,
  main: () => Promise<void>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const summary = async (line: string) => {
    if (env.GITHUB_STEP_SUMMARY)
      await appendFile(env.GITHUB_STEP_SUMMARY, `${line}\n`);
  };
  try {
    await main();
    await summary(`- ${step}: success`);
    return true;
  } catch (error) {
    const code = causeOf(error);
    await summary(`- ${step}: failed (\`${code}\`)`);
    console.error(
      `${step} failed: ${error instanceof Error ? error.message : code}`,
    );
    process.exitCode = 1;
    return false;
  }
}
