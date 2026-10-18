import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { AssetInput } from '../../scripts/migration-preflight/assets.js';
import type { Trial } from '../../scripts/migration-preflight/evidence.js';
import { BROWSERS, TOOLS } from '../../scripts/migration-preflight/evidence.js';

// The toolchain that produced each trial is part of the trial record.
const PLAYWRIGHT_VERSION = (
  JSON.parse(
    await readFile(
      resolve('node_modules/@playwright/test/package.json'),
      'utf8',
    ),
  ) as { version: string }
).version;
const inputPath = process.env.FORMICARIUM_PREFLIGHT_INPUT;
if (!inputPath)
  throw Error(
    'FORMICARIUM_PREFLIGHT_INPUT fixed official asset inventory required; no fallback',
  );
const inventory: {
  schemaVersion: number;
  assets: AssetInput[];
  sourceCommit: string;
} = JSON.parse(await readFile(inputPath, 'utf8'));
if (
  inventory.schemaVersion !== 1 ||
  !/^[0-9a-f]{40}$/.test(inventory.sourceCommit) ||
  !Array.isArray(inventory.assets)
)
  throw Error('preflight inventory schema/sourceCommit invalid');
for (const tool of TOOLS)
  if (inventory.assets.filter((asset) => asset.tool === tool).length !== 1)
    throw Error(`${tool}: unique fixed asset required`);

for (const tool of TOOLS)
  for (let index = 0; index <= 5; index++) {
    test(`${tool} official trial ${index}`, async ({
      page,
      browser,
    }, testInfo) => {
      if (!BROWSERS.includes(testInfo.project.name as Trial['browser']))
        throw Error('unknown browser project');
      const asset = inventory.assets.find((entry) => entry.tool === tool)!;
      const response = await page.goto('/');
      const tlsDetails = await response?.securityDetails();
      const certificateFingerprint =
        response?.headers()['x-preflight-certificate-sha256'];
      const coreMetadataSha256 =
        response?.headers()['x-preflight-core-metadata-sha256'];
      const coreInput = await page.evaluate(async () => {
        const response = await fetch('/preflight/core-input.json', {
          cache: 'no-store',
        });
        if (!response.ok) throw Error('trial core input record missing');
        return response.json();
      });
      expect(coreInput.derivedInfoSha256).toBe(coreMetadataSha256);
      expect(coreInput.originalMetadataPreserved).toBe(true);
      if (process.env.FORMICARIUM_PREFLIGHT_ORIGIN?.startsWith('https:')) {
        expect(tlsDetails).not.toBeNull();
        expect(certificateFingerprint).toBe(
          process.env.FORMICARIUM_PREFLIGHT_TLS_FINGERPRINT?.toLowerCase(),
        );
      }
      expect(response).not.toBeNull();
      expect(response!.headers()['cross-origin-opener-policy']).toBe(
        'same-origin',
      );
      expect(response!.headers()['cross-origin-embedder-policy']).toBe(
        'require-corp',
      );
      const outcome = await page.evaluate(
        async ({ asset, browser, trial }) => {
          try {
            if (!crossOriginIsolated || typeof SharedArrayBuffer !== 'function')
              throw Error('COI/SAB required');
            const { createSession } = await import('/runtime/web/api.js');
            const { createTrialRunner } = await import(
              '/scripts/migration-preflight/runner.js'
            );
            const runner = createTrialRunner({
              createSession: () =>
                createSession({
                  assets: {
                    loaderURL: new URL('/dist/blink/blink.mjs', location.href),
                    wasmURL: new URL('/dist/blink/blink.wasm', location.href),
                    buildInfoURL: new URL(
                      '/dist/blink/build-info.json',
                      location.href,
                    ),
                    workerURL: new URL(
                      '/runtime/web/package-worker.js',
                      location.href,
                    ),
                  },
                }),
            });
            try {
              return {
                status: 'passed' as const,
                result: {
                  ...(await runner.run(asset, { browser, trial })),
                  isolated: crossOriginIsolated,
                  userAgent: navigator.userAgent,
                },
              };
            } finally {
              await runner.dispose();
            }
          } catch (caught) {
            const error = caught as {
              code?: unknown;
              stage?: unknown;
              phasesMs?: unknown;
              message?: unknown;
            };
            return {
              status: 'failed' as const,
              failure: {
                code:
                  typeof error?.code === 'string' ? error.code : 'EXECUTION',
                stage:
                  typeof error?.stage === 'string'
                    ? error.stage
                    : 'browser-preflight',
                message:
                  typeof error?.message === 'string'
                    ? error.message
                    : 'browser trial failed',
                phasesMs: error?.phasesMs ?? {},
                requestedUrl: asset.url,
              },
            };
          }
        },
        {
          asset,
          browser: testInfo.project.name as Trial['browser'],
          trial: index as Trial['trial'],
        },
      );
      const attempt = process.env.FORMICARIUM_PREFLIGHT_ATTEMPT;
      if (!attempt || !resolve(attempt).startsWith(resolve('.artifacts') + '/'))
        throw Error('new project .artifacts attempt directory required');
      const directory = resolve(attempt, 'trials');
      await mkdir(directory, { recursive: true });
      // Failed real rows are retained. No retries, skipped rows, or synthetic timings.
      if (outcome.status === 'failed') {
        await writeFile(
          resolve(
            directory,
            `${tool}.${testInfo.project.name}.${index}.failure.json`,
          ),
          JSON.stringify(
            {
              schemaVersion: 1,
              sourceCommit: inventory.sourceCommit,
              tool,
              browser: testInfo.project.name,
              trial: index,
              failure: outcome.failure,
              coreInput,
            },
            null,
            2,
          ) + '\n',
          { flag: 'wx' },
        );
        await testInfo.attach('preflight-failure', {
          body: JSON.stringify(outcome.failure),
          contentType: 'application/json',
        });
        throw Error(
          `${outcome.failure.stage}: ${outcome.failure.code}: ${outcome.failure.message}`,
        );
      }
      const result = outcome.result;
      await writeFile(
        resolve(directory, `${tool}.${testInfo.project.name}.${index}.json`),
        JSON.stringify(
          {
            schemaVersion: 1,
            sourceCommit: inventory.sourceCommit,
            trial: result.trial,
            stdout: result.stdout,
            stderr: result.stderr,
            environment: {
              node: process.version,
              playwright: PLAYWRIGHT_VERSION,
              browserVersion: browser.version(),
              userAgent: result.userAgent,
              isolated: String(result.isolated),
              cache:
                'new context and new session per trial; asset fetch cache=no-store; server Cache-Control=no-store',
              coverage: 'uninstrumented performance path',
              origin:
                process.env.FORMICARIUM_PREFLIGHT_ORIGIN ??
                'http://127.0.0.1:4182',
              certificateFingerprint: certificateFingerprint ?? 'not-TLS',
              tlsProtocol: tlsDetails?.protocol ?? 'not-TLS',
              tlsIssuer: tlsDetails?.issuer ?? 'not-TLS',
              tlsSubject: tlsDetails?.subjectName ?? 'not-TLS',
              condition:
                'HTTPS mirror remeasurement; upstream official URL and raw digest retained separately in mirror inventory',
              coreMetadataSha256,
              coreOriginalInfoSha256: coreInput.originalInfoSha256,
              coreLoaderSha256: coreInput.assetDigests.loaderSha256,
              coreWasmSha256: coreInput.assetDigests.wasmSha256,
              coreCommit: coreInput.blinkCommit,
              coreInputCondition: coreInput.condition,
            },
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
      await testInfo.attach('preflight-trial', {
        body: JSON.stringify(result),
        contentType: 'application/json',
      });
      expect(result.trial.exitCode).toBe(0);
      expect(result.trial.cors).toBe('passed');
    });
  }
