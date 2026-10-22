#!/usr/bin/env bash
#MISE alias="native-baseline"
#MISE description="native baseline"
# usage: mise run native-baseline [<session>] [--check-reproducible]
# 手順（runtime/registry.js の SESSIONS。既定は aube-1645）を、static-musl のゲスト
# （dist/guests/<guest>）で x86-64 Linux のコンテナ上で native に実行し、書き起こしを
# 表の baseline（fixtures/baseline/<session>.native.txt）に保存する（native の基準値）。
#
# 手順の設定は scripts/session-info.js から得る（表を読み、名前と手順ファイルを検証する）。
# 書き起こしの形式は runtime/session.js と同じ：
#   $ <command> / <stdout> / [exit <code>]   （stderr は含めない）
# 作業ディレクトリと HOME は、ブラウザ・Node.js での実行と同じ（表の cwd と /root）にする。
# 受け付けるコマンドは <guest> ...、rm -rf <path>、cat <path>。sh -c で実行する。
# 実行のたびに新しいコンテナで fixture を置き直すので、前回の結果は混ざらない。
#
# --check-reproducible：2 回作って一致することを確かめる。一致しなければ基準値を書かずに
# 終了コード 1 で止める。
#
# node は scripts/lib/node.sh の規則で探す（FORMICARIUM_NODE、PATH、mise のインストール先）。
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
# shellcheck source=../../scripts/lib/container.sh
. "$root/scripts/lib/container.sh"
# shellcheck source=../../scripts/lib/node.sh
. "$root/scripts/lib/node.sh"

usage() {
  echo "usage: bash mise-tasks/build/native-baseline.sh [<session>] [--check-reproducible]" >&2
  exit 2
}

session=aube-1645
check_reproducible=0
session_given=0
for arg in "$@"; do
  case $arg in
    --check-reproducible) check_reproducible=1 ;;
    -*) usage ;;
    *)
      [ "$session_given" = 0 ] || usage
      session=$arg
      session_given=1
      ;;
  esac
done
if ! [[ $session =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]]; then
  echo "error: 手順の名前に使えない文字があります: $session" >&2
  exit 2
fi

# SESSION・GUEST・GUEST_PATH・SCRIPT・PROJECT_BASE・PROJECT_ROOT・CWD・BASELINE・GUEST_ENV を設定する
info_status=0
load_session_info "$session" || info_status=$?
[ "$info_status" = 0 ] || exit "$info_status"

[ -f "$root/$GUEST_PATH" ] || { echo "error: $root/$GUEST_PATH がありません（bash mise-tasks/build/guests.sh $GUEST）" >&2; exit 1; }
[ -f "$root/$SCRIPT" ] || { echo "error: $root/$SCRIPT がありません" >&2; exit 1; }
[ -d "$root/$PROJECT_BASE" ] || { echo "error: $root/$PROJECT_BASE がありません" >&2; exit 1; }
image=${FORMICARIUM_NATIVE_IMAGE:-busybox:latest}

# コンテナで実行する本体。先頭に session-info.js の出力（変数の定義）を付けて渡す。
# 変数はシェル変数のままで export しない（ゲストの環境は GUEST_ENV だけ）。
body='
  mv /work /in
  mkdir -p /work /root /usr/local/bin "$PROJECT_ROOT"
  cp -a "/in/$PROJECT_BASE/." "$PROJECT_ROOT/"
  cp "/in/$GUEST_PATH" "/usr/local/bin/$GUEST"
  chmod 0755 "/usr/local/bin/$GUEST"
  # runtime/registry.js の env と同じ（aube は registry への更新確認を止める）
  export HOME=/root PATH=/usr/local/bin:/usr/bin:/bin $GUEST_ENV
  cd "$CWD"
  out="/out/$SESSION.native.txt"
  grep -v "^#" "/in/$SCRIPT" | while IFS= read -r line; do
    case $line in
      "") continue ;;
      "\$ "*) cmd=${line#\$ } ;;
      *) echo "unsupported line: $line" >&2; exit 1 ;;
    esac
    case $cmd in
      "$GUEST"|"$GUEST "*|"rm -rf "*|"cat "*) ;;
      *) echo "unsupported command: $cmd" >&2; exit 1 ;;
    esac
    set +e
    sh -c "$cmd" >/tmp/stdout 2>/dev/null </dev/null
    code=$?
    set -e
    {
      echo "\$ $cmd"
      cat /tmp/stdout
      # 最終行に改行がなければ足す（runtime/session.js と同じ扱い）
      if [ -s /tmp/stdout ] && [ "$(tail -c 1 /tmp/stdout | od -An -c | tr -d " ")" != "\n" ]; then echo; fi
      echo "[exit $code]"
    } >> "$out"
  done
'

# usage: run_once <outdir>（プロジェクトのルートからの相対パス）
run_once() {
  rm -rf "${root:?}/$1"
  # ブラウザと同じく、ネットワークなしで実行する。
  CONTAINER_EXTRA_ARGS="--network none" container_run "$image" "$1" "$SESSION_INFO
$body" "$GUEST_PATH" "$PROJECT_BASE" "$SCRIPT"
  [ -f "$root/$1/$SESSION.native.txt" ] || { echo "error: 書き起こしが作られませんでした" >&2; return 1; }
}

workdir=dist/native-baseline
rm -rf "${root:?}/$workdir"
run_once "$workdir/run1"
if [ "$check_reproducible" = 1 ]; then
  run_once "$workdir/run2"
  if ! cmp -s "$root/$workdir/run1/$SESSION.native.txt" "$root/$workdir/run2/$SESSION.native.txt"; then
    echo "error: 2 回の実行で書き起こしが一致しません（基準値は書きません）" >&2
    diff -u "$root/$workdir/run1/$SESSION.native.txt" "$root/$workdir/run2/$SESSION.native.txt" >&2 || true
    exit 1
  fi
  echo "== 2 回の実行で書き起こしが一致しました" >&2
fi

out="$root/$BASELINE"
mkdir -p "$(dirname "$out")"
cp "$root/$workdir/run1/$SESSION.native.txt" "$out"
rm -rf "${root:?}/$workdir"
echo "== $out"
cat "$out"
