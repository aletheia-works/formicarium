import type { CoreLauncher, LegacyEntry } from '../runtime/contracts.js';
import { errorText } from '../runtime/contracts.js';
// ブラウザの Worker。コア（paludarium）を読み込み、ゲストを実行して結果をページに返す。
// コアは自分の Worker を、この Worker からさらに起動する。
// メッセージ：{type:'stdout'|'stderr', text} を逐次、最後に {type:'done', ...} か {type:'error', message}。
import { coreAssets, loadPackageCore } from '../runtime/core.js';
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

/** bun run build が dist/paludarium に写したコアを、照合してから起動する。 */
function loadCore() {
  return loadPackageCore({
    assets: coreAssets(
      new URL('../dist/paludarium/', import.meta.url),
      import.meta.url,
    ),
    readBytes: (url) => fetchBytes(String(url)),
  });
}

async function runGuestRequest(
  launcher: CoreLauncher,
  { name, args }: { name: string; args: string[] },
) {
  const guestPath = `${GUEST_DIR}/${name}`;
  const data = await fetchBytes(GUESTS[name]!);
  const started = performance.now();
  const result = await runGuest({
    launcher,
    guestPath,
    args,
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
  launcher: CoreLauncher,
  { name }: { name: string },
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
    launcher,
    guestPath,
    guestEntry,
    steps: toSessionSteps(commands, session.cwd),
    entries,
    env: GUEST_ENV[session.guest] ?? {},
    cwd: session.cwd,
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
    const { launcher, cleanup } = await loadCore();
    try {
      const outcome =
        request.kind === 'session'
          ? await runSessionRequest(launcher, request)
          : await runGuestRequest(launcher, request);
      self.postMessage({ type: 'done', ...outcome });
    } finally {
      await cleanup();
    }
  } catch (error) {
    // コアの stderr の最後を添えて、原因を追えるようにする
    const stderr =
      error instanceof GuestRunError && error.stderr
        ? new TextDecoder().decode(error.stderr)
        : '';
    self.postMessage({ type: 'error', message: errorText(error), stderr });
  }
};
