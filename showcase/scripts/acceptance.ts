import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUniqueJson } from './build-key.ts';
import { fail } from './errors.ts';

/** Site acceptance profile: tool-*-version must exist once per environment. */
export const ENVIRONMENTS = Object.freeze([
  'node',
  'chromium',
  'firefox',
  'webkit',
  'safari',
] as const);
export type EnvironmentId = (typeof ENVIRONMENTS)[number];
export const MAX_LOGGED_OUTPUT = 1024;

export interface AcceptanceRow {
  name: string;
  tool: string;
  environment: EnvironmentId;
  status: 'passed' | 'failed';
  expectedVersion: string;
  exitCode: number | null;
  stdout: string;
  cause: string | null;
  installMs: number | null;
  versionMs: number | null;
}
export interface EnvironmentRecord {
  environment: EnvironmentId;
  observed: Readonly<Record<string, string>>;
}
export interface AcceptancePart {
  schemaVersion: 1;
  environment: EnvironmentRecord;
  rows: AcceptanceRow[];
}
export interface AcceptanceLog {
  schemaVersion: 1;
  runId: string | null;
  runAttempt: string | null;
  recordedAt: string;
  environments: EnvironmentRecord[];
  rows: AcceptanceRow[];
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The selected version must appear as a whole version token in stdout. */
export function versionMatches(stdout: string, version: string): boolean {
  return new RegExp(
    `(?:^|[^0-9A-Za-z.])v?${escapeRegExp(version)}(?:[^0-9A-Za-z.]|$)`,
    'm',
  ).test(stdout);
}

export interface Observation {
  tool: string;
  environment: EnvironmentId;
  expectedVersion: string;
  exitCode: number | null;
  stdout: string;
  installMs: number | null;
  versionMs: number | null;
  error?: string | null;
}

/** Each tool x environment is its own row; any failure is recorded, not hidden. */
export function judgeRow(observation: Observation): AcceptanceRow {
  const matched =
    !observation.error &&
    observation.exitCode === 0 &&
    versionMatches(observation.stdout, observation.expectedVersion);
  return {
    name: `tool-${observation.tool}-version`,
    tool: observation.tool,
    environment: observation.environment,
    status: matched ? 'passed' : 'failed',
    expectedVersion: observation.expectedVersion,
    exitCode: observation.exitCode,
    stdout: observation.stdout.slice(0, MAX_LOGGED_OUTPUT),
    cause: matched
      ? null
      : (observation.error ??
        (observation.exitCode !== 0 ? 'nonzero-exit' : 'version-mismatch')),
    installMs: observation.installMs,
    versionMs: observation.versionMs,
  };
}

/** Exactly tools x 5 environments, each passed once; otherwise no candidate. */
export function requireAllRows(
  rows: readonly AcceptanceRow[],
  tools: readonly { tool: string; version: string }[],
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.tool}/${row.environment}`;
    if (seen.has(key)) fail('acceptance-row-missing', `duplicate row ${key}`);
    seen.add(key);
  }
  for (const { tool, version } of tools)
    for (const environment of ENVIRONMENTS) {
      const row = rows.find(
        (item) => item.tool === tool && item.environment === environment,
      );
      if (!row)
        fail('acceptance-row-missing', `${tool}/${environment} missing`);
      if (row.status !== 'passed')
        fail('acceptance-row-missing', `${tool}/${environment} ${row.cause}`);
      if (row.expectedVersion !== version)
        fail('acceptance-row-missing', `${tool}/${environment} other version`);
    }
  if (rows.length !== tools.length * ENVIRONMENTS.length)
    fail('acceptance-row-missing', 'unexpected acceptance rows');
}

/** Merges the per-environment parts written by the Node, Playwright and Safari runs. */
export async function readAcceptanceParts(
  directory: string,
): Promise<AcceptancePart[]> {
  const parts: AcceptancePart[] = [];
  for (const name of (await readdir(directory)).sort()) {
    if (!/^(node|chromium|firefox|webkit|safari)\.json$/.test(name)) continue;
    const part = parseUniqueJson(
      await readFile(join(directory, name), 'utf8'),
    ) as AcceptancePart;
    if (part.schemaVersion !== 1 || !Array.isArray(part.rows))
      fail('acceptance-row-missing', `${name} is not an acceptance part`);
    parts.push(part);
  }
  return parts;
}

export function mergeAcceptance(
  parts: readonly AcceptancePart[],
  context: {
    runId: string | null;
    runAttempt: string | null;
    recordedAt: string;
  },
): AcceptanceLog {
  return {
    schemaVersion: 1,
    ...context,
    environments: parts.map((part) => part.environment),
    rows: parts.flatMap((part) => part.rows),
  };
}
