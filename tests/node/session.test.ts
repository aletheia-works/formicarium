// 手順の解釈（runtime/session.js）と、cat のステップ（runtime/guest-io.js）。
// コアもゲストも使わないので、ビルド物なしで実行できる。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runSession } from '../../runtime/guest-io.js';
import {
  parseSessionScript,
  splitShellWords,
  toSessionSteps,
} from '../../runtime/session.js';
import { root } from './helpers.js';

describe('引数の分割（splitShellWords）', () => {
  it('二重引用符で囲んだ値は 1 つの引数になる', () => {
    assert.deepEqual(
      splitShellWords('pitchfork daemons add db --run "postgres -D data"'),
      ['pitchfork', 'daemons', 'add', 'db', '--run', 'postgres -D data'],
    );
  });

  it('単引用符・二重引用符の中の \\"・引用符の外の \\ を sh と同じに分ける', () => {
    // 単引用符の中では \ も " もそのまま
    assert.deepEqual(splitShellWords(`echo 'a \\ "b"'`), ['echo', 'a \\ "b"']);
    // 二重引用符の中の \ は " と \ の前ではエスケープ、それ以外ではそのまま残る
    assert.deepEqual(splitShellWords('echo "say \\"hi\\" \\\\ \\n"'), [
      'echo',
      'say "hi" \\ \\n',
    ]);
    // 引用符の外の \ は次の 1 文字をそのまま使う（空白も区切りにならない）
    assert.deepEqual(splitShellWords('echo a\\ b c'), ['echo', 'a b', 'c']);
    // 引用符はつながった 1 語の一部になり、空の引用符は空の引数になる
    assert.deepEqual(splitShellWords(`echo x"y z"'w' "" `), [
      'echo',
      'xy zw',
      '',
    ]);
    // 連続する空白とタブは 1 つの区切り
    assert.deepEqual(splitShellWords('  a \t  b  '), ['a', 'b']);
  });

  it('閉じていない引用符と、sh が別の意味に解釈する文字を拒否する', () => {
    assert.throws(
      () => splitShellWords('echo "abc'),
      /unterminated double quote/,
    );
    assert.throws(
      () => splitShellWords("echo 'abc"),
      /unterminated single quote/,
    );
    assert.throws(() => splitShellWords('echo abc\\'), /trailing backslash/);
    for (const command of [
      'a | b',
      'a; b',
      'a & b',
      'a > f',
      'a < f',
      'echo $HOME',
      'echo `id`',
      'ls *',
      'ls ?',
      'ls [ab]',
      'a (b)',
      'echo #c',
      'ls ~',
    ]) {
      assert.throws(
        () => splitShellWords(command),
        /unsupported shell syntax/,
        command,
      );
    }
    // 二重引用符の中でも $ と ` は sh が展開するので拒否する（\ でエスケープすれば受け付ける）
    assert.throws(
      () => splitShellWords('echo "$HOME"'),
      /inside double quotes/,
    );
    assert.deepEqual(splitShellWords('echo "\\$HOME"'), ['echo', '$HOME']);
    // 引用符の中のメタ文字、語の途中の # はそのまま
    assert.deepEqual(splitShellWords(`echo '| ; & * ?' a#b`), [
      'echo',
      '| ; & * ?',
      'a#b',
    ]);
    // 手順ファイルの解釈でも、行番号つきで止まる
    assert.throws(
      () => parseSessionScript('$ pitchfork --run "x\n', { tool: 'pitchfork' }),
      /line 1: unterminated double quote/,
    );
  });
});

describe('cat の解釈', () => {
  it('cat <相対パス> を catFile として解釈し、プロジェクトの外を指すパスを拒否する', () => {
    assert.deepEqual(
      parseSessionScript('$ cat pitchfork.toml\n', { tool: 'pitchfork' }),
      [{ command: 'cat pitchfork.toml', catFile: 'pitchfork.toml' }],
    );
    assert.deepEqual(
      toSessionSteps(
        [{ command: 'cat pitchfork.toml', catFile: 'pitchfork.toml' }],
        '/work/app',
      ),
      [{ catFile: '/work/app/pitchfork.toml' }],
    );
    assert.throws(
      () => parseSessionScript('$ cat ../x\n'),
      /cat only takes a relative path/,
    );
    assert.throws(
      () => parseSessionScript('$ cat /etc/passwd\n'),
      /cat only takes a relative path/,
    );
    assert.throws(
      () => parseSessionScript('$ cat a b\n'),
      /unsupported command/,
    );
  });

  it('pitchfork-basic の手順は pitchfork を tool にしたときだけ受け付ける', () => {
    const text = readFileSync(
      path.join(root, 'fixtures/sessions/pitchfork-basic.txt'),
      'utf8',
    );
    const commands = parseSessionScript(text, { tool: 'pitchfork' });
    assert.equal(commands.length, 8);
    assert.deepEqual(commands[2].args, [
      'daemons',
      'add',
      'db',
      '--run',
      'postgres -D data',
    ]);
    assert.equal(commands[4].catFile, 'pitchfork.toml');
    // 既定の tool（aube）のままでは、pitchfork のコマンドを受け付けない（後方互換）
    assert.throws(
      () => parseSessionScript(text),
      /unsupported command: pitchfork --version/,
    );
  });
});

describe('cat のステップの実行（runSession）', () => {
  const guestPath = '/guest/pitchfork';
  const common = {
    // cat と rm -rf のステップはコアを起動しない。呼ばれたら失敗させる。
    createModule: () => {
      throw new Error('createModule must not be called for cat steps');
    },
    core: { argv: () => [] },
    guestPath,
    guestEntry: {
      path: guestPath,
      type: 'file' as const,
      data: new Uint8Array([0x7f]),
      mode: 0o755,
    },
    cwd: '/work/app',
    persist: ['/work', '/root'],
  };
  const toml = '[daemons.api]\nrun = "bun run server/index.ts"\n';

  it('引き継いでいるファイルの中身をそのまま stdout に返し、終了コードは 0', async () => {
    const results = await runSession({
      ...common,
      entries: [
        { path: '/work/app', type: 'dir' as const },
        { path: '/work/app/pitchfork.toml', type: 'file' as const, data: toml },
      ],
      steps: [{ catFile: '/work/app/pitchfork.toml' }],
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].exitCode, 0);
    assert.equal(new TextDecoder().decode(results[0].stdout), toml);
    assert.equal(results[0].stderr.length, 0);
  });

  it('存在しないファイル・ディレクトリ・persist の外は Error になる', async () => {
    const entries = [
      { path: '/work/app', type: 'dir' as const },
      { path: '/work/app/pitchfork.toml', type: 'file' as const, data: toml },
      {
        path: '/etc/passwd',
        type: 'file' as const,
        data: 'root:x:0:0::/root:/bin/sh\n',
      },
    ];
    await assert.rejects(
      runSession({
        ...common,
        entries,
        steps: [{ catFile: '/work/app/missing.toml' }],
      }),
      /no such file/,
    );
    await assert.rejects(
      runSession({ ...common, entries, steps: [{ catFile: '/work/app' }] }),
      /is a directory/,
    );
    await assert.rejects(
      runSession({ ...common, entries, steps: [{ catFile: '/etc/passwd' }] }),
      /must be inside/,
    );
    // 前のステップ（rm -rf）で消したファイルは読めない（状態を引き継いでいる）
    await assert.rejects(
      runSession({
        ...common,
        entries,
        steps: [
          { removeTree: '/work/app/pitchfork.toml' },
          { catFile: '/work/app/pitchfork.toml' },
        ],
      }),
      /no such file/,
    );
  });
});

describe('既存の手順の互換', () => {
  it('aube-1645 の解釈結果と steps は変更前と同じ', () => {
    const text = readFileSync(
      path.join(root, 'fixtures/sessions/aube-1645.txt'),
      'utf8',
    );
    const commands = parseSessionScript(text);
    assert.deepEqual(commands, [
      { command: 'aube install', args: ['install'] },
      { command: 'rm -rf node_modules', removeTree: 'node_modules' },
      {
        command: 'aube install --frozen-lockfile',
        args: ['install', '--frozen-lockfile'],
      },
      { command: 'aube list', args: ['list'] },
    ]);
    assert.deepEqual(toSessionSteps(commands, '/work/app'), [
      { args: ['install'] },
      { removeTree: '/work/app/node_modules' },
      { args: ['install', '--frozen-lockfile'] },
      { args: ['list'] },
    ]);
  });
});
