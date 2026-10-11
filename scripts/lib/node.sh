#!/usr/bin/env bash
# node の実行ファイルを探す共通処理。各スクリプトから source して使う。
#
# 優先順位：
#   1. FORMICARIUM_NODE 環境変数
#   2. PATH の node
#   3. mise のインストール先（Windows は ~/AppData/Local/mise/installs/node/*/、
#      Linux や macOS は ~/.local/share/mise/installs/node/*/bin/）。版はハードコードしない
# 見つからなければ、メッセージを出して 1 を返す。

# usage: node_bin=$(find_node)
find_node() {
  if [ -n "${FORMICARIUM_NODE:-}" ]; then
    printf '%s\n' "$FORMICARIUM_NODE"
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  local found
  found=$(ls -d "$HOME"/AppData/Local/mise/installs/node/*/node.exe \
    "$HOME"/AppData/Local/mise/installs/node/*/bin/node \
    "$HOME"/.local/share/mise/installs/node/*/bin/node 2>/dev/null | tail -1 || true)
  if [ -z "$found" ]; then
    echo "error: node が見つかりません（FORMICARIUM_NODE で指定できます）" >&2
    return 1
  fi
  printf '%s\n' "$found"
}

# usage: load_session_info <session>
# scripts/session-info.js の出力（KEY='value' の行。値は単引用符でエスケープ済み）を読み、
# SESSION・GUEST・GUEST_PATH・SCRIPT・PROJECT_BASE・PROJECT_ROOT・CWD・BASELINE・GUEST_ENV と、
# その元の文字列 SESSION_INFO を設定する。失敗すれば session-info.js の終了コードを返す。
load_session_info() {
  local session=$1 node status
  # Session metadata is a helper, not a Node consumer compatibility test.
  if [ -n "${FORMICARIUM_NODE:-}" ]; then
    node=$(find_node) || return 1
  elif command -v bun >/dev/null 2>&1; then
    node=$(command -v bun)
  else
    node=$(find_node) || return 1
  fi
  set +e
  SESSION_INFO=$("$node" "$_formicarium_node_root/scripts/session-info.js" "$session")
  status=$?
  set -e
  if [ "$status" != 0 ]; then
    echo "error: 手順 $session の設定を読めませんでした（scripts/session-info.js の終了コード $status）" >&2
    return "$status"
  fi
  eval "$SESSION_INFO"
  if [ "${SESSION:-}" != "$session" ] || [ -z "${GUEST:-}" ] || [ -z "${BASELINE:-}" ]; then
    echo "error: scripts/session-info.js の出力が不正です" >&2
    return 1
  fi
}

_formicarium_node_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
