// ゲスト・ゲストごとの環境変数・手順の表。ここが唯一の定義で、次の場所がここを読む。
//   - ブラウザ：web/sessions.js（URL の許可リスト。パスをそのファイルからの相対に直す）
//   - Node.js のテスト：tests/node/*.test.ts
//   - native の基準値：scripts/native-baseline.sh（scripts/session-info.js を通して読む）
//   - ゲストのビルド：scripts/build-guests.sh（ビルドの手順はシェルに残し、表のゲストがすべて
//     ビルドの対象に含まれることを tests/node/runner.test.js で確かめる）
//
// パスはすべてプロジェクトのルートからの相対パス。projectRoot・cwd・persist は仮想ファイル
// システム（native ではコンテナ）上の絶対パス。コアに依存する情報はここに置かない（runtime/core.ts）。

/** ゲスト名と手順名に使える文字（URL のパラメータとシェルへの受け渡しで、そのまま検証に使う） */
export const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
};

/**
 * ゲスト（dist/guests/ のビルド物）。env はそのゲストを実行するときの環境変数で、
 * Node.js・ブラウザ・native の基準値で同じ値を使う。
 * aube は --version などのたびに registry へ更新の確認をしに行くので止める（ブラウザには
 * ネットワークがなく、native の基準値と条件をそろえるため）。
 */
export const GUESTS = deepFreeze({
  probe: { path: 'dist/guests/probe', env: {} },
  hello: { path: 'dist/guests/hello', env: {} },
  exit3: { path: 'dist/guests/exit3', env: {} },
  // 対話的な実行（stdin と端末）の確認用
  ttyecho: { path: 'dist/guests/ttyecho', env: {} },
  // 全画面のエディタ。端末の定義（xterm-256color）はビルドで組み込んであり、terminfo のファイルは要らない
  nano: { path: 'dist/guests/nano', env: { TERM: 'xterm-256color' } },
  aube: { path: 'dist/guests/aube', env: { AUBE_NO_UPDATE_CHECK: '1' } },
  // 環境変数は不要（2026-10-06 に scripts/pitchfork-probe-paths.sh で native に確認済み）
  pitchfork: { path: 'dist/guests/pitchfork', env: {} },
} satisfies Record<string, { path: string; env: Record<string, string> }>);

/**
 * 手順。project のファイル（projectBase 以下の projectFiles）は projectRoot 以下に置き、
 * cwd で実行する。persist のディレクトリの中身を、ステップの間で引き継ぐ。
 * projectFiles は projectBase の中身と一致させる（tests/node/runner.test.js で確かめる）。
 * baseline は scripts/native-baseline.sh が作る native の基準値。
 */
export const SESSIONS = deepFreeze({
  'aube-1645': {
    guest: 'aube',
    script: 'fixtures/sessions/aube-1645.txt',
    projectBase: 'fixtures/aube-local-deps/',
    projectFiles: [
      'app/package.json',
      'app/filedep/package.json',
      'outside/linked/package.json',
    ],
    projectRoot: '/work',
    cwd: '/work/app',
    persist: ['/work', '/root'],
    baseline: 'fixtures/baseline/aube-1645.native.txt',
  },
  'pitchfork-basic': {
    guest: 'pitchfork',
    script: 'fixtures/sessions/pitchfork-basic.txt',
    projectBase: 'fixtures/pitchfork-basic/',
    projectFiles: ['app/pitchfork.toml'],
    projectRoot: '/work',
    cwd: '/work/app',
    // pitchfork の書き込み先は /work/app/pitchfork.toml と /root/.local/state/pitchfork/ で、この範囲に収まる。
    // 範囲の外は /tmp/fslock/ のロックファイルだけで、毎回作り直されるので引き継がない
    // （2026-10-06 に scripts/pitchfork-probe-paths.sh で native に確認済み）
    persist: ['/work', '/root'],
    baseline: 'fixtures/baseline/pitchfork-basic.native.txt',
  },
});

/**
 * 名前を検証して手順を返す。表にない名前、NAME に合わない名前は Error にする。
 * @param {string} name
 */
export function lookupSession(name: string) {
  if (
    typeof name !== 'string' ||
    !NAME.test(name) ||
    !Object.hasOwn(SESSIONS, name)
  ) {
    throw new Error(`unknown session: ${name}`);
  }
  const session = SESSIONS[name as keyof typeof SESSIONS];
  if (!Object.hasOwn(GUESTS, session.guest)) {
    throw new Error(
      `session ${name} refers to an unknown guest: ${session.guest}`,
    );
  }
  return session;
}
