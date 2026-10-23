#!/usr/bin/env bash
#MISE alias="build-blink-wasm"
#MISE description="build blink wasm"
# usage: mise run build-blink-wasm
# blink（fork）を Emscripten でビルドし、dist/blink/blink.mjs と blink.wasm を作る。
# インタプリタのみ（--disable-jit）、pthread あり（-sPROXY_TO_PTHREAD）。
#
# 手順：
#   1. mise-tasks/build/fetch-blink.sh で blink.lock のコミットを .vendor/blink に取得する
#   2. emconfigure ./configure --disable-jit → emmake make で blink.a と blink.o を作る
#   3. emcc でリンクして ES モジュール（blink.mjs）と wasm を出力する
#
# ビルドの場所（FORMICARIUM_BUILD）：
#   container（既定）: emscripten/emsdk:<ローカルの emsdk と同じ版> のコンテナで行う。
#                       blink の configure と Makefile は POSIX の sh と GNU make を前提に
#                       しており、Windows の emsdk ではそのまま実行できないため。
#   host            : scripts/emscripten-env.sh で設定したローカルの emsdk で行う
#                       （sh と GNU make がある Linux や macOS 向け）。
#
# 開発用：BLINK_SRC に別のソースディレクトリ（作業中の fork のチェックアウト）を
# 指定すると、取得を省いてそれをビルドする。
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/dist/blink"
mode=${FORMICARIUM_BUILD:-container}

# リンクの設定。ゲストのスレッドは Web Worker 上の pthread になる。
# INITIAL_MEMORY は blink の静的領域とスタックを収める大きさにし、あとは伸ばす。
LINK_FLAGS=(
  -O2
  -pthread
  -sPROXY_TO_PTHREAD
  -sPTHREAD_POOL_SIZE=16
  -sALLOW_MEMORY_GROWTH=1
  # WebKit はインスタンスごとに上限までコミットし、ページの処理が終わるまで手放さない。
  # 4GB では aube #1645 の 4 手順で約 14GB になるので 1GB にする（aube と probe は 1GB で動く。ADR 0010）。
  -sMAXIMUM_MEMORY=1GB
  -sINITIAL_MEMORY=128MB
  -sSTACK_SIZE=8MB
  -sDEFAULT_PTHREAD_STACK_SIZE=2MB
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createBlink
  -sEXIT_RUNTIME=1
  "-sENVIRONMENT=web,worker,node"
  -sFORCE_FILESYSTEM=1
  "-sEXPORTED_RUNTIME_METHODS=FS,ENV"
)
# 診断用に、リンクのフラグを足せる（例：FORMICARIUM_EXTRA_LINK_FLAGS='-sASSERTIONS=1'）。
# shellcheck disable=SC2206
LINK_FLAGS+=(${FORMICARIUM_EXTRA_LINK_FLAGS:-})
CONFIGURE_ARGS=(--disable-jit 'CFLAGS=-O2 -pthread' 'LDFLAGS=-pthread')

if [ -n "${BLINK_SRC:-}" ]; then
  src=$(cd "$BLINK_SRC" && pwd)
  echo "note: BLINK_SRC=$src をビルドします（blink.lock は使いません）" >&2
else
  bash "$root/mise-tasks/build/fetch-blink.sh"
  src="$root/.vendor/blink"
fi
if [ -n "${BLINK_SOURCE_COMMIT:-}" ]; then
  # Local source metadata may be supplied by the jj-driven development flow.
  # It describes the base commit; local patches remain explicitly dirty.
  if ! [[ $BLINK_SOURCE_COMMIT =~ ^[0-9a-f]{40}$ ]]; then
    echo 'error: BLINK_SOURCE_COMMIT must be a 40-character hash' >&2
    exit 2
  fi
  commit=$BLINK_SOURCE_COMMIT
  dirty=${BLINK_SOURCE_DIRTY:-unknown}
else
  commit=$(git -C "$src" rev-parse HEAD 2>/dev/null || echo unknown)
  dirty=$(git -C "$src" status --porcelain 2>/dev/null | head -1)
fi

emsdk_version() {
  # ローカルの emsdk の版にコンテナをそろえる。なければ既定の版を使う。
  local f="${EMSDK:-$HOME/AppData/Local/emsdk}/upstream/emscripten/emscripten-version.txt"
  [ -f "$f" ] || f="$HOME/emsdk/upstream/emscripten/emscripten-version.txt"
  if [ -f "$f" ]; then tr -d '"\r\n ' <"$f"; else echo 6.0.10; fi
}

# blink を configure・make してリンクするシェルスクリプト（コンテナでもホストでも同じ）。
build_script() {
  local srcdir=$1 outdir=$2
  cat <<EOF
set -eu
cd '$srcdir'
emconfigure ./configure $(printf "'%s' " "${CONFIGURE_ARGS[@]}") >config.out 2>&1 || { cat config.out; exit 1; }
emmake make -j"\$(nproc 2>/dev/null || echo 4)" o//blink/blink.a o//blink/blink.o
mkdir -p '$outdir'
jslib=
if [ -f blink/emscriptenfs.js ]; then jslib='--js-library blink/emscriptenfs.js'; fi
emcc ${LINK_FLAGS[*]} \$jslib o//blink/blink.o o//blink/blink.a -lm -o '$outdir/blink.mjs'
emcc --version | head -1 >'$outdir/emcc-version.txt'
EOF
}

rm -rf "$out"
mkdir -p "$out"
case $mode in
  container)
    # shellcheck source=../../scripts/lib/container.sh
    . "$root/scripts/lib/container.sh"
    image=${FORMICARIUM_EMSDK_IMAGE:-"emscripten/emsdk:$(emsdk_version)"}
    echo "== blink を $image でビルドします"
    rel_src=${src#"$root"/}
    if [ "$rel_src" = "$src" ]; then
      echo "error: ソースはプロジェクトの中に置いてください: $src" >&2
      exit 2
    fi
    container_run "$image" dist/blink "
      cp -a '/work/$rel_src' /tmp/blink
      rm -rf /tmp/blink/o /tmp/blink/.git
      $(build_script /tmp/blink /out)
    " "$rel_src"
    ;;
  host)
    # shellcheck source=../../scripts/emscripten-env.sh
    . "$root/scripts/emscripten-env.sh"
    command -v make >/dev/null || { echo "error: GNU make がありません（FORMICARIUM_BUILD=container を使ってください）" >&2; exit 2; }
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    cp -a "$src" "$tmp/blink"
    rm -rf "$tmp/blink/o" "$tmp/blink/.git"
    sh -c "$(build_script "$tmp/blink" "$out")"
    ;;
  *)
    echo "error: FORMICARIUM_BUILD は container か host です: $mode" >&2
    exit 2
    ;;
esac

for f in blink.mjs blink.wasm; do
  if [ ! -s "$out/$f" ]; then
    echo "error: $out/$f が生成されていません" >&2
    exit 1
  fi
done
cat >"$out/build-info.json" <<EOF
{
  "blinkCommit": "$commit",
  "blinkSourceDirty": $([ -n "$dirty" ] && echo true || echo false),
  "emcc": "$(tr -d '\r\n"' <"$out/emcc-version.txt")",
  "mode": "$mode",
  "configure": "$(printf '%s ' "${CONFIGURE_ARGS[@]}" | sed 's/ $//')",
  "link": "${LINK_FLAGS[*]}"
}
EOF
rm -f "$out/emcc-version.txt"
ls -la "$out"
