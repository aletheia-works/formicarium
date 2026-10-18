import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { assertInstallTestOutput } from '../migration-install/completion.js';
import { assessEvidence } from '../migration-preflight/evidence.js';
import type { Command } from '../migration-session/completion.js';
import { sha256 } from '../package/stage-package.js';

/** C06/C10 fixed B1 profile: six checks per environment E, seven host checks. */
export const B1_ENVIRONMENTS = Object.freeze([
  'node',
  'chromium',
  'firefox',
  'webkit',
] as const);
export const B1_PER_ENVIRONMENT = Object.freeze([
  'guest-validation',
  'fixture-validation',
  'handle-copy',
  'install-lifecycle',
  'command-behavior',
  'package-consumer',
] as const);
export const B1_HOST = Object.freeze([
  'types',
  'package-inventory',
  'source-baseline',
  'coverage-80',
  'probe-eight',
  'aube-native-match',
  'wasm-memory-cap',
] as const);
export const B1_PREFLIGHT_PATH =
  'docs/results/terrarium-migration-preflight-evidence/acceptance-evidence.json';
type Environment = (typeof B1_ENVIRONMENTS)[number] | 'host';
export interface B1Check {
  name: string;
  environment: Environment;
  status: 'passed' | 'failed' | 'unverified';
  logSha256: string;
}
export interface ApiAcceptance {
  schemaVersion: 1;
  evidenceId: string;
  sourceCommit: string;
  packageVersion: '0.3.0';
  packSha256: string;
  inventorySha256: string;
  checks: readonly B1Check[];
  preflightEvidenceId: string;
}
export interface B1Identity {
  sourceCommit: string;
  packSha256: string;
  inventorySha256: string;
  preflightEvidenceId: string;
}
/** One completion command as observed: its label, exact command and raw log. */
export interface ObservedCommand extends Command {
  label: string;
  rawLogPath: string;
  rawLogSha256: string;
  exitCode: number;
}

/**
 * Which completion command's raw log evidences each B1 row. Browser rows use
 * the same Playwright log for all three projects and additionally require the
 * project's own `[project] ›` result lines in that log (list reporter).
 */
export const B1_SOURCES: Readonly<
  Record<
    string,
    { node?: string; browser?: string; host?: string; marker?: string }
  >
> = Object.freeze({
  'guest-validation': { node: 'session-unit', browser: 'session-browser' },
  'fixture-validation': { node: 'session-unit', browser: 'session-browser' },
  'handle-copy': { node: 'session-unit', browser: 'session-browser' },
  'install-lifecycle': { node: 'install-unit', browser: 'install-browser' },
  'command-behavior': { node: 'command-unit', browser: 'command-browser' },
  'package-consumer': { node: 'test-consumer', browser: 'command-browser' },
  types: { host: 'typecheck' },
  // Host markers are the titles of the tests that assert the property.
  'package-inventory': {
    host: 'command-unit',
    marker:
      'installed U4 exports C05 from the root and keeps parser and port modules private',
  },
  'source-baseline': {
    host: 'node-regression',
    marker: '取得物（.vendor/blink）の HEAD は blink.lock のコミットと一致し',
  },
  'coverage-80': { host: 'coverage-report', marker: '"passed":true' },
  'probe-eight': {
    host: 'browser-regression',
    marker: 'probe の全項目が PASS する',
  },
  'aube-native-match': {
    host: 'browser-regression',
    marker: 'aube #1645 の書き起こしが native と一致する',
  },
  // This build test asserts -sMAXIMUM_MEMORY=1GB in the recorded link flags.
  'wasm-memory-cap': {
    host: 'node-regression',
    marker: 'ビルド物は blink.lock のコミットから、JIT なしで作られている',
  },
});

const SHA256 = /^[a-f0-9]{64}$/;
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw Error(`U4 B1 ${message}`);
}
export function requiredB1Rows(): { name: string; environment: Environment }[] {
  return [
    ...B1_PER_ENVIRONMENT.flatMap((name) =>
      B1_ENVIRONMENTS.map((environment) => ({ name, environment })),
    ),
    ...B1_HOST.map((name) => ({ name, environment: 'host' as const })),
  ];
}
const rowKey = (row: { name: string; environment: string }) =>
  `${row.name}@${row.environment}`;

/** Structural C06 acceptance: every named field, the exact set, all passed. */
export function validateB1(
  value: unknown,
  expected: B1Identity,
): ApiAcceptance {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'object required',
  );
  const row = value as Record<string, unknown>;
  ensure(
    JSON.stringify(Object.keys(row).sort()) ===
      JSON.stringify(
        [
          'schemaVersion',
          'evidenceId',
          'sourceCommit',
          'packageVersion',
          'packSha256',
          'inventorySha256',
          'checks',
          'preflightEvidenceId',
        ].sort(),
      ),
    'named field missing/unknown',
  );
  ensure(row.schemaVersion === 1, 'schemaVersion');
  ensure(
    typeof row.evidenceId === 'string' &&
      row.evidenceId.length > 0 &&
      new TextEncoder().encode(row.evidenceId).length <= 128,
    'evidenceId',
  );
  ensure(
    typeof row.sourceCommit === 'string' &&
      /^[a-f0-9]{40}$/.test(row.sourceCommit) &&
      row.sourceCommit === expected.sourceCommit,
    'sourceCommit differs',
  );
  ensure(row.packageVersion === '0.3.0', 'packageVersion');
  for (const field of ['packSha256', 'inventorySha256'] as const)
    ensure(
      typeof row[field] === 'string' &&
        SHA256.test(row[field] as string) &&
        row[field] === expected[field],
      `${field} differs`,
    );
  ensure(
    row.preflightEvidenceId === expected.preflightEvidenceId,
    'preflightEvidenceId differs',
  );
  ensure(Array.isArray(row.checks), 'checks required');
  const required = new Set(requiredB1Rows().map(rowKey));
  const seen = new Set<string>();
  const checks: B1Check[] = [];
  for (const raw of row.checks as unknown[]) {
    ensure(raw !== null && typeof raw === 'object', 'check object required');
    const check = raw as Record<string, unknown>;
    ensure(
      JSON.stringify(Object.keys(check).sort()) ===
        JSON.stringify(['environment', 'logSha256', 'name', 'status']),
      'check field missing/unknown',
    );
    ensure(
      typeof check.environment === 'string' &&
        ([...B1_ENVIRONMENTS, 'host'] as string[]).includes(check.environment),
      'unknown environment',
    );
    ensure(typeof check.name === 'string', 'check name');
    const key = rowKey(check as { name: string; environment: string });
    ensure(required.has(key), `unknown check ${key}`);
    ensure(!seen.has(key), `duplicate check ${key}`);
    seen.add(key);
    ensure(check.status === 'passed', `check not passed ${key}`);
    ensure(
      typeof check.logSha256 === 'string' && SHA256.test(check.logSha256),
      `log digest ${key}`,
    );
    checks.push(check as unknown as B1Check);
  }
  ensure(seen.size === required.size, 'required check missing');
  return row as unknown as ApiAcceptance;
}

/** U1's accepted preflight record, structurally re-assessed before reuse of its id. */
export async function readPreflightEvidenceId(root: string): Promise<{
  evidenceId: string;
  sha256: string;
}> {
  const bytes = await readFile(resolve(root, B1_PREFLIGHT_PATH));
  const value = JSON.parse(bytes.toString('utf8'));
  assessEvidence(value);
  ensure(typeof value.evidenceId === 'string', 'preflight evidenceId');
  return { evidenceId: value.evidenceId, sha256: sha256(bytes) };
}

/** Re-reads a retained raw log and checks it is this run's real passing output. */
export async function observedLogDigest(
  observed: ObservedCommand,
  output: string,
  marker?: string,
): Promise<string> {
  const path = resolve(observed.rawLogPath);
  const inside = relative(resolve(output), path);
  ensure(
    inside && !inside.startsWith('..') && !isAbsolute(inside),
    `log outside this completion output: ${observed.label}`,
  );
  const bytes = await readFile(path);
  ensure(
    observed.exitCode === 0 && sha256(bytes) === observed.rawLogSha256,
    `log/exit differs: ${observed.label}`,
  );
  const text = bytes.toString('utf8');
  if (observed.label !== 'typecheck' && observed.label !== 'coverage-report')
    assertInstallTestOutput(text);
  if (marker) ensure(text.includes(marker), `log marker missing: ${marker}`);
  return observed.rawLogSha256;
}

/** Builds B1 rows only from logs that exist, re-hash, and pass for the row. */
export async function assembleB1(options: {
  evidenceId: string;
  identity: B1Identity;
  observed: readonly ObservedCommand[];
  expectedCommands: readonly { label: string; command: Command }[];
  output: string;
}): Promise<ApiAcceptance> {
  const byLabel = new Map<string, ObservedCommand>();
  for (const observed of options.observed) {
    ensure(!byLabel.has(observed.label), `duplicate log ${observed.label}`);
    byLabel.set(observed.label, observed);
  }
  const lookup = (label: string) => {
    const observed = byLabel.get(label);
    const planned = options.expectedCommands.find(
      (item) => item.label === label,
    );
    ensure(observed && planned, `missing log ${label}`);
    ensure(
      JSON.stringify([observed.executable, observed.args, observed.cwd]) ===
        JSON.stringify([
          planned.command.executable,
          planned.command.args,
          planned.command.cwd,
        ]),
      `log does not come from the U4 command ${label}`,
    );
    return observed;
  };
  const checks: B1Check[] = [];
  for (const { name, environment } of requiredB1Rows()) {
    const source = B1_SOURCES[name];
    ensure(source, `no source for ${name}`);
    const label =
      environment === 'host'
        ? source.host
        : environment === 'node'
          ? source.node
          : source.browser;
    ensure(label, `no ${environment} source for ${name}`);
    const marker =
      environment === 'host' || environment === 'node'
        ? source.marker
        : `[${environment}] ›`;
    checks.push({
      name,
      environment,
      status: 'passed',
      logSha256: await observedLogDigest(lookup(label), options.output, marker),
    });
  }
  const acceptance: ApiAcceptance = {
    schemaVersion: 1,
    evidenceId: options.evidenceId,
    sourceCommit: options.identity.sourceCommit,
    packageVersion: '0.3.0',
    packSha256: options.identity.packSha256,
    inventorySha256: options.identity.inventorySha256,
    checks,
    preflightEvidenceId: options.identity.preflightEvidenceId,
  };
  return validateB1(acceptance, options.identity);
}
