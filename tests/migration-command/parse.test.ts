import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatListing,
  guardCommandInput,
  MAX_COMMAND_BYTES,
  tokenizeCommand,
} from '../../runtime/command-parse.js';
import type { FsEntry } from '../../types/index.js';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const rejects = (run: () => unknown, message?: RegExp) =>
  assert.throws(run, (error: { code?: string; message?: string }) => {
    assert.equal(error.code, 'INVALID_INPUT');
    if (message) assert.match(String(error.message), message);
    return true;
  });
const parse = (input: string) => tokenizeCommand(guardCommandInput(input));

// InputGuard
test('InputGuard refuses non-string input before reading anything else', () => {
  for (const value of [undefined, null, 1, ['ls'], { toString: () => 'ls' }])
    rejects(() => guardCommandInput(value), /must be a string/);
});
test('InputGuard accepts the empty string and exactly 65536 ASCII bytes', () => {
  assert.equal(guardCommandInput(''), '');
  const exact = 'a'.repeat(MAX_COMMAND_BYTES);
  assert.equal(guardCommandInput(exact), exact);
});
test('InputGuard refuses 65537 bytes and huge strings', () => {
  for (const size of [MAX_COMMAND_BYTES + 1, 4 * MAX_COMMAND_BYTES])
    rejects(() => guardCommandInput('a'.repeat(size)), /65536/);
});
test('InputGuard counts UTF-8 bytes of multi-byte characters at the boundary', () => {
  // U+3042 is 3 bytes: 21845 * 3 = 65535, plus one ASCII byte = 65536.
  const exact = `${'あ'.repeat(21845)}a`;
  assert.equal(new TextEncoder().encode(exact).length, 65536);
  assert.equal(guardCommandInput(exact), exact);
  const over = `${'あ'.repeat(21845)}ab`;
  rejects(() => guardCommandInput(over), /65536/);
  // A 4-byte emoji crossing the limit is refused although length is small.
  const emoji = `${'a'.repeat(65533)}😀`;
  assert.equal(emoji.length, 65535);
  rejects(() => guardCommandInput(emoji), /65536/);
});
test('InputGuard refuses lone surrogates instead of replacing them with U+FFFD', () => {
  for (const value of ['cat \uD800', 'cat \uDC00x', 'x\uD83D']) {
    assert.equal(value.isWellFormed(), false);
    rejects(() => guardCommandInput(value), /lone surrogate/);
  }
  assert.equal(guardCommandInput('cat 😀'), 'cat 😀');
});
test('InputGuard refuses LF, CR and NUL anywhere, even inside quotes', () => {
  for (const value of ['ls\n', 'cat "a\rb"', "cat 'a\0b'", '\n'])
    rejects(() => guardCommandInput(value), /line break or NUL/);
  for (const value of ['ls\n', 'cat "a\rb"', "cat 'a\0b'"])
    rejects(() => tokenizeCommand(value), /line break or NUL/);
});

// Tokenizer: the functional design W2 example table (nine rows).
test('Tokenizer reproduces every row of the W2 example table', () => {
  assert.deepEqual(parse('cat "a b.txt"'), ['cat', 'a b.txt']);
  assert.deepEqual(parse(`aube 'x;y' ""`), ['aube', 'x;y', '']);
  assert.deepEqual(parse('aube "say \\"hi\\" \\\\ \\n"'), [
    'aube',
    'say "hi" \\ \\n',
  ]);
  assert.deepEqual(parse('cat a\\ b'), ['cat', 'a b']);
  assert.deepEqual(parse('aube "$HOME"'), ['aube', '$HOME']);
  rejects(() => parse('ls *'), /shell syntax is unsupported/);
  rejects(() => parse('aube "unclosed'), /unterminated quote/);
  rejects(() => parse('cat file\\'), /trailing backslash/);
  assert.deepEqual(parse('cat 日本語　名.txt'), ['cat', '日本語　名.txt']);
});
test('Tokenizer refuses each unquoted BR4.5 shell symbol (13 characters)', () => {
  for (const symbol of [
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
  ])
    for (const input of [`aube ${symbol}`, `aube a${symbol}b`])
      rejects(() => parse(input), /shell syntax is unsupported/);
  // `&&`, `>>` and `$(...)` are refused at their first character.
  for (const input of ['a && b', 'a >> b', 'echo $(id)', 'a || b'])
    rejects(() => parse(input), /shell syntax is unsupported/);
});
test('Tokenizer keeps [ ] ~ # ! = and other punctuation literal outside quotes', () => {
  assert.deepEqual(parse('aube [a] ~ #x !y k=v a,b:c @d %e ^f +g'), [
    'aube',
    '[a]',
    '~',
    '#x',
    '!y',
    'k=v',
    'a,b:c',
    '@d',
    '%e',
    '^f',
    '+g',
  ]);
});
test('Tokenizer makes empty tokens from empty quotes and concatenates adjacent parts', () => {
  assert.deepEqual(parse('a \'\' "" b'), ['a', '', '', 'b']);
  assert.deepEqual(parse(`a''b`), ['ab']);
  assert.deepEqual(parse(`pre'mid dle'"post fix"tail`), [
    'premid dlepost fixtail',
  ]);
  assert.deepEqual(parse(`''`), ['']);
});
test('Tokenizer resolves only \\" and \\\\ inside double quotes and keeps other \\x', () => {
  assert.deepEqual(parse('a "\\""'), ['a', '"']);
  assert.deepEqual(parse('a "\\\\"'), ['a', '\\']);
  assert.deepEqual(parse('a "\\x\\$\\`\\t"'), ['a', '\\x\\$\\`\\t']);
  assert.deepEqual(parse('a "$x `id` * ? | ;"'), ['a', '$x `id` * ? | ;']);
});
test('Tokenizer keeps single quoted text fully literal, including backslashes', () => {
  assert.deepEqual(parse(`a 'x\\y\\'`), ['a', 'x\\y\\']);
  assert.deepEqual(parse(`a '"$|'`), ['a', '"$|']);
});
test('Tokenizer resolves \\x outside quotes to x, including separators and symbols', () => {
  assert.deepEqual(parse('a \\$HOME \\| \\; \\* \\\\ \\"'), [
    'a',
    '$HOME',
    '|',
    ';',
    '*',
    '\\',
    '"',
  ]);
  assert.deepEqual(parse('a\\\tb'), ['a\tb']);
  assert.deepEqual(parse('\\ '), [' ']);
});
test('Tokenizer reports unterminated quotes and trailing backslash distinctly', () => {
  rejects(() => parse("cat 'open"), /unterminated quote/);
  rejects(() => parse('cat "open'), /unterminated quote/);
  // A trailing backslash inside double quotes leaves the quote open.
  rejects(() => parse('cat "x\\'), /unterminated quote/);
  rejects(() => parse('\\'), /trailing backslash/);
});
test('Tokenizer preserves non-ASCII, NBSP and full-width space without normalization', () => {
  assert.deepEqual(parse('cat a b'), ['cat', 'a b']);
  assert.deepEqual(parse('cat 　'), ['cat', '　']);
  assert.deepEqual(parse('cat é é 😀'), ['cat', 'é', 'é', '😀']);
  assert.notDeepEqual(parse('cat é'), parse('cat é'));
});
test('Tokenizer collapses runs of spaces/tabs and ignores leading/trailing separators', () => {
  assert.deepEqual(parse(' \t ls \t\t /work  '), ['ls', '/work']);
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse(' \t \t'), []);
});

// ListingFormatter
const entry = {
  dir: (path: string): FsEntry => ({ path, type: 'dir', mode: 0o755 }),
  file: (path: string): FsEntry => ({
    path,
    type: 'file',
    mode: 0o644,
    inodeId: path,
    data: new Uint8Array(),
  }),
  link: (path: string, target: string): FsEntry => ({
    path,
    type: 'symlink',
    target,
  }),
};
test('ListingFormatter marks dir, symlink and file and ends every line with LF', () => {
  const output = formatListing([
    entry.file('/work/b.txt'),
    entry.dir('/work/c'),
    entry.link('/work/d', '/work/b.txt'),
  ]);
  assert.equal(text(output), 'b.txt\nc/\nd -> /work/b.txt\n');
});
test('ListingFormatter sorts the whole display string by UTF-16 code units', () => {
  // `.` (0x2E) precedes `/` (0x2F), so `a.b` comes before `a/`.
  assert.equal(
    text(formatListing([entry.dir('/work/a'), entry.file('/work/a.b')])),
    'a.b\na/\n',
  );
  assert.equal(
    text(
      formatListing([
        entry.file('/work/b'),
        entry.file('/work/B'),
        entry.file('/work/_'),
        entry.file('/work/10'),
        entry.file('/work/9'),
      ]),
    ),
    '10\n9\nB\n_\nb\n',
  );
});
test('ListingFormatter returns empty bytes, not a lone newline, for zero entries', () => {
  const output = formatListing([]);
  assert.ok(output instanceof Uint8Array);
  assert.equal(output.length, 0);
});
test('ListingFormatter keeps non-ASCII names and orders them by code unit', () => {
  assert.equal(
    text(
      formatListing([
        entry.file('/work/日本語'),
        entry.file('/work/a'),
        entry.file('/work/😀'),
        entry.file('/work/Ａ'),
      ]),
    ),
    // U+65E5 < U+D83D (surrogate of 😀) < U+FF21
    'a\n日本語\n😀\nＡ\n',
  );
});
test('ListingFormatter uses only the last path element and keeps the raw target', () => {
  assert.equal(
    text(formatListing([entry.link('/work/deep/x', '../y z')])),
    'x -> ../y z\n',
  );
});
