import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISPLAY_LIMITS,
  DisplayBuffer,
  escapeEnd,
  lineCount,
  trimDisplay,
  utf8Length,
} from '../../src/terminal/buffer.ts';

const LINE = `${'x'.repeat(199)}\n`; // 200 bytes: ~5243 lines stay below 10000
/** `bytes` bytes of 200-byte lines after a distinct first line. */
function textOf(bytes: number): string {
  const first = `${'b'.repeat(199)}\n`;
  const rest = bytes - first.length;
  return first + LINE.repeat(Math.floor(rest / 200)) + 'y'.repeat(rest % 200);
}

test('UTF-8 length and line count follow the display rules', () => {
  assert.equal(utf8Length('aé日😀'), 1 + 2 + 3 + 4);
  assert.equal(utf8Length('\ud800'), 3);
  assert.equal(lineCount(''), 0);
  assert.equal(lineCount('a'), 1);
  assert.equal(lineCount('a\n'), 1);
  assert.equal(lineCount('a\nb'), 2);
});

test('1048575 and 1048576 bytes are kept; 1048577 drops the first line only', () => {
  for (const bytes of [1048575, 1048576]) {
    const text = textOf(bytes);
    assert.equal(utf8Length(text), bytes);
    assert.deepEqual(trimDisplay(text), {
      kept: text,
      droppedBytes: 0,
      droppedLines: 0,
    });
  }
  const text = textOf(1048577);
  const result = trimDisplay(text);
  assert.equal(result.droppedBytes, 200);
  assert.equal(result.droppedLines, 1);
  assert.equal(result.kept, text.slice(200));
  assert.ok(utf8Length(result.kept) <= DISPLAY_LIMITS.maxBytes);
});

test('9999 and 10000 lines are kept; 10001 drops exactly one line', () => {
  for (const lines of [9999, 10000]) {
    const text = 'l\n'.repeat(lines);
    assert.equal(trimDisplay(text).droppedLines, 0);
  }
  const text = `first\n${'l\n'.repeat(10000)}`;
  assert.deepEqual(trimDisplay(text), {
    kept: 'l\n'.repeat(10000),
    droppedBytes: 6,
    droppedLines: 1,
  });
  // An unterminated last line counts as a line too.
  assert.equal(trimDisplay(`${'l\n'.repeat(10000)}tail`).droppedLines, 1);
});

test('without a near LF the cut stays on a multi-byte character boundary', () => {
  const text = 'あ'.repeat(349526); // 1048578 bytes, no LF
  const result = trimDisplay(text);
  assert.equal(result.droppedBytes, 3);
  assert.equal(result.kept, 'あ'.repeat(349525));
  const emoji = '😀'.repeat(262145); // 1048580 bytes
  const cut = trimDisplay(emoji);
  assert.equal(cut.droppedBytes, 4);
  assert.equal(cut.kept.codePointAt(0), 0x1f600);
});

test('a cut inside an escape sequence moves past its end', () => {
  const limits = { maxBytes: 23, maxLines: 100, longLineBytes: 4 };
  // 29 bytes, no LF: the minimal cut (6 bytes) lands inside ESC[31m.
  const text = `abcd\x1b[31m${'r'.repeat(20)}`;
  const result = trimDisplay(text, limits);
  assert.equal(result.kept, 'r'.repeat(20));
  assert.equal(result.droppedBytes, 9);
  assert.equal(escapeEnd('\x1b]8;;https://x.test\x07link', 0), 20);
  assert.equal(escapeEnd('\x1b]0;title\x1b\\rest', 0), 11);
  assert.equal(escapeEnd('\x1b7', 0), 2);
  assert.equal(escapeEnd('\x1b[1;2', 0), 5);
});

test('a line longer than 4096 bytes is cut without waiting for its LF', () => {
  const limits = { ...DISPLAY_LIMITS, maxBytes: 10000 };
  const text = `${'a'.repeat(5000)}${'b'.repeat(6000)}\nend\n`;
  const result = trimDisplay(text, limits);
  // Needed: 1005 bytes. The next LF is 9995 bytes away, so no wait for it.
  assert.equal(result.droppedBytes, 1005);
  assert.equal(result.droppedLines, 1);
  // A near LF (within 4096 bytes) is waited for: the whole first line goes.
  const near = `${'a'.repeat(3000)}\n${'b'.repeat(7004)}\n`;
  assert.equal(trimDisplay(near, limits).droppedBytes, 3001);
});

test('DisplayBuffer redraws only after a limit is passed and sums what it dropped', () => {
  const buffer = new DisplayBuffer({
    maxBytes: 10,
    maxLines: 3,
    longLineBytes: 4096,
  });
  assert.equal(buffer.append('ab\n'), null);
  assert.equal(buffer.append('cd\n'), null);
  assert.equal(buffer.append('ef\n'), null);
  assert.equal(buffer.append('gh'), 'cd\nef\ngh');
  assert.deepEqual(
    [buffer.droppedBytes, buffer.droppedLines, buffer.lines, buffer.bytes],
    [3, 1, 3, 8],
  );
  assert.equal(buffer.append('\nij\n'), 'ef\ngh\nij\n');
  assert.deepEqual([buffer.droppedBytes, buffer.droppedLines], [6, 2]);
  buffer.clear();
  assert.equal(buffer.text, '');
});
