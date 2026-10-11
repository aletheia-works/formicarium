#!/usr/bin/env bash
#MISE alias="fetch-blink"
#MISE description="fetch blink"
# usage: mise run fetch-blink
# blink.lock に書かれた fork のコミットを .vendor/blink に取得する（FR1.1）。
# 取得後の HEAD がロックのコミットと一致しなければ、終了コード 1 で止める。
# BLINK_LOCK でロックファイルの場所を変えられる（テスト用）。
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
lock=${BLINK_LOCK:-$root/blink.lock}
dest=${BLINK_DEST:-$root/.vendor/blink}

# ロックファイルは source せず、決まったキーだけを読む（任意のコードを実行しないため）。
lock_value() {
  local value
  value=$(sed -n "s/^$1=//p" "$lock" | tail -1 | tr -d '\r')
  if [ -z "$value" ]; then
    echo "error: $lock に $1 がありません" >&2
    exit 1
  fi
  printf '%s\n' "$value"
}

[ -f "$lock" ] || { echo "error: ロックファイルがありません: $lock" >&2; exit 1; }
url=$(lock_value url)
commit=$(lock_value commit)
upstream_url=$(lock_value upstream_url)
upstream_commit=$(lock_value upstream_commit)
for sha in "$commit" "$upstream_commit"; do
  if ! [[ $sha =~ ^[0-9a-f]{40}$ ]]; then
    echo "error: コミットは 40 桁の 16 進数で指定してください: $sha" >&2
    exit 1
  fi
done
case $url in https://github.com/*) ;; *) echo "error: 想定外の URL です: $url" >&2; exit 1;; esac

git_() { git -c core.autocrlf=false -c advice.detachedHead=false -C "$dest" "$@"; }

if [ ! -d "$dest/.git" ]; then
  rm -rf "$dest"
  mkdir -p "$dest"
  git -C "$dest" init --quiet
  git_ remote add origin "$url"
fi
git_ remote set-url origin "$url"
if ! git_ cat-file -e "$commit^{commit}" 2>/dev/null; then
  git_ fetch --quiet origin "$commit"
fi
if ! git_ cat-file -e "$upstream_commit^{commit}" 2>/dev/null; then
  git_ fetch --quiet "$upstream_url" "$upstream_commit" ||
    echo "warning: upstream のコミット $upstream_commit を取得できませんでした（差分の一覧に必要）" >&2
fi
git_ checkout --quiet --force "$commit"
git_ clean --quiet -fdx

head=$(git_ rev-parse HEAD)
if [ "$head" != "$commit" ]; then
  echo "error: 取得したコミットがロックと一致しません（HEAD=$head, lock=$commit）" >&2
  exit 1
fi
echo "blink $commit を $dest に取得しました"
