import type { LegacyEntry, ModuleFactory } from '../runtime/contracts.js';
import { errorText } from '../runtime/contracts.js';
// ブラウザの Worker。コア（blink）を読み込み、ゲストを実行して結果をページに返す（FR2.2）。
// コアの pthread は、この Worker からさらに Worker として起動される。
// メッセージ：{type:'stdout'|'stderr', text} を逐次、最後に {type:'done', ...} か {type:'error', message}。
import { defaultCore } from '../runtime/core.js';
import {
  GUEST_DIR,
  GuestRunError,
  runGuest,
  runSession,
} from '../runtime/guest-io.js';
import {
  formatTranscript,
  parseSessionScript,
  toSessionSteps,
} from '../runtime/session.js';
import { GUEST_ENV, GUESTS, SESSIONS } from './sessions.js';

// Emscripten は Atomics.waitAsync があると、このスレッドへの代行依頼（ファイル操作など）を
// waitAsync で待つ。WebKit ではその通知が取りこぼされ、ゲスト全体が数十秒〜無期限に止まる
// ことを観測した（aube #1645、loop-back 1 の診断）。コアを読み込む前に無効にして、
// postMessage で起こす経路を使わせる。
delete (Atomics as { waitAsync?: typeof Atomics.waitAsync }).waitAsync;

const decoder = { stdout: new TextDecoder(), stderr: new TextDecoder() };

function post(type: 'stdout' | 'stderr', chunk: Uint8Array) {
  self.postMessage({
    type,
    text: decoder[type].decode(chunk, { stream: true }),
  });
}

async function fetchBytes(relative: string) {
  const url = new URL(relative, import.meta.url);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`fetch ${url.pathname} failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchText(relative: string) {
  return new TextDecoder().decode(await fetchBytes(relative));
}

async function loadCore() {
  const url = new URL(`../${defaultCore.loaderPath}`, import.meta.url);
  const { default: createModule } = await import(url.href);
  return createModule;
}

async function runGuestRequest(
  createModule: ModuleFactory,
  {
    name,
    args,
    coreFlags = [],
  }: { name: string; args: string[]; coreFlags?: string[] },
) {
  const guestPath = `${GUEST_DIR}/${name}`;
  const data = await fetchBytes(GUESTS[name]!);
  const started = performance.now();
  const result = await runGuest({
    createModule,
    core: defaultCore,
    guestPath,
    args,
    coreFlags: coreFlags.includes('-s') ? [...coreFlags, '-e'] : coreFlags,
    env: GUEST_ENV[name] ?? {},
    entries: [{ path: guestPath, type: 'file', data, mode: 0o755 }],
    onStdout: (c) => post('stdout', c),
    onStderr: (c) => post('stderr', c),
  });
  return {
    exitCode: result.exitCode,
    steps: [
      {
        command: [name, ...args].join(' '),
        exitCode: result.exitCode,
        elapsedMs: performance.now() - started,
      },
    ],
  };
}

async function runSessionRequest(
  createModule: ModuleFactory,
  { name, coreFlags = [] }: { name: string; coreFlags?: string[] },
) {
  const session = SESSIONS[name]!;
  // ゲスト名は手順ごとに違う（aube、pitchfork）。表の guest をそのままコマンド名として渡す。
  const commands = parseSessionScript(await fetchText(session.script), {
    tool: session.guest,
  });
  const guestPath = `${GUEST_DIR}/${session.guest}`;
  const guestEntry: LegacyEntry = {
    path: guestPath,
    type: 'file',
    data: await fetchBytes(GUESTS[session.guest]!),
    mode: 0o755,
  };
  const entries: LegacyEntry[] = [];
  for (const file of session.projectFiles) {
    entries.push({
      path: `${session.projectRoot}/${file}`,
      type: 'file',
      data: await fetchBytes(session.projectBase + file),
      mode: 0o644,
    });
  }
  const results = await runSession({
    createModule,
    core: defaultCore,
    guestPath,
    guestEntry,
    steps: toSessionSteps(commands, session.cwd),
    entries,
    env: GUEST_ENV[session.guest] ?? {},
    cwd: session.cwd,
    coreFlags: coreFlags.includes('-s') ? [...coreFlags, '-e'] : coreFlags,
    persist: session.persist,
    onStdout: (c) => post('stdout', c),
    onStderr: (c) => post('stderr', c),
  });
  return {
    exitCode: results.at(-1)?.exitCode,
    transcript: formatTranscript(commands, results),
    steps: commands.map((c, i) => ({
      command: c.command,
      exitCode: results[i]?.exitCode,
      elapsedMs: results[i]?.elapsedMs,
    })),
  };
}

self.onmessage = async ({ data: request }) => {
  try {
    const createModule = await loadCore();
    const outcome =
      request.kind === 'session'
        ? await runSessionRequest(createModule, request)
        : await runGuestRequest(createModule, request);
    self.postMessage({ type: 'done', ...outcome });
  } catch (error) {
    // コアの stderr の最後を添えて、原因を追えるようにする
    const stderr =
      error instanceof GuestRunError && error.stderr
        ? new TextDecoder().decode(error.stderr)
        : '';
    self.postMessage({ type: 'error', message: errorText(error), stderr });
  }
};

// Emscripten は終了時に ExitStatus を throw する。結果は onExit で受け取っているので、
// それ以外のエラーだけをページに伝える。
self.addEventListener('error', (event) => {
  if (
    event.error?.name === 'ExitStatus' ||
    /ExitStatus|unwind/.test(String(event.message))
  ) {
    event.preventDefault();
  }
});
