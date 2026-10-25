// ブラウザで実行できるゲストと手順の一覧。URL のパラメータはこの一覧と照合してから使う
// （任意のパスを読み込ませないため）。
// 中身は runtime/registry.js の表から作る。パスはこのファイルからの相対パスに直して公開する。
import {
  GUESTS as GUEST_TABLE,
  NAME,
  SESSIONS as SESSION_TABLE,
} from '../runtime/registry.js';

/** このファイルからプロジェクトのルートへの相対パス */
const FROM_HERE = '../';

/** ?guest=<name> で選べるゲスト（dist/guests/ のビルド物） */
export const GUESTS = Object.freeze(
  Object.fromEntries(
    Object.entries(GUEST_TABLE).map(([name, guest]) => [
      name,
      FROM_HERE + guest.path,
    ]),
  ),
);

/**
 * ゲストごとの環境変数（runtime/registry.js の env）。Node.js のテストと
 * mise-tasks/build/native-baseline.sh も同じ表の値を使う。
 */
export const GUEST_ENV = Object.freeze(
  Object.fromEntries(
    Object.entries(GUEST_TABLE).map(([name, guest]) => [name, guest.env]),
  ),
);

/**
 * ?session=<name> で選べる手順。project のファイルは cwd の親（projectRoot）以下に置く。
 * ページは projectRoot で Session を作るので、ステップの間で projectRoot と HOME の中身が
 * 引き継がれる（registry の persist と同じ範囲。persist は計測のスクリプトも読む）。
 */
export const SESSIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(SESSION_TABLE).map(([name, session]) => [
      name,
      Object.freeze({
        ...session,
        script: FROM_HERE + session.script,
        projectBase: FROM_HERE + session.projectBase,
        baseline: FROM_HERE + session.baseline,
      }),
    ]),
  ),
);

/** URL のパラメータを検証して、実行する内容を返す。不正なら Error を投げる。 */
export function parseRunRequest(searchParams: URLSearchParams) {
  const session = searchParams.get('session');
  if (session !== null) {
    if (!NAME.test(session) || !Object.hasOwn(SESSIONS, session)) {
      throw new Error(`unknown session: ${session}`);
    }
    return { kind: 'session' as const, name: session };
  }
  const guest = searchParams.get('guest') ?? 'probe';
  if (!NAME.test(guest) || !Object.hasOwn(GUESTS, guest)) {
    throw new Error(`unknown guest: ${guest}`);
  }
  const args = searchParams.getAll('arg');
  if (args.some((a) => a.length > 4096)) throw new Error('argument too long');
  // ?stdin=<text> はゲストが最初に出力した後に stdin へ送り、そこで閉じる。
  const stdin = searchParams.get('stdin');
  if (stdin !== null && stdin.length > 4096) throw new Error('stdin too long');
  // ?terminal=<columns>x<rows> はゲストに端末として見せる大きさ。
  const size = searchParams.get('terminal');
  // 上限は Session の検査（validateTerminal）と同じ 65535。
  const match =
    size === null ? null : /^([1-9]\d{0,4})x([1-9]\d{0,4})$/.exec(size);
  const terminal = match
    ? { columns: Number(match[1]), rows: Number(match[2]) }
    : null;
  if (
    size !== null &&
    (!terminal || terminal.columns > 65535 || terminal.rows > 65535)
  )
    throw new Error(`invalid terminal: ${size}`);
  return { kind: 'guest' as const, name: guest, args, stdin, terminal };
}
