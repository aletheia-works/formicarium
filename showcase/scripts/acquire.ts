import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  GuestBuildInfo,
  GuestExpectation,
  GuestHandle,
} from '@aletheia-works/formicarium';
import { extractEntry } from './archive.ts';
import {
  builderHash,
  buildKey,
  canonicalJson,
  canonicalSha256,
  sha256,
} from './build-key.ts';
import type { ReleaseAssetAcquire, ToolConfig } from './config.ts';
import { fail, runCli, ShowcaseError } from './errors.ts';
import {
  discardBody,
  type FetchLike,
  readBounded,
  statusCause,
  transportFailure,
} from './github.ts';
import { MAX_REDIRECTS, TRANSFER_POLICY } from './limits.ts';
import {
  fileInventory,
  SHOWCASE_ROOT,
  type WorkLayout,
  workLayout,
  writeOnce,
} from './paths.ts';
import {
  loadResolutions,
  loadVerifiedTools,
  resolutionFor,
  type ToolResolution,
} from './resolve.ts';

export const PROVENANCE_NOTE =
  'このcommitはrelease tagの識別であり、publisherのbinaryの再現性の証明ではない';
export const TARGET = 'x86_64-unknown-linux-musl';

export interface FetchOptions {
  maxBytes: number;
  expectedBytes?: number;
  deadlineMs?: number;
  maxRedirects?: number;
  fetchImpl?: FetchLike;
  clock?: () => number;
}
export interface FetchResult {
  bytes: Uint8Array;
  /** Final URL without query or fragment (signed download URLs carry tokens). */
  finalUrl: string;
  elapsedMs: number;
}

/** HTTPS, credential-free, no fragment; anything else is a redirect rule failure. */
export function checkTransferUrl(raw: string, base?: string): URL {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch (error) {
    return fail('redirect', 'transfer URL invalid', error);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    fail('redirect', 'transfer URL must be credential-free HTTPS');
  return url;
}
export const withoutQuery = (url: URL) => `${url.origin}${url.pathname}`;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Transfer: each redirect hop is inspected (max 5), credentials are
 * omitted, the deadline covers DNS, redirects and the whole body, and the
 * body is limited by the streamed total, not by Content-Length.
 */
export async function fetchBounded(
  raw: string,
  options: FetchOptions,
): Promise<FetchResult> {
  const execute = options.fetchImpl ?? globalThis.fetch;
  const clock = options.clock ?? (() => performance.now());
  const started = clock();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.deadlineMs ?? TRANSFER_POLICY.fetchDeadlineMs);
  try {
    let url = checkTransferUrl(raw);
    const visited = new Set<string>();
    let response: Response;
    for (let hops = 0; ; hops++) {
      if (visited.has(url.href)) fail('redirect', 'redirect loop');
      visited.add(url.href);
      response = await execute(url.href, {
        credentials: 'omit',
        redirect: 'manual',
        signal: controller.signal,
      });
      if (!REDIRECT_STATUSES.has(response.status)) break;
      discardBody(response);
      if (hops + 1 > (options.maxRedirects ?? MAX_REDIRECTS))
        fail('redirect', 'redirect limit exceeded');
      const location = response.headers.get('location');
      if (!location) fail('redirect', 'redirect without location');
      url = checkTransferUrl(location, url.href);
    }
    if (!response.ok) {
      discardBody(response);
      fail(statusCause(response), `asset answered ${response.status}`);
    }
    const limit = Math.min(
      options.maxBytes,
      options.expectedBytes ?? options.maxBytes,
    );
    let bytes: Uint8Array;
    try {
      bytes = await readBounded(response, limit);
    } catch (error) {
      if (
        error instanceof ShowcaseError &&
        error.code === 'size-limit' &&
        options.expectedBytes !== undefined &&
        options.expectedBytes < options.maxBytes
      )
        fail('size-mismatch', 'asset is larger than its declared size');
      throw error;
    }
    if (
      options.expectedBytes !== undefined &&
      bytes.length !== options.expectedBytes
    )
      fail('size-mismatch', 'asset size differs from its declared size');
    return { bytes, finalUrl: withoutQuery(url), elapsedMs: clock() - started };
  } catch (error) {
    return transportFailure(error, timedOut);
  } finally {
    clearTimeout(timer);
  }
}

export interface ReusedRun {
  runId: number;
  runAttempt: number;
  workflow: string;
}
export interface ToolProvenance {
  kind: 'release-asset' | 'source-build';
  assetUrl: string | null;
  finalUrl: string | null;
  downloadSha256: string;
  attestation: 'present' | 'absent' | null;
  note: string;
  reusedFromRun: ReusedRun | null;
}
/** The record each acquire path writes beside the verified bytes. */
export interface AcquiredTool {
  tool: string;
  version: string;
  format: 'elf' | 'tar.gz';
  archiveEntry?: string;
  downloadFile: string;
  downloadSha256: string;
  downloadBytes: number;
  elfSha256: string;
  elfBytes: number;
  buildInfo: GuestBuildInfo;
  buildInfoSha256: string;
  provenance: ToolProvenance;
  timing: { fetchMs: number };
}

/** Files and configuration whose change must change every builderHash. */
export async function builderInventory(
  root = SHOWCASE_ROOT,
): Promise<{ path: string; sha256: string }[]> {
  const files: { path: string; sha256: string }[] = [];
  for (const directory of ['builders', 'scripts'])
    for (const file of await fileInventory(join(root, directory)))
      files.push({ path: `${directory}/${file.path}`, sha256: file.sha256 });
  for (const name of ['tools.json', 'allowed-sources.json'])
    files.push({
      path: name,
      sha256: sha256(await readFile(join(root, name))),
    });
  return files;
}

/** Guest metadata for an official asset that ships no build-info of its own. */
export function officialBuildInfo(
  resolution: ToolResolution,
  hash: string,
  elfSha256: string,
): GuestBuildInfo {
  if (!resolution.asset)
    fail('release-invalid', `${resolution.tool} has no resolved asset`);
  const info = {
    schemaVersion: 1 as const,
    tool: resolution.tool,
    versionOrName: resolution.version,
    source: { repository: resolution.repository, commit: resolution.commit },
    target: TARGET as typeof TARGET,
    rustc: null,
    sourcePatches: [],
    dependencies: [],
    builderHash: hash,
    buildKey: '',
    elfSha256,
    provenance: {
      kind: 'release-asset',
      releaseTag: resolution.tag,
      assetName: resolution.asset.name,
      assetSha256: resolution.asset.sha256,
      note: PROVENANCE_NOTE,
    },
  };
  info.buildKey = buildKey(info);
  return info;
}

export type ValidateGuest = (
  bytes: Uint8Array,
  expected: GuestExpectation,
) => GuestHandle;

/** Runs the public validateGuest; its INVALID_INPUT becomes elf-invalid. */
export function validateWithPublicApi(
  validate: ValidateGuest,
  elf: Uint8Array,
  info: GuestBuildInfo,
): string {
  const buildInfoSha256 = canonicalSha256(info);
  try {
    validate(elf, {
      elfSha256: info.elfSha256,
      buildInfoSha256,
      identity: info,
    });
  } catch (error) {
    fail('elf-invalid', `${info.tool} failed public validateGuest`, error);
  }
  return buildInfoSha256;
}

export interface AcquireOptions {
  validate: ValidateGuest;
  hash: string;
  fetchImpl?: FetchLike;
}

/** Official static musl asset: published SHA256 and size, then archive extraction. */
export async function acquireOfficial(
  config: ToolConfig,
  resolution: ToolResolution,
  options: AcquireOptions,
): Promise<{ record: AcquiredTool; download: Uint8Array; elf: Uint8Array }> {
  if (config.acquire.kind !== 'release-asset' || !resolution.asset)
    fail('config-invalid', `${config.tool} is not a release-asset tool`);
  const acquire = config.acquire as ReleaseAssetAcquire;
  const asset = resolution.asset;
  const fetched = await fetchBounded(asset.url, {
    maxBytes: TRANSFER_POLICY.maxDownloadBytes,
    expectedBytes: asset.size,
    fetchImpl: options.fetchImpl,
  });
  const downloadSha256 = sha256(fetched.bytes);
  if (downloadSha256 !== asset.sha256)
    fail('checksum-mismatch', `${config.tool} asset SHA256 differs`);
  const elf =
    acquire.format === 'elf'
      ? fetched.bytes
      : await extractEntry(fetched.bytes, acquire.archiveEntry!);
  if (elf.length > TRANSFER_POLICY.maxElfBytes)
    fail('size-limit', `${config.tool} ELF exceeds the ELF limit`);
  const info = officialBuildInfo(resolution, options.hash, sha256(elf));
  const buildInfoSha256 = validateWithPublicApi(options.validate, elf, info);
  const record: AcquiredTool = {
    tool: config.tool,
    version: resolution.version,
    format: acquire.format,
    ...(acquire.archiveEntry ? { archiveEntry: acquire.archiveEntry } : {}),
    downloadFile: asset.name,
    downloadSha256,
    downloadBytes: fetched.bytes.length,
    elfSha256: info.elfSha256,
    elfBytes: elf.length,
    buildInfo: info,
    buildInfoSha256,
    provenance: {
      kind: 'release-asset',
      assetUrl: asset.url,
      finalUrl: fetched.finalUrl,
      downloadSha256,
      attestation: resolution.attestation,
      note: PROVENANCE_NOTE,
      reusedFromRun: null,
    },
    timing: { fetchMs: Math.round(fetched.elapsedMs) },
  };
  return { record, download: fetched.bytes, elf };
}

/** Stores the verified copy; later jobs never read the network bytes again. */
export async function storeAcquired(
  layout: WorkLayout,
  record: AcquiredTool,
  download: Uint8Array,
  elf: Uint8Array,
): Promise<void> {
  const directory = join(layout.acquired, record.tool);
  await writeOnce(join(directory, record.downloadFile), download);
  if (record.format === 'tar.gz')
    await writeOnce(join(directory, 'guest'), elf);
  await writeOnce(
    join(directory, 'build-info.json'),
    canonicalJson(record.buildInfo),
  );
  await writeOnce(
    join(directory, 'acquired.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}

export async function loadAcquired(
  layout: WorkLayout,
): Promise<AcquiredTool[]> {
  const records: AcquiredTool[] = [];
  let tools: string[];
  try {
    tools = await readdir(layout.acquired);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return records;
    throw error;
  }
  for (const tool of tools.sort())
    records.push(
      JSON.parse(
        await readFile(join(layout.acquired, tool, 'acquired.json'), 'utf8'),
      ) as AcquiredTool,
    );
  return records;
}

/** acquire job, official half: release-asset tools never fall back to a build. */
export async function runAcquireOfficialJob(options: {
  validate: ValidateGuest;
  fetchImpl?: FetchLike;
  layout?: WorkLayout;
  readMain?: (path: string) => string;
}): Promise<AcquiredTool[]> {
  const layout = options.layout ?? workLayout();
  const tools = await loadVerifiedTools(options.readMain);
  const resolutions = await loadResolutions(layout);
  const hash = builderHash(await builderInventory(), {});
  const records: AcquiredTool[] = [];
  for (const config of tools.tools) {
    if (config.acquire.kind !== 'release-asset') continue;
    const acquired = await acquireOfficial(
      config,
      resolutionFor(resolutions, config.tool),
      { validate: options.validate, hash, fetchImpl: options.fetchImpl },
    );
    await storeAcquired(
      layout,
      acquired.record,
      acquired.download,
      acquired.elf,
    );
    records.push(acquired.record);
  }
  return records;
}

if (import.meta.main)
  await runCli('acquire official assets', async () => {
    const { validateGuest } = await import('@aletheia-works/formicarium');
    for (const record of await runAcquireOfficialJob({
      validate: validateGuest,
    }))
      console.log(`${record.tool} ${record.version} ${record.elfSha256}`);
  });
