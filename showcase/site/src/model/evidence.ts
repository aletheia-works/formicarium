import { canonicalSha256 } from '../../../scripts/build-key.ts';
import {
  COMMIT_HEX,
  exactKeys,
  isRecord,
  reject,
  SHA256_HEX,
} from './model-error.ts';

export type EnvironmentId = 'node' | 'chromium' | 'firefox' | 'webkit' | 'host';
export type CheckStatus = 'passed' | 'failed' | 'unverified';
/** C10 CheckRow: logSha256 is the SHA256 of the check record file. */
export interface CheckRow {
  name: string;
  environment: EnvironmentId;
  status: CheckStatus;
  logSha256: string;
}
/** C10 SiteEvidenceIdentity. */
export interface SiteEvidenceIdentity {
  sourceCommit: string;
  formicariumSourceCommit: string;
  formicariumPackSha256: string;
  candidateId: string;
  catalogSha256: string;
  fixtureInventorySha256: string;
  siteInventorySha256: string;
}
/** One check record: what was read, from which log, for which identity. */
export interface CheckRecord {
  schemaVersion: 1;
  name: string;
  environment: EnvironmentId;
  status: CheckStatus;
  identityDigest: string;
  sources: { path: string; sha256: string }[];
  facts: Record<string, unknown>;
}
/** C10 AcceptanceEvidence for unit u8-showcase-site. */
export interface AcceptanceEvidence {
  schemaVersion: 1;
  evidenceId: string;
  unit: 'u8-showcase-site';
  sourceCommit: string;
  recordedAt: string;
  identity: SiteEvidenceIdentity;
  checks: CheckRow[];
  outputs: { path: string; digest: string }[];
  deployedIdentity?: string;
}

const BROWSERS: readonly EnvironmentId[] = ['chromium', 'firefox', 'webkit'];
const ALL: readonly EnvironmentId[] = ['node', ...BROWSERS];
const ENVIRONMENTS: readonly EnvironmentId[] = [...ALL, 'host'];
const STATUSES: readonly CheckStatus[] = ['passed', 'failed', 'unverified'];

/** C06/C10 U8 profile: the 27 required (name, environment) rows. */
export const REQUIRED_ROWS: readonly {
  name: string;
  environment: EnvironmentId;
}[] = Object.freeze([
  ...[
    'tool-aube-version',
    'tool-pitchfork-version',
    'tool-biome-version',
  ].flatMap((name) => ALL.map((environment) => ({ name, environment }))),
  ...['empty-terminal-install', 'ui-states-keyboard', 'browser-coi'].flatMap(
    (name) => BROWSERS.map((environment) => ({ name, environment })),
  ),
  ...[
    'public-import-boundary',
    'fixture-isolation',
    'candidate-identity',
    'previous-site-preserved',
    'site-inventory',
    'coverage-80',
  ].map((name) => ({ name, environment: 'host' as const })),
]);

export const INVENTORY_OUTPUT = 'site-inventory.json';
const CODE = 'evidence-invalid';
const IDENTITY_KEYS = [
  'sourceCommit',
  'formicariumSourceCommit',
  'formicariumPackSha256',
  'candidateId',
  'catalogSha256',
  'fixtureInventorySha256',
  'siteInventorySha256',
] as const;
const rowKey = (row: { name: string; environment: string }) =>
  `${row.name}/${row.environment}`;

export function validateSiteEvidenceIdentity(
  value: unknown,
): SiteEvidenceIdentity {
  if (!isRecord(value)) reject(CODE, 'identity must be an object');
  exactKeys(CODE, value, IDENTITY_KEYS);
  for (const key of IDENTITY_KEYS) {
    const pattern = key.endsWith('Commit') ? COMMIT_HEX : SHA256_HEX;
    if (typeof value[key] !== 'string' || !pattern.test(value[key] as string))
      reject(CODE, `identity.${key} invalid`);
  }
  return Object.fromEntries(
    IDENTITY_KEYS.map((key) => [key, value[key]]),
  ) as unknown as SiteEvidenceIdentity;
}

/** The digest every check record names, so no log of another candidate fits. */
export const identityDigest = (identity: SiteEvidenceIdentity) =>
  canonicalSha256(validateSiteEvidenceIdentity(identity));

function checkRow(value: unknown): CheckRow {
  if (!isRecord(value)) reject(CODE, 'check must be an object');
  exactKeys(CODE, value, ['name', 'environment', 'status', 'logSha256']);
  if (typeof value.name !== 'string' || !/^[a-z0-9-]+$/.test(value.name))
    reject(CODE, 'check name invalid');
  if (!ENVIRONMENTS.includes(value.environment as EnvironmentId))
    reject(CODE, `environment invalid: ${value.name}`);
  if (!STATUSES.includes(value.status as CheckStatus))
    reject(CODE, `status invalid: ${value.name}`);
  if (typeof value.logSha256 !== 'string' || !SHA256_HEX.test(value.logSha256))
    reject(CODE, `logSha256 invalid: ${value.name}`);
  return value as unknown as CheckRow;
}

/**
 * Every (name, environment) once; every required row present and passed.
 * Extra rows may be recorded but never replace a required one.
 */
export function requireRows(value: unknown): CheckRow[] {
  if (!Array.isArray(value)) reject(CODE, 'checks must be an array');
  const rows = value.map(checkRow);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(rowKey(row))) reject(CODE, `duplicate check ${rowKey(row)}`);
    seen.add(rowKey(row));
  }
  const problems: string[] = [];
  for (const required of REQUIRED_ROWS) {
    const row = rows.find((item) => rowKey(item) === rowKey(required));
    if (!row) problems.push(`missing ${rowKey(required)}`);
    else if (row.status !== 'passed')
      problems.push(`${row.status} ${rowKey(required)}`);
  }
  if (problems.length) reject(CODE, problems.join(', '));
  return rows;
}

/** evidenceId: everything except the id itself and the recording time. */
export function evidenceIdOf(
  evidence: Omit<AcceptanceEvidence, 'evidenceId'> & { evidenceId?: string },
): string {
  const { evidenceId: _id, recordedAt: _at, ...identity } = evidence;
  return canonicalSha256(identity);
}

const OFFSET_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Full C10 check; `deployed` evidence must carry deployedIdentity. */
export function validateEvidence(
  value: unknown,
  options: { deployed: boolean },
): AcceptanceEvidence {
  if (!isRecord(value)) reject(CODE, 'evidence must be an object');
  exactKeys(
    CODE,
    value,
    [
      'schemaVersion',
      'evidenceId',
      'unit',
      'sourceCommit',
      'recordedAt',
      'identity',
      'checks',
      'outputs',
    ],
    ['deployedIdentity'],
  );
  if (value.schemaVersion !== 1) reject(CODE, 'schemaVersion must be 1');
  if (value.unit !== 'u8-showcase-site')
    reject(CODE, 'unit must be u8-showcase-site');
  if (
    typeof value.sourceCommit !== 'string' ||
    !COMMIT_HEX.test(value.sourceCommit)
  )
    reject(CODE, 'sourceCommit invalid');
  if (
    typeof value.recordedAt !== 'string' ||
    !OFFSET_TIME.test(value.recordedAt)
  )
    reject(CODE, 'recordedAt must be ISO 8601 with an offset');
  const identity = validateSiteEvidenceIdentity(value.identity);
  if (identity.sourceCommit !== value.sourceCommit)
    reject(CODE, 'sourceCommit differs from identity.sourceCommit');
  requireRows(value.checks);
  const outputs = value.outputs;
  if (
    !Array.isArray(outputs) ||
    !outputs.some(
      (output) =>
        isRecord(output) &&
        output.path === INVENTORY_OUTPUT &&
        output.digest === identity.siteInventorySha256,
    )
  )
    reject(CODE, 'outputs must name the site inventory');
  if (options.deployed && value.deployedIdentity === undefined)
    reject(CODE, 'deployed evidence needs deployedIdentity');
  if (!options.deployed && value.deployedIdentity !== undefined)
    reject(CODE, 'pre-deploy evidence must not carry deployedIdentity');
  if (
    value.deployedIdentity !== undefined &&
    value.deployedIdentity !== identity.siteInventorySha256
  )
    reject(CODE, 'deployedIdentity differs from siteInventorySha256');
  const evidence = value as unknown as AcceptanceEvidence;
  if (evidenceIdOf(evidence) !== evidence.evidenceId)
    reject(CODE, 'evidenceId differs from the content');
  return evidence;
}
