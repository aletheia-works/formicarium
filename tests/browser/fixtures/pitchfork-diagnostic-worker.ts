import type { LegacyEntry, ModuleFactory } from '../../../runtime/contracts.js';
import { errorText } from '../../../runtime/contracts.js';
import { defaultCore } from '../../../runtime/core.js';
import { GUEST_DIR, runSession } from '../../../runtime/guest-io.js';
import {
  formatTranscript,
  parseSessionScript,
  toSessionSteps,
} from '../../../runtime/session.js';
import { GUEST_ENV, GUESTS, SESSIONS } from '../../../web/sessions.js';

// Match the real Worker before importing the generated core.
delete (Atomics as { waitAsync?: typeof Atomics.waitAsync }).waitAsync;
const root = new URL('../../../', import.meta.url);
const sessionBase = new URL('web/sessions.js', root);
let sequence = 0;
function event(phase: string, details: object = {}) {
  self.postMessage({
    type: 'diagnostic',
    sequence: ++sequence,
    atMs: performance.now(),
    phase,
    ...details,
  });
}
async function bytes(relative: string) {
  const url = new URL(relative, sessionBase);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`fixture fetch ${url.pathname}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
function observe<Args extends unknown[], Result>(
  callback: (this: unknown, ...args: Args) => Result,
  phase: string,
  details: object,
) {
  return function (this: unknown, ...args: Args): Result {
    event(`${phase}:enter`, {
      ...details,
      ...(phase === 'onExit' || phase === 'quit' ? { exitCode: args[0] } : {}),
    });
    try {
      const result = callback.apply(this, args);
      event(`${phase}:return`, details);
      return result;
    } catch (error) {
      event(`${phase}:throw`, { ...details, error: errorText(error) });
      throw error;
    }
  };
}
self.onmessage = async ({ data }: MessageEvent<{ traced: boolean }>) => {
  self.onmessage = null;
  try {
    event('setup:begin', { traced: data.traced });
    const session = SESSIONS['pitchfork-basic'];
    const commands = parseSessionScript(
      new TextDecoder().decode(await bytes(session.script)),
      { tool: session.guest },
    );
    const guestCommands = commands
      .map((command, index) => ({ ...command, stepIndex: index + 1 }))
      .filter((command) => command.args !== undefined);
    const guestPath = `${GUEST_DIR}/${session.guest}`;
    const guestEntry: LegacyEntry = {
      path: guestPath,
      type: 'file',
      mode: 0o755,
      data: await bytes(GUESTS[session.guest]),
    };
    const entries: LegacyEntry[] = [];
    for (const file of session.projectFiles)
      entries.push({
        path: `${session.projectRoot}/${file}`,
        type: 'file',
        mode: 0o644,
        data: await bytes(session.projectBase + file),
      });
    event('setup:ready', { commands: commands.map((c) => c.command) });
    const { default: original } = (await import(
      new URL(defaultCore.loaderPath, root).href
    )) as { default: ModuleFactory };
    event('loader:imported');
    let moduleIndex = 0;
    const createModule: ModuleFactory = (options) => {
      const index = moduleIndex++;
      const command = guestCommands[index];
      const details = {
        moduleIndex: index + 1,
        stepIndex: command?.stepIndex,
        command: command?.command,
        arguments: [...options.arguments],
      };
      event('factory:enter', details);
      let promise: ReturnType<ModuleFactory>;
      try {
        promise = original({
          ...options,
          preRun: options.preRun.map((callback) =>
            observe(callback, 'preRun', details),
          ),
          onExit: observe(options.onExit, 'onExit', details),
          quit: observe(options.quit, 'quit', details),
        });
      } catch (error) {
        event('factory:throw', { ...details, error: errorText(error) });
        throw error;
      }
      // Observe without replacing the factory's promise or its resolved module.
      void promise.then(
        () => event('factory:resolved', details),
        (error) =>
          event('factory:rejected', { ...details, error: errorText(error) }),
      );
      return promise;
    };
    const post = (type: 'stdout' | 'stderr', chunk: Uint8Array) =>
      self.postMessage({ type, bytes: new Uint8Array(chunk) });
    event('session:begin');
    const results = await runSession({
      createModule,
      core: defaultCore,
      guestPath,
      guestEntry,
      entries,
      steps: toSessionSteps(commands, session.cwd),
      env: GUEST_ENV[session.guest],
      cwd: session.cwd,
      persist: session.persist,
      coreFlags: data.traced ? ['-s', '-e'] : [],
      onStdout: (chunk) => post('stdout', chunk),
      onStderr: (chunk) => post('stderr', chunk),
    });
    event('session:resolved');
    self.postMessage({
      type: 'done',
      transcript: formatTranscript(commands, results),
      steps: results.map((result, index) => ({
        command: commands[index].command,
        exitCode: result.exitCode,
        elapsedMs: result.elapsedMs,
      })),
    });
  } catch (error) {
    event('session:rejected', { error: errorText(error) });
    self.postMessage({ type: 'fixtureerror', message: errorText(error) });
  }
};
self.addEventListener('error', (event) => {
  if (
    event.error?.name === 'ExitStatus' ||
    /ExitStatus|unwind/.test(String(event.message))
  )
    event.preventDefault();
});
