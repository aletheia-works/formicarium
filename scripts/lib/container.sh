#!/usr/bin/env bash
# コンテナの実行環境を選ぶ共通処理。各スクリプトから source して使う。
#
# 優先順位：
#   1. FORMICARIUM_CONTAINER 環境変数（wslc または docker のコマンドパス）
#   2. wslc（C:\Program Files\WSL\wslc.exe）。`wslc info` が応答する場合だけ使う
#   3. docker
# どれも使えなければ、終了コード 2 で止める。
#
# ファイルの受け渡しはバインドマウントではなく tar のストリームで行う。
# Docker Desktop は共有設定にないパスをマウントできず、Windows のバインド
# マウントは遅いため。キャッシュ（cargo のレジストリやビルド先）だけは名前付き
# ボリュームに置く。
#
# ゲストとネイティブのベースラインは x86-64 なので、docker では linux/amd64 の
# イメージを使う。arm64 の Mac でも、arm64 のイメージで x86-64 の musl を
# ビルドしようとして失敗せず、amd64 のエミュレーションで動く。

_formicarium_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

container_select() {
  if [ -n "${CONTAINER_CLI:-}" ]; then
    return 0
  fi
  if [ -n "${FORMICARIUM_CONTAINER:-}" ]; then
    CONTAINER_CLI=$FORMICARIUM_CONTAINER
    return 0
  fi
  local wslc="/c/Program Files/WSL/wslc.exe"
  # `wslc info` が応答しても run だけ失敗することがあるので、小さなコンテナを実際に動かして確かめる。
  if [ -x "$wslc" ] && timeout 90 "$wslc" run --rm busybox true >/dev/null 2>&1; then
    CONTAINER_CLI=$wslc
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && timeout 60 docker info >/dev/null 2>&1; then
    if [ -x "$wslc" ]; then
      echo "note: wslc が応答しないため docker を使います" >&2
    fi
    CONTAINER_CLI=docker
    return 0
  fi
  echo "error: コンテナの実行環境（wslc または docker）が見つかりません" >&2
  return 2
}

# usage: container_run <image> <outdir> <script> [input paths...]
#   input paths : プロジェクトのルートからの相対パス。コンテナの /work に展開する
#   script      : /work で sh -euc として実行する。成果物は /out に置く
#   outdir      : /out の中身を展開する先（プロジェクトのルートからの相対パス）
# script の stdout は stderr に回す（stdout は成果物の tar に使うため）。
# CONTAINER_EXTRA_ARGS で run に追加の引数（例：--network none）を渡せる。
container_run() {
  local image=$1 outdir=$2 script=$3
  shift 3
  container_select || return 2
  mkdir -p "$_formicarium_root/$outdir"
  local status
  local -a platform=()
  case "${CONTAINER_CLI##*/}" in
    wslc | wslc.exe) ;;
    *) platform=(--platform linux/amd64) ;;
  esac
  set +e
  tar -C "$_formicarium_root" -cf - "$@" |
    MSYS_NO_PATHCONV=1 "$CONTAINER_CLI" run --rm -i ${platform[@]+"${platform[@]}"} ${CONTAINER_EXTRA_ARGS:-} \
      -v formicarium-cargo-registry:/usr/local/cargo/registry \
      -v formicarium-cache:/cache \
      "$image" sh -euc "
        mkdir -p /work /out
        tar -xf - -C /work
        cd /work
        ( $script ) 1>&2
        tar -cf - -C /out .
      " |
    tar -xf - -C "$_formicarium_root/$outdir"
  status=("${PIPESTATUS[@]}")
  set -e
  if [ "${status[0]}" != 0 ] || [ "${status[1]}" != 0 ] || [ "${status[2]}" != 0 ]; then
    echo "error: コンテナでの処理に失敗しました（tar=${status[0]} container=${status[1]} extract=${status[2]}）" >&2
    return 1
  fi
}
