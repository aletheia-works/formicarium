import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
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
  'u1-node',
  'u1-browser',
  'u3-node',
  'u3-browser',
]);
export interface FilePin {
  path: string;
  bytes: number;
  sha256: string;
}

export async function provisionPreparedResolver(
  root: string,
  pins: FilePin[],
  preparedOut: string,
) {
  const prefix = '.artifacts/ci-candidate/inputs/resolver/';
  const modules = ['manifest.js', 'fixtures.js', 'resolver.js'];
  const selected = pins.filter((row) =>
    modules.some((name) => row.path === prefix + name),
  );
  if (
    selected.length !== modules.length ||
    new Set(selected.map((row) => row.path)).size !== modules.length
  )
    throw Error('prepared resolver module inventory missing or duplicate');
  await verifyPins(root, selected);
  const destination = resolve(
    preparedOut,
    'terrarium/.vendor/formicarium-inputs/resolver',
  );
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination); // Never replace a previous prepared resolver.
  const rebased = selected.map((row) => ({
    ...row,
    path: safePath(row.path.slice(prefix.length)),
  }));
  for (let index = 0; index < selected.length; index++) {
    const target = resolve(destination, rebased[index]!.path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(root, selected[index]!.path), target, {
      force: false,
      errorOnExist: true,
    });
  }
  await verifyPins(destination, rebased);
  return destination;
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
  site: string;
  terrarium: string;
  coreCommit: string;
  guests: { aube: string; pitchfork: string };
  owner: { baselineCommit: string; integrationSourceIdentity: string };
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
  if (
    !/^[a-f0-9]{40}$/.test(input.owner.baselineCommit) ||
    !/^[a-f0-9]{64}$/.test(input.owner.integrationSourceIdentity)
  )
    throw Error('owner provenance missing');
  const ownerSource = input.files
    .filter((row) =>
      row.path.startsWith(`${input.terrarium}/packages/terrarium/src/`),
    )
    .map((row) => ({ path: row.path, sha256: row.sha256 }));
  if (
    !ownerSource.length ||
    hash(JSON.stringify(ownerSource)) !== input.owner.integrationSourceIdentity
  )
    throw Error('owner copy source identity differs');
  for (const key of [
    'tarball',
    'packageManifest',
    'packageRoot',
    'site',
    'terrarium',
  ] as const)
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
    `${input.terrarium}/web/terminal.mjs`,
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
export function validateChecks(results: CheckResult[]) {
  if (
    results.length !== REQUIRED_CHECKS.length ||
    new Set(results.map((row) => row.id)).size !== results.length
  )
    throw Error('mandatory check inventory differs');
  for (const id of REQUIRED_CHECKS) {
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
export function validateCoverage(
  report: {
    passed: boolean;
    fixedInventory: string[];
    lines: { total: number; covered: number; skipped: number; pct: number };
    freshReceipts: {
      realm: string;
      project?: string;
      executionIdentity: string;
      generation: string;
    }[];
    executionIdentity: string;
    generation: string;
    componentImport: {
      originalTarballSha256: string;
      originalRealmNames: string[];
    };
  },
  expected: {
    files: readonly string[];
    tarballSha256: string;
    u1Realms: readonly string[];
  },
) {
  if (
    !report.passed ||
    JSON.stringify(report.fixedInventory) !== JSON.stringify(expected.files) ||
    report.lines.pct < 80 ||
    report.lines.skipped !== 0 ||
    report.lines.total < 1
  )
    throw Error('fixed24 coverage failed');
  if (
    !report.executionIdentity ||
    !report.generation ||
    report.freshReceipts.length !== 46 ||
    report.freshReceipts.some(
      (row) =>
        row.executionIdentity !== report.executionIdentity ||
        row.generation !== report.generation,
    )
  )
    throw Error('fresh receipt identity differs');
  if (
    !report.freshReceipts.some((row) => row.realm === 'node-host') ||
    ['chromium', 'firefox', 'webkit'].some(
      (project) =>
        report.freshReceipts.filter((row) => row.project === project).length !==
        15,
    )
  )
    throw Error('mandatory realm missing');
  if (
    report.componentImport.originalTarballSha256 !== expected.tarballSha256 ||
    JSON.stringify([...report.componentImport.originalRealmNames].sort()) !==
      JSON.stringify([...expected.u1Realms].sort())
  )
    throw Error('U1 same-pack realm binding differs');
}
export function validateWorkflow(text: string) {
  if (
    !text.includes('contents: read') ||
    !text.includes('persist-credentials: false') ||
    !text.includes("branches: ['codex/verify/**']") ||
    /pull_request_target|id-token: write|contents: write|packages: write|npm publish|NPM_TOKEN|gh release|secrets\./.test(
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
