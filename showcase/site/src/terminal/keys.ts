import { escapeEnd, utf8Length } from './buffer.ts';

/** maxCommandBytes: one line is at most 65536 UTF-8 bytes. */
export const MAX_LINE_BYTES = 65536;

export type EditorAction =
  /** Echo of accepted input (or the erase of one character). */
  | { kind: 'write'; text: string }
  /** Enter: the line is complete (it may be empty). */
  | { kind: 'submit'; line: string }
  /** Ctrl-C while editing: the line is dropped, a new prompt follows. */
  | { kind: 'cancel-line' }
  /** Ctrl-C while a command or install runs. */
  | { kind: 'abort' }
  /** ↑/↓: redraw the line with this history entry. */
  | { kind: 'replace'; line: string }
  /** Ctrl-L: clear the screen and scrollback; the typed line stays. */
  | { kind: 'clear' }
  /** Tab: complete the last word of the line from the file system. */
  | { kind: 'complete' }
  /** Input was refused; the status line tells why. */
  | { kind: 'notice'; code: 'line-too-long' | 'paste-truncated' };

const HISTORY_UP = new Set(['\x1b[A', '\x1bOA']);
const HISTORY_DOWN = new Set(['\x1b[B', '\x1bOB']);

/** East Asian wide and emoji code points take two terminal columns. */
export function columns(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  return (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x20000 && code <= 0x3fffd)
    ? 2
    : 1;
}

/** The word Tab completes, and where its candidates are. */
export interface CompletionTarget {
  /** The absolute directory to list. */
  directory: string;
  /** The start of a name in that directory. */
  prefix: string;
}

/** Characters the command tokenizer takes literally only after a backslash. */
const ESCAPED = /[\s\\'"`$&|;<>()*?[\]{}#~!=]/g;

/**
 * What to complete at the end of a line, or null for a word in quotes, which
 * would need its own parsing. `..` resolves by name, as the commands do.
 */
export function completionTarget(
  line: string,
  cwd: string,
): CompletionTarget | null {
  let start = 0;
  for (let index = 0; index < line.length; index++) {
    const character = line[index]!;
    if (character === '\\') index++;
    else if (character === "'" || character === '"') return null;
    // As the command tokenizer: NBSP and a full-width space stay in the word.
    else if (character === ' ' || character === '\t') start = index + 1;
  }
  const word = line.slice(start).replace(/\\(.)/gu, '$1');
  const slash = word.lastIndexOf('/');
  const named = word.slice(0, slash + 1);
  const parts: string[] = [];
  for (const part of (named.startsWith('/') ? named : `${cwd}/${named}`).split(
    '/',
  ))
    if (part === '..') parts.pop();
    else if (part !== '' && part !== '.') parts.push(part);
  return { directory: `/${parts.join('/')}`, prefix: word.slice(slash + 1) };
}

/** A listed entry, as far as completing its name needs. */
export interface CompletionEntry {
  path: string;
  type: string;
}

export interface Completion {
  /** Text to add to the line: the rest of the name, escaped. */
  append: string;
  /** Every candidate, shown on a second Tab when none can be added. */
  names: string[];
}

/**
 * The shared start of the names that match. One match ends the word: a
 * directory with `/` and anything else with a space. Dot files are offered
 * only for a prefix that starts with a dot, as in a shell.
 */
export function complete(
  entries: readonly CompletionEntry[],
  prefix: string,
): Completion {
  const matches = entries
    .map((entry) => ({
      name: entry.path.slice(entry.path.lastIndexOf('/') + 1),
      directory: entry.type === 'dir',
    }))
    .filter(
      ({ name }) =>
        name.startsWith(prefix) && (prefix.startsWith('.') || name[0] !== '.'),
    )
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const names = matches.map(({ name, directory }) =>
    directory ? `${name}/` : name,
  );
  const escaped = (text: string) => text.replace(ESCAPED, '\\$&');
  const [first] = matches;
  if (!first) return { append: '', names };
  if (matches.length === 1)
    return {
      append: `${escaped(first.name.slice(prefix.length))}${first.directory ? '/' : ' '}`,
      names,
    };
  let shared = first.name;
  for (const { name } of matches)
    while (!name.startsWith(shared)) shared = shared.slice(0, -1);
  return { append: escaped(shared.slice(prefix.length)), names };
}

/**
 * The line being typed (frontend-components key table). Escape sequences,
 * including xterm's answers to terminal queries, never enter the line.
 */
export class LineEditor {
  line = '';
  readonly history: string[] = [];
  #index = 0;

  /** Handles one xterm onData string. `busy`: running or installing. */
  handle(data: string, busy: boolean): EditorAction[] {
    if (busy) return data.includes('\x03') ? [{ kind: 'abort' }] : [];
    const actions: EditorAction[] = [];
    const newline = data.search(/[\r\n]/);
    // A paste of several lines: only the first line is taken, never executed.
    const paste = data.length > 1 && newline !== -1;
    const input = paste ? data.slice(0, newline) : data;
    for (let index = 0; index < input.length; ) {
      const character = String.fromCodePoint(input.codePointAt(index)!);
      if (character === '\x1b') {
        const end = escapeEnd(input, index);
        const sequence = input.slice(index, end);
        index = end;
        if (HISTORY_UP.has(sequence)) actions.push(this.#move(-1));
        else if (HISTORY_DOWN.has(sequence)) actions.push(this.#move(1));
        continue;
      }
      index += character.length;
      if (character === '\r' || character === '\n') {
        actions.push(this.#submit());
        continue;
      }
      if (character === '\x03') {
        this.line = '';
        this.#index = this.history.length;
        actions.push({ kind: 'cancel-line' });
        continue;
      }
      // Only the key itself clears; a form feed inside pasted text is dropped.
      if (character === '\x0c' && data === '\x0c') {
        actions.push({ kind: 'clear' });
        continue;
      }
      if (character === '\x7f' || character === '\b') {
        actions.push(...this.#erase());
        continue;
      }
      // Only the key itself completes; a tab inside pasted text is dropped.
      if (character === '\t' && data === '\t') {
        actions.push({ kind: 'complete' });
        continue;
      }
      if (character.charCodeAt(0) < 0x20) continue;
      if (utf8Length(this.line) + utf8Length(character) > MAX_LINE_BYTES) {
        actions.push({ kind: 'notice', code: 'line-too-long' });
        break;
      }
      this.line += character;
      actions.push({ kind: 'write', text: character });
    }
    if (paste) actions.push({ kind: 'notice', code: 'paste-truncated' });
    return actions;
  }

  #submit(): EditorAction {
    const line = this.line;
    if (line.trim() !== '' && this.history.at(-1) !== line)
      this.history.push(line);
    this.#index = this.history.length;
    this.line = '';
    return { kind: 'submit', line };
  }

  #erase(): EditorAction[] {
    const characters = [...this.line];
    const last = characters.pop();
    if (last === undefined) return [];
    this.line = characters.join('');
    const width = columns(last);
    return [
      {
        kind: 'write',
        text: '\b'.repeat(width) + ' '.repeat(width) + '\b'.repeat(width),
      },
    ];
  }

  #move(step: number): EditorAction {
    this.#index = Math.min(
      this.history.length,
      Math.max(0, this.#index + step),
    );
    this.line = this.history[this.#index] ?? '';
    return { kind: 'replace', line: this.line };
  }

  reset(): void {
    this.line = '';
    this.#index = this.history.length;
  }
}
