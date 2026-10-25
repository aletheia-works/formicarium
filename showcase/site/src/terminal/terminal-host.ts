import type {
  CommandSession,
  Progress,
  Session,
} from '@aletheia-works/formicarium';
import { DisplayBuffer } from './buffer.ts';
import { loadCatalog, siteRootFrom } from './catalog.ts';
import type { Timers } from './fetch-limited.ts';
import {
  emptyEntries,
  fixtureToEntries,
  loadFixtureIndex,
  WORK_CWD,
  WORK_ROOT,
} from './fixture-index.ts';
import {
  type FormicariumManifest,
  type LoadedFormicarium,
  loadFormicarium,
} from './formicarium-loader.ts';
import { type EditorAction, LineEditor } from './keys.ts';
import { renderOmitted } from './omitted-notice.ts';
import { CommandOutput } from './output.ts';
import {
  parsePageData,
  TERMINAL_ATTRIBUTE,
  type TerminalPageData,
} from './page-data.ts';
import { type Status, statusText } from './status.ts';

/** functional-spec TerminalSession states. */
export type HostState =
  | 'isolating'
  | 'loading'
  | 'installing'
  | 'ready'
  | 'ready_failed_install'
  | 'running'
  | 'failed'
  | 'disposed';
/** Without control by the service worker after this long, isolation failed. */
export const ISOLATION_WAIT_MS = 15000;

/** The part of xterm.js the host uses (a fake in unit tests). */
export interface TerminalLike {
  /** The size an interactive run is given (fixed for the run). */
  readonly cols: number;
  readonly rows: number;
  write(data: string): void;
  reset(): void;
  focus(): void;
  dispose(): void;
}
export interface TextElement {
  textContent: string | null;
}
export interface Isolation {
  isolated: boolean;
  serviceWorker: 'unsupported' | 'controlled' | 'pending';
}
export interface HostOptions {
  data: TerminalPageData;
  terminal: TerminalLike;
  status: TextElement;
  omitted: TextElement & { hidden: HTMLElement['hidden'] };
  /** The host element: its data-state mirrors the state for styling and tests. */
  root?: { dataset: Record<string, string | undefined> };
  /** The Stop button: shown only while an interactive run takes the keys. */
  stop?: { hidden: HTMLElement['hidden'] };
  pageUrl: string;
  isolation: () => Isolation;
  load?: (
    manifest: FormicariumManifest,
    siteRoot: URL,
  ) => Promise<LoadedFormicarium>;
  fetchImpl?: typeof fetch;
  timers?: Timers;
}

const BUSY: readonly HostState[] = ['running', 'installing'];
const INPUT: readonly HostState[] = [
  'ready',
  'ready_failed_install',
  'running',
  'installing',
];

/** Resolves the argument of a successful `cd` against the current directory. */
export function nextCwd(cwd: string, line: string): string | null {
  const words = line.trim().split(/[ \t]+/);
  if (words[0] !== 'cd' || words.length !== 2 || /['"\\]/.test(words[1]!))
    return null;
  const parts = words[1]!.startsWith('/') ? [] : cwd.split('/').filter(Boolean);
  for (const part of words[1]!.split('/'))
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  return `/${parts.join('/')}`;
}

/**
 * One terminal of a page: isolation, loading, the automatic install of a tool
 * page, one command at a time, Ctrl-C, display limits and dispose.
 */
export class TerminalHost {
  state: HostState = 'isolating';
  cwd = WORK_CWD;
  readonly editor = new LineEditor();
  readonly display = new DisplayBuffer();
  readonly #options: HostOptions;
  readonly #page = new AbortController();
  #run: AbortController | null = null;
  #output: CommandOutput | null = null;
  #session: Session | null = null;
  #commands: CommandSession | null = null;
  #isolationTimer: unknown = null;
  /** The stdin of the running interactive tool; null when none runs. */
  #input: ReadableStreamDefaultController<Uint8Array> | null = null;
  readonly #encoder = new TextEncoder();
  /** The last tool an install command registered (shown in the ready text). */
  #installed: { tool: string; version: string } | null = null;

  constructor(options: HostOptions) {
    this.#options = options;
  }

  #setState(state: HostState): void {
    this.state = state;
    if (this.#options.root) this.#options.root.dataset.state = state;
  }

  #status(status: Status): void {
    this.#options.status.textContent = statusText(
      status,
      this.#options.data.locale,
    );
  }

  #print(text: string): void {
    const redraw = this.display.append(text);
    if (redraw === null) this.#options.terminal.write(text);
    else {
      this.#options.terminal.reset();
      this.#options.terminal.write(redraw);
      renderOmitted(
        this.#options.omitted,
        this.display,
        this.#options.data.locale,
      );
    }
  }

  #prompt(): void {
    this.#print(`${this.cwd}$ `);
  }

  /**
   * `clear` and Ctrl-L: the page empties the terminal and its scrollback
   * itself (no command runs), and the omitted notice goes with the output.
   */
  #clear(): void {
    this.display.clear();
    this.display.droppedBytes = 0;
    this.display.droppedLines = 0;
    this.#options.terminal.reset();
    renderOmitted(
      this.#options.omitted,
      this.display,
      this.#options.data.locale,
    );
  }

  /** isolating -> loading -> installing / ready, or failed. */
  async start(): Promise<void> {
    this.#setState('isolating');
    this.#status({ kind: 'isolating' });
    const isolation = this.#options.isolation();
    if (!isolation.isolated) {
      // coi-serviceworker reloads the page once it controls it.
      if (isolation.serviceWorker === 'pending') {
        const timers = this.#options.timers ?? globalThis;
        this.#isolationTimer = timers.setTimeout(
          () => this.#isolationFailed(),
          ISOLATION_WAIT_MS,
        );
        return;
      }
      this.#isolationFailed();
      return;
    }
    await this.#load();
  }

  #isolationFailed(): void {
    if (this.state !== 'isolating') return;
    this.#setState('failed');
    this.#status({ kind: 'isolation-failed' });
  }

  async #load(): Promise<void> {
    const { data } = this.#options;
    this.#setState('loading');
    this.#status({ kind: 'loading' });
    const siteRoot = siteRootFrom(this.#options.pageUrl, data.base);
    const fetchOptions = {
      signal: this.#page.signal,
      fetchImpl: this.#options.fetchImpl,
      timers: this.#options.timers,
    };
    try {
      const loaded = await (this.#options.load ?? loadFormicarium)(
        data.formicarium,
        siteRoot,
      );
      const entries = data.fixture
        ? await fixtureToEntries(
            await loadFixtureIndex({
              url: new URL(data.fixture.path, siteRoot).href,
              sha256: data.fixture.sha256,
              fetch: fetchOptions,
            }),
          )
        : emptyEntries();
      const catalog = await loadCatalog({
        url: new URL(data.catalog.path, siteRoot).href,
        sha256: data.catalog.sha256,
        siteRoot,
        fetch: fetchOptions,
      });
      // The persistence root is /work (app/ and the directories beside it);
      // the shell then starts in /work/app.
      const session = await loaded.browser.createSession({
        assets: loaded.assets,
        cwd: WORK_ROOT,
        entries: loaded.root.fixtureToFsEntries(entries),
      });
      await session.setCwd(WORK_CWD);
      if (this.state === 'disposed') {
        await session.dispose();
        return;
      }
      this.#session = session;
      this.#commands = loaded.root.createCommandSession(session, { catalog });
    } catch (error) {
      if (this.state === 'disposed') return;
      this.#setState('failed');
      const failure = new CommandOutput({
        write: (text) => this.#print(text),
      }).fail(error);
      this.#status({ kind: 'failed', ...failure });
      return;
    }
    if (data.mode === 'preinstalled' && data.tool) {
      const line = `install ${data.tool}`;
      this.#print(`${this.cwd}$ ${line}\n`);
      await this.#execute(line, true);
    } else {
      this.#setState('ready');
      this.#status({ kind: 'ready', tool: null, version: null });
      this.#prompt();
    }
  }

  /**
   * xterm onData. Nothing is typed before ready or after a failure. An
   * interactive run gets every key unchanged (Ctrl-C included).
   */
  onData(data: string): void {
    if (!INPUT.includes(this.state)) return;
    if (this.#input) {
      try {
        this.#input.enqueue(this.#encoder.encode(data));
      } catch {
        // The run settled and the Session cancelled its stdin: the key is late.
      }
      return;
    }
    for (const action of this.editor.handle(data, BUSY.includes(this.state)))
      this.#apply(action);
  }

  #apply(action: EditorAction): void {
    switch (action.kind) {
      case 'write':
        this.#print(action.text);
        return;
      case 'replace':
        // Erase the row and redraw it (through the buffer, so a redraw matches).
        this.#print(`\r\x1b[2K${this.cwd}$ ${action.line}`);
        return;
      case 'cancel-line':
        this.#print('^C\n');
        this.#prompt();
        return;
      case 'abort':
        this.abort();
        return;
      case 'notice':
        this.#status({ kind: action.code });
        return;
      case 'clear':
        this.#clear();
        this.#print(`${this.cwd}$ ${this.editor.line}`);
        return;
      case 'submit':
        this.#print('\n');
        if (action.line.trim() === 'clear') {
          this.#clear();
          this.#prompt();
        } else if (action.line.trim() === '') this.#prompt();
        else void this.#execute(action.line, false);
    }
  }

  /**
   * Ctrl-C while running or installing, or the Stop button of an interactive
   * run: ABORTED, late output is dropped.
   */
  abort(): void {
    if (!BUSY.includes(this.state)) return;
    this.#output?.cancel();
    this.#run?.abort();
  }

  async #execute(line: string, automatic: boolean): Promise<void> {
    const commands = this.#commands;
    if (!commands) return;
    const words = line.trim().split(/[ \t]+/);
    const installing = words[0] === 'install' && words.length === 2;
    const target = installing ? (words[1] ?? '') : '';
    const shownVersion = automatic ? (this.#options.data.version ?? '') : '';
    const interactive =
      !installing && this.#options.data.interactive.includes(words[0] ?? '');
    this.#setState(installing ? 'installing' : 'running');
    this.#status(
      installing
        ? {
            kind: 'installing',
            tool: target,
            version: shownVersion,
            progress: null,
          }
        : interactive
          ? { kind: 'interactive' }
          : { kind: 'running' },
    );
    const run = new AbortController();
    this.#run = run;
    const { terminal } = this.#options;
    let stdin: ReadableStream<Uint8Array> | undefined;
    if (interactive) {
      stdin = new ReadableStream({
        start: (controller) => {
          this.#input = controller;
        },
      });
      if (this.#options.stop) this.#options.stop.hidden = false;
    }
    // A full-screen tool draws with escape sequences, so its output goes
    // straight to xterm: the display buffer would cut and redraw it.
    const output = new CommandOutput({
      write: interactive
        ? (text) => terminal.write(text)
        : (text) => this.#print(text),
    });
    this.#output = output;
    const onProgress = (progress: Progress) => {
      if (!run.signal.aborted && this.state === 'installing')
        this.#status({
          kind: 'installing',
          tool: target,
          version: shownVersion,
          progress,
        });
    };
    let failure: { code: string; message: string } | null = null;
    try {
      const result = await commands.execute(line, {
        signal: run.signal,
        onOutput: output.onOutput,
        onProgress,
        ...(stdin
          ? {
              stdin,
              terminal: { columns: terminal.cols, rows: terminal.rows },
            }
          : {}),
      });
      if (this.state === 'disposed') return;
      if (run.signal.aborted) failure = this.#aborted();
      else {
        output.finish(result);
        const cwd = result.exitCode === 0 ? nextCwd(this.cwd, line) : null;
        if (cwd) this.cwd = cwd;
        if (
          result.kind === 'install' &&
          result.exitCode === 0 &&
          result.installation
        )
          this.#installed = {
            tool: result.installation.tool,
            version: result.installation.versionOrName,
          };
      }
    } catch (error) {
      if (this.state === 'disposed') return;
      failure = run.signal.aborted ? this.#aborted() : output.fail(error);
    } finally {
      if (this.#run === run) this.#run = null;
      if (interactive) this.#endInput();
    }
    this.#finish(automatic, failure, output.wrote);
  }

  /** running/installing -> ready (or ready_failed_install after the page's own install). */
  #finish(
    automatic: boolean,
    failure: { code: string; message: string } | null,
    wrote: boolean,
  ): void {
    if (automatic && failure) {
      this.#setState('ready_failed_install');
      this.#status({ kind: 'ready-failed-install', ...failure });
    } else {
      this.#setState('ready');
      if (failure?.code === 'ABORTED') this.#status({ kind: 'aborted' });
      else if (failure) this.#status({ kind: 'command-failed', ...failure });
      else if (!failure && !wrote) this.#status({ kind: 'no-output' });
      else
        this.#status({
          kind: 'ready',
          tool: this.#installed?.tool ?? null,
          version: this.#installed?.version ?? null,
        });
    }
    this.#prompt();
  }

  /** The interactive run is over: its stdin ends and the keys return to the line. */
  #endInput(): void {
    try {
      this.#input?.close();
    } catch {
      // The Session cancelled the stream when the run settled.
    }
    this.#input = null;
    if (this.#options.stop) this.#options.stop.hidden = true;
    if (this.state !== 'disposed') this.#options.terminal.focus();
  }

  #aborted(): { code: string; message: string } {
    this.#print('^C\nABORTED: the command was cancelled\n');
    return { code: 'ABORTED', message: 'the command was cancelled' };
  }

  /** pagehide: abort, then drop the session, the command session and xterm. */
  async dispose(): Promise<void> {
    if (this.state === 'disposed') return;
    this.#setState('disposed');
    if (this.#isolationTimer !== null)
      (this.#options.timers ?? globalThis).clearTimeout(
        this.#isolationTimer as never,
      );
    this.#output?.cancel();
    this.#run?.abort();
    this.#endInput();
    this.#page.abort();
    this.#commands = null;
    const session = this.#session;
    this.#session = null;
    this.#options.terminal.dispose();
    await session?.dispose().catch(() => undefined);
  }
}

/** Tab and Shift+Tab move the page focus instead of reaching xterm. */
export const passKey = (event: { key: string }) => event.key !== 'Tab';

/**
 * pagehide disposes the terminal; a page restored from the back-forward cache
 * holds a disposed terminal, so it is loaded again.
 */
export function attachPageEvents(
  target: Pick<EventTarget, 'addEventListener'>,
  host: Pick<TerminalHost, 'dispose'>,
  reload: () => void,
): void {
  target.addEventListener('pagehide', () => void host.dispose());
  target.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) reload();
  });
}

/** The page entry of the terminal pages (xterm.js, fit addon, page events). */
export async function startTerminalPage(
  document: Document,
): Promise<TerminalHost | null> {
  const element = document.querySelector<HTMLElement>(
    `[${TERMINAL_ATTRIBUTE}]`,
  );
  const status = document.querySelector<HTMLElement>(
    '[data-testid="terminal-status"]',
  );
  const omitted = document.querySelector<HTMLElement>(
    '[data-testid="terminal-omitted"]',
  );
  const stop = document.querySelector<HTMLButtonElement>(
    '[data-testid="terminal-stop"]',
  );
  if (!element || !status || !omitted) return null;
  const data = parsePageData(element.getAttribute(TERMINAL_ATTRIBUTE));
  let modules: [
    typeof import('@xterm/xterm'),
    typeof import('@xterm/addon-fit'),
  ];
  try {
    modules = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]);
  } catch {
    element.dataset.state = 'failed';
    status.textContent = statusText(
      {
        kind: 'failed',
        code: 'ASSET_LOAD',
        message: 'the terminal could not be loaded',
      },
      data.locale,
    );
    return null;
  }
  const [{ Terminal }, { FitAddon }] = modules;
  const terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    screenReaderMode: true,
    scrollback: 10000,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    theme: { background: '#0d1117' },
    // OSC 8 links never open; no link addon is loaded either.
    linkHandler: { activate: () => undefined },
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);
  terminal.attachCustomKeyEventHandler(passKey);
  new ResizeObserver(() => {
    if (element.clientWidth && element.clientHeight) fit.fit();
  }).observe(element);
  const host = new TerminalHost({
    data,
    terminal,
    status,
    omitted,
    root: element,
    ...(stop ? { stop } : {}),
    pageUrl: document.location.href,
    isolation: () => ({
      isolated: globalThis.crossOriginIsolated === true,
      serviceWorker: !('serviceWorker' in navigator)
        ? 'unsupported'
        : navigator.serviceWorker.controller
          ? 'controlled'
          : 'pending',
    }),
  });
  terminal.onData((input) => host.onData(input));
  stop?.addEventListener('click', () => host.abort());
  attachPageEvents(window, host, () => document.location.reload());
  await host.start();
  return host;
}
