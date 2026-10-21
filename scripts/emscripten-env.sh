#!/usr/bin/env bash
# emsdk を使うための環境設定。ビルドスクリプトから `. scripts/emscripten-env.sh` で読み込む。
#
# emsdk の場所は $EMSDK。未設定なら Windows では ~/AppData/Local/emsdk、
# それ以外では ~/emsdk を使う。cmake と ninja は mise の
# インストール先から探し、見つからなければ PATH 上のものを使う。
#
# emsdk が見つからないときは、導入手順を示して終了コード 2 で止まる
# （source されている場合は return、直接実行された場合は exit）。

_formicarium_env_fail() {
  echo "error: $1" >&2
  echo "emsdk の導入手順は README.md の「前提ツール」を参照してください。" >&2
  return 2 2>/dev/null || exit 2
}

: "${EMSDK:=$( [ -d "$HOME/AppData/Local/emsdk" ] && echo "$HOME/AppData/Local/emsdk" || echo "$HOME/emsdk" )}"
_em="$EMSDK/upstream/emscripten"
if [ ! -d "$_em" ]; then
  _formicarium_env_fail "emsdk が見つかりません: $EMSDK（EMSDK 環境変数で場所を指定できます）"
fi
_exe=""; [ -f "$_em/emcc.exe" ] && _exe=".exe"
if [ ! -f "$_em/emcc$_exe" ] && [ ! -f "$_em/emcc" ]; then
  _formicarium_env_fail "emcc がありません: $_em（emsdk install latest && emsdk activate latest を実行してください）"
fi

# mise のインストール先から実体を探す（mise exec は使わない）。
_formicarium_misebin() {
  local tool=$1 exe=$2
  ls -d "$HOME/AppData/Local/mise/installs/$tool"/*/{bin/,}"$exe" \
        "$HOME/.local/share/mise/installs/$tool"/*/{bin/,}"$exe" 2>/dev/null | tail -1
}
_tools_path=""
for _pair in "ninja:ninja$_exe" "cmake:cmake$_exe"; do
  _bin=$(_formicarium_misebin "${_pair%%:*}" "${_pair#*:}")
  if [ -n "$_bin" ]; then _tools_path="$(dirname "$_bin"):$_tools_path"; fi
done

export EMSDK
export EM_CONFIG="$EMSDK/.emscripten"
export PATH="$_tools_path$_em:$EMSDK:$PATH"
export FORMICARIUM_EMCC="$_em/emcc$_exe"
export FORMICARIUM_EMAR="$_em/emar$_exe"
unset _em _exe _tools_path _pair _bin
