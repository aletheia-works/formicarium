import assert from 'node:assert/strict';
import test from 'node:test';
import {
  columns,
  complete,
  completionTarget,
  LineEditor,
  MAX_LINE_BYTES,
} from '../../src/terminal/keys.ts';

test('typed characters are echoed and Enter submits the line', () => {
  const editor = new LineEditor();
  assert.deepEqual(editor.handle('ls', false), [
    { kind: 'write', text: 'l' },
    { kind: 'write', text: 's' },
  ]);
  assert.deepEqual(editor.handle('\r', false), [
    { kind: 'submit', line: 'ls' },
  ]);
  assert.equal(editor.line, '');
  // An empty line is submitted as is (the host shows a new prompt, kind=empty).
  assert.deepEqual(editor.handle('\r', false), [{ kind: 'submit', line: '' }]);
  assert.deepEqual(editor.history, ['ls']);
});

test('Backspace erases one character, wide characters take two columns', () => {
  const editor = new LineEditor();
  editor.handle('a日', false);
  assert.deepEqual(editor.handle('\x7f', false), [
    { kind: 'write', text: '\b\b  \b\b' },
  ]);
  assert.deepEqual(editor.handle('\b', false), [
    { kind: 'write', text: '\b \b' },
  ]);
  assert.deepEqual(editor.handle('\x7f', false), []);
  assert.equal(columns('😀'), 2);
  assert.equal(columns('a'), 1);
});

test('↑ and ↓ walk the page history; other escape sequences never enter the line', () => {
  const editor = new LineEditor();
  for (const line of ['aube --version', 'ls']) {
    editor.handle(line, false);
    editor.handle('\r', false);
  }
  assert.deepEqual(editor.handle('\x1b[A', false), [
    { kind: 'replace', line: 'ls' },
  ]);
  assert.deepEqual(editor.handle('\x1bOA', false), [
    { kind: 'replace', line: 'aube --version' },
  ]);
  assert.deepEqual(editor.handle('\x1b[A', false), [
    { kind: 'replace', line: 'aube --version' },
  ]);
  assert.deepEqual(editor.handle('\x1b[B\x1b[B', false), [
    { kind: 'replace', line: 'ls' },
    { kind: 'replace', line: '' },
  ]);
  // ← →, a DSR answer and a focus report are dropped, the text around them kept.
  assert.deepEqual(
    editor.handle(
      'a\x1b[D\x1b[12;40Rb\x1b[I\x1b]11;rgb:0000/0000/0000\x07',
      false,
    ),
    [
      { kind: 'write', text: 'a' },
      { kind: 'write', text: 'b' },
    ],
  );
  assert.equal(editor.line, 'ab');
});

test('Ctrl-C drops the line while editing and aborts while running', () => {
  const editor = new LineEditor();
  editor.handle('rm -rf x', false);
  assert.deepEqual(editor.handle('\x03', false), [{ kind: 'cancel-line' }]);
  assert.equal(editor.line, '');
  assert.deepEqual(editor.handle('abc\x03', true), [{ kind: 'abort' }]);
});

test('Ctrl-L asks for a clear screen and keeps the line being typed', () => {
  const editor = new LineEditor();
  editor.handle('ca', false);
  assert.deepEqual(editor.handle('\x0c', false), [{ kind: 'clear' }]);
  assert.equal(editor.line, 'ca');
  assert.deepEqual(editor.handle('\x0c', true), []);
  assert.deepEqual(editor.handle('t\x0c', false), [
    { kind: 'write', text: 't' },
  ]);
  assert.equal(editor.line, 'cat');
});

test('while running or installing every other key is discarded', () => {
  const editor = new LineEditor();
  editor.handle('ls', false);
  for (const data of [
    'x',
    '\r',
    '\x7f',
    '\x1b[A',
    '\t',
    '\x0c',
    'pasted\rline',
  ])
    assert.deepEqual(editor.handle(data, true), [], JSON.stringify(data));
  assert.equal(editor.line, 'ls');
});

test('a line stops at 65536 UTF-8 bytes', () => {
  const editor = new LineEditor();
  editor.handle('a'.repeat(MAX_LINE_BYTES - 1), false);
  assert.deepEqual(editor.handle('b', false), [{ kind: 'write', text: 'b' }]);
  assert.deepEqual(editor.handle('c', false), [
    { kind: 'notice', code: 'line-too-long' },
  ]);
  const wide = new LineEditor();
  wide.handle('a'.repeat(MAX_LINE_BYTES - 2), false);
  assert.deepEqual(wide.handle('日', false), [
    { kind: 'notice', code: 'line-too-long' },
  ]);
  assert.equal(new TextEncoder().encode(editor.line).length, MAX_LINE_BYTES);
});

test('a multi-line paste enters only its first line and never executes', () => {
  const editor = new LineEditor();
  const actions = editor.handle('echo 1\rrm -rf /work\r', false);
  assert.deepEqual(
    actions.map((action) => action.kind),
    ['write', 'write', 'write', 'write', 'write', 'write', 'notice'],
  );
  assert.equal(editor.line, 'echo 1');
  assert.ok(!actions.some((action) => action.kind === 'submit'));
  // A tab inside pasted text and other control characters are ignored.
  assert.deepEqual(new LineEditor().handle('\t\x01', false), []);
});

test('the Tab key asks to complete; while busy it does nothing', () => {
  const editor = new LineEditor();
  editor.handle('ls', false);
  assert.deepEqual(editor.handle('\t', false), [{ kind: 'complete' }]);
  assert.equal(editor.line, 'ls');
  assert.deepEqual(editor.handle('\t', true), []);
});

test('the word to complete is the last one, with .. and escapes resolved', () => {
  const cwd = '/work/app';
  for (const [line, directory, prefix] of [
    ['cat sr', '/work/app', 'sr'],
    ['cat ', '/work/app', ''],
    ['cat src/ma', '/work/app/src', 'ma'],
    ['cat src/', '/work/app/src', ''],
    ['cd ../', '/work', ''],
    ['cd ../ot', '/work', 'ot'],
    ['cd ./a/../b/c', '/work/app/b', 'c'],
    ['cat /root/x', '/root', 'x'],
    ['cat /../x', '/', 'x'],
    ['cat my\\ fi', '/work/app', 'my fi'],
    ['cat a\\ b/c', '/work/app/a b', 'c'],
    ['sr', '/work/app', 'sr'],
    // Only a space or a tab ends a word, as in the command tokenizer.
    ['cd my\u00a0dir/su', '/work/app/my\u00a0dir', 'su'],
    ['cd 全角\u3000名/su', '/work/app/全角\u3000名', 'su'],
    ['cat\tsr', '/work/app', 'sr'],
    // The same results as the package's collapsePath for these segments.
    ['cat ./../x', '/work', 'x'],
    ['cat a//../x', '/work/app', 'x'],
    ['cat ../../../x', '/', 'x'],
  ] as const)
    assert.deepEqual(completionTarget(line, cwd), { directory, prefix }, line);
  for (const line of ['cat "a', "cat 'a b"])
    assert.equal(completionTarget(line, cwd), null, line);
});

const entry = (name: string, type = 'file') => ({
  path: `/work/${name}`,
  type,
});

test('one match ends the word: a directory with a slash, a file with a space', () => {
  assert.deepEqual(complete([entry('src', 'dir')], 'sr'), {
    append: 'c/',
    names: ['src/'],
  });
  assert.equal(complete([entry('main.ts'), entry('x')], 'ma').append, 'in.ts ');
  // A symlink may not be a directory, so it ends as a file does.
  assert.equal(complete([entry('link', 'symlink')], 'li').append, 'nk ');
  // The whole name typed still ends the word.
  assert.equal(complete([entry('src', 'dir')], 'src').append, '/');
});

test('several matches add what they share and name every choice', () => {
  const entries = [entry('main.ts'), entry('main.js'), entry('mod', 'dir')];
  assert.deepEqual(complete(entries.slice(0, 2), 'm'), {
    append: 'ain.',
    names: ['main.js', 'main.ts'],
  });
  assert.deepEqual(complete(entries, 'm'), {
    append: '',
    names: ['main.js', 'main.ts', 'mod/'],
  });
  assert.deepEqual(complete(entries, 'x'), { append: '', names: [] });
});

test('dot files need a dot, and special characters in a name are escaped', () => {
  const dots = [entry('.git', 'dir'), entry('a')];
  assert.equal(complete(dots, '').append, 'a ');
  assert.equal(complete(dots, '.').append, 'git/');
  assert.equal(complete([entry('my file.txt')], 'my').append, '\\ file.txt ');
  assert.equal(complete([entry('a$b(1)')], 'a').append, '\\$b\\(1\\) ');
});
