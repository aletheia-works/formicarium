// A minimal W3C WebDriver client for safaridriver, which drives the Safari
// that ships with macOS (the showcase and site acceptance in real Safari).
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';

export const SAFARIDRIVER =
  process.env.SHOWCASE_SAFARIDRIVER ?? 'http://127.0.0.1:4444';

/**
 * One WebDriver command; resolves to the reply's `value`. node:http, not
 * fetch: fetch gives up after 300 s without response headers, and
 * execute/async answers only when the page script ends.
 */
export function webdriver(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 120000,
): Promise<unknown> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const call = request(
      `${SAFARIDRIVER}${path}`,
      {
        method,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }
          : {},
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          try {
            const reply = JSON.parse(Buffer.concat(chunks).toString()) as {
              value: unknown;
            };
            if ((response.statusCode ?? 500) >= 400)
              throw Error(
                `WebDriver ${method} ${path}: ${JSON.stringify(reply)}`,
              );
            resolve(reply.value);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    // Safari's own script timeout answers first; this only catches a hung driver.
    call.setTimeout(timeoutMs, () =>
      call.destroy(Error(`WebDriver ${method} ${path}: no answer`)),
    );
    call.on('error', reject);
    call.end(payload);
  });
}

/** safaridriver may still be starting when the tests do. */
export async function waitForDriver(): Promise<void> {
  for (let attempt = 0; attempt <= 100; attempt++) {
    try {
      const status = (await webdriver('GET', '/status')) as {
        ready?: boolean;
      };
      if (status.ready) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`safaridriver is not ready: ${SAFARIDRIVER}`);
}

export interface SafariSession {
  id: string;
  browserVersion: string;
  platformName: string;
}

/** How many times createSession asks safaridriver for a session. */
export const SESSION_ATTEMPTS = 3;

/**
 * Quit Safari so that safaridriver launches it again; it may not be running.
 * Run locally, this also quits a Safari window the developer has open.
 */
function quitSafari(): void {
  try {
    execFileSync('pkill', ['-x', 'Safari']);
  } catch {}
}

/**
 * A new Safari session; Safari runs one session at a time. safaridriver
 * sometimes times out waiting for Safari to start ("session not created");
 * after a failed attempt Safari is quit and the session is asked for again, a
 * set number of times. This retries only the connection to Safari, never a test.
 */
export async function createSession({
  retryDelayMs = 5000,
  relaunch = quitSafari,
}: {
  retryDelayMs?: number;
  relaunch?: () => void;
} = {}): Promise<SafariSession> {
  await waitForDriver();
  let created: {
    sessionId: string;
    capabilities: { browserVersion?: string; platformName?: string };
  };
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      created = (await webdriver('POST', '/session', {
        capabilities: { alwaysMatch: { browserName: 'safari' } },
      })) as typeof created;
      break;
    } catch (error) {
      // The time tells whether a later failure needs a longer wait.
      console.log(
        `Safari session attempt ${attempt} failed after ${Date.now() - started} ms: ${error}`,
      );
      if (attempt >= SESSION_ATTEMPTS) throw error;
      relaunch();
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return {
    id: created.sessionId,
    browserVersion: created.capabilities.browserVersion ?? 'unknown',
    platformName: created.capabilities.platformName ?? 'unknown',
  };
}
