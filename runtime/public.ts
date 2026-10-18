export { ERROR_CODES, ExecutionError } from './errors.js';

import type { RunOptions, RunResult, Session } from '../types/index.js';
import { failure, invalid } from './errors.js';
import { type GuestHandle, guestSnapshot } from './guest-validation.js';
import { sessionPort } from './session-port.js';

export { createCommandSession } from './command.js';
export { fixtureToFsEntries, validateGuest } from './guest-validation.js';
export { createInstaller } from './install.js';

/** The package-local session brand is checked before handing private bytes to run. */
export function runValidatedGuest(
  session: Session,
  guest: GuestHandle,
  options: Omit<RunOptions, 'guest'> = {},
): Promise<RunResult> {
  try {
    sessionPort(session);
    const snapshot = guestSnapshot(guest);
    return session.run({ ...options, guest: snapshot.bytes });
  } catch (error) {
    return Promise.reject(error);
  }
}
export async function registerValidatedGuest(
  session: Session,
  tool: string,
  guest: GuestHandle,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  invalid(
    options !== null && typeof options === 'object',
    'registration options invalid',
  );
  const signal = options.signal;
  invalid(
    signal === undefined ||
      (typeof signal.aborted === 'boolean' &&
        typeof signal.addEventListener === 'function' &&
        typeof signal.removeEventListener === 'function'),
    'registration signal invalid',
  );
  if (signal?.aborted) throw failure('ABORTED', 'Registration was aborted');
  const port = sessionPort(session);
  guestSnapshot(guest);
  const reservation = await port.acquire('install');
  try {
    if (signal?.aborted) throw failure('ABORTED', 'Registration was aborted');
    await port.commitGuest(reservation, tool, guest);
  } finally {
    await port.release(reservation);
  }
}

/** Display helper only: RunResult's byte streams remain the authoritative output. */
export function decodeUtf8(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array))
    throw new TypeError('decodeUtf8 requires Uint8Array');
  return new TextDecoder().decode(bytes);
}
