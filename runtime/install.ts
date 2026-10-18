import type { Session } from '../types/index.js';
import { ExecutionError, failure, invalid } from './errors.js';
import type { GuestHandle } from './guest-validation.js';
import { validateGuest } from './guest-validation.js';
import { extractArchive } from './install-archive.js';
import type { GuestCatalog } from './install-catalog.js';
import { selectCatalog, snapshotCatalog } from './install-catalog.js';
import type { Progress } from './install-lifecycle.js';
import { InstallLifetime, ProgressReporter } from './install-lifecycle.js';
import { installDigest, transferAsset } from './install-transfer.js';
import { sessionPort } from './session-port.js';

export interface InstallOptions {
  signal?: AbortSignal;
  onProgress?: (value: Progress) => void;
}
export interface InstallResult {
  operationId: string;
  tool: string;
  versionOrName: string;
  digest: string;
  buildKey: string;
}
export interface Installer {
  install(selection: string, options?: InstallOptions): Promise<InstallResult>;
}
export interface InstallTiming {
  finalURL: string;
  phasesMs: {
    fetch: number;
    extract: number;
    digest: number;
    validate: number;
    register: number;
  };
}
const timings = new WeakMap<
  InstallResult,
  InstallTiming & { guest: GuestHandle }
>();
/** Internal acceptance instrumentation, never a package export or result field. */
export function installationTiming(
  result: InstallResult,
): InstallTiming | undefined {
  const value = timings.get(result);
  return value
    ? { finalURL: value.finalURL, phasesMs: { ...value.phasesMs } }
    : undefined;
}
/** Internal acceptance observer of the successful C03 brand, never raw bytes. */
export function installationGuest(
  result: InstallResult,
): GuestHandle | undefined {
  return timings.get(result)?.guest;
}
export function createInstaller(
  session: Session,
  catalog: GuestCatalog,
): Installer {
  const port = sessionPort(session);
  const snapshot = snapshotCatalog(catalog);
  return Object.freeze({
    async install(
      selection: string,
      options: InstallOptions = {},
    ): Promise<InstallResult> {
      invalid(
        options !== null && typeof options === 'object',
        'Install options required',
      );
      invalid(
        options.signal === undefined || options.signal instanceof AbortSignal,
        'Install signal invalid',
      );
      invalid(
        options.onProgress === undefined ||
          typeof options.onProgress === 'function',
        'Install progress callback invalid',
      );
      const entry = selectCatalog(snapshot, selection);
      if (options.signal?.aborted) {
        throw failure('ABORTED', 'Install cancelled before transfer');
      }
      const reservation = await port.acquire('install');
      const lifetime = new InstallLifetime(reservation, port, options.signal);
      const progress = new ProgressReporter(
        reservation.operationId,
        lifetime,
        options.onProgress,
      );
      const phasesMs = {
        fetch: 0,
        extract: 0,
        digest: 0,
        validate: 0,
        register: 0,
      };
      try {
        lifetime.check();
        const transferred = await transferAsset(entry, {
          control: lifetime,
          progress: (processed, total) =>
            progress.notify('fetch', processed, total),
        });
        phasesMs.fetch = transferred.fetchMs;
        phasesMs.digest = transferred.downloadDigestMs;
        let bytes = transferred.bytes;
        if (entry.format === 'tar.gz') {
          const started = performance.now();
          progress.notify('extract', 0, null);
          bytes = await extractArchive(
            bytes,
            entry.archiveEntry!,
            lifetime,
            (processed) => progress.notify('extract', processed, null),
          );
          phasesMs.extract = performance.now() - started;
        }
        lifetime.check();
        invalid(
          bytes.length === entry.elfBytes,
          'Install declared ELF byte count mismatch',
        );
        let started = performance.now();
        progress.notify('digest', 0, bytes.length);
        const digest = await installDigest(bytes, lifetime);
        invalid(
          digest === entry.buildInfo.elfSha256,
          'Install ELF SHA256 mismatch',
        );
        progress.notify('digest', bytes.length, bytes.length);
        phasesMs.digest += performance.now() - started;
        started = performance.now();
        progress.notify('validate', 0, bytes.length);
        lifetime.check();
        const handle = validateGuest(bytes, {
          elfSha256: entry.buildInfo.elfSha256,
          buildInfoSha256: entry.buildInfoSha256,
          identity: entry.buildInfo,
        });
        // C03 is synchronous: check after it rather than claiming mid-validation cancellation.
        await lifetime.yield();
        lifetime.check();
        progress.notify('validate', bytes.length, bytes.length);
        phasesMs.validate = performance.now() - started;
        started = performance.now();
        progress.notify('register', 0, bytes.length);
        lifetime.check();
        await port.commitGuest(reservation, entry.tool, handle);
        // Commit is the terminal success linearization point. A later caller abort
        // cannot turn an already committed installation into a reported failure.
        progress.finish();
        lifetime.complete();
        phasesMs.register = performance.now() - started;
        const result = Object.freeze({
          operationId: reservation.operationId,
          tool: entry.tool,
          versionOrName: entry.versionOrName,
          digest: handle.digest,
          buildKey: handle.buildInfo.buildKey,
        });
        timings.set(result, {
          finalURL: transferred.finalURL,
          phasesMs,
          guest: handle,
        });
        return result;
      } catch (error) {
        if (error instanceof ExecutionError) lifetime.fail(error);
        throw await lifetime.reason(error);
      } finally {
        progress.finish();
        lifetime.cleanup();
        await port.release(reservation);
      }
    },
  });
}
