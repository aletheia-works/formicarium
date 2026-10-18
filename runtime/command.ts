import type {
  CommandOptions,
  CommandResult,
  CommandSession,
  InstallResult,
  OutputChunk,
  Progress,
  RunOptions,
  Session,
} from '../types/index.js';
import {
  formatListing,
  guardCommandInput,
  tokenizeCommand,
} from './command-parse.js';
import { failure, invalid } from './errors.js';
import { createInstaller, type Installer } from './install.js';
import type { GuestCatalog } from './install-catalog.js';
import { type SessionPort, sessionPort } from './session-port.js';

/** Exact argv[0] names that never reach a registered guest of the same name. */
export const RESERVED_COMMANDS = Object.freeze([
  'ls',
  'cat',
  'rm',
  'cd',
  'install',
] as const);
const EMPTY = new Uint8Array();
const encoder = new TextEncoder();

interface CheckedOptions {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  onOutput?: (chunk: OutputChunk) => void;
}
type Route =
  | { kind: 'ls'; path?: string }
  | { kind: 'fs'; name: 'cat' | 'cd' | 'rm'; path: string }
  | { kind: 'install'; selection: string }
  | { kind: 'guest'; tool: string; args: readonly string[] };

/** Each property is read once, so a getter cannot change it after checking. */
function checkOptions(value: unknown): CheckedOptions {
  if (value === undefined) return {};
  invalid(
    value !== null && typeof value === 'object',
    'command options invalid',
  );
  const raw = value as CommandOptions;
  const { signal, onProgress, onOutput } = raw;
  invalid(
    signal === undefined || signal instanceof AbortSignal,
    'command signal invalid',
  );
  invalid(
    onProgress === undefined || typeof onProgress === 'function',
    'command progress callback invalid',
  );
  invalid(
    onOutput === undefined || typeof onOutput === 'function',
    'command output callback invalid',
  );
  return { signal, onProgress, onOutput };
}

/** CommandDispatcher (BR4.8, BR4.9, BR4.12): shape checks precede reservation. */
function route(argv: readonly string[]): Route {
  const [name, ...rest] = argv as [string, ...string[]];
  if (name === 'ls') {
    invalid(rest.length <= 1, 'ls accepts at most one path');
    invalid(!rest[0]?.startsWith('-'), 'ls flags are unsupported');
    return { kind: 'ls', path: rest[0] };
  }
  if (name === 'cat' || name === 'cd') {
    invalid(rest.length === 1, `${name} requires exactly one path`);
    return { kind: 'fs', name, path: rest[0]! };
  }
  if (name === 'rm') {
    invalid(
      rest.length === 2 && rest[0] === '-rf',
      'rm accepts only rm -rf path',
    );
    return { kind: 'fs', name, path: rest[1]! };
  }
  if (name === 'install') {
    invalid(rest.length === 1, 'install requires exactly one selection');
    return { kind: 'install', selection: rest[0]! };
  }
  return { kind: 'guest', tool: name, args: rest };
}

/** ResultBuilder (BR4.17): every call returns new bytes owned by the caller. */
function result(
  kind: CommandResult['kind'],
  exitCode: number,
  stdout: Uint8Array = EMPTY,
  stderr: Uint8Array = EMPTY,
): CommandResult {
  return {
    kind,
    exitCode,
    stdout: new Uint8Array(stdout),
    stderr: new Uint8Array(stderr),
  };
}

function preabort(options: CheckedOptions): void {
  if (options.signal?.aborted)
    throw failure('ABORTED', 'Command was aborted before it started');
}

/** BuiltinAdapter: cat/cd/rm use one fs reservation; ls uses public listEntries. */
async function runBuiltin(
  session: Session,
  port: SessionPort,
  target: Extract<Route, { kind: 'ls' | 'fs' }>,
  options: CheckedOptions,
): Promise<CommandResult> {
  // Path syntax (empty, NUL, `..`) does not depend on the cwd, so it is
  // rejected as INVALID_INPUT before the abort check and the reservation.
  if (target.path !== undefined) port.resolvePath(target.path);
  // U2 completes builtins synchronously; a signal raised after this check
  // does not interrupt or change the completed result.
  preabort(options);
  if (target.kind === 'ls') {
    // Resolving and listing happen in the same tick, so the cwd used for a
    // relative path is the one listEntries observes.
    const entries =
      target.path === undefined
        ? await session.listEntries()
        : await session.listEntries(port.resolvePath(target.path));
    return result('builtin', 0, formatListing(entries));
  }
  const reservation = await port.acquire('fs');
  try {
    // The cwd cannot change while this fs reservation is held.
    const path = port.resolvePath(target.path);
    const argv =
      target.name === 'rm' ? ['rm', '-rf', path] : [target.name, path];
    const done = await port.builtin(reservation, argv);
    return result('builtin', 0, done.stdout);
  } finally {
    await port.release(reservation);
  }
}

/** InstallAdapter: C04 owns selection, reservation, cancellation and commit. */
async function runInstall(
  installer: Installer,
  selection: string,
  options: CheckedOptions,
): Promise<CommandResult> {
  const installation: InstallResult = await installer.install(selection, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
  });
  const line = `installed ${installation.tool}@${installation.versionOrName} (sha256 ${installation.digest})\n`;
  return { ...result('install', 0, encoder.encode(line)), installation };
}

/** GuestRunAdapter: one run reservation; Session.run's default timeout applies. */
async function runGuest(
  port: SessionPort,
  target: Extract<Route, { kind: 'guest' }>,
  options: CheckedOptions,
): Promise<CommandResult> {
  preabort(options);
  const reservation = await port.acquire('run');
  try {
    const runOptions: Omit<RunOptions, 'guest' | 'args'> = {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.onOutput ? { onOutput: options.onOutput } : {}),
    };
    const run = await port.runInstalled(
      reservation,
      target.tool,
      target.args,
      runOptions,
    );
    return {
      ...result('guest', run.exitCode, run.stdout, run.stderr),
      runId: run.runId,
    };
  } finally {
    await port.release(reservation);
  }
}

/**
 * C05 factory. The Session must come from this package (INVALID_INPUT
 * otherwise) and the catalog is validated and copied by C04. The returned
 * object exposes only `execute`; it never hands out the Session, Installer or
 * the internal port, and it keeps no cwd, filesystem or guest copy.
 */
export function createCommandSession(
  session: Session,
  options: { catalog: GuestCatalog },
): CommandSession {
  const port = sessionPort(session);
  invalid(
    options !== null && typeof options === 'object',
    'command session options required',
  );
  const installer = createInstaller(session, options.catalog);
  return Object.freeze({
    async execute(input: string, raw?: CommandOptions) {
      // Order: INVALID_INPUT (options, input, tokens, shape) -> ABORTED ->
      // DISPOSED/BUSY from the reservation itself.
      const checked = checkOptions(raw);
      const argv = tokenizeCommand(guardCommandInput(input));
      if (argv.length === 0) return result('empty', 0);
      const target = route(argv);
      if (target.kind === 'install')
        return runInstall(installer, target.selection, checked);
      if (target.kind === 'guest') return runGuest(port, target, checked);
      return runBuiltin(session, port, target, checked);
    },
  });
}
