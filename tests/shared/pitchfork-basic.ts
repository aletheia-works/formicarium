// pitchfork-basic の Node.js とブラウザのテストで共通に使う、時間の上限と判定の補助。
// 書き起こしの一致と、手順の間の状態の引き継ぎを、両方の環境で同じ規則で確かめる。
import { normalizeTranscript } from '../../runtime/session.js';

/**
 * 1 回の実行（8 コマンド）の時間の上限。最初の 3 回の実測の
 * 最大値の 3 倍を 60 秒単位で切り上げた値。
 * 既存の上限（probe 600 秒、ブラウザの aube 840 秒）とは別の値で、それらは変えない。
 *   Node.js  ：2026-10-06 の 3 回が 24.9・26.9・32.7 秒 → 32.7 × 3 = 98.1 → 120 秒
 *   ブラウザ：2026-10-06 の 3 ブラウザ × 3 回の最大が Firefox の 3.1 分（約 186 秒）→ 558 → 600 秒
 */
export const NODE_TIMEOUT_MS = 120 * 1000;
export const BROWSER_TIMEOUT_MS = 600 * 1000;

/**
 * 書き起こしを、手順のコマンドごとの stdout と終了コードに分ける。
 * 見出し（"$ <command>"）を手順の順に探すので、stdout に "$ " で始まる行があっても誤らない。
 * @param {string} transcript runtime/session.js の formatTranscript の形式
 * @param {Array<{command: string}>} commands parseSessionScript の結果
 * @returns {Array<{command: string, stdout: string, exitCode: number}>}
 */
export function transcriptOutputs(
  transcript: string,
  commands: readonly { command: string }[],
) {
  let text = normalizeTranscript(transcript);
  if (!text.endsWith('\n')) text += '\n';
  const outputs: { command: string; stdout: string; exitCode: number }[] = [];
  let pos = 0;
  commands.forEach((c, i) => {
    const header = `$ ${c.command}\n`;
    if (!text.startsWith(header, pos)) {
      throw new Error(
        `transcript: expected ${JSON.stringify(header)} at offset ${pos}`,
      );
    }
    const bodyStart = pos + header.length;
    let end = text.length;
    if (i + 1 < commands.length) {
      const next = text.indexOf(`]\n$ ${commands[i + 1].command}\n`, bodyStart);
      if (next === -1)
        throw new Error(
          `transcript: no block for ${JSON.stringify(commands[i + 1].command)}`,
        );
      end = next + 2;
    }
    const block = text.slice(bodyStart, end);
    const exit = /\[exit (-?\d+)\]\n$/.exec(block);
    if (!exit)
      throw new Error(
        `transcript: no exit code for ${JSON.stringify(c.command)}`,
      );
    outputs.push({
      command: c.command,
      stdout: block.slice(0, exit.index),
      exitCode: Number(exit[1]),
    });
    pos = end;
  });
  if (pos !== text.length)
    throw new Error(
      `transcript: unexpected text after the last command at offset ${pos}`,
    );
  return outputs;
}

/** pitchfork.toml の [daemons.<name>] の節（見出しから次の見出しの前まで）を返す。なければ null。 */
export function daemonSection(toml: string, name: string) {
  const lines = toml.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === `[daemons.${name}]`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => line.trim().startsWith('['));
  return [lines[start], ...(next === -1 ? rest : rest.slice(0, next))].join(
    '\n',
  );
}

/** 手順の中から、指定したコマンドの出力を 1 つ取り出す。なければ Error。 */
export function outputOf(
  outputs: { command: string; stdout: string; exitCode: number }[],
  command: string,
) {
  const found = outputs.filter((o) => o.command === command);
  if (found.length !== 1)
    throw new Error(
      `expected exactly one ${JSON.stringify(command)}, found ${found.length}`,
    );
  return found[0];
}
