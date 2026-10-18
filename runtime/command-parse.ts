import type { FsEntry } from '../types/index.js';
import { failure, invalid } from './errors.js';

/** C11 maxCommandBytes: the exact boundary is accepted and +1 is refused. */
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

/**
 * Tokenizer (W2): a POSIX quoting subset that never expands anything.
 * Only ASCII space and tab separate tokens; NBSP and full-width spaces stay
 * inside the token unchanged.
 */
export function tokenizeCommand(input: string): string[] {
  const argv: string[] = [];
  let state: TokenizerState = 'none';
  let current = '';
  let started = false;
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
      if (started) argv.push(current);
      current = '';
      started = false;
    } else if (char === "'" || char === '"' || char === '\\') {
      // An opened quote creates the token even when it stays empty.
      state = char === "'" ? 'single' : char === '"' ? 'double' : 'escape';
      started = true;
    } else if (SHELL_SYNTAX.has(char)) {
      throw failure('INVALID_INPUT', 'shell syntax is unsupported');
    } else {
      current += char;
      started = true;
    }
  }
  if (state === 'escape') throw failure('INVALID_INPUT', 'trailing backslash');
  if (state !== 'none') throw failure('INVALID_INPUT', 'unterminated quote');
  if (started) argv.push(current);
  return argv;
}

/**
 * ListingFormatter (W6, D4): the whole display string is sorted by UTF-16
 * code units, so `a.b` precedes `a/` exactly like terrarium's `.sort()`.
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
