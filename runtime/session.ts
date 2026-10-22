import type { SessionStep } from './contracts.js';
import { errorText } from './contracts.js';
export interface Command extends SessionStep {
  command: string;
}
// 手順ファイル（fixtures/sessions/*.txt）の読み込みと、実行結果の書き起こし（transcript）。
// Node.js・ブラウザ・native の基準値（scripts/native-baseline.sh）で同じ形式を使い、
// 出力をそのまま比べられるようにする。
//
// 手順ファイルの形式：
//   # で始まる行はコメント
//   "$ <command>" の行が 1 つのコマンド。<command> は次のどれか
//     <tool> ...          ゲストの実行（tool は手順ごとのゲスト名。既定は aube）
//     rm -rf <相対パス>   JS 側で消す
//     cat <相対パス>      JS 側でファイルの中身を stdout に出す
//   引数は native の基準値（sh -c "<command>"）と同じ規則で分ける（splitShellWords）。
//
// 書き起こしの形式：
//   $ <command>
//   <stdout>
//   [exit <code>]
// stderr は含めない（進捗表示や所要時間など、環境で変わる内容が出るため）。

/**
 * 引用符の外にあると、sh が分割以外の意味（パイプ、リダイレクト、展開、グロブなど）で
 * 解釈する文字。ここで同じ解釈を再現する代わりに拒否して、native の sh と結果が食い違うのを防ぐ。
 */
const UNQUOTED_META = new Set([
  '|',
  ';',
  '&',
  '<',
  '>',
  '$',
  '`',
  '*',
  '?',
  '[',
  '(',
  ')',
]);
/** 語の先頭にあるときだけ sh が特別に扱う文字（# はコメント、~ はホームの展開） */
const WORD_START_META = new Set(['#', '~']);
/** 二重引用符の中で、\ がエスケープとして働く文字（POSIX sh と同じ） */
const DQ_ESCAPABLE = new Set(['$', '`', '"', '\\', '\n']);

/**
 * 1 行のコマンドを、sh -c と同じ規則で語に分ける。
 * 受け付けるのは、単引用符、二重引用符（中の \ は $ ` " \ 改行 の前だけエスケープ）、
 * 引用符の外の \。閉じていない引用符と、sh が展開やリダイレクトとして扱う文字は Error にする。
 * @param {string} text
 * @returns {string[]}
 */
export function splitShellWords(text: string): string[] {
  if (typeof text !== 'string') throw new TypeError('command must be a string');
  const words = [];
  let word = '';
  let inWord = false;
  let i = 0;
  const startWord = () => {
    inWord = true;
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === ' ' || ch === '\t') {
      if (inWord) words.push(word);
      word = '';
      inWord = false;
      i += 1;
    } else if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      if (end === -1)
        throw new Error(`unterminated single quote at column ${i + 1}`);
      word += text.slice(i + 1, end);
      startWord();
      i = end + 1;
    } else if (ch === '"') {
      i = readDoubleQuoted(text, i, (s) => {
        word += s;
      });
      startWord();
    } else if (ch === '\\') {
      if (i + 1 >= text.length) throw new Error('trailing backslash');
      // 引用符の外の \<改行> は行の継続（何も残らない）。それ以外は次の 1 文字をそのまま使う。
      if (text[i + 1] !== '\n') word += text[i + 1];
      startWord();
      i += 2;
    } else if (UNQUOTED_META.has(ch) || (!inWord && WORD_START_META.has(ch))) {
      throw new Error(
        `unsupported shell syntax ${JSON.stringify(ch)} at column ${i + 1} (quote it)`,
      );
    } else {
      word += ch;
      startWord();
      i += 1;
    }
  }
  if (inWord) words.push(word);
  return words;
}

/** text[start] の二重引用符から読み、閉じる引用符の次の位置を返す。中身は append に渡す。 */
function readDoubleQuoted(
  text: string,
  start: number,
  append: (text: string) => void,
) {
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '"') return i + 1;
    if (ch === '\\' && i + 1 < text.length && DQ_ESCAPABLE.has(text[i + 1]!)) {
      if (text[i + 1] !== '\n') append(text[i + 1]!);
      i += 2;
    } else if (ch === '$' || ch === '`') {
      // 二重引用符の中でも sh は $ と ` を展開するので、エスケープされていなければ拒否する
      throw new Error(
        `unsupported shell syntax ${JSON.stringify(ch)} inside double quotes at column ${i + 1}`,
      );
    } else {
      append(ch);
      i += 1;
    }
  }
  throw new Error(`unterminated double quote at column ${start + 1}`);
}

/** rm -rf と cat が受け取るパスの検証。プロジェクトの外を指すものは拒否する。 */
function checkRelativePath(lineNumber: number, verb: string, target: string) {
  if (target === '' || target.includes('..') || target.startsWith('/')) {
    throw new Error(
      `line ${lineNumber}: ${verb} only takes a relative path inside the project: ${target}`,
    );
  }
}

/** 1 行のコマンドを解釈する。 */
function parseCommandLine(
  lineNumber: number,
  command: string,
  tool: string,
): Command {
  let words: string[];
  try {
    words = splitShellWords(command);
  } catch (error) {
    throw new Error(`line ${lineNumber}: ${errorText(error)}: ${command}`, {
      cause: error,
    });
  }
  if (words.length > 0 && words[0] === tool) {
    return { command, args: words.slice(1) };
  }
  if (words[0] === 'rm' && words[1] === '-rf' && words.length === 3) {
    checkRelativePath(lineNumber, 'rm -rf', words[2]!);
    return { command, removeTree: words[2] };
  }
  if (words[0] === 'cat' && words.length === 2) {
    checkRelativePath(lineNumber, 'cat', words[1]!);
    return { command, catFile: words[1] };
  }
  throw new Error(`line ${lineNumber}: unsupported command: ${command}`);
}

/**
 * 手順ファイルを解釈して、コマンドの配列にする。
 * @param {string} text 手順ファイルの中身
 * @param {{tool?: string}} [options] ゲストのコマンド名（runtime/registry.js の手順の guest）
 * @returns {Array<{command: string, args?: string[], removeTree?: string, catFile?: string}>}
 */
export function parseSessionScript(text: string, { tool = 'aube' } = {}) {
  if (typeof text !== 'string')
    throw new TypeError('session script must be a string');
  if (typeof tool !== 'string' || tool === '')
    throw new TypeError('tool must be a non-empty string');
  const commands = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (!line.startsWith('$ ')) {
      throw new Error(
        `line ${index + 1}: expected "$ <command>", got ${JSON.stringify(line)}`,
      );
    }
    commands.push(parseCommandLine(index + 1, line.slice(2).trim(), tool));
  }
  if (commands.length === 0) throw new Error('session script has no commands');
  return commands;
}

/** 手順のコマンドを、runtime/guest-io.js の runSession が受け取るステップに変える。 */
export function toSessionSteps(
  commands: readonly Command[],
  cwd: string,
): SessionStep[] {
  return commands.map((c) => {
    if (c.removeTree) return { removeTree: `${cwd}/${c.removeTree}` };
    if (c.catFile) return { catFile: `${cwd}/${c.catFile}` };
    return { args: c.args };
  });
}

/**
 * 書き起こしを作る。
 * @param {Array<{command: string}>} commands
 * @param {Array<{exitCode: number, stdout: Uint8Array|string}>} results commands と同じ順
 */
export function formatTranscript(
  commands: readonly { command: string }[],
  results: readonly { exitCode: number; stdout: Uint8Array | string }[],
) {
  if (commands.length !== results.length) {
    throw new Error(
      `expected ${commands.length} results, got ${results.length}`,
    );
  }
  const decoder = new TextDecoder();
  let out = '';
  commands.forEach((c, i) => {
    const r = results[i]!;
    const stdout =
      typeof r.stdout === 'string'
        ? r.stdout
        : decoder.decode(r.stdout ?? new Uint8Array());
    out += `$ ${c.command}\n`;
    out += stdout;
    if (stdout && !stdout.endsWith('\n')) out += '\n';
    out += `[exit ${r.exitCode}]\n`;
  });
  return out;
}

/**
 * 書き起こしを比べる前の正規化。改行コードをそろえ、行末の空白を落とす。
 * 内容（バージョン番号など）は変えない。
 */
export function normalizeTranscript(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '\n');
}
