import type { FsEntry } from '../types/index.js';
import { failure, invalid } from './errors.js';

/** maxCommandBytes: the exact boundary is accepted and +1 is refused. */
export const MAX_COMMAND_BYTES = 65536;
const SHELL_SYNTAX = new Set([
  '|',
  '&',
  ';',
  '<',
  '>',
  '$',
  '`',
  '*',
  '?',
  '(',
  ')',
  '{',
  '}',
]);
const encoder = new TextEncoder();

/**
 * InputGuard (D1): every check is pure and finishes before any reservation.
 * A lone surrogate is refused instead of being silently replaced by U+FFFD.
 */
export function guardCommandInput(input: unknown): string {
  invalid(typeof input === 'string', 'command input must be a string');
  invalid(input.isWellFormed(), 'command input contains a lone surrogate');
  // Every UTF-16 code unit encodes to at least one byte, so a longer string
  // cannot fit and is refused without encoding it.
  invalid(
    input.length <= MAX_COMMAND_BYTES &&
      encoder.encode(input).length <= MAX_COMMAND_BYTES,
    'command input exceeds 65536 UTF-8 bytes',
  );
  invalid(
    !input.includes('\n') && !input.includes('\r') && !input.includes('\0'),
    'command input contains a line break or NUL',
  );
  return input;
}

type TokenizerState = 'none' | 'single' | 'double' | 'escape' | 'dq-escape';

/** One token and how many of its leading characters were unquoted. */
interface Word {
  value: string;
  literal: number;
}

/**
 * Tokenizer (W2): a POSIX quoting subset that never expands anything.
 * Only ASCII space and tab separate tokens; NBSP and full-width spaces stay
 * inside the token unchanged.
 */
export function tokenizeCommand(input: string): string[] {
  return tokenizeWords(input).map((word) => word.value);
}

function tokenizeWords(input: string): Word[] {
  const words: Word[] = [];
  let state: TokenizerState = 'none';
  let current = '';
  let started = false;
  // The unquoted prefix ends at the first quote or backslash of the token.
  let literal = 0;
  let quoted = false;
  // for..of reads code points, so a surrogate pair is one character.
  for (const char of input) {
    invalid(
      char !== '\n' && char !== '\r' && char !== '\0',
      'command input contains a line break or NUL',
    );
    if (state === 'single') {
      if (char === "'") state = 'none';
      else current += char;
    } else if (state === 'double') {
      if (char === '"') state = 'none';
      else if (char === '\\') state = 'dq-escape';
      else current += char;
    } else if (state === 'dq-escape') {
      current += char === '"' || char === '\\' ? char : `\\${char}`;
      state = 'double';
    } else if (state === 'escape') {
      current += char;
      state = 'none';
    } else if (char === ' ' || char === '\t') {
      if (started) words.push({ value: current, literal });
      current = '';
      started = false;
      literal = 0;
      quoted = false;
    } else if (char === "'" || char === '"' || char === '\\') {
      // An opened quote creates the token even when it stays empty.
      state = char === "'" ? 'single' : char === '"' ? 'double' : 'escape';
      started = true;
      quoted = true;
    } else if (SHELL_SYNTAX.has(char)) {
      throw failure('INVALID_INPUT', 'shell syntax is unsupported');
    } else {
      current += char;
      started = true;
      if (!quoted) literal = current.length;
    }
  }
  if (state === 'escape') throw failure('INVALID_INPUT', 'trailing backslash');
  if (state !== 'none') throw failure('INVALID_INPUT', 'unterminated quote');
  if (started) words.push({ value: current, literal });
  return words;
}

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=/;

/**
 * Splits leading `NAME=value` words off as the guest's environment, as a
 * POSIX shell does: the name and `=` must be unquoted, the value may be
 * quoted, and a later assignment to the same name wins. The first other word
 * starts argv, so `jj k=v` keeps `k=v` as an argument. HOME follows the
 * Session's home and cannot be assigned.
 */
export function parseCommand(input: string): {
  env: Record<string, string>;
  argv: string[];
} {
  const words = tokenizeWords(input);
  const env: Record<string, string> = Object.create(null);
  let index = 0;
  for (; index < words.length; index++) {
    const { value, literal } = words[index]!;
    const name = ASSIGNMENT.exec(value)?.[1];
    if (name === undefined || literal <= name.length) break;
    invalid(name !== 'HOME', 'HOME cannot be assigned; it is the session home');
    env[name] = value.slice(name.length + 1);
  }
  invalid(index === 0 || index < words.length, 'an assignment needs a command');
  return { env, argv: words.slice(index).map((word) => word.value) };
}

/**
 * ListingFormatter (W6, D4): the whole display string is sorted by UTF-16
 * code units, so `a.b` precedes `a/` exactly like `Array.prototype.sort()`.
 */
export function formatListing(entries: readonly FsEntry[]): Uint8Array {
  const lines = entries
    .map((entry) => {
      const name = entry.path.slice(entry.path.lastIndexOf('/') + 1);
      if (entry.type === 'dir') return `${name}/`;
      if (entry.type === 'symlink') return `${name} -> ${entry.target}`;
      return name;
    })
    .sort();
  return lines.length
    ? encoder.encode(`${lines.join('\n')}\n`)
    : new Uint8Array();
}
