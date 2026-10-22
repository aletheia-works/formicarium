import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export async function createFreshResultsDirectory(output: string) {
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
}

export const REQUIRED_CHECKS = Object.freeze([
  'release',
  'node-regression',
  'browser-regression',
  'native-aube',
  'native-pitchfork',
  'package-coverage-node',
  'package-coverage-browser',
]);
export interface FilePin {
  path: string;
  bytes: number;
  sha256: string;
}

export interface InputManifest {
  schemaVersion: 1;
  repository: string;
  sourceCommit: string;
  sourceFiles: FilePin[];
  files: FilePin[];
  tarball: string;
  packageManifest: string;
  packageRoot: string;
  coreCommit: string;
  guests: { aube: string; pitchfork: string };
}
export interface CheckResult {
  id: string;
  exitCode: number | null;
  timedOut: boolean;
  skipped: number;
  passed: number;
  command: string[];
}
export const hash = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
export function safePath(path: string) {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw Error(`invalid relative input path: ${path}`);
  return path;
}
export function validateManifest(
  input: InputManifest,
  context: { repository: string; commit: string; event: string; ref: string },
) {
  if (
    !['push', 'workflow_dispatch'].includes(context.event) ||
    !context.ref.startsWith('refs/heads/codex/verify/')
  )
    throw Error('untrusted CI execution source');
  validateManifestContents(input, context);
}
export function validateManifestContents(
  input: InputManifest,
  context: { repository: string; commit: string },
) {
  if (
    input.schemaVersion !== 1 ||
    input.repository !== context.repository ||
    input.sourceCommit !== context.commit ||
    !/^[a-f0-9]{40}$/.test(input.sourceCommit)
  )
    throw Error('candidate source commit differs');
  if (
    !/^[a-f0-9]{40}$/.test(input.coreCommit) ||
    input.guests.aube !== 'v2.7.0' ||
    input.guests.pitchfork !== 'v2.30.1'
  )
    throw Error('core or guest version differs');
  for (const key of ['tarball', 'packageManifest', 'packageRoot'] as const)
    safePath(input[key]);
  for (const rows of [input.files, input.sourceFiles]) {
    if (
      !Array.isArray(rows) ||
      !rows.length ||
      new Set(rows.map((row) => row.path)).size !== rows.length
    )
      throw Error('file inventory missing or duplicated');
    for (const row of rows)
      if (
        !safePath(row.path) ||
        !Number.isSafeInteger(row.bytes) ||
        row.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(row.sha256)
      )
        throw Error('invalid file pin');
  }
  for (const required of [
    input.tarball,
    input.packageManifest,
    'assets/blink.wasm',
    'assets/blink.mjs',
    'assets/build-info.json',
    'dist/guests/probe',
    'dist/guests/aube',
    'dist/guests/pitchfork',
    '.artifacts/ci-candidate/provenance/aube.json',
    '.artifacts/ci-candidate/provenance/pitchfork.json',
    'fixtures/baseline/aube-1645.native.txt',
    'fixtures/baseline/pitchfork-basic.native.txt',
  ])
    if (!input.files.some((row) => row.path === required))
      throw Error(`required input missing: ${required}`);
}
export async function verifyPins(root: string, pins: FilePin[]) {
  const canonical = await realpath(root);
  for (const pin of pins) {
    const path = resolve(root, safePath(pin.path));
    const actual = await realpath(path);
    if (
      relative(canonical, actual).startsWith(`..${sep}`) ||
      !(await lstat(path)).isFile()
    )
      throw Error(`input is not an owned regular file: ${pin.path}`);
    // Reject a symlink in any ancestor, not only escaping links.
    let prefix = root;
    for (const part of pin.path.split('/')) {
      prefix = resolve(prefix, part);
      if ((await lstat(prefix)).isSymbolicLink())
        throw Error(`symlink input: ${pin.path}`);
    }
    const bytes = await readFile(path);
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256)
      throw Error(`input bytes differ: ${pin.path}`);
  }
}
export function validateChecks(
  results: CheckResult[],
  required: readonly string[] = REQUIRED_CHECKS,
) {
  if (
    results.length !== required.length ||
    new Set(results.map((row) => row.id)).size !== results.length
  )
    throw Error('mandatory check inventory differs');
  for (const id of required) {
    const result = results.find((row) => row.id === id);
    if (
      result?.exitCode !== 0 ||
      result.timedOut ||
      result.skipped !== 0 ||
      result.passed < 1
    )
      throw Error(`mandatory check failed or unmeasured: ${id}`);
  }
}
/** The package coverage report must cover exactly the distributed JS of this tarball. */
export function validateCoverage(
  report: {
    candidateSha256: string;
    passed: boolean;
    lines: { total: number; covered: number; skipped: number; pct: number };
    files: { path: string }[];
  },
  expected: { files: readonly string[]; tarballSha256: string },
) {
  if (
    !report.passed ||
    JSON.stringify(report.files.map((row) => row.path).sort()) !==
      JSON.stringify([...expected.files].sort()) ||
    report.lines.pct < 80 ||
    report.lines.skipped !== 0 ||
    report.lines.total < 1
  )
    throw Error('package coverage failed');
  if (report.candidateSha256 !== expected.tarballSha256)
    throw Error('package coverage measured another tarball');
}
/**
 * verify.yml runs only by hand. Its one secret is the read-only GitHub token
 * that the credential job checks with GET requests; nothing may publish.
 */
export function validateWorkflow(text: string) {
  const secrets = text.match(/secrets\.[A-Za-z0-9_]+/g) ?? [];
  if (
    !text.includes('contents: read') ||
    !text.includes('persist-credentials: false') ||
    !/^on:\n {2}workflow_dispatch:\n/m.test(text) ||
    /^ {2}(push|pull_request|schedule|workflow_run):/m.test(text) ||
    secrets.some((name) => name !== 'secrets.TF_TOKEN_GITHUB') ||
    /pull_request_target|id-token: write|contents: write|packages: write|npm publish|NPM_TOKEN|gh release/.test(
      text,
    )
  )
    throw Error('unsafe verification workflow');
}

export function parseTestSummary(
  stdout: string,
  stderr: string,
): { passed: number; skipped: number } {
  const text = `${stdout}\n${stderr}`;
  const tap = text.match(/^# pass (\d+)\s*$/m);
  const node = text.match(/^ℹ pass (\d+)\s*$/m);
  if (tap || node) {
    const skip = text.match(/^(?:#|ℹ) skipped (\d+)\s*$/m);
    if (!skip) throw Error('test summary has no skip accounting');
    return { passed: Number((tap ?? node)![1]), skipped: Number(skip[1]) };
  }
  const bun = text.match(/^\s*(\d+) pass\s*$/m);
  if (bun && /^\s*\d+ fail\s*$/m.test(text)) {
    return {
      passed: Number(bun[1]),
      skipped: Number(text.match(/^\s*(\d+) skip(?:ped)?\s*$/m)?.[1] ?? 0),
    };
  }
  const playwright = text.match(/^\s*(\d+) passed(?:\s|$)/m);
  if (playwright)
    return {
      passed: Number(playwright[1]),
      skipped: Number(text.match(/^\s*(\d+) skipped(?:\s|$)/m)?.[1] ?? 0),
    };
  throw Error('recognized test summary required');
}
