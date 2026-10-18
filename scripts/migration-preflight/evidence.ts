export const BASELINE_SOURCE = Object.freeze({
  repository: 'https://github.com/biomejs/biome',
  commit: '2405c7620169bd0719166af09a8d89cc76fb37fb',
});
export const TOOLS = ['aube', 'biome'] as const;
export const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
export const PHASES = [
  'fetch',
  'extract',
  'digest',
  'validate',
  'register',
  'run',
] as const;
export interface Trial {
  tool: (typeof TOOLS)[number];
  browser: (typeof BROWSERS)[number];
  trial: 0 | 1 | 2 | 3 | 4 | 5;
  version: string;
  url: string;
  finalUrl: string;
  digest: string;
  cors: 'passed' | 'failed';
  exitCode: number;
  stdoutDigest: string;
  phasesMs: Record<(typeof PHASES)[number], number>;
}
export interface PreflightEvidence {
  schemaVersion: 1;
  evidenceId: string;
  sourceCommit: string;
  recordedAt: string;
  environment: Readonly<Record<string, string>>;
  trials: readonly Trial[];
  baseline: {
    source: { repository: string; commit: string };
    buildKey: string;
    firstDigest: string;
    reusedDigest: string;
    compileSkipped: boolean;
    versionExitCode: number;
    ciRunUrl: string;
  };
}
export interface TrialSummary {
  tool: Trial['tool'];
  browser: Trial['browser'];
  firstNonDownloadMs: number;
  medianNonDownloadMs: number;
  maxNonDownloadMs: number;
  fetchMs: readonly number[];
}
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error(`${field}: object required`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw Error(`${field}: nonempty string required`);
  return value;
}
function pattern(value: unknown, regex: RegExp, field: string): void {
  if (!regex.test(text(value, field))) throw Error(`${field}: invalid format`);
}
function secureUrl(value: unknown, field: string): URL {
  const url = new URL(text(value, field));
  if (url.protocol !== 'https:' || url.username || url.password)
    throw Error(`${field}: HTTPS without credentials required`);
  return url;
}
function validateTrial(value: unknown): Trial {
  const row = object(value, 'trial');
  if (
    !TOOLS.includes(row.tool as Trial['tool']) ||
    !BROWSERS.includes(row.browser as Trial['browser'])
  )
    throw Error('trial: unknown tool/browser');
  if (
    !Number.isInteger(row.trial) ||
    Number(row.trial) < 0 ||
    Number(row.trial) > 5
  )
    throw Error('trial: index must be 0–5');
  pattern(row.version, /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'version');
  secureUrl(row.url, 'url');
  secureUrl(row.finalUrl, 'finalUrl');
  pattern(row.digest, SHA256, 'digest');
  pattern(row.stdoutDigest, SHA256, 'stdoutDigest');
  if (row.cors !== 'passed' || row.exitCode !== 0)
    throw Error('trial: CORS and exit must pass');
  const times = object(row.phasesMs, 'phasesMs');
  for (const phase of PHASES) {
    const time = times[phase];
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0)
      throw Error(`phasesMs.${phase}: finite nonnegative time required`);
  }
  const trial = row as unknown as Trial;
  if (!Number.isFinite(nonDownloadMs(trial)))
    throw Error('trial: summed time overflow');
  return trial;
}
function nonDownloadMs(trial: Trial): number {
  return PHASES.filter((phase) => phase !== 'fetch').reduce(
    (sum, phase) => sum + trial.phasesMs[phase],
    0,
  );
}
function validateHeader(row: Record<string, unknown>): void {
  if (row.schemaVersion !== 1) throw Error('schemaVersion: expected 1');
  if (new TextEncoder().encode(text(row.evidenceId, 'evidenceId')).length > 128)
    throw Error('evidenceId: too long');
  pattern(row.sourceCommit, COMMIT, 'sourceCommit');
  pattern(
    row.recordedAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    'recordedAt',
  );
  if (!Number.isFinite(Date.parse(String(row.recordedAt))))
    throw Error('recordedAt: invalid date');
  const environment = object(row.environment, 'environment');
  if (!Object.keys(environment).length) throw Error('environment: missing');
  for (const [key, value] of Object.entries(environment)) {
    text(key, 'environment key');
    text(value, `environment.${key}`);
  }
}
function validateBaseline(value: unknown): void {
  const baseline = object(value, 'baseline');
  const source = object(baseline.source, 'baseline.source');
  if (
    source.repository !== BASELINE_SOURCE.repository ||
    source.commit !== BASELINE_SOURCE.commit
  )
    throw Error('baseline: source identity mismatch');
  for (const field of ['buildKey', 'firstDigest', 'reusedDigest'])
    pattern(baseline[field], SHA256, `baseline.${field}`);
  if (
    baseline.firstDigest !== baseline.reusedDigest ||
    baseline.compileSkipped !== true ||
    baseline.versionExitCode !== 0
  )
    throw Error('baseline: reuse failed');
  const url = secureUrl(baseline.ciRunUrl, 'baseline.ciRunUrl');
  if (
    url.hostname !== 'github.com' ||
    !/^\/[^/]+\/[^/]+\/actions\/runs\/\d+\/?$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    throw Error('baseline.ciRunUrl: GitHub Actions run required');
}
/** Structural C01 acceptance. Remote authenticity and environment inventory are verified separately by verify.ts. */
export function assessEvidence(value: unknown): readonly TrialSummary[] {
  const row = object(value, 'evidence');
  validateHeader(row);
  validateBaseline(row.baseline);
  if (!Array.isArray(row.trials) || row.trials.length !== 36)
    throw Error('trials: exactly 36 rows required');
  const trials = row.trials.map(validateTrial);
  const keys = new Set(
    trials.map((trial) => `${trial.tool}/${trial.browser}/${trial.trial}`),
  );
  if (keys.size !== 36) throw Error('trials: duplicate or missing combination');
  return TOOLS.flatMap((tool) =>
    BROWSERS.map((browser) => {
      const group = trials
        .filter((trial) => trial.tool === tool && trial.browser === browser)
        .sort((a, b) => a.trial - b.trial);
      const first = group[0];
      const fixed = group[1];
      if (group.length !== 6 || !first || !fixed)
        throw Error('trials: incomplete combination');
      if (
        group.some(
          (trial) =>
            trial.version !== fixed.version ||
            trial.url !== fixed.url ||
            trial.finalUrl !== fixed.finalUrl ||
            trial.digest !== fixed.digest ||
            trial.stdoutDigest !== fixed.stdoutDigest,
        )
      )
        throw Error('trials: fixed asset/output identity mismatch');
      const warm = group
        .slice(1)
        .map(nonDownloadMs)
        .sort((a, b) => a - b);
      const median = warm[2];
      if (median === undefined || median > 3000)
        throw Error(`${tool}/${browser}: median exceeds 3000ms`);
      return {
        tool,
        browser,
        firstNonDownloadMs: nonDownloadMs(first),
        medianNonDownloadMs: median,
        maxNonDownloadMs: Math.max(...group.map(nonDownloadMs)),
        fetchMs: group.map((trial) => trial.phasesMs.fetch),
      };
    }),
  );
}
