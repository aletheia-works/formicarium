import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRelativePath } from '../src/model/model-error.ts';

/** showcase/site/ (this file lives in showcase/site/scripts/). */
export const SITE_ROOT = fileURLToPath(new URL('../', import.meta.url));
/** showcase/ (U7) and the repository root. */
export const SHOWCASE_DIR = resolve(SITE_ROOT, '..');
export const REPOSITORY_DIR = resolve(SHOWCASE_DIR, '..');

/** Cause codes of the site scripts; every failure carries exactly one. */
export type SiteCause =
  | 'config-invalid'
  | 'candidate-unavailable'
  | 'candidate-mismatch'
  | 'pack-invalid'
  | 'fixture-invalid'
  | 'notices-missing'
  | 'csp-invalid'
  | 'site-check'
  | 'inventory-mismatch'
  | 'evidence-invalid'
  | 'deploy-refused'
  | 'api-failed'
  | 'deployment-mismatch'
  | 'stale-deploy'
  | 'required-failed'
  | 'build-failed';

export class SiteError extends Error {
  readonly code: SiteCause;
  constructor(code: SiteCause, message: string, options?: { cause?: unknown }) {
    super(`${code}: ${message}`, options);
    this.name = 'SiteError';
    this.code = code;
  }
}

export function fail(code: SiteCause, message: string, cause?: unknown): never {
  throw new SiteError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

/** owner/repo; neither part may start with a dot (`..`, `.github`). */
export const REPOSITORY_SLUG = /^[A-Za-z0-9][\w-]*\/[A-Za-z0-9_][\w.-]*$/;

/** URLs in logs and summaries never carry a query or fragment (NFR8.6). */
export function withoutQuery(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw.replace(/[?#].*$/, '');
  }
}

/** Removes the query and fragment of every URL in a free text line. */
export const redactUrls = (text: string) =>
  text.replace(/https?:\/\/[^\s'"<>)]+/g, (url) => withoutQuery(url));

/** The gitignored work directory of the site build. */
export function siteLayout(work = join(SITE_ROOT, '.work'), site = SITE_ROOT) {
  return Object.freeze({
    work,
    candidate: join(work, 'inputs', 'candidate'),
    resolve: join(work, 'inputs', 'resolve'),
    pack: join(work, 'inputs', 'resolve', 'pack'),
    build: join(work, 'build'),
    siteData: join(work, 'build', 'site-data.json'),
    modules: join(work, 'build', 'bundle-modules.json'),
    logs: join(work, 'logs'),
    coverage: join(work, 'coverage'),
    sourcemaps: join(work, 'sourcemaps'),
    evidence: join(work, 'evidence'),
    accept: join(work, 'accept'),
    public: join(site, 'public'),
    dist: join(site, 'dist'),
  });
}
export type SiteLayout = ReturnType<typeof siteLayout>;

export async function writeText(path: string, text: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
export const writeJsonFile = (path: string, value: unknown) =>
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);

/** Writes downloaded files below a directory; every path is checked first. */
export async function writeTree(
  directory: string,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  for (const [path, bytes] of files) {
    checkRelativePath('inventory-invalid', path, 4096);
    await writeText(join(directory, path), bytes);
  }
}

/** Appends to the job summary when GitHub Actions provides one. */
export async function summary(
  lines: string | readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!env.GITHUB_STEP_SUMMARY) return;
  const text = typeof lines === 'string' ? lines : lines.join('\n');
  await appendFile(env.GITHUB_STEP_SUMMARY, `${redactUrls(text)}\n`);
}

const codeOf = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code)
    : 'unexpected';

/**
 * CLI wrapper: the step result and cause code go to the job summary, the
 * message (URLs without query) to stderr, exit code 1. Nothing is retried.
 */
export async function runCli(
  step: string,
  main: () => Promise<void>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  try {
    await main();
    await summary(`- ${step}: success`, env);
    return true;
  } catch (error) {
    await summary(`- ${step}: failed (\`${codeOf(error)}\`)`, env);
    const message = error instanceof Error ? error.message : codeOf(error);
    console.error(`${step} failed: ${redactUrls(message)}`);
    process.exitCode = 1;
    return false;
  }
}

/** `--name value` options of a CLI; unknown names are a configuration error. */
export function parseOptions(
  argv: readonly string[],
  names: readonly string[],
): Record<string, string> {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, '');
    const value = argv[index + 1];
    if (!name || !names.includes(name) || value === undefined)
      fail('config-invalid', `unknown or incomplete option ${argv[index]}`);
    options[name] = value;
  }
  return options;
}
