/// <reference path="../../tests/browser-modules.d.ts" />
/// <reference path="../../tests/migration-session/browser-modules.d.ts" />
/// <reference path="../../tests/migration-install/browser-modules.d.ts" />
import { X509Certificate } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from '@playwright/test';
import { snapshotCatalog } from '../../runtime/install-catalog.js';
import { consumerInput } from '../../tests/migration-session/consumer-input.js';
import type { CatalogEntry, GuestCatalog } from '../../types/index.js';
import { sha256 } from '../package/stage-package.js';
import {
  INSTALL_REGRESSION_UNITS,
  type InstallCandidateOptions,
  installCandidateInventory,
} from './stage.js';

export interface InstallTrial {
  tool: string;
  browser: string;
  trial: number;
  version: string;
  url: string;
  finalUrl: string;
  digest: string;
  cors: 'passed';
  exitCode: number;
  stdoutDigest: string;
  phasesMs: {
    fetch: number;
    extract: number;
    digest: number;
    validate: number;
    register: number;
    run: number;
  };
}
export function summarizeInstallTrials(trials: readonly InstallTrial[]) {
  const groups: {
    tool: string;
    browser: string;
    firstMs: number;
    medianMs: number;
    maxMs: number;
  }[] = [];
  const nonDownload = (trial: InstallTrial) =>
    trial.phasesMs.extract +
    trial.phasesMs.digest +
    trial.phasesMs.validate +
    trial.phasesMs.register +
    trial.phasesMs.run;
  if (trials.length !== 36) throw Error('formal U3 trial count must be36');
  for (const tool of ['aube', 'biome'])
    for (const browser of ['chromium', 'firefox', 'webkit']) {
      const rows = trials
        .filter((row) => row.tool === tool && row.browser === browser)
        .sort((a, b) => a.trial - b.trial);
      if (
        rows.length !== 6 ||
        rows.some(
          (row, index) =>
            row.trial !== index ||
            row.exitCode !== 0 ||
            row.cors !== 'passed' ||
            !/^[a-f0-9]{64}$/.test(row.stdoutDigest) ||
            !/^[a-f0-9]{64}$/.test(row.digest) ||
            row.version !== (tool === 'aube' ? '2.7.0' : '2.5.15') ||
            row.finalUrl !== row.url ||
            row.url !==
              `https://localhost:4182/mirror/${tool === 'aube' ? 'aube.tar.gz' : 'biome.elf'}` ||
            Object.values(row.phasesMs).some(
              (value) => !Number.isFinite(value) || value < 0,
            ),
        )
      )
        throw Error('formal U3 missing/duplicate/failed trial');
      const ordered = rows
        .slice(1)
        .map(nonDownload)
        .sort((a, b) => a - b);
      const medianMs = ordered[2]!;
      if (medianMs > 3000)
        throw Error(
          `U3 non-download median exceeds3000ms: ${tool}/${browser} ${medianMs}`,
        );
      groups.push({
        tool,
        browser,
        firstMs: nonDownload(rows[0]!),
        medianMs,
        maxMs: Math.max(...rows.map(nonDownload)),
      });
    }
  return groups;
}
/** Every per-trial context keeps browser TLS verification enabled. */
export const INSTALL_CONTEXT_OPTIONS = Object.freeze({
  ignoreHTTPSErrors: false as const,
});

/**
 * Optional job-only Firefox profile whose cert9.db holds the job CA; it is
 * validated before any server or browser starts. Unset keeps the default launch.
 */
export async function resolveInstallFirefoxProfile(env: NodeJS.ProcessEnv) {
  const value = env.FORMICARIUM_INSTALL_FIREFOX_PROFILE;
  if (value === undefined) return undefined;
  if (!value || !isAbsolute(value))
    throw Error('U3 Firefox profile must be an absolute path');
  const inspect = (path: string) =>
    lstat(path).catch((error: unknown) => {
      throw Error('U3 Firefox profile path is missing', { cause: error });
    });
  const directory = await inspect(value);
  if (!directory.isDirectory() || directory.isSymbolicLink())
    throw Error('U3 Firefox profile must be a real directory');
  const database = await inspect(resolve(value, 'cert9.db'));
  if (!database.isFile() || database.isSymbolicLink())
    throw Error('U3 Firefox profile cert9.db must be a regular file');
  return await realpath(value);
}

type InstallBrowserLaunch =
  | { kind: 'launch'; options: Parameters<typeof chromium.launch>[0] }
  | {
      kind: 'persistent';
      userDataDir: string;
      options: {
        firefoxUserPrefs: Record<string, boolean>;
        ignoreHTTPSErrors: false;
      };
    };

/** Pure launch selection: only Firefox with an explicit profile is persistent. */
export function installBrowserLaunch(
  browserName: 'chromium' | 'firefox' | 'webkit',
  profile?: string,
): InstallBrowserLaunch {
  if (browserName !== 'firefox') return { kind: 'launch', options: {} };
  const firefoxUserPrefs = { 'security.enterprise_roots.enabled': true };
  if (profile === undefined)
    return { kind: 'launch', options: { firefoxUserPrefs } };
  return {
    kind: 'persistent',
    userDataDir: profile,
    options: { firefoxUserPrefs, ignoreHTTPSErrors: false },
  };
}

export async function measureInstall(
  out: string,
  root = process.cwd(),
  options: InstallCandidateOptions = {},
) {
  const input = await consumerInput();
  if (!INSTALL_REGRESSION_UNITS.includes(input.candidate.unit))
    throw Error('U3 formal measurement requires current U3 candidate');
  const checkSource = async () => {
    const source = await installCandidateInventory(
      input.candidate.unit,
      root,
      options,
    );
    if (
      JSON.stringify(source) !== JSON.stringify(input.candidate.sourceFiles) ||
      sha256(JSON.stringify(source)) !== input.candidate.sourceIdentity
    )
      throw Error('formal U3 current source differs from candidate');
    if (
      sha256(await readFile(input.candidate.tarball.path)) !==
      input.candidate.tarball.sha256
    )
      throw Error('formal U3 candidate tarball changed');
  };
  await checkSource();
  const certPath = process.env.FORMICARIUM_INSTALL_TLS_CERT;
  const keyPath = process.env.FORMICARIUM_INSTALL_TLS_KEY;
  const fingerprint = process.env.FORMICARIUM_INSTALL_TLS_SHA256;
  if (
    !certPath ||
    !keyPath ||
    !fingerprint ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    throw Error(
      'explicit trusted localhost certificate/key/fingerprint required; no trust changes performed',
    );
  const certBytes = await readFile(certPath);
  const certificate = new X509Certificate(certBytes);
  if (
    certificate.ca ||
    certificate.checkHost('localhost') !== 'localhost' ||
    Date.parse(certificate.validTo) <= Date.now() ||
    certificate.fingerprint256.replaceAll(':', '').toLowerCase() !== fingerprint
  )
    throw Error('formal U3 localhost certificate identity invalid/expired');
  const firefoxProfile = await resolveInstallFirefoxProfile(process.env);
  const mirror = JSON.parse(
    await readFile(
      resolve(
        root,
        'docs/results/terrarium-migration-preflight-evidence/mirror-input.json',
      ),
      'utf8',
    ),
  );
  const assets = new Map<string, Uint8Array>();
  const entries: CatalogEntry[] = [];
  for (const asset of mirror.assets) {
    const filename = asset.tool === 'aube' ? 'aube.tar.gz' : 'biome.elf';
    const bytes = new Uint8Array(
      await readFile(
        resolve(
          root,
          '.artifacts/migration-preflight/mirror-assets-attempt-1',
          filename,
        ),
      ),
    );
    if (sha256(bytes) !== asset.downloadSha256)
      throw Error('formal U3 asset differs from accepted U1 bytes');
    const elfBytes = asset.tool === 'aube' ? input.bytes.length : bytes.length;
    assets.set(`/mirror/${filename}`, bytes);
    entries.push({
      tool: asset.tool,
      versionOrName: asset.version,
      url: `https://localhost:4182/mirror/${filename}`,
      format: asset.format,
      ...(asset.archiveEntry ? { archiveEntry: asset.archiveEntry } : {}),
      downloadSha256: asset.downloadSha256,
      downloadBytes: bytes.length,
      elfBytes,
      buildInfo: asset.buildInfo,
      buildInfoSha256: asset.buildInfoSha256,
    });
  }
  const catalog: GuestCatalog = {
    schemaVersion: 1,
    catalogId: 'u3-formal-u1-fixed-assets',
    defaults: Object.fromEntries(
      entries.map((entry) => [entry.tool, entry.versionOrName]),
    ),
    entries,
  };
  snapshotCatalog(catalog);
  await mkdir(out, { recursive: false });
  await mkdir(resolve(out, 'trials'));
  const server = createServer(
    { cert: certBytes, key: await readFile(keyPath) },
    async (request, response) => {
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; style-src 'self'",
      );
      response.setHeader('X-U3-Certificate-SHA256', fingerprint);
      try {
        const path = decodeURIComponent(
          new URL(request.url ?? '/', 'https://localhost:4182').pathname,
        );
        const file = resolve(input.packageRoot, `.${path}`);
        const suffix = relative(input.packageRoot, file);
        if (
          suffix.startsWith('..') ||
          isAbsolute(suffix) ||
          path.includes('\0')
        )
          throw Error('path rejected');
        const body =
          assets.get(path) ??
          (path === '/'
            ? '<!doctype html><title>U3 formal install</title>'
            : await readFile(file));
        response.setHeader(
          'Content-Type',
          path.endsWith('.js') || path.endsWith('.mjs')
            ? 'text/javascript'
            : path.endsWith('.wasm')
              ? 'application/wasm'
              : path === '/'
                ? 'text/html'
                : 'application/octet-stream',
        );
        response.end(body);
      } catch {
        response.statusCode = 404;
        response.end('missing');
      }
    },
  );
  const trials: InstallTrial[] = [];
  try {
    await new Promise<void>((done, reject) => {
      server.once('error', reject);
      server.listen(4182, '127.0.0.1', done);
    });
    for (const [browserName, engine] of [
      ['chromium', chromium],
      ['firefox', firefox],
      ['webkit', webkit],
    ] as const) {
      const launch = installBrowserLaunch(browserName, firefoxProfile);
      let persistent:
        | Awaited<ReturnType<typeof firefox.launchPersistentContext>>
        | undefined;
      let browser: Awaited<ReturnType<typeof engine.launch>>;
      if (launch.kind === 'persistent') {
        persistent = await firefox.launchPersistentContext(
          launch.userDataDir,
          launch.options,
        );
        const owner = persistent.browser();
        if (!owner) {
          await persistent.close();
          throw Error('U3 Firefox profile persistent context has no browser');
        }
        browser = owner;
      } else browser = await engine.launch(launch.options);
      try {
        for (const tool of ['aube', 'biome'])
          for (let trial = 0; trial < 6; trial++) {
            const context = await browser.newContext(INSTALL_CONTEXT_OPTIONS);
            const page = await context.newPage();
            try {
              const response = await page.goto('https://localhost:4182/');
              if (
                response?.headers()['x-u3-certificate-sha256'] !== fingerprint
              )
                throw Error('formal U3 TLS endpoint pin differs');
              const browserSecurityDetails = await response.securityDetails();
              const observed = await page.evaluate(
                async ({ catalog, tool }) => {
                  const api: typeof import('../../runtime/public.js') =
                    await import('/runtime/public.js');
                  const {
                    createSession,
                  }: typeof import('../../runtime/web/api.js') = await import(
                    '/runtime/web/api.js'
                  );
                  const observer: typeof import('../../runtime/install.js') =
                    await import('/runtime/install.js');
                  const bench = () => {
                    const started = performance.now();
                    let value = 1;
                    for (let i = 0; i < 500000; i++)
                      value = Math.imul(value ^ i, 1664525);
                    return { ms: performance.now() - started, value };
                  };
                  const hostBefore = bench();
                  const session = await createSession();
                  try {
                    const installed = await api
                      .createInstaller(session, catalog)
                      .install(tool);
                    const timing = observer.installationTiming(installed);
                    const guest = observer.installationGuest(installed);
                    if (!timing || !guest || guest.digest !== installed.digest)
                      throw Error('successful installation observer missing');
                    const started = performance.now();
                    const run = await api.runValidatedGuest(session, guest, {
                      args: ['--version'],
                      timeoutMs: 600000,
                    });
                    const runMs = performance.now() - started;
                    const hostAfter = bench();
                    return {
                      installed,
                      timing,
                      run: {
                        exitCode: run.exitCode,
                        stdout: [...run.stdout],
                        stderr: [...run.stderr],
                      },
                      runMs,
                      hostBefore,
                      hostAfter,
                      environment: {
                        userAgent: navigator.userAgent,
                        isolated: String(crossOriginIsolated),
                      },
                    };
                  } finally {
                    await session.dispose();
                  }
                },
                { catalog, tool },
              );
              const entry = entries.find((entry) => entry.tool === tool)!;
              const stdoutDigest =
                tool === 'aube'
                  ? '508bf440b685ba63e692132d0a2dbf0ed6f177cb302f95063d66d73cd83fcd97'
                  : '1db1dfc3729a07347620f6a6834e01a6663672f880801e30416b1ad433ab89c8';
              const row: InstallTrial = {
                tool,
                browser: browserName,
                trial,
                version: entry.versionOrName,
                url: entry.url,
                finalUrl: observed.timing.finalURL,
                digest: observed.installed.digest,
                cors: 'passed',
                exitCode: observed.run.exitCode,
                stdoutDigest: sha256(new Uint8Array(observed.run.stdout)),
                phasesMs: { ...observed.timing.phasesMs, run: observed.runMs },
              };
              if (
                observed.environment.isolated !== 'true' ||
                row.digest !== entry.buildInfo.elfSha256 ||
                row.stdoutDigest !== stdoutDigest ||
                row.exitCode !== 0
              )
                throw Error(
                  'formal U3 real guest output/core/identity differs',
                );
              trials.push(row);
              await writeFile(
                resolve(out, 'trials', `${tool}.${browserName}.${trial}.json`),
                `${JSON.stringify({ schemaVersion: 1, unit: 'u3-install', candidateSha256: input.candidate.tarball.sha256, sourceIdentity: input.candidate.sourceIdentity, catalogSha256: sha256(JSON.stringify(catalog)), input: entry, trial: row, installationOperationId: observed.installed.operationId, stdout: observed.run.stdout, stderr: observed.run.stderr, hostBefore: observed.hostBefore, hostAfter: observed.hostAfter, browserSecurityDetails, certificateInspection: { issuer: certificate.issuer, subject: certificate.subject, validTo: certificate.validTo, fingerprint256: fingerprint }, environment: { ...observed.environment, browserVersion: browser.version(), origin: 'https://localhost:4182', certificateFingerprint: fingerprint, tlsIssuer: browserSecurityDetails?.issuer ?? null, tlsSubject: browserSecurityDetails?.subjectName ?? null, tlsProtocol: browserSecurityDetails?.protocol ?? null, coverage: 'uninstrumented formal product path', publicPath: 'C04install+C03same-successful-brand-run; U4registered-tool-command deferred' } }, null, 2)}\n`,
                { flag: 'wx' },
              );
            } finally {
              await context.close();
            }
          }
      } finally {
        if (persistent) await persistent.close();
        else await browser.close();
      }
    }
    await checkSource();
    const groups = summarizeInstallTrials(trials);
    const receipt = {
      schemaVersion: 1,
      unit: 'u3-install',
      passed: true,
      recordedAt: new Date().toISOString(),
      sourceIdentity: input.candidate.sourceIdentity,
      candidateSha256: input.candidate.tarball.sha256,
      catalogSha256: sha256(JSON.stringify(catalog)),
      thresholdMs: 3000,
      trialCount: 36,
      groups,
      trials,
      realSafari: '未検証',
    };
    await writeFile(
      resolve(out, 'measurement-report.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { flag: 'wx' },
    );
    return resolve(out, 'measurement-report.json');
  } catch (error) {
    await writeFile(
      resolve(out, 'incomplete.json'),
      `${JSON.stringify({ unit: 'u3-install', passed: false, observedTrials: trials, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
      { flag: 'wx' },
    );
    throw error;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const [out, ...extra] = process.argv.slice(2);
  if (!out || extra.length)
    throw Error('usage: U3 measure.js <new-output-directory>');
  console.log(await measureInstall(resolve(out)));
}
