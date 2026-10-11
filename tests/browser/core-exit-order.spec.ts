import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { lookupSession } from '../../runtime/registry.js';
import { normalizeTranscript } from '../../runtime/session.js';

const digest = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

test('core exit notification is exactly once before the next factory', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(660_000);
  const session = lookupSession('pitchfork-basic');
  const identity = () => ({
    buildInfo: JSON.parse(readFileSync('dist/blink/build-info.json', 'utf8')),
    lock: readFileSync('blink.lock', 'utf8').match(
      /^commit=([0-9a-f]{40})$/m,
    )?.[1],
    loader: digest('dist/blink/blink.mjs'),
    wasm: digest('dist/blink/blink.wasm'),
    buildInfoSha256: digest('dist/blink/build-info.json'),
    guest: digest('dist/guests/pitchfork'),
    baseline: digest(session.baseline),
    browser: browser.version(),
  });
  const before = identity();
  expect(before.buildInfo.blinkCommit).toBe(before.lock);
  expect(before.lock).toMatch(/^[0-9a-f]{40}$/);
  expect(before.buildInfo.blinkSourceDirty).toBe(false);
  expect(before.buildInfo.configure).toContain('--disable-jit');
  expect(before.buildInfo.link).toContain('-sMAXIMUM_MEMORY=1GB');
  expect(before.guest).toBe(
    'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e',
  );
  expect(before.baseline).toBe(
    'd8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9',
  );
  const baseline = normalizeTranscript(readFileSync(session.baseline, 'utf8'));
  const persist = async (
    filename: string,
    body: string,
    contentType: string,
  ) => {
    const path = testInfo.outputPath(filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { encoding: 'utf8', flag: 'wx' });
    expect(await readFile(path)).toEqual(Buffer.from(body, 'utf8'));
    await testInfo.attach(filename, { path, contentType });
  };
  const result = await (async () => {
    try {
      await page.goto('/web/index.html?session=no-such-session');
      await page.waitForFunction(() =>
        window.formicariumResult?.error?.includes('unknown session'),
      );
      return await page.evaluate(async () => {
        const environment = {
          isolated: crossOriginIsolated,
          visibility: document.visibilityState,
          userAgent: navigator.userAgent,
        };
        const worker = new Worker(
          '/tests/browser/fixtures/pitchfork-diagnostic-worker.js',
          { type: 'module' },
        );
        type DiagnosticEvent = {
          phase: string;
          sequence: number;
          moduleIndex?: number;
          command?: string;
          exitCode?: number;
        };
        type Outcome = {
          transcript?: string;
          steps?: { command: string; exitCode: number; elapsedMs: number }[];
          message?: string;
        };
        const events: DiagnosticEvent[] = [];
        const streams = { stdout: [] as string[], stderr: [] as string[] };
        const decoders = {
          stdout: new TextDecoder(),
          stderr: new TextDecoder(),
        };
        const encoder = new TextEncoder();
        let bytes = 0;
        let settled = false;
        let outcome: Outcome | undefined;
        let guestTimer: ReturnType<typeof setTimeout>;
        let drainTimer: ReturnType<typeof setTimeout> | undefined;
        return await new Promise<{
          status: string;
          bytes: number;
          events: DiagnosticEvent[];
          stdout: string;
          stderr: string;
          outcome?: Outcome;
          environment: typeof environment;
        }>((resolve) => {
          const finish = (status: string) => {
            if (settled) return;
            settled = true;
            clearTimeout(guestTimer);
            clearTimeout(drainTimer);
            worker.onmessage = null;
            worker.onerror = null;
            worker.onmessageerror = null;
            worker.terminate();
            streams.stdout.push(decoders.stdout.decode());
            streams.stderr.push(decoders.stderr.decode());
            resolve({
              status,
              bytes,
              events,
              stdout: streams.stdout.join(''),
              stderr: streams.stderr.join(''),
              outcome,
              environment,
            });
          };
          worker.onmessage = ({ data }) => {
            const stream = data.type === 'stdout' || data.type === 'stderr';
            const size = stream
              ? data.bytes.byteLength
              : encoder.encode(JSON.stringify(data)).byteLength;
            if (bytes + size > 64 * 1024 * 1024) {
              finish('overflow');
              return;
            }
            bytes += size;
            if (stream) {
              const type = data.type as 'stdout' | 'stderr';
              streams[type].push(
                decoders[type].decode(data.bytes, { stream: true }),
              );
            } else if (data.type === 'diagnostic') events.push(data);
            else if (data.type === 'done') {
              if (outcome) {
                finish('fixtureerror');
                return;
              }
              outcome = data;
              clearTimeout(guestTimer);
              // Retain late final-module callbacks instead of terminating on done.
              drainTimer = setTimeout(() => finish('completed'), 5_000);
            } else {
              outcome = data;
              finish('fixtureerror');
            }
          };
          worker.onerror = (event) => {
            if (/ExitStatus|unwind/.test(event.message)) {
              event.preventDefault();
              return;
            }
            outcome = { message: event.message };
            finish('fixtureerror');
          };
          worker.onmessageerror = () => {
            outcome = { message: 'Diagnostic Worker message decode failed' };
            finish('fixtureerror');
          };
          guestTimer = setTimeout(() => finish('timeout'), 600_000);
          worker.postMessage({ traced: false });
        });
      });
    } finally {
      // Also terminate the complete Worker tree if host evaluation fails.
      await page.close();
    }
  })();
  const after = identity();
  const modules = Array.from({ length: 7 }, (_, index) => {
    const moduleIndex = index + 1;
    const factories = result.events.filter(
      (event) =>
        event.phase === 'factory:enter' && event.moduleIndex === moduleIndex,
    );
    const exits = result.events.filter(
      (event) =>
        event.phase === 'onExit:enter' && event.moduleIndex === moduleIndex,
    );
    const nextFactory = result.events.find(
      (event) =>
        event.phase === 'factory:enter' &&
        event.moduleIndex === moduleIndex + 1,
    );
    return {
      moduleIndex,
      factoryCount: factories.length,
      exitCount: exits.length,
      exitCodes: exits.map((event) => event.exitCode),
      lateExits: nextFactory
        ? exits.filter((event) => event.sequence > nextFactory.sequence).length
        : 0,
    };
  });
  const collection = {
    completed: result.status === 'completed',
    all8Exit0:
      result.outcome?.steps?.length === 8 &&
      result.outcome.steps.every((step) => step.exitCode === 0),
    nativeEqual:
      normalizeTranscript(result.outcome?.transcript ?? '') === baseline,
  };
  // All raw evidence is persisted before either collection or defect assertions.
  await persist(
    'identity.json',
    JSON.stringify({ before, after }, null, 2),
    'application/json',
  );
  await persist('stdout.txt', result.stdout, 'text/plain');
  await persist('stderr.txt', result.stderr, 'text/plain');
  await persist(
    'events.json',
    JSON.stringify(result.events, null, 2),
    'application/json',
  );
  await persist(
    'outcome.json',
    JSON.stringify(result.outcome ?? null, null, 2),
    'application/json',
  );
  await persist(
    'regression.json',
    JSON.stringify(
      {
        status: result.status,
        bytes: result.bytes,
        truncated: result.status === 'overflow',
        environment: result.environment,
        collection,
        modules,
        collectionValid:
          collection.completed &&
          collection.all8Exit0 &&
          collection.nativeEqual,
        defect: modules.some(
          (module) => module.exitCount !== 1 || module.lateExits !== 0,
        ),
      },
      null,
      2,
    ),
    'application/json',
  );
  expect(after).toEqual(before);
  expect(result.environment.isolated).toBe(true);
  expect(result.environment.visibility).toBe('visible');
  expect(
    collection,
    'Collection prerequisites; failure here is not the intended Red',
  ).toEqual({ completed: true, all8Exit0: true, nativeEqual: true });
  expect(
    result.events.filter((event) => event.phase === 'factory:enter'),
  ).toHaveLength(7);
  for (const module of modules) {
    expect(
      module.factoryCount,
      `module ${module.moduleIndex} factory exists`,
    ).toBe(1);
    expect(
      module.exitCount,
      `EXIT_ORDER_RED: module ${module.moduleIndex} onExit must occur exactly once`,
    ).toBe(1);
    expect(
      module.lateExits,
      `EXIT_ORDER_RED: module ${module.moduleIndex} onExit must precede next factory`,
    ).toBe(0);
    expect(module.exitCodes).toEqual([0]);
  }
});
