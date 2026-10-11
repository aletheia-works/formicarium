#!/usr/bin/env bash
#MISE alias="build-guests"
#MISE description="build guests"
# usage: mise run build-guests [probe|aube|pitchfork|all]
# static-musl x86-64 のゲストをコンテナ（rust:alpine）でビルドし、dist/guests/ に置く。
#   probe     : guest/probe の probe・hello・exit3
#   aube      : aubepkg/aube の AUBE_REF（既定 v2.6.1）
#   pitchfork : jdx/pitchfork（公式リポジトリ）の PITCHFORK_REF（既定 v2.30.1）。ソースは変えない（FR1.1）
# 取得したコミットは dist/guests/<name>.commit に記録する（FR1.2）。
# ビルド後、dist/guests/ にあるすべてのゲストが x86-64 の static な ELF であることを確かめる。
# runtime/registry.js の GUESTS にあるゲストは、すべて下の guests に含める
# （tests/node/runner.test.js で確かめる）。
# コンテナは scripts/lib/container.sh の規則で選ぶ（wslc を優先し、使えなければ docker）。
# cargo のレジストリとビルド先は名前付きボリュームに置く（2 回目以降を速くするため）。
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
# shellcheck source=../../scripts/lib/container.sh
. "$root/scripts/lib/container.sh"

what=${1:-all}
case $what in probe|aube|pitchfork|all) ;; *) echo "usage: $0 [probe|aube|pitchfork|all]" >&2; exit 2;; esac

# ビルドで作られるゲストの一覧（生成物の確認に使う）
guests="probe hello exit3 aube pitchfork"

image=${FORMICARIUM_RUST_IMAGE:-rust:alpine}
aube_repo=${AUBE_REPO:-https://github.com/aubepkg/aube.git}
aube_ref=${AUBE_REF:-v2.6.1}
if ! [[ $aube_ref =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "error: AUBE_REF に使えない文字があります: $aube_ref" >&2
  exit 2
fi
pitchfork_repo=${PITCHFORK_REPO:-https://github.com/jdx/pitchfork.git}
pitchfork_ref=${PITCHFORK_REF:-v2.30.1}
if ! [[ $pitchfork_ref =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "error: PITCHFORK_REF に使えない文字があります: $pitchfork_ref" >&2
  exit 2
fi
if ! [[ $pitchfork_repo =~ ^https://[A-Za-z0-9._/-]+$ ]]; then
  echo "error: PITCHFORK_REPO は https の URL にしてください: $pitchfork_repo" >&2
  exit 2
fi
target=x86_64-unknown-linux-musl
mkdir -p "$root/dist/guests"

build_probe() {
  echo "== probe・hello・exit3 をビルド（${image}）"
  container_run "$image" dist/guests "
    apk add --no-cache musl-dev >/dev/null
    cargo build --release --locked --target $target \
      --manifest-path guest/probe/Cargo.toml --target-dir /cache/guests
    for bin in probe hello exit3; do
      cp /cache/guests/$target/release/\$bin /out/\$bin
    done
  " guest/probe/Cargo.toml guest/probe/Cargo.lock guest/probe/src
}

build_aube() {
  echo "== aube $aube_ref をビルド（${image}）"
  # aube の build script は、PATH に node があると npm の packument を取得して埋め込む。
  # コンテナには node がないので埋め込まれないが、念のため空の primer を明示して
  # どのマシンでも同じ内容になるようにする（terrarium の build-aube.sh と同じ扱い）。
  container_run "$image" dist/guests "
    apk add --no-cache musl-dev git perl make cmake >/dev/null
    src=/cache/aube-src/$aube_ref
    if [ ! -d \"\$src/.git\" ]; then
      rm -rf \"\$src\"
      git clone --quiet --depth 1 --branch '$aube_ref' '$aube_repo' \"\$src\"
    fi
    git -C \"\$src\" rev-parse HEAD > /out/aube.commit
    : > /cache/empty-primer.rkyv.zst
    cd \"\$src\"
    AUBE_PRIMER_PATH=/cache/empty-primer.rkyv.zst \
      cargo build --release --locked --target $target -p aube --bin aube --target-dir /cache/aube
    cp /cache/aube/$target/release/aube /out/aube
  " guest/probe/Cargo.toml
}

build_pitchfork() {
  echo "== pitchfork $pitchfork_ref をビルド（${image}、取得元 ${pitchfork_repo}）"
  # キャッシュのクローンは取得元の URL も確かめてから使う（別の取得元のものを混ぜないため。NFR3）。
  # release ビルドは web UI（ui/dist）を埋め込むので、先に UI をビルドする（pitchfork の build.rs は
  # ui/dist/index.html がないと release で止まる）。UI のビルド手順は pitchfork の mise.toml の
  # build:ui と同じ `aube install && aube run build`。aube は dist/guests/aube（static-musl）を使い、
  # pnpm-lock.yaml に固定した依存だけを入れる（--frozen-lockfile）。pitchfork のソースは変えない。
  # 上流の UI build は Node を使う。公式 current-alpine image の musl binary を
  # Rust container に渡し、Alpine の LTS package による旧版固定を避ける。
  # 実際に使った版・UI の成果物は pitchfork.build-info に記録する。
  local aube_bin=dist/guests/aube
  [ -f "$root/$aube_bin" ] || { echo "error: $aube_bin がありません（UI のビルドに使います）" >&2; exit 1; }
  container_run "${PITCHFORK_UI_NODE_IMAGE:-node:current-alpine}" .artifacts/pitchfork-ui-node "
    cp /usr/local/bin/node /out/node
  " guest/probe/Cargo.toml
  container_run "$image" dist/guests "
    apk add --no-cache musl-dev git perl make cmake libstdc++ >/dev/null
    install -m 0755 /work/.artifacts/pitchfork-ui-node/node /usr/local/bin/node
    node_version=\$(node --version)
    install -m 0755 /work/$aube_bin /usr/local/bin/aube
    src=/cache/pitchfork-src/$pitchfork_ref
    if [ ! -d \"\$src/.git\" ] || [ \"\$(git -C \"\$src\" remote get-url origin)\" != '$pitchfork_repo' ]; then
      rm -rf \"\$src\"
      git clone --quiet --depth 1 --branch '$pitchfork_ref' '$pitchfork_repo' \"\$src\"
    fi
    git -C \"\$src\" rev-parse HEAD > /out/pitchfork.commit
    cd \"\$src/ui\"
    export AUBE_NO_UPDATE_CHECK=1
    aube install --frozen-lockfile
    aube run build
    [ -f dist/index.html ] || { echo 'error: ui/dist/index.html ができていません' >&2; exit 1; }
    cd \"\$src\"
    # 上流のソースをそのまま使う。以前のパッチが残るキャッシュは拒否する。
    git diff HEAD --exit-code -- src
    cargo build --release --locked --target $target --bin pitchfork --target-dir /cache/pitchfork
    cp /cache/pitchfork/$target/release/pitchfork /out/pitchfork
    {
      echo \"ref=$pitchfork_ref\"
      echo \"commit=\$(cat /out/pitchfork.commit)\"
      echo \"ui-node=\$node_version\"
      echo \"ui-index-sha256=\$(sha256sum ui/dist/index.html | cut -d ' ' -f 1)\"
    } > /out/pitchfork.build-info
  " guest/probe/Cargo.toml "$aube_bin" .artifacts/pitchfork-ui-node/node
}

case $what in
  probe) build_probe ;;
  aube) build_aube ;;
  pitchfork) build_pitchfork ;;
  all) build_probe; build_aube; build_pitchfork ;;
esac

# 生成物が static な ELF であること（プログラムヘッダに PT_INTERP がない）を確かめる。
# ELF64 のヘッダ：e_phoff は 32 バイト目から 8 バイト、e_phentsize は 54、e_phnum は 56（リトルエンディアン）。
# od の -tu はホストのバイト順で読むので、リトルエンディアンのホスト（x86-64 など）を前提にする。
check_static_elf() {
  local bin=$1 class data phoff phentsize phnum i p_type
  class=$(od -An -tu1 -j4 -N1 "$bin" | tr -d ' \n')
  data=$(od -An -tu1 -j5 -N1 "$bin" | tr -d ' \n')
  if [ "$class" != 2 ] || [ "$data" != 1 ]; then
    echo "error: $bin は 64 ビット・リトルエンディアンの ELF ではありません" >&2
    return 1
  fi
  phoff=$(od -An -tu8 -j32 -N8 "$bin" | tr -d ' \n')
  phentsize=$(od -An -tu2 -j54 -N2 "$bin" | tr -d ' \n')
  phnum=$(od -An -tu2 -j56 -N2 "$bin" | tr -d ' \n')
  if [ "$phentsize" != 56 ] || [ "$phnum" -lt 1 ] || [ "$phnum" -gt 256 ]; then
    echo "error: $bin のプログラムヘッダが不正です（e_phentsize=$phentsize e_phnum=${phnum}）" >&2
    return 1
  fi
  for ((i = 0; i < phnum; i++)); do
    p_type=$(od -An -tu4 -j$((phoff + i * phentsize)) -N4 "$bin" | tr -d ' \n')
    if [ "$p_type" = 3 ]; then
      echo "error: $bin は動的リンクです（PT_INTERP があります）" >&2
      return 1
    fi
  done
}

# 生成物が x86-64 の ELF であることを確かめる（e_ident と e_machine）。あわせて static であることも確かめる。
for name in $guests; do
  bin="$root/dist/guests/$name"
  [ -f "$bin" ] || continue
  magic=$(head -c 4 "$bin" | od -An -c | tr -d ' \n')
  machine=$(od -An -tx1 -j18 -N2 "$bin" | tr -d ' \n')
  if [ "$magic" != '177ELF' ] || [ "$machine" != '3e00' ]; then
    echo "error: $bin は x86-64 の ELF ではありません" >&2
    exit 1
  fi
  check_static_elf "$bin" || exit 1
done
ls -la "$root/dist/guests"
