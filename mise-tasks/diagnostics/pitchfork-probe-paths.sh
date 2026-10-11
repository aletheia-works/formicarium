#!/usr/bin/env bash
#MISE alias="pitchfork-probe-paths"
#MISE description="pitchfork probe paths"
# usage: mise run pitchfork-probe-paths [<session>]
# コード生成計画の Step 4（requirements.md の Assumptions の 2 件）を native で確かめるための調査用スクリプト。
# 手順（既定は pitchfork-basic）を busybox のコンテナ（ネットワークなし）で native に実行し、
# コマンドごとに次を dist/pitchfork-probe-paths/report.txt に書く。
#   - そのコマンドで新しく書き込まれた（mtime が新しい）パスの一覧（find / -xdev -newer）
#     /proc・/sys・/dev・/out・/in と、このスクリプト自身の作業ファイルは除く
#   - stdout・stderr・終了コード（status api のように、スーパーバイザーなしで何が返るかを見るため）
#   - コマンドの後に残っているプロセス（バックグラウンドでスーパーバイザーを起動していないか）
# 判定（persist の範囲を広げるか）は人が行う。書き込み先がすべて表の persist（/work と /root）
# の下にあれば、今の範囲のままでよい。基準値（fixtures/baseline/）は書き換えない。
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
# shellcheck source=../../scripts/lib/container.sh
. "$root/scripts/lib/container.sh"
# shellcheck source=../../scripts/lib/node.sh
. "$root/scripts/lib/node.sh"

session=${1:-pitchfork-basic}
if ! [[ $session =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]]; then
  echo "error: 手順の名前に使えない文字があります: $session" >&2
  exit 2
fi
info_status=0
load_session_info "$session" || info_status=$?
[ "$info_status" = 0 ] || exit "$info_status"
[ -f "$root/$GUEST_PATH" ] || { echo "error: $root/$GUEST_PATH がありません（bash mise-tasks/build/guests.sh $GUEST）" >&2; exit 1; }
image=${FORMICARIUM_NATIVE_IMAGE:-busybox:latest}

body='
  mv /work /in
  mkdir -p /work /root /usr/local/bin "$PROJECT_ROOT"
  cp -a "/in/$PROJECT_BASE/." "$PROJECT_ROOT/"
  cp "/in/$GUEST_PATH" "/usr/local/bin/$GUEST"
  chmod 0755 "/usr/local/bin/$GUEST"
  export HOME=/root PATH=/usr/local/bin:/usr/bin:/bin $GUEST_ENV
  cd "$CWD"
  report=/out/report.txt
  {
    echo "session: $SESSION"
    echo "guest env: ${GUEST_ENV:-(none)}"
    echo "cwd: $CWD  HOME: $HOME"
  } > "$report"
  n=0
  grep -v "^#" "/in/$SCRIPT" | while IFS= read -r line; do
    case $line in
      "") continue ;;
      "\$ "*) cmd=${line#\$ } ;;
      *) echo "unsupported line: $line" >&2; exit 1 ;;
    esac
    n=$((n + 1))
    # mtime の比較を確実にするため、目印のファイルを作ってから 1 秒あける
    touch /tmp/.probe-stamp
    sleep 1
    set +e
    sh -c "$cmd" >/tmp/.probe-stdout 2>/tmp/.probe-stderr </dev/null
    code=$?
    set -e
    sleep 1
    {
      echo
      echo "=== [$n] \$ $cmd"
      echo "--- exit: $code"
      echo "--- stdout:"
      cat /tmp/.probe-stdout
      echo "--- stderr:"
      cat /tmp/.probe-stderr
      echo "--- written paths (newer than the stamp):"
      find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /out -o -path /in \) -prune -o \
        -newer /tmp/.probe-stamp -print 2>/dev/null |
        grep -v -e "^/tmp/\.probe-" -e "^/tmp\$" | sort || true
      echo "--- processes after the command:"
      ps -o pid,args 2>/dev/null | grep -v -e "ps -o" -e "grep -v" || true
    } >> "$report"
  done
'

outdir=dist/pitchfork-probe-paths
rm -rf "${root:?}/$outdir"
CONTAINER_EXTRA_ARGS="--network none" container_run "$image" "$outdir" "$SESSION_INFO
$body" "$GUEST_PATH" "$PROJECT_BASE" "$SCRIPT"
echo "== $root/$outdir/report.txt"
cat "$root/$outdir/report.txt"
