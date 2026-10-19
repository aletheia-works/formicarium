import { escapeEnd, utf8Length } from './buffer.ts';

/** C11 maxCommandBytes: one line is at most 65536 UTF-8 bytes (BR3.4). */
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
      if (character === '\x7f' || character === '\b') {
        actions.push(...this.#erase());
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
