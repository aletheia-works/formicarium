import { coreAssets } from '../runtime/core.js';
import {
  formatTranscript,
  parseSessionScript,
  toSessionSteps,
} from '../runtime/session.js';
// URL で選んだゲストや手順を、パッケージのブラウザ API（createSession）で実行する。
// 開発用のツリーには assets/ がないので、bun run build が dist/paludarium に写したコアと、
// ビルドした package Worker を明示して渡す。
import { createSession } from '../runtime/web/api.js';
import type { FsEntry, OutputChunk, Session } from '../types/index.js';
import type { parseRunRequest } from './sessions.js';
import { GUEST_ENV, GUESTS, SESSIONS } from './sessions.js';

type Request = ReturnType<typeof parseRunRequest>;
export interface Outcome {
  exitCode: number;
  transcript?: string;
  steps: { command: string; exitCode: number; elapsedMs: number }[];
}
/** The browser's limit for one aube #1645 run (AGENTS.md quality limits). */
const SESSION_STEP_TIMEOUT_MS = 840_000;
type Sink = (stream: OutputChunk['stream'], text: string) => void;

const assets = coreAssets(
  new URL('../dist/paludarium/', import.meta.url),
  new URL('../runtime/web/package-worker.bundle.js', import.meta.url),
);

async function fetchBytes(relative: string) {
  const url = new URL(relative, import.meta.url);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`fetch ${url.pathname} failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** chunk ごとに、stdout と stderr を別々に文字列へ直して渡す。 */
function textOutput(sink: Sink) {
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  return (chunk: OutputChunk) =>
    sink(
      chunk.stream,
      decoders[chunk.stream].decode(chunk.bytes, { stream: true }),
    );
}

/** path までのディレクトリ（root 自身を含む）を、浅い順に返す。 */
function directoriesUnder(root: string, path: string) {
  const parts = path.slice(root.length).split('/').filter(Boolean);
  return parts
    .slice(0, -1)
    .map((_, index) => `${root}/${parts.slice(0, index + 1).join('/')}`);
}

/** ゲストが最初に出力したら text を送って閉じる stdin（対話的な実行の確認用）。 */
function typedInput(text: string) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  let sent = false;
  const afterOutput = () => {
    if (sent) return;
    sent = true;
    controller.enqueue(new TextEncoder().encode(text));
    controller.close();
  };
  return { stream, afterOutput };
}

async function runGuest(
  { name, args, stdin, terminal, network }: Extract<Request, { kind: 'guest' }>,
  sink: Sink,
): Promise<Outcome> {
  const guest = await fetchBytes(GUESTS[name]!);
  const session = await createSession({ assets });
  const input = stdin === null ? null : typedInput(stdin);
  const output = textOutput(sink);
  try {
    const result = await session.run({
      guest,
      args,
      env: GUEST_ENV[name] ?? {},
      onOutput: (chunk) => {
        output(chunk);
        input?.afterOutput();
      },
      ...(input ? { stdin: input.stream } : {}),
      ...(terminal ? { terminal } : {}),
      ...(network ? { network } : {}),
    });
    return {
      exitCode: result.exitCode,
      steps: [
        {
          command: [name, ...args].join(' '),
          exitCode: result.exitCode,
          // The Session's span: this run's Worker start, core check and load,
          // and the guest. scripts/measure-aube.ts records it as the step time.
          elapsedMs: result.elapsedMs,
        },
      ],
    };
  } finally {
    await session.dispose();
  }
}

async function runSession(
  { name }: Extract<Request, { kind: 'session' }>,
  sink: Sink,
): Promise<Outcome> {
  const definition = SESSIONS[name]!;
  // ゲスト名は手順ごとに違う（aube、pitchfork）。表の guest をそのままコマンド名として渡す。
  const commands = parseSessionScript(
    new TextDecoder().decode(await fetchBytes(definition.script)),
    { tool: definition.guest },
  );
  const guest = await fetchBytes(GUESTS[definition.guest]!);
  // Session は作業ディレクトリと HOME の中身を引き継ぐ。手順は projectRoot（cwd の親）全体を
  // 引き継ぐので、projectRoot で Session を作ってから cwd に移る。
  const root = definition.projectRoot;
  const directories = new Set<string>([definition.cwd]);
  const entries: FsEntry[] = [];
  for (const file of definition.projectFiles) {
    const path = `${root}/${file}`;
    for (const directory of directoriesUnder(root, path))
      directories.add(directory);
    entries.push({
      path,
      type: 'file',
      mode: 0o644,
      inodeId: path,
      data: await fetchBytes(definition.projectBase + file),
    });
  }
  for (const directory of directoriesUnder(root, `${definition.cwd}/`))
    directories.add(directory);
  for (const path of [...directories].sort())
    entries.unshift({ path, type: 'dir', mode: 0o755 });
  const session = await createSession({ assets, cwd: root, entries });
  try {
    await session.setCwd(definition.cwd);
    const results: {
      exitCode: number;
      stdout: Uint8Array;
      elapsedMs: number;
    }[] = [];
    for (const step of toSessionSteps(commands, definition.cwd))
      results.push(await runStep(session, step, guest, definition.guest, sink));
    // parseSessionScript never returns an empty script, so every index has a result.
    return {
      exitCode: results.at(-1)!.exitCode,
      transcript: formatTranscript(commands, results),
      steps: commands.map((command, index) => ({
        command: command.command,
        exitCode: results[index]!.exitCode,
        elapsedMs: results[index]!.elapsedMs,
      })),
    };
  } finally {
    await session.dispose();
  }
}

/** 1 手順を実行する。rm -rf と cat はゲストを起動せず、Session の操作で行う。 */
async function runStep(
  session: Session,
  step: ReturnType<typeof toSessionSteps>[number],
  guest: Uint8Array,
  tool: string,
  sink: Sink,
) {
  if (step.removeTree !== undefined) {
    await session.remove(step.removeTree);
    return { exitCode: 0, stdout: new Uint8Array(), elapsedMs: 0 };
  }
  if (step.catFile !== undefined)
    return {
      exitCode: 0,
      stdout: await session.readFile(step.catFile),
      elapsedMs: 0,
    };
  // elapsedMs spans this run's Worker start, core check and load, and the guest.
  const result = await session.run({
    guest,
    args: step.args,
    env: GUEST_ENV[tool] ?? {},
    // A session step may take as long as the 840 s the browser allows one
    // aube #1645 run, not the Session's 600 s default. A single guest run
    // (probe) keeps the default, which is its 600 s limit.
    timeoutMs: SESSION_STEP_TIMEOUT_MS,
    onOutput: textOutput(sink),
  });
  return result;
}

export function execute(request: Request, sink: Sink) {
  return request.kind === 'session'
    ? runSession(request, sink)
    : runGuest(request, sink);
}
