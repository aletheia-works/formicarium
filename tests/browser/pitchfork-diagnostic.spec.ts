import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import { lookupSession } from '../../runtime/registry.js';
import { normalizeTranscript } from '../../runtime/session.js';

const digest = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

test('original Worker syscall diagnosis (collection only)', async ({
  page,
  browser,
}, testInfo) => {
  const flag = process.env.FORMICARIUM_DIAGNOSTIC;
  const traced = flag === 'pitchfork-firefox-original';
  test.skip(
    ![
      'pitchfork-firefox-original',
      'pitchfork-firefox-original-untraced',
    ].includes(flag ?? '') || testInfo.project.name !== 'firefox',
    'Explicit original Worker Firefox diagnosis only',
  );
  test.setTimeout(660_000);
  const cap = 64 * 1024 * 1024;
  const session = lookupSession('pitchfork-basic');
  const identity = () => ({
    core: JSON.parse(readFileSync('dist/blink/build-info.json', 'utf8')),
    loader: digest('dist/blink/blink.mjs'),
    wasm: digest('dist/blink/blink.wasm'),
    buildInfo: digest('dist/blink/build-info.json'),
    guest: digest('dist/guests/pitchfork'),
    baseline: digest(session.baseline),
    browser: browser.version(),
  });
  const before = identity();
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
  const stdout: string[] = [];
  const stderr: string[] = [];
  const consoleMessages: { type: string; text: string }[] = [];
  const pageErrors: string[] = [];
  let totalBytes = 0;
  let overflow = false;
  let stdoutOffset = 0;
  let stderrOffset = 0;
  let status = 'fixtureerror';
  let failure: string | undefined;
  type Observation = {
    diagnosticsPresent: boolean;
    pageStatus: string | null;
    isolated: boolean;
    visibility: string;
    userAgent: string;
    result?: import('../../web/globals.js').BrowserOutcome;
  };
  let observation: Observation | undefined;
  const reserve = (text: string) => {
    const bytes = Buffer.byteLength(text);
    if (totalBytes + bytes > cap) {
      overflow = true;
      return false;
    }
    totalBytes += bytes;
    return true;
  };
  const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
    const entry = { type: message.type(), text: message.text() };
    if (reserve(JSON.stringify(entry))) consoleMessages.push(entry);
  };
  const onPageError = (error: Error) => {
    if (reserve(error.message)) pageErrors.push(error.message);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  const started = Date.now();
  try {
    expect(before.core.blinkCommit).toBe(
      '1f58c82eb1b379483493c9be6e00f1634672d72d',
    );
    expect(before.core.blinkSourceDirty).toBe(false);
    expect(before.wasm).toBe(
      'dc0d5417d7c41380fd88598e511b9aae58454fb2a6a255209f7c6f75dfb2eef7',
    );
    expect(before.guest).toBe(
      'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e',
    );
    expect(before.baseline).toBe(
      'd8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9',
    );
    await page.goto(
      `/web/index.html?session=pitchfork-basic${traced ? '&core-flag=-s' : ''}`,
      { timeout: 30_000 },
    );
    for (;;) {
      const remainingMs = 600_000 - (Date.now() - started);
      if (remainingMs <= 0) {
        status = 'timeout';
        break;
      }
      // Only deltas cross the host boundary; no changes to the page or Worker.
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
      const sample = await Promise.race([
        page.evaluate(
          ({ stdoutOffset, stderrOffset, budget }) => {
            const diagnostics = window.formicariumDiagnostics;
            const out = diagnostics?.stdout?.slice(stdoutOffset) ?? '';
            const err = diagnostics?.stderr?.slice(stderrOffset) ?? '';
            const result = window.formicariumResult;
            const encoder = new TextEncoder();
            const bytes =
              encoder.encode(out).length +
              encoder.encode(err).length +
              encoder.encode(JSON.stringify(result ?? null)).length;
            const overflow = bytes > budget;
            return {
              overflow,
              stdout: overflow ? '' : out,
              stderr: overflow ? '' : err,
              stdoutOffset: diagnostics?.stdout?.length ?? stdoutOffset,
              stderrOffset: diagnostics?.stderr?.length ?? stderrOffset,
              observation: {
                diagnosticsPresent: diagnostics !== undefined,
                pageStatus:
                  document.querySelector('#status')?.textContent ?? null,
                isolated: crossOriginIsolated,
                visibility: document.visibilityState,
                userAgent: navigator.userAgent,
                result: overflow ? undefined : result,
              },
            };
          },
          { stdoutOffset, stderrOffset, budget: cap - totalBytes },
        ),
        new Promise<never>((_, reject) => {
          deadlineTimer = setTimeout(
            () => reject(new Error('diagnostic guest deadline')),
            remainingMs,
          );
        }),
      ]).finally(() => clearTimeout(deadlineTimer));
      observation = sample.observation;
      if (sample.overflow || !reserve(sample.stdout + sample.stderr)) {
        overflow = true;
        status = 'overflow';
        break;
      }
      stdout.push(sample.stdout);
      stderr.push(sample.stderr);
      stdoutOffset = sample.stdoutOffset;
      stderrOffset = sample.stderrOffset;
      if (overflow) {
        status = 'overflow';
        break;
      }
      if (pageErrors.length || observation.result?.error) {
        status = 'fixtureerror';
        break;
      }
      if (observation.result) {
        status = 'completed';
        break;
      }
      // Sequential host polling; no additional guest execution or page timer.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1_000, remainingMs)),
      );
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    status =
      failure === 'diagnostic guest deadline' ? 'timeout' : 'fixtureerror';
  } finally {
    try {
      const after = identity();
      const comparison = {
        completed: status === 'completed',
        stepCount: observation?.result?.steps?.length ?? 0,
        all8Exit0:
          observation?.result?.steps?.length === 8 &&
          observation.result.steps.every((step) => step.exitCode === 0),
        nativeEqual:
          observation?.result?.transcript !== undefined &&
          normalizeTranscript(observation.result.transcript) ===
            normalizeTranscript(readFileSync(session.baseline, 'utf8')),
      };
      await persist(
        'identity.json',
        JSON.stringify({ before, after }, null, 2),
        'application/json',
      );
      await persist('stdout.txt', stdout.join(''), 'text/plain');
      await persist('stderr.txt', stderr.join(''), 'text/plain');
      await persist(
        'diagnosis.json',
        JSON.stringify(
          {
            status,
            acceptance: false,
            collectionOnly: true,
            traced,
            traceOverhead: traced,
            comparison,
            elapsedMs: Date.now() - started,
            bytes: totalBytes,
            truncated: overflow,
            observation,
            consoleMessages,
            pageErrors,
            failure,
            ordinaryTimeoutsUnresolved: true,
          },
          null,
          2,
        ),
        'application/json',
      );
      expect(after).toEqual(before);
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      // Closing the original page owns termination of its real Worker tree.
      await page.close();
    }
  }
  expect(['completed', 'timeout']).toContain(status);
  expect(observation?.diagnosticsPresent).toBe(true);
  expect(observation?.isolated).toBe(true);
  expect(observation?.visibility).toBe('visible');
  expect(pageErrors).toEqual([]);
  const syscall =
    /(?:mmap|read|write|openat|close|epoll_pwait|futex|exit_group)\(/;
  if (traced) expect(stderr.join('')).toMatch(syscall);
  else expect(stderr.join('')).not.toMatch(syscall);
});

test('opt-in Firefox pitchfork boundary diagnosis (collection only)', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    process.env.FORMICARIUM_DIAGNOSTIC !== 'pitchfork-firefox' ||
      testInfo.project.name !== 'firefox',
    'Explicit Firefox diagnosis only',
  );
  test.setTimeout(1_260_000);
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
  const session = lookupSession('pitchfork-basic');
  const info = JSON.parse(readFileSync('dist/blink/build-info.json', 'utf8'));
  const identity = {
    core: info,
    loader: digest('dist/blink/blink.mjs'),
    wasm: digest('dist/blink/blink.wasm'),
    buildInfo: digest('dist/blink/build-info.json'),
    guest: digest('dist/guests/pitchfork'),
    baseline: digest(session.baseline),
    browser: browser.version(),
  };
  expect(info.blinkCommit).toBe('1f58c82eb1b379483493c9be6e00f1634672d72d');
  expect(info.blinkSourceDirty).toBe(false);
  expect(identity.wasm).toBe(
    'dc0d5417d7c41380fd88598e511b9aae58454fb2a6a255209f7c6f75dfb2eef7',
  );
  expect(identity.guest).toBe(
    'f30395a418e526e939350cc87e03d43c92d1aa0a0b0b104130761a8b8daa841e',
  );
  expect(identity.baseline).toBe(
    'd8ec13b28acbd3c5bec833ca8cfa3d4d0612e46d5537080ada8c44d69e2b1fc9',
  );
  await persist(
    'identity.json',
    JSON.stringify(identity, null, 2),
    'application/json',
  );
  await page.goto('/web/index.html?session=no-such-session');
  await page.waitForFunction(() =>
    window.formicariumResult?.error?.includes('unknown session'),
  );
  const environment = await page.evaluate(() => ({
    isolated: crossOriginIsolated,
    visibility: document.visibilityState,
    userAgent: navigator.userAgent,
  }));
  expect(environment.isolated).toBe(true);
  expect(environment.visibility).toBe('visible');
  const baseline = normalizeTranscript(readFileSync(session.baseline, 'utf8'));
  for (const traced of [false, true]) {
    const result = await page.evaluate(
      async ({ traced }) => {
        const worker = new Worker(
          '/tests/browser/fixtures/pitchfork-diagnostic-worker.js',
          { type: 'module' },
        );
        const events: { phase: string; [key: string]: unknown }[] = [];
        const streams = { stdout: [] as string[], stderr: [] as string[] };
        const decoders = {
          stdout: new TextDecoder(),
          stderr: new TextDecoder(),
        };
        const encoder = new TextEncoder();
        let bytes = 0;
        let settled = false;
        let timer: ReturnType<typeof setTimeout>;
        type Done = {
          type: string;
          transcript?: string;
          steps?: { command: string; exitCode: number; elapsedMs: number }[];
          message?: string;
        };
        return await new Promise<{
          status: string;
          bytes: number;
          events: typeof events;
          stdout: string;
          stderr: string;
          outcome?: Done;
        }>((resolve) => {
          const finish = (status: string, outcome?: Done) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
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
            else if (data.type === 'done') finish('completed', data);
            else if (data.type === 'fixtureerror') finish('fixtureerror', data);
            else
              finish('fixtureerror', {
                type: 'error',
                message: 'Unexpected diagnostic message',
              });
          };
          worker.onerror = (event) => {
            if (/ExitStatus|unwind/.test(event.message)) {
              event.preventDefault();
              return;
            }
            finish('fixtureerror', { type: 'error', message: event.message });
          };
          worker.onmessageerror = () =>
            finish('fixtureerror', {
              type: 'error',
              message: 'Worker message could not be decoded',
            });
          timer = setTimeout(() => finish('timeout'), 600_000);
          worker.postMessage({ traced });
        });
      },
      { traced },
    );
    const prefix = traced ? 'traced' : 'untraced';
    // Await persistence of all received streams before any subsequent Worker starts.
    await persist(`${prefix}-stdout.txt`, result.stdout, 'text/plain');
    await persist(`${prefix}-stderr.txt`, result.stderr, 'text/plain');
    const acceptance =
      !traced &&
      result.status === 'completed' &&
      result.outcome?.steps?.every((step) => step.exitCode === 0) === true &&
      normalizeTranscript(result.outcome?.transcript ?? '') === baseline;
    await persist(
      `${prefix}-diagnosis.json`,
      JSON.stringify(
        {
          ...result,
          stdout: undefined,
          stderr: undefined,
          environment,
          identity,
          acceptance,
          collectionOnly: true,
          tracedOverhead: traced,
          lastEvent: result.events.at(-1),
          truncated: result.status === 'overflow',
        },
        null,
        2,
      ),
      'application/json',
    );
    expect(['completed', 'timeout']).toContain(result.status);
    expect(result.events.some((event) => event.phase === 'setup:ready')).toBe(
      true,
    );
    expect(result.events.some((event) => event.phase === 'factory:enter')).toBe(
      true,
    );
    if (result.status !== 'timeout' || traced) break;
  }
});
