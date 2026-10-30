import type {
  CommandSession,
  Installer,
  NetworkOptions,
  Progress,
  Session,
} from '@aletheia-works/formicarium';
import { stringsFor } from '../i18n/strings.ts';
import { DisplayBuffer } from './buffer.ts';
import { loadCatalog, siteRootFrom } from './catalog.ts';
import { FetchFailure, type Timers } from './fetch-limited.ts';
import {
  emptyEntries,
  fixtureToEntries,
  HOME,
  homeEntries,
  loadCaBundle,
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
import { CommandOutput, failureOf, plainText } from './output.ts';
import {
  parsePageData,
  TERMINAL_ATTRIBUTE,
  type TerminalPageData,
} from './page-data.ts';
import { RelayTokens } from './relay.ts';
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
  /** The clock of the relay token's lifetime (Date.now). */
  now?: () => number;
}

const BUSY: readonly HostState[] = ['running', 'installing'];
const INPUT: readonly HostState[] = [
  'ready',
  'ready_failed_install',
  'running',
  'installing',
];

/**
 * The public command API's failures that are a user's mistake, by code and
 * message (formicarium 0.9.0, runtime/state.js, install-catalog.js and
 * command-parse.js): an unregistered guest; an install selection whose tool
 * has no catalog default or whose name or version is malformed; a path
 * outside the persistence roots (/work and the home); a missing entry; and
 * shell syntax. A unit test finds each message in the package the site
 * ships, so a reworded core fails it rather than silently falling back to
 * the raw codes.
 */
export const API_MISTAKES = Object.freeze({
  notRegistered: { code: 'NOT_FOUND', message: 'Guest is not registered' },
  badIdentifier: {
    code: 'INVALID_INPUT',
    message: 'install identifier invalid',
  },
  outsideRoots: {
    code: 'INVALID_INPUT',
    message: 'path lies outside persistence roots',
  },
  missingEntry: { code: 'NOT_FOUND', message: 'Entry does not exist' },
  noShell: { code: 'INVALID_INPUT', message: 'shell syntax is unsupported' },
});
const {
  notRegistered: NOT_REGISTERED,
  badIdentifier: BAD_IDENTIFIER,
  outsideRoots: OUTSIDE_ROOTS,
  missingEntry: MISSING_ENTRY,
  noShell: NO_SHELL,
} = API_MISTAKES;
/**
 * The INVALID_INPUT messages of a builtin's wrong arguments, by builtin
 * (runtime/command.js; cat and cd share one written with the name).
 */
export const API_USAGE: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    ls: ['ls accepts at most one path', 'ls flags are unsupported'],
    cat: ['cat requires exactly one path'],
    cd: ['cd requires exactly one path'],
    rm: ['rm accepts only rm -rf path'],
    cp: ['cp accepts only cp [-r] source destination'],
    mv: ['mv accepts only mv source destination'],
    install: ['install requires exactly one selection'],
  });
/** The builtins that take paths. */
const PATH_BUILTINS = new Set(['ls', 'cat', 'cd', 'rm', 'cp', 'mv']);
/** The one flag a path builtin takes before its paths. */
const PATH_FLAGS: Readonly<Record<string, string>> = { rm: '-rf', cp: '-r' };
const isFailure = (
  failure: { code: string; message: string },
  known: { code: string; message: string },
) => failure.code === known.code && failure.message === known.message;

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
  #installer: Installer | null = null;
  #isolationTimer: unknown = null;
  /** The stdin of the running interactive tool; null when none runs. */
  #input: ReadableStreamDefaultController<Uint8Array> | null = null;
  readonly #encoder = new TextEncoder();
  /** The last tool an install command registered (shown in the ready text). */
  #installed: { tool: string; version: string } | null = null;
  /** Every tool installed so far (companions apart), for help and mistakes. */
  readonly #tools = new Set<string>();
  /** The tools `install <tool>` adds: the catalog's defaults, companions apart. */
  #catalogTools: string[] = [];
  /** The relay token of the network runs, fetched at the first of them. */
  readonly #relay: RelayTokens;

  constructor(options: HostOptions) {
    this.#options = options;
    this.#relay = new RelayTokens({
      tokenUrl: options.data.relay.tokenUrl,
      fetchImpl: options.fetchImpl,
      timers: options.timers,
      now: options.now,
    });
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

  /** `help`: the page prints it itself (no command runs); the state stays. */
  #help(): void {
    this.#print(
      `${stringsFor(this.#options.data.locale).shell.help(
        [...this.#tools].sort(),
        this.#catalogTools,
      )}\n`,
    );
    // After a failed page install the state and status stay, so that the
    // failure remains in view and typing install still retries it.
    if (this.state !== 'ready_failed_install') {
      this.#setState('ready');
      this.#readyStatus();
    }
    this.#prompt();
  }

  #readyStatus(): void {
    this.#status({
      kind: 'ready',
      tool: this.#installed?.tool ?? null,
      version: this.#installed?.version ?? null,
    });
  }

  /**
   * A typed line's failure that is a user's mistake, explained in the page's
   * locale with its status; null for any other failure, which keeps its code.
   */
  #mistake(
    words: string[],
    failure: { code: string; message: string },
  ): { text: string; status: Status } | null {
    const shell = stringsFor(this.#options.data.locale).shell;
    const name = plainText(words[0] ?? '');
    const argument = plainText(words[1] ?? '');
    const installed = [...this.#tools].sort();
    if (isFailure(failure, NOT_REGISTERED))
      return {
        text: shell.notFound(name, installed, this.#catalogTools),
        status: { kind: 'command-not-found', name },
      };
    if (
      name === 'install' &&
      words.length === 2 &&
      isFailure(failure, BAD_IDENTIFIER)
    )
      return {
        text: shell.unknownTool(argument, this.#catalogTools),
        status: { kind: 'unknown-tool', selection: argument },
      };
    if (isFailure(failure, NO_SHELL))
      return { text: shell.noShell, status: { kind: 'no-shell' } };
    if (
      failure.code === 'INVALID_INPUT' &&
      API_USAGE[name]?.includes(failure.message)
    )
      return {
        text: shell.usage(name, shell.usages[name]!),
        status: { kind: 'usage', name },
      };
    if (!PATH_BUILTINS.has(name)) return null;
    // The path is named only when the line has one; only rm -rf and cp -r
    // take a flag, so cat -x names the path -x.
    const operands = words.slice(1);
    if (operands[0] === PATH_FLAGS[name]) operands.shift();
    const path = operands.length === 1 ? plainText(operands[0]!) : '';
    if (isFailure(failure, OUTSIDE_ROOTS))
      return {
        text: shell.outsideRoots(name, path, WORK_ROOT, HOME),
        status: { kind: 'outside-roots', name, work: WORK_ROOT, home: HOME },
      };
    if (isFailure(failure, MISSING_ENTRY))
      return {
        text: shell.missing(name, path),
        status: { kind: 'missing-entry', name },
      };
    return null;
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
    let installer: Installer;
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
      // The Session takes files only when it is created, so the CA bundle of
      // the network tools is written then, below the home that every run
      // keeps (a page without network tools fetches none).
      const caBundle = data.caBundle
        ? [
            await loadCaBundle({
              url: new URL(data.caBundle.path, siteRoot).href,
              sha256: data.caBundle.sha256,
              fetch: fetchOptions,
            }),
          ]
        : [];
      const catalog = await loadCatalog({
        url: new URL(data.catalog.path, siteRoot).href,
        sha256: data.catalog.sha256,
        siteRoot,
        fetch: fetchOptions,
      });
      const companions = Object.values(data.companions).flat();
      this.#catalogTools = Object.keys(catalog.defaults ?? {})
        .filter((tool) => !companions.includes(tool))
        .sort();
      // The persistence roots are /work (app/ and the directories beside it)
      // and the home with the tools' settings; the shell starts in /work/app.
      const session = await loaded.browser.createSession({
        assets: loaded.assets,
        cwd: WORK_ROOT,
        entries: loaded.root.fixtureToFsEntries([
          ...entries,
          ...homeEntries(data.homeFiles, caBundle),
        ]),
      });
      await session.setCwd(WORK_CWD);
      if (this.state === 'disposed') {
        await session.dispose();
        return;
      }
      this.#session = session;
      this.#commands = loaded.root.createCommandSession(session, { catalog });
      installer = loaded.root.createInstaller(session, catalog);
      this.#installer = installer;
    } catch (error) {
      if (this.state === 'disposed') return;
      this.#setState('failed');
      const failure = new CommandOutput({
        write: (text) => this.#print(text),
      }).fail(error);
      this.#status({ kind: 'failed', ...failure });
      return;
    }
    // The page's own tool is installed as if typed. The tools every page
    // installs follow through the public installer, which writes nothing to
    // the terminal, so they look present from the start (one that already is
    // the page's tool is installed once). The first failure stops the rest.
    const own = data.mode === 'preinstalled' ? data.tool : null;
    const quiet = data.everyPage.filter((tool) => tool !== data.tool);
    if (own) {
      const line = `install ${own}`;
      this.#print(`${this.cwd}$ ${line}\n`);
      if (!(await this.#execute(line, true, quiet.length === 0))) return;
    }
    if (quiet.length > 0) {
      await this.#installQuietly(installer, quiet);
      return;
    }
    if (!own) {
      this.#setState('ready');
      this.#status({ kind: 'ready', tool: null, version: null });
      this.#prompt();
    }
  }

  /**
   * Installs `tools` one by one without writing to the terminal, each with
   * its companions; only a failure is shown, named by its tool, and leaves
   * ready_failed_install (typing install retries it). Ctrl-C cancels it like
   * a typed install.
   */
  async #installQuietly(installer: Installer, tools: string[]): Promise<void> {
    this.#setState('installing');
    const run = new AbortController();
    this.#run = run;
    let failure: { code: string; message: string } | null = null;
    const current = { tool: '' };
    try {
      for (const tool of tools) {
        current.tool = tool;
        const installed = await this.#installOne(installer, tool, run.signal);
        if (this.state === 'disposed') return;
        this.#tools.add(installed.tool);
        await this.#installCompanions(
          installer,
          installed,
          run.signal,
          current,
        );
        if (this.#isDisposed()) return;
      }
    } catch (error) {
      if (this.state === 'disposed') return;
      failure = run.signal.aborted
        ? this.#aborted()
        : new CommandOutput({
            write: (text) => this.#print(`${current.tool}: ${text}`),
          }).fail(error);
    } finally {
      if (this.#run === run) this.#run = null;
    }
    this.#finish(true, failure, true);
  }

  /** One install through the public installer, its progress in the status. */
  async #installOne(
    installer: Installer,
    selection: string,
    signal: AbortSignal,
  ): Promise<{ tool: string; versionOrName: string }> {
    const tool = selection.split('@')[0]!;
    this.#status({ kind: 'installing', tool, version: '', progress: null });
    return installer.install(selection, {
      signal,
      onProgress: (progress) => {
        if (!signal.aborted && this.state === 'installing')
          this.#status({ kind: 'installing', tool, version: '', progress });
      },
    });
  }

  /**
   * The companions of an installed tool (git-remote-https of git), at its
   * version, without writing to the terminal; `current` names the one being
   * installed for a failure message.
   */
  async #installCompanions(
    installer: Installer,
    installed: { tool: string; versionOrName: string },
    signal: AbortSignal,
    current: { tool: string },
  ): Promise<void> {
    for (const companion of this.#options.data.companions[installed.tool] ??
      []) {
      current.tool = companion;
      await this.#installOne(
        installer,
        `${companion}@${installed.versionOrName}`,
        signal,
      );
      if (this.#isDisposed()) return;
    }
  }

  /** Read again after an await: dispose() may have run meanwhile. */
  #isDisposed(): boolean {
    return this.state === 'disposed';
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
        // `help foo` asks for help too; no tool is named help.
        if (action.line.trim() === 'clear') {
          this.#clear();
          this.#prompt();
        } else if (/^help(?:\s|$)/.test(action.line.trim())) this.#help();
        else if (action.line.trim() === '') this.#prompt();
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

  /**
   * Runs one line and reports whether it succeeded. With `last` false a
   * successful run keeps the busy state and prints no prompt, because the
   * page's next install follows it.
   */
  async #execute(
    line: string,
    automatic: boolean,
    last = true,
  ): Promise<boolean> {
    const commands = this.#commands;
    if (!commands) return false;
    const words = line.trim().split(/[ \t]+/);
    const installing = words[0] === 'install' && words.length === 2;
    const target = installing ? (words[1] ?? '') : '';
    // Only the page's own tool has its version in the page data, and only it
    // is named in the ready text after the page's installs.
    const ownTool = automatic && target === this.#options.data.tool;
    const shownVersion = ownTool ? (this.#options.data.version ?? '') : '';
    const interactive =
      !installing && this.#options.data.interactive.includes(words[0] ?? '');
    // Only a network tool's run gets the network, through the site's relay.
    const networked =
      !installing && this.#options.data.network.includes(words[0] ?? '');
    const runningStatus: Status = interactive
      ? { kind: 'interactive' }
      : { kind: 'running' };
    this.#setState(installing ? 'installing' : 'running');
    this.#status(
      installing
        ? {
            kind: 'installing',
            tool: target,
            version: shownVersion,
            progress: null,
          }
        : networked
          ? { kind: 'relay' }
          : runningStatus,
    );
    const run = new AbortController();
    this.#run = run;
    let network: NetworkOptions | undefined;
    if (networked) {
      try {
        network = {
          allow: [...this.#options.data.relay.allow],
          relay: await this.#relay.get(run.signal),
        };
      } catch (error) {
        if (this.#isDisposed()) return false;
        if (
          run.signal.aborted ||
          (error instanceof FetchFailure && error.kind === 'aborted')
        ) {
          if (this.#run === run) this.#run = null;
          this.#finish(automatic, this.#aborted(), true);
          return false;
        }
        // Without a token the command still runs, with no network: most of
        // git and jj works offline, and only clone and fetch then fail.
        this.#print(
          `${statusText({ kind: 'relay-unreachable' }, this.#options.data.locale)}\n`,
        );
      }
      this.#status(runningStatus);
    }
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
    let mistake: Status | null = null;
    let succeeded = false;
    const companion = { tool: '' };
    try {
      const result = await commands.execute(line, {
        signal: run.signal,
        onOutput: output.onOutput,
        onProgress,
        ...(network ? { network } : {}),
        ...(stdin
          ? {
              stdin,
              terminal: { columns: terminal.cols, rows: terminal.rows },
            }
          : {}),
      });
      if (this.state === 'disposed') return false;
      if (run.signal.aborted) failure = this.#aborted();
      else {
        output.finish(result);
        const cwd = result.exitCode === 0 ? nextCwd(this.cwd, line) : null;
        if (cwd) this.cwd = cwd;
        if (
          result.kind === 'install' &&
          result.exitCode === 0 &&
          result.installation &&
          (!automatic || ownTool)
        )
          this.#installed = {
            tool: result.installation.tool,
            version: result.installation.versionOrName,
          };
        if (
          result.kind === 'install' &&
          result.exitCode === 0 &&
          result.installation
        )
          this.#tools.add(result.installation.tool);
        // A tool's companions follow its install quietly, named on failure.
        if (
          result.exitCode === 0 &&
          result.kind === 'install' &&
          result.installation &&
          this.#installer
        ) {
          await this.#installCompanions(
            this.#installer,
            result.installation,
            run.signal,
            companion,
          );
          if (this.#isDisposed()) return false;
        }
        succeeded = result.exitCode === 0;
      }
    } catch (error) {
      if (this.state === 'disposed') return false;
      if (run.signal.aborted) failure = this.#aborted();
      else if (companion.tool)
        failure = new CommandOutput({
          write: (text) => this.#print(`${companion.tool}: ${text}`),
        }).fail(error);
      else {
        // Only a typed line's mistake is explained; the page's own installs
        // keep the code, as their retry needs it.
        const explained = automatic
          ? null
          : this.#mistake(words, failureOf(error));
        failure = output.fail(error, explained?.text);
        mistake = explained?.status ?? null;
      }
    } finally {
      if (this.#run === run) this.#run = null;
      if (interactive) this.#endInput();
    }
    if (!last && succeeded) return true;
    this.#finish(automatic, failure, output.wrote, mistake);
    return succeeded;
  }

  /** running/installing -> ready (or ready_failed_install after the page's own install). */
  #finish(
    automatic: boolean,
    failure: { code: string; message: string } | null,
    wrote: boolean,
    mistake: Status | null = null,
  ): void {
    if (automatic && failure) {
      this.#setState('ready_failed_install');
      this.#status({ kind: 'ready-failed-install', ...failure });
    } else {
      this.#setState('ready');
      if (failure?.code === 'ABORTED') this.#status({ kind: 'aborted' });
      else if (mistake) this.#status(mistake);
      else if (failure) this.#status({ kind: 'command-failed', ...failure });
      else if (!failure && !wrote) this.#status({ kind: 'no-output' });
      else this.#readyStatus();
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

export interface KeyMods {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}
/** macOS copies and pastes with Cmd+C and Cmd+V itself; elsewhere Ctrl. */
export type KeyPlatform = 'mac' | 'other';
export const keyPlatform = (platform: string): KeyPlatform =>
  /^(?:Mac|iPhone|iPad|iPod)/.test(platform) ? 'mac' : 'other';

/**
 * Keys xterm must not take (false leaves them to the browser): Tab and
 * Shift+Tab move the page focus, and off macOS Ctrl+V and Ctrl+Shift+V
 * paste through the browser's paste event, which xterm reads, instead of
 * reaching the terminal as ^V.
 */
export const passKey = (
  event: { key: string } & Partial<KeyMods>,
  platform: KeyPlatform = 'other',
) =>
  event.key !== 'Tab' &&
  !(
    platform === 'other' &&
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    event.key.toLowerCase() === 'v'
  );

/**
 * What a copy key does off macOS (which copies with Cmd+C itself), or null
 * when the key is not a copy and goes on as before:
 * - `browser`: Ctrl+C with a selection is left to the browser, whose copy
 *   event xterm fills with the selection; without one it stays ^C.
 * - `write`: Ctrl+Shift+C opens the element picker in Chrome and Edge, so
 *   the page starts the copy itself.
 * - `swallow`: Ctrl+Shift+C with nothing selected does nothing.
 */
export function copyAction(
  event: { key: string } & Partial<KeyMods>,
  platform: KeyPlatform,
  selected: boolean,
): 'browser' | 'write' | 'swallow' | null {
  if (
    platform !== 'other' ||
    !event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.key.toLowerCase() !== 'c'
  )
    return null;
  if (event.shiftKey) return selected ? 'write' : 'swallow';
  return selected ? 'browser' : null;
}

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
  const platform = keyPlatform(navigator.platform);
  // Off macOS a copy ends the selection, as in Windows Terminal and VS Code,
  // so that the next Ctrl+C is ^C again. It is cleared after xterm filled
  // the copy event (its listeners run first, on the textarea and here).
  if (platform === 'other')
    element.addEventListener('copy', () =>
      setTimeout(() => terminal.clearSelection()),
    );
  terminal.attachCustomKeyEventHandler((event) => {
    const copy = copyAction(event, platform, terminal.hasSelection());
    if (copy === 'write' || copy === 'swallow') {
      event.preventDefault();
      // The copy event, as Ctrl+C gets from the browser, which xterm fills
      // with the selection; the Clipboard API needs a permission in some.
      if (copy === 'write' && event.type === 'keydown')
        document.execCommand('copy');
      return false;
    }
    return copy === 'browser' ? false : passKey(event, platform);
  });
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
