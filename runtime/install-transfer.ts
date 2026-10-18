import { ExecutionError, failure, invalid } from './errors.js';
import type { CatalogEntry } from './install-catalog.js';
import { assetURL, INSTALL_LIMITS } from './install-catalog.js';

export interface InstallControl {
  readonly signal: AbortSignal;
  check(): void;
  yield(): Promise<void>;
  fail?(error: ExecutionError): void;
}
export interface TransferResult {
  bytes: Uint8Array<ArrayBuffer>;
  finalURL: string;
  fetchMs: number;
  downloadDigestMs: number;
}
interface TransferOptions {
  control: InstallControl;
  progress(processed: number, total: number | null): void;
  fetch?: typeof fetch;
  clock?: () => number;
  browser?: boolean;
}
/** Await host work with a removable abort listener; late results cannot resume the caller. */
export async function interruptible<T>(
  task: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw signal.reason;
  let abort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([task, cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
export async function installDigest(
  bytes: Uint8Array,
  control: InstallControl,
): Promise<string> {
  control.check();
  if (!globalThis.crypto?.subtle)
    throw failure('UNSUPPORTED_ENV', 'SHA256 host support required');
  const result = await interruptible(
    crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
    control.signal,
  );
  await control.yield();
  control.check();
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
function transferURL(raw: string): string {
  try {
    return assetURL(raw);
  } catch {
    throw failure('ASSET_LOAD', 'Asset redirect is not credential-free HTTPS');
  }
}
export async function transferAsset(
  entry: CatalogEntry,
  options: TransferOptions,
): Promise<TransferResult> {
  const clock = options.clock ?? (() => performance.now());
  const started = clock();
  const controller = new AbortController();
  const abort = () =>
    controller.abort(options.control.signal.reason ?? failure('ABORTED'));
  options.control.signal.addEventListener('abort', abort, { once: true });
  if (options.control.signal.aborted) abort();
  const expire = () => {
    const error = failure('TIMEOUT', 'Asset fetch deadline exceeded');
    options.control.fail?.(error);
    controller.abort(error);
  };
  const timer = setTimeout(expire, INSTALL_LIMITS.fetchMs);
  const control: InstallControl = {
    signal: controller.signal,
    check() {
      options.control.check();
      if (
        !controller.signal.aborted &&
        clock() - started >= INSTALL_LIMITS.fetchMs
      )
        expire();
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async yield() {
      await options.control.yield();
      this.check();
    },
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let complete = false;
  try {
    control.check();
    const execute = options.fetch ?? globalThis.fetch;
    if (typeof execute !== 'function')
      throw failure('UNSUPPORTED_ENV', 'Fetch stream support required');
    const browser = options.browser ?? typeof document !== 'undefined';
    let url = transferURL(entry.url);
    const visited = new Set<string>();
    for (let redirects = 0; ; redirects++) {
      control.check();
      if (visited.has(url)) throw failure('ASSET_LOAD', 'Asset redirect loop');
      visited.add(url);
      const pending = execute(url, {
        credentials: 'omit',
        redirect: browser ? 'error' : 'manual',
        signal: controller.signal,
      });
      // A host adapter which resolves after cancellation must still drop its body.
      void pending.then(
        (late) => {
          if (controller.signal.aborted)
            return late.body?.cancel().catch(() => undefined);
        },
        () => undefined,
      );
      response = await interruptible(pending, controller.signal);
      control.check();
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (browser || redirects >= 5)
          throw failure('ASSET_LOAD', 'Asset redirect limit/profile rejected');
        const location = response.headers.get('location');
        if (!location)
          throw failure('ASSET_LOAD', 'Asset redirect location missing');
        try {
          url = transferURL(new URL(location, url).href);
        } catch {
          throw failure('ASSET_LOAD', 'Asset redirect URL rejected');
        }
        continue;
      }
      break;
    }
    if (
      !response.ok ||
      response.redirected ||
      ['opaque', 'opaqueredirect'].includes(response.type) ||
      !response.body
    ) {
      await response.body?.cancel();
      throw failure('ASSET_LOAD', 'Asset response rejected');
    }
    if (response.url && transferURL(response.url) !== url) {
      await response.body.cancel();
      throw failure(
        'ASSET_LOAD',
        'Asset response URL changed without inspected redirect',
      );
    }
    const length = response.headers.get('content-length');
    const total =
      length !== null &&
      /^\d+$/.test(length) &&
      Number.isSafeInteger(Number(length))
        ? Number(length)
        : null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    options.progress(0, total);
    control.check();
    reader = response.body.getReader();
    while (true) {
      control.check();
      const chunk = await interruptible(reader.read(), controller.signal);
      control.check();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array))
        throw failure('ASSET_LOAD', 'Asset body chunk invalid');
      received += chunk.value.length;
      invalid(
        Number.isSafeInteger(received) &&
          received <= INSTALL_LIMITS.download &&
          received <= entry.downloadBytes,
        'Asset downloaded byte limit exceeded',
      );
      chunks.push(new Uint8Array(chunk.value));
      options.progress(received, total);
      await control.yield();
    }
    invalid(
      received === entry.downloadBytes,
      'Asset declared download byte count mismatch',
    );
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      control.check();
      bytes.set(chunk, offset);
      offset += chunk.length;
      await control.yield();
    }
    control.check();
    const fetched = clock();
    clearTimeout(timer); // Download hashing belongs to non-download time, not the fetch deadline.
    const digest = await installDigest(bytes, options.control);
    invalid(digest === entry.downloadSha256, 'Asset download SHA256 mismatch');
    complete = true;
    return {
      bytes,
      finalURL: url,
      fetchMs: fetched - started,
      downloadDigestMs: clock() - fetched,
    };
  } catch (error) {
    if (error instanceof ExecutionError) {
      options.control.fail?.(error);
      throw error;
    }
    if (controller.signal.aborted) throw controller.signal.reason;
    options.control.check();
    const failed = failure('ASSET_LOAD', 'Asset transfer failed');
    options.control.fail?.(failed);
    throw failed;
  } finally {
    clearTimeout(timer);
    options.control.signal.removeEventListener('abort', abort);
    if (!complete) controller.abort(failure('ABORTED', 'Asset transfer ended'));
    if (reader) {
      if (!complete) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    } else if (!complete) await response?.body?.cancel().catch(() => undefined);
  }
}
