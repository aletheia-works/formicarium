import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommandResult } from '@aletheia-works/formicarium';
import { CommandOutput, plainText } from '../../src/terminal/output.ts';

const encode = (text: string) => new TextEncoder().encode(text);
const result = (
  kind: CommandResult['kind'],
  stdout = '',
  exitCode = 0,
  stderr = '',
): CommandResult => ({
  kind,
  exitCode,
  stdout: encode(stdout),
  stderr: encode(stderr),
});
const sink = () => {
  const written: string[] = [];
  return { written, write: (text: string) => written.push(text) };
};
const chunk = (
  bytes: Uint8Array,
  stream: 'stdout' | 'stderr' = 'stdout',
  sequence = 0,
) => ({ runId: 'r', sequence, stream, bytes });

test('a guest result writes only its onOutput chunks, never result.stdout again', () => {
  const out = sink();
  const output = new CommandOutput(out);
  output.onOutput(chunk(encode('2.7.2 linux-x64\n')));
  output.finish(result('guest', '2.7.2 linux-x64\n'));
  assert.deepEqual(out.written, ['2.7.2 linux-x64\n']);
  assert.ok(output.wrote);
});

test('builtin and install results are written once from stdout and stderr', () => {
  for (const kind of ['builtin', 'install'] as const) {
    const out = sink();
    const output = new CommandOutput(out);
    output.onOutput(
      chunk(encode('ignored? no: builtins never call onOutput\n')),
    );
    output.finish(result(kind, 'package.json\n', 0, 'warn\n'));
    assert.deepEqual(out.written.slice(-2), ['package.json\n', 'warn\n'], kind);
  }
  const empty = new CommandOutput(sink());
  empty.finish(result('empty'));
  assert.equal(empty.wrote, false);
});

test('multi-byte characters split across chunks are decoded as a stream', () => {
  const out = sink();
  const output = new CommandOutput(out);
  const bytes = encode('日本');
  output.onOutput(chunk(bytes.slice(0, 2)));
  output.onOutput(chunk(bytes.slice(2, 4), 'stdout', 1));
  output.onOutput(chunk(bytes.slice(4), 'stdout', 2));
  output.finish(result('guest'));
  assert.equal(out.written.join(''), '日本');
});

test('a nonzero exit code gets one line of its own', () => {
  const out = sink();
  const output = new CommandOutput(out);
  output.onOutput(chunk(encode('error: no file')));
  output.finish(result('guest', '', 2));
  assert.deepEqual(out.written, ['error: no file', '\nexit code 2\n']);
});

test('errors are one plain-text line; control characters are neutralised', () => {
  const out = sink();
  const output = new CommandOutput(out);
  const failure = Object.assign(
    new Error('bad \x1b[31m<img src=x onerror=alert(1)>\x07'),
    { code: 'INVALID_INPUT' },
  );
  assert.deepEqual(output.fail(failure), {
    code: 'INVALID_INPUT',
    message: 'bad �[31m<img src=x onerror=alert(1)>�',
  });
  assert.deepEqual(out.written, [
    'INVALID_INPUT: bad �[31m<img src=x onerror=alert(1)>�\n',
  ]);
  assert.equal(plainText('a\tb\nc\u0085'), 'a\tb\nc�');
});

test('a recognized failure is written as its explanation, still returning its code', () => {
  const out = sink();
  const output = new CommandOutput(out);
  const failure = Object.assign(new Error('Guest is not registered'), {
    code: 'NOT_FOUND',
  });
  assert.deepEqual(output.fail(failure, 'x\x1b: command not found.'), {
    code: 'NOT_FOUND',
    message: 'Guest is not registered',
  });
  assert.deepEqual(out.written, ['x�: command not found.\n']);
});

test('after cancel, late chunks and results are not shown', () => {
  const out = sink();
  const output = new CommandOutput(out);
  output.onOutput(chunk(encode('early\n')));
  output.cancel();
  output.onOutput(chunk(encode('late\n')));
  output.finish(result('guest', '', 130));
  output.fail(new Error('late'));
  assert.deepEqual(out.written, ['early\n']);
});
