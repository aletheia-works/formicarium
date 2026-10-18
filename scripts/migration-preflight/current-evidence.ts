import { lstat, readdir, readFile } from 'node:fs/promises';
import { cpus, machine, platform, release } from 'node:os';
import { resolve } from 'node:path';
import {
  type BaselineInputs,
  type BaselineReceipt,
  baselineKey,
  readAccepted,
} from './baseline.js';
import {
  assessEvidence,
  BASELINE_SOURCE,
  BROWSERS,
  type PreflightEvidence,
  TOOLS,
  type Trial,
} from './evidence.js';
import { parseUniqueJSON } from './unique-json.js';
import type { checkAcceptance } from './verify.js';

type Inventory = Parameters<typeof checkAcceptance>[0]['inventory'];

/** Fields that legitimately differ per browser; all others must match in every trial. */
const PER_BROWSER = ['browserVersion', 'userAgent', 'tlsIssuer'] as const;
const TRIAL_FILE = /^(aube|biome)\.(chromium|firefox|webkit)\.([0-5])\.json$/;
const PASSED_TRIAL =
  /^\s*✓\s+\d+\s+\[(chromium|firefox|webkit)\]\s+›\s+\S+\s+›\s+(aube|biome) official trial (\d+)\b/;

export interface RemoteReceipt extends BaselineReceipt {
  schemaVersion: number;
  source: { repository: string; commit: string };
  sourceCommit: string;
  ciRunUrl: string;
  recordedAt: string;
}
export interface PreflightRunInput {
  trialsDirectory: string;
  browserLogPath: string;
  inventoryPath: string;
  baselineDirectory: string;
  ciRunPath: string;
}
interface TrialRecord {
  schemaVersion: number;
  sourceCommit: string;
  trial: Trial;
  environment: Record<string, unknown>;
}
const readUnique = async <T>(path: string): Promise<T> =>
  parseUniqueJSON(await readFile(path, 'utf8')) as T;

async function readTrials(directory: string): Promise<TrialRecord[]> {
  const names = (await readdir(directory)).sort();
  const expected = TOOLS.flatMap((tool) =>
    BROWSERS.flatMap((browser) =>
      [0, 1, 2, 3, 4, 5].map((index) => `${tool}.${browser}.${index}.json`),
    ),
  ).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected))
    throw Error('trials: exactly the 36 passing trial files are required');
  const records: TrialRecord[] = [];
  for (const name of names) {
    const path = resolve(directory, name);
    if (!(await lstat(path)).isFile())
      throw Error(`trials: regular file required: ${name}`);
    const [, tool, browser, index] = TRIAL_FILE.exec(name)!;
    const record = await readUnique<TrialRecord>(path);
    if (
      record.schemaVersion !== 1 ||
      record.trial?.tool !== tool ||
      record.trial.browser !== browser ||
      record.trial.trial !== Number(index)
    )
      throw Error(`trials: record does not match its file name: ${name}`);
    records.push(record);
  }
  return records;
}
function environmentOf(
  records: readonly TrialRecord[],
): Record<string, string> {
  const common = new Map<string, string>();
  const perBrowser = new Map<string, string>();
  const keys = JSON.stringify(Object.keys(records[0]!.environment).sort());
  for (const record of records) {
    if (JSON.stringify(Object.keys(record.environment).sort()) !== keys)
      throw Error('trial environment identity differs: field set');
    for (const [key, value] of Object.entries(record.environment)) {
      if (typeof value !== 'string' || !value.trim())
        throw Error(`trial environment identity differs: ${key} empty`);
      const browserKey = (PER_BROWSER as readonly string[]).includes(key);
      const target = browserKey ? perBrowser : common;
      const name = browserKey ? `${record.trial.browser}.${key}` : key;
      const seen = target.get(name);
      if (seen !== undefined && seen !== value)
        throw Error(`trial environment identity differs: ${name}`);
      target.set(name, value);
    }
  }
  return {
    ...Object.fromEntries(common),
    ...Object.fromEntries(perBrowser),
    hostOS: `${platform()} ${release()} ${machine()}`,
    hostCPU: cpus()[0]?.model || 'unknown',
  };
}
/** The trials must have run on the toolchain verifying them now. */
async function assertCurrentToolchain(environment: Record<string, string>) {
  const playwright = (
    await readUnique<{ version: string }>(
      resolve('node_modules/@playwright/test/package.json'),
    )
  ).version;
  if (environment.node !== process.version)
    throw Error(`trials must run on the current Node ${process.version}`);
  if (environment.playwright !== playwright)
    throw Error(`trials must run on the installed Playwright ${playwright}`);
}
/** Every passing trial the browser log reports is exactly one sealed trial file. */
async function assertBrowserLog(path: string, records: readonly TrialRecord[]) {
  const log = (await readFile(path, 'utf8')).replace(
    new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
    '',
  );
  const passed = log
    .split('\n')
    .map((line) => PASSED_TRIAL.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, browser, tool, index]) => `${tool}.${browser}.${index}`)
    .sort();
  const files = records
    .map(({ trial }) => `${trial.tool}.${trial.browser}.${trial.trial}`)
    .sort();
  if (JSON.stringify(passed) !== JSON.stringify(files))
    throw Error('browser log passing trials differ from the trial files');
}
async function readBaseline(directory: string, ciRunPath: string) {
  const baselineInputs = await readUnique<BaselineInputs>(
    resolve(directory, 'actual-inputs.json'),
  );
  // The builder hash includes the running Node: an older-toolchain build fails here.
  const key = baselineKey(baselineInputs);
  const cached = await readdir(resolve(directory, 'cache'));
  if (JSON.stringify(cached) !== JSON.stringify([key]))
    throw Error('baseline cache must hold exactly the current build key');
  const accepted = await readAccepted(
    resolve(directory, 'cache', key),
    baselineInputs,
  );
  const first = await readUnique<RemoteReceipt>(
    resolve(directory, 'first-receipt.json'),
  );
  const reuse = await readUnique<RemoteReceipt>(
    resolve(directory, 'reuse-receipt.json'),
  );
  const run = await readUnique<{
    status?: unknown;
    conclusion?: unknown;
    html_url?: unknown;
    head_sha?: unknown;
  }>(ciRunPath);
  if (
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.html_url !== first.ciRunUrl ||
    run.html_url !== reuse.ciRunUrl ||
    run.head_sha !== first.sourceCommit ||
    run.head_sha !== reuse.sourceCommit
  )
    throw Error('CI run must be the successful run that wrote both receipts');
  return { baselineInputs, accepted, first, reuse, key };
}
/** Builds C01 evidence only from this run's trials and the current-Node baseline CI. */
export async function assemblePreflightEvidence(
  input: PreflightRunInput,
  options: { evidenceId: string; recordedAt: string },
) {
  const records = await readTrials(input.trialsDirectory);
  const inventory = await readUnique<Inventory>(input.inventoryPath);
  const sourceCommit = inventory.sourceCommit;
  if (records.some((record) => record.sourceCommit !== sourceCommit))
    throw Error('trials: source commit differs from the mirror inventory');
  await assertBrowserLog(input.browserLogPath, records);
  const environment = environmentOf(records);
  await assertCurrentToolchain(environment);
  const baseline = await readBaseline(input.baselineDirectory, input.ciRunPath);
  const evidence: PreflightEvidence = {
    schemaVersion: 1,
    evidenceId: options.evidenceId,
    sourceCommit,
    recordedAt: options.recordedAt,
    environment,
    trials: records.map((record) => record.trial),
    baseline: {
      source: { ...BASELINE_SOURCE },
      buildKey: baseline.key,
      firstDigest: baseline.first.elfSha256,
      reusedDigest: baseline.reuse.elfSha256,
      compileSkipped: baseline.reuse.compileSkipped,
      versionExitCode: baseline.reuse.versionExitCode,
      ciRunUrl: baseline.first.ciRunUrl,
    },
  };
  assessEvidence(evidence);
  return {
    evidence,
    inventory,
    baselineInputs: baseline.baselineInputs,
    first: baseline.first,
    reuse: baseline.reuse,
    accepted: baseline.accepted,
  };
}
