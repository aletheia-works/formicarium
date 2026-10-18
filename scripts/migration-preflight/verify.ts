import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FIRST_PARTY_JS } from '../package/stage-package.js';
import {
  type BaselineInputs,
  type BaselineReceipt,
  baselineKey,
  readAccepted,
} from './baseline.js';
import { assessEvidence, type PreflightEvidence, TOOLS } from './evidence.js';
import { parseUniqueJSON } from './unique-json.js';

export { parseUniqueJSON } from './unique-json.js';

const hash = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
const sha = (value: unknown) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export const REQUIRED_SUITES = Object.freeze([
  'preflight-unit',
  'preflight-browser',
  'package-consumer',
  'node-regression',
  'browser-regression',
  'coverage',
]);
export interface VerificationInput {
  schemaVersion: 1;
  evidence: string;
  inventory: string;
  baselineInputs: string;
  firstReceipt: string;
  reuseReceipt: string;
  baselineDirectory: string;
  coverageReport: string;
  candidateManifest: string;
  suites: readonly {
    name: string;
    command: string;
    sourceCommit: string;
    recordKind: 'observed-command-summary';
    exitCode: number;
    passed: number;
    failed: number;
    skipped: number;
    record: string;
    recordSha256: string;
  }[];
}
interface Inventory {
  schemaVersion: number;
  sourceCommit: string;
  assets: {
    tool: string;
    version: string;
    url: string;
    elfSha256: string;
    downloadSha256: string;
  }[];
  metadataProducer: {
    official: {
      tool: string;
      version: string;
      url: string;
      downloadSha256: string;
      elfSha256: string;
    }[];
  };
  mirror: {
    origin: string;
    entries: {
      tool: string;
      originalUrl: string;
      mirrorUrl: string;
      sha256: string;
    }[];
  };
}
interface RemoteReceipt extends BaselineReceipt {
  schemaVersion: number;
  source: { repository: string; commit: string };
  sourceCommit: string;
  ciRunUrl: string;
  recordedAt: string;
}
export function checkAcceptance(input: {
  evidence: PreflightEvidence;
  inventory: Inventory;
  baselineInputs: BaselineInputs;
  first: RemoteReceipt;
  reuse: RemoteReceipt;
  accepted: BaselineReceipt;
  coverage: {
    passed: boolean;
    threshold: number;
    candidateSha256: string;
    lines: { total: number; covered: number; skipped: number; pct: number };
    files: { path: string; lines: Record<string, number> }[];
    digests: { path: string; sourceSha256: string }[];
    realmNames: string[];
  };
  candidate: {
    tarball: { sha256: string };
    files: { path: string; sha256: string }[];
  };
}): void {
  const { evidence, inventory, first, reuse, accepted, coverage, candidate } =
    input;
  assessEvidence(evidence);
  if (
    inventory.schemaVersion !== 1 ||
    inventory.sourceCommit !== evidence.sourceCommit ||
    inventory.assets.length !== 2
  )
    throw Error('inventory source/size mismatch');
  for (const tool of TOOLS) {
    const assets = inventory.assets.filter((asset) => asset.tool === tool);
    if (assets.length !== 1) throw Error('inventory tool uniqueness required');
    const asset = assets[0]!;
    if (!sha(asset.elfSha256) || !sha(asset.downloadSha256))
      throw Error('inventory digest invalid');
    const official = inventory.metadataProducer.official.filter(
      (row) => row.tool === tool,
    );
    const mirrors = inventory.mirror.entries.filter((row) => row.tool === tool);
    const upstream = official[0];
    const mirror = mirrors[0];
    if (
      official.length !== 1 ||
      mirrors.length !== 1 ||
      !upstream ||
      !mirror ||
      upstream.version !== asset.version ||
      upstream.downloadSha256 !== asset.downloadSha256 ||
      upstream.elfSha256 !== asset.elfSha256 ||
      mirror.sha256 !== asset.downloadSha256 ||
      mirror.originalUrl !== upstream.url ||
      mirror.mirrorUrl !== asset.url ||
      new URL(upstream.url).protocol !== 'https:' ||
      new URL(upstream.url).search ||
      new URL(asset.url).origin !== inventory.mirror.origin ||
      inventory.mirror.origin !== evidence.environment.origin
    )
      throw Error('official/mirror provenance mismatch');
    const rows = evidence.trials.filter((row) => row.tool === tool);
    if (
      rows.some(
        (row) =>
          row.version !== asset.version ||
          row.url !== asset.url ||
          row.finalUrl !== asset.url ||
          row.digest !== asset.elfSha256 ||
          row.stdoutDigest !== rows[0]!.stdoutDigest,
      )
    )
      throw Error('cross-browser inventory/output mismatch');
  }
  const key = baselineKey(input.baselineInputs);
  for (const receipt of [first, reuse]) {
    if (
      receipt.schemaVersion !== 1 ||
      receipt.source.repository !== input.baselineInputs.repository ||
      receipt.source.commit !== input.baselineInputs.commit ||
      !/^[0-9a-f]{40}$/.test(receipt.sourceCommit) ||
      !Number.isFinite(Date.parse(receipt.recordedAt)) ||
      receipt.ciRunUrl !== evidence.baseline.ciRunUrl ||
      receipt.buildKey !== key ||
      receipt.versionExitCode !== 0 ||
      receipt.elfSha256 !== accepted.elfSha256 ||
      receipt.buildInfoSha256 !== accepted.buildInfoSha256
    )
      throw Error('remote baseline receipt mismatch');
  }
  if (
    first.compileSkipped !== false ||
    reuse.compileSkipped !== true ||
    first.sourceCommit !== reuse.sourceCommit ||
    evidence.baseline.buildKey !== key ||
    evidence.baseline.firstDigest !== first.elfSha256 ||
    evidence.baseline.reusedDigest !== reuse.elfSha256
  )
    throw Error('first/reuse evidence mismatch');
  const inventoryPaths = [...FIRST_PARTY_JS].sort();
  if (
    JSON.stringify(coverage.files.map((row) => row.path).sort()) !==
      JSON.stringify(inventoryPaths) ||
    JSON.stringify(coverage.digests.map((row) => row.path).sort()) !==
      JSON.stringify(inventoryPaths)
  )
    throw Error('coverage fixed denominator differs');
  let total = 0;
  let covered = 0;
  for (const file of coverage.files)
    for (const [line, count] of Object.entries(file.lines)) {
      if (!/^\d+$/.test(line) || !Number.isSafeInteger(count) || count < 0)
        throw Error('coverage line invalid');
      total++;
      if (count > 0) covered++;
    }
  if (
    !total ||
    coverage.lines.total !== total ||
    coverage.lines.covered !== covered ||
    coverage.lines.skipped !== 0 ||
    coverage.lines.pct < 80 ||
    covered / total < 0.8 ||
    coverage.threshold !== 80 ||
    coverage.passed !== true ||
    coverage.candidateSha256 !== candidate.tarball.sha256 ||
    !sha(candidate.tarball.sha256) ||
    !coverage.realmNames.length ||
    new Set(coverage.realmNames).size !== coverage.realmNames.length
  )
    throw Error('coverage acceptance failed');
  for (const digest of coverage.digests)
    if (
      !sha(digest.sourceSha256) ||
      candidate.files.filter(
        (row) => row.path === digest.path && row.sha256 === digest.sourceSha256,
      ).length !== 1
    )
      throw Error('coverage candidate identity mismatch');
  for (const field of [
    'cache',
    'coverage',
    'origin',
    'certificateFingerprint',
    'coreMetadataSha256',
    'coreOriginalInfoSha256',
    'coreLoaderSha256',
    'coreWasmSha256',
    'coreCommit',
    'coreInputCondition',
  ])
    if (!evidence.environment[field])
      throw Error(`environment missing ${field}`);
  for (const field of [
    'coreOriginalInfoSha256',
    'coreLoaderSha256',
    'coreWasmSha256',
  ])
    if (!sha(evidence.environment[field]))
      throw Error('core input digest invalid');
  if (
    evidence.environment.coverage !== 'uninstrumented performance path' ||
    !evidence.environment.origin!.startsWith('https:') ||
    !sha(evidence.environment.certificateFingerprint) ||
    !sha(evidence.environment.coreMetadataSha256)
  )
    throw Error('measurement environment invalid');
}
export async function verifyFile(path: string): Promise<void> {
  const read = async <T>(file: string): Promise<T> =>
    parseUniqueJSON(await readFile(resolve(file), 'utf8')) as T;
  const manifest = await read<VerificationInput>(path);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.suites))
    throw Error('verification input invalid');
  const evidence = await read<PreflightEvidence>(manifest.evidence);
  const inputs = await read<BaselineInputs>(manifest.baselineInputs);
  if (manifest.suites.length !== REQUIRED_SUITES.length)
    throw Error('required suite inventory missing');
  for (const name of REQUIRED_SUITES) {
    const rows = manifest.suites.filter((row) => row.name === name);
    const row = rows[0];
    if (
      rows.length !== 1 ||
      !row ||
      !row.command.trim() ||
      !/^[0-9a-f]{40}$/.test(row.sourceCommit) ||
      row.recordKind !== 'observed-command-summary' ||
      row.exitCode !== 0 ||
      !Number.isSafeInteger(row.passed) ||
      row.passed <= 0 ||
      row.failed !== 0 ||
      row.skipped !== 0 ||
      !sha(row.recordSha256) ||
      hash(await readFile(resolve(row.record))) !== row.recordSha256
    )
      throw Error(`required suite failed/missing: ${name}`);
  }
  checkAcceptance({
    evidence,
    inventory: await read(manifest.inventory),
    baselineInputs: inputs,
    first: await read(manifest.firstReceipt),
    reuse: await read(manifest.reuseReceipt),
    accepted: await readAccepted(resolve(manifest.baselineDirectory), inputs),
    coverage: await read(manifest.coverageReport),
    candidate: await read(manifest.candidateManifest),
  });
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const path = process.env.FORMICARIUM_PREFLIGHT_VERIFICATION;
  if (!path)
    throw Error(
      'FORMICARIUM_PREFLIGHT_VERIFICATION required; no fixture fallback',
    );
  await verifyFile(path);
  console.log('U1 evidence acceptance passed');
}
