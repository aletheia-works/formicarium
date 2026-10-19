/**
 * Display buffer of the terminal (BR3.8, P3, contract "Transcript"): at most
 * 1048576 UTF-8 bytes or 10000 lines, whichever is reached first. The oldest
 * part is dropped; CommandResult bytes are never touched.
 */
export const DISPLAY_LIMITS = Object.freeze({
  maxBytes: 1048576,
  maxLines: 10000,
  /** A line longer than this is cut without waiting for its LF. */
  longLineBytes: 4096,
});
export interface DisplayLimits {
  readonly maxBytes: number;
  readonly maxLines: number;
  readonly longLineBytes: number;
}

/** UTF-8 length of one UTF-16 code unit sequence (lone surrogates: 3 bytes). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export const countLf = (text: string) => {
  let lines = 0;
  for (
    let index = text.indexOf('\n');
    index !== -1;
    index = text.indexOf('\n', index + 1)
  )
    lines++;
  return lines;
};
/** Lines shown: every LF ends one, and a final unterminated line counts too. */
export const lineCount = (text: string) =>
  countLf(text) + (text.length > 0 && !text.endsWith('\n') ? 1 : 0);

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;

/** Smallest code-point boundary index whose prefix holds at least `bytes`. */
function byteCut(text: string, bytes: number): number {
  let index = 0;
  let removed = 0;
  while (index < text.length && removed < bytes) {
    const code = text.charCodeAt(index);
    const pair =
      isHigh(code) &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff;
    removed += code < 0x80 ? 1 : code < 0x800 ? 2 : pair ? 4 : 3;
    index += pair ? 2 : 1;
  }
  return index;
}

/** Index just after the `count`-th LF. */
function lineCut(text: string, count: number): number {
  let index = -1;
  for (let found = 0; found < count; found++) {
    index = text.indexOf('\n', index + 1);
    if (index === -1) return text.length;
  }
  return index + 1;
}

/** End of the escape sequence starting at `start` (CSI, OSC/DCS/APC/PM, or two-byte). */
export function escapeEnd(text: string, start: number): number {
  const kind = text[start + 1];
  if (kind === undefined) return text.length;
  if (kind === '[') {
    let index = start + 2;
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) return index + 1;
      // Parameter (0x30-0x3f) and intermediate (0x20-0x2f) bytes continue it.
      if (code < 0x20 || code > 0x3f) return index;
      index++;
    }
    return text.length;
  }
  if (kind === ']' || kind === 'P' || kind === '_' || kind === '^') {
    for (let index = start + 2; index < text.length; index++) {
      if (text[index] === '\x07') return index + 1;
      if (text[index] === '\x1b' && text[index + 1] === '\\') return index + 2;
    }
    return text.length;
  }
  // SS3 (ESC O <final>, e.g. the application-mode arrow keys) is three long.
  if (kind === 'O') return Math.min(start + 3, text.length);
  return start + 2;
}

/** Moves a cut out of an escape sequence that it would split. */
function outOfEscape(text: string, cut: number): number {
  const start = text.lastIndexOf('\x1b', cut - 1);
  if (start === -1) return cut;
  const end = escapeEnd(text, start);
  return end > cut ? end : cut;
}

export interface TrimResult {
  kept: string;
  droppedBytes: number;
  droppedLines: number;
}

/**
 * Drops the oldest text until both limits hold. The cut moves to just after
 * the next LF; when that LF is more than `longLineBytes` away (or absent), it
 * stays on a character boundary and leaves any escape sequence whole.
 */
export function trimDisplay(
  text: string,
  limits: DisplayLimits = DISPLAY_LIMITS,
): TrimResult {
  const bytes = utf8Length(text);
  const lines = lineCount(text);
  if (bytes <= limits.maxBytes && lines <= limits.maxLines)
    return { kept: text, droppedBytes: 0, droppedLines: 0 };
  let cut = Math.max(
    byteCut(text, bytes - limits.maxBytes),
    lines > limits.maxLines ? lineCut(text, lines - limits.maxLines) : 0,
  );
  if (cut > 0 && cut < text.length && text[cut - 1] !== '\n') {
    const lf = text.indexOf('\n', cut);
    if (
      lf !== -1 &&
      utf8Length(text.slice(cut, lf + 1)) <= limits.longLineBytes
    )
      cut = lf + 1;
    else cut = outOfEscape(text, cut);
  }
  const dropped = text.slice(0, cut);
  return {
    kept: text.slice(cut),
    droppedBytes: utf8Length(dropped),
    droppedLines: lineCount(dropped),
  };
}

/** Running display text with counters; returns the new text after a trim. */
export class DisplayBuffer {
  #text = '';
  #bytes = 0;
  #lfs = 0;
  readonly limits: DisplayLimits;
  droppedBytes = 0;
  droppedLines = 0;
  constructor(limits: DisplayLimits = DISPLAY_LIMITS) {
    this.limits = limits;
  }
  get text() {
    return this.#text;
  }
  get bytes() {
    return this.#bytes;
  }
  get lines() {
    return (
      this.#lfs + (this.#text.length > 0 && !this.#text.endsWith('\n') ? 1 : 0)
    );
  }
  /** Appends; null when nothing was dropped, else the text to redraw. */
  append(chunk: string): string | null {
    this.#text += chunk;
    this.#bytes += utf8Length(chunk);
    this.#lfs += countLf(chunk);
    if (
      this.#bytes <= this.limits.maxBytes &&
      this.lines <= this.limits.maxLines
    )
      return null;
    const trimmed = trimDisplay(this.#text, this.limits);
    this.#text = trimmed.kept;
    this.#bytes = utf8Length(trimmed.kept);
    this.#lfs = countLf(trimmed.kept);
    this.droppedBytes += trimmed.droppedBytes;
    this.droppedLines += trimmed.droppedLines;
    return trimmed.kept;
  }
  clear(): void {
    this.#text = '';
    this.#bytes = 0;
    this.#lfs = 0;
  }
}
