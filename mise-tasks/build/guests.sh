#!/usr/bin/env bash
#MISE alias="build-guests"
#MISE description="build guests"
# usage: mise run build-guests [probe|aube|pitchfork|nano|git|jj|all]
# static-musl x86-64 のゲストをコンテナ（rust:alpine）でビルドし、dist/guests/ に置く。
#   probe     : guest/probe の probe・hello・exit3・ttyecho・spawn
#   aube      : aubepkg/aube の AUBE_REF（既定 v2.6.1）
#   pitchfork : jdx/pitchfork（公式リポジトリ）の PITCHFORK_REF（既定 v2.30.1）。ソースは変えない
#   nano      : GNU nano NANO_VERSION（既定 9.3）。ncurses NCURSES_VERSION（既定 6.6）に
#               xterm-256color の端末定義を組み込み、terminfo のファイルなしで動くようにする。ソースは変えない
#   git       : Git GIT_VERSION（既定 2.56.0）の git と git-remote-https。HTTP の部分は、OpenSSL と zlib
#               だけを使う curl CURL_VERSION（既定 8.23.0）を static に組み込む。ソースは変えない
#   jj        : jj-vcs/jj の JJ_REF（既定 v0.46.0）。git の操作は PATH の git を使う。ソースは変えない
# git から取得したゲストは、取得したコミットを dist/guests/<name>.commit に記録する。nano と git は tarball から
# ビルドするので .commit はなく、版と確かめた SHA-256 を dist/guests/<name>.build-info に記録する。
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
case $what in probe|aube|pitchfork|nano|git|jj|all) ;; *) echo "usage: $0 [probe|aube|pitchfork|nano|git|jj|all]" >&2; exit 2;; esac

# ビルドで作られるゲストの一覧（生成物の確認に使う）
guests="probe hello exit3 ttyecho aube pitchfork nano git git-remote-https jj"

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
jj_repo=https://github.com/jj-vcs/jj.git
jj_ref=${JJ_REF:-v0.46.0}
if ! [[ $jj_ref =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "error: JJ_REF に使えない文字があります: $jj_ref" >&2
  exit 2
fi
# nano と ncurses の tarball は SHA-256 で確かめる。既定の版の値は、GNU の keyring で署名を
# 確かめた tarball のもの。別の版を使うときは、その版の値も渡す。
nano_version=${NANO_VERSION:-9.3}
nano_sha256=${NANO_SHA256:-a9affc52c9596ee0682bcdd4ceb3c0b235eb221d83d733dfd9b0dff45897cb0d}
ncurses_version=${NCURSES_VERSION:-6.6}
ncurses_sha256=${NCURSES_SHA256:-355b4cbbed880b0381a04c46617b7656e362585d52e9cf84a67e2009b749ff11}
# git の tarball は、Junio C Hamano の署名（git-<版>.tar.sign）と kernel.org の sha256sums.asc で、
# curl の tarball は Daniel Stenberg の署名で確かめた値。別の版を使うときは、その版の値も渡す。
git_version=${GIT_VERSION:-2.56.0}
git_sha256=${GIT_SHA256:-26c56c296b38c0695b26fa95f475f1d01704d2d38e73465ca30b0b2f5dc789d3}
curl_version=${CURL_VERSION:-8.23.0}
curl_sha256=${CURL_SHA256:-8dadd7d2536a314f982ad05a651b713f426bf7d02cc2c76cffb9796f2218e6c5}
for value in "$nano_version" "$ncurses_version" "$git_version" "$curl_version"; do
  if ! [[ $value =~ ^[0-9]+(\.[0-9]+)+$ ]]; then
    echo "error: 版の形が正しくありません: $value" >&2
    exit 2
  fi
done
for value in "$nano_sha256" "$ncurses_sha256" "$git_sha256" "$curl_sha256"; do
  if ! [[ $value =~ ^[0-9a-f]{64}$ ]]; then
    echo "error: SHA-256 の形が正しくありません: $value" >&2
    exit 2
  fi
done
target=x86_64-unknown-linux-musl
mkdir -p "$root/dist/guests"

build_probe() {
  echo "== probe・hello・exit3・ttyecho・spawn をビルド（${image}）"
  container_run "$image" dist/guests "
    apk add --no-cache musl-dev >/dev/null
    cargo build --release --locked --target $target \
      --manifest-path guest/probe/Cargo.toml --target-dir /cache/guests
    for bin in probe hello exit3 ttyecho spawn; do
      cp /cache/guests/$target/release/\$bin /out/\$bin
    done
  " guest/probe/Cargo.toml guest/probe/Cargo.lock guest/probe/src
}

build_aube() {
  echo "== aube $aube_ref をビルド（${image}）"
  # aube の build script は、PATH に node があると npm の packument を取得して埋め込む。
  # コンテナには node がないので埋め込まれないが、念のため空の primer を明示して
  # どのマシンでも同じ内容になるようにする。
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
  # キャッシュのクローンは取得元の URL も確かめてから使う（別の取得元のものを混ぜないため）。
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

build_nano() {
  echo "== nano $nano_version（ncurses $ncurses_version）をビルド（${FORMICARIUM_C_IMAGE:-alpine:latest}）"
  # ncurses は static で、端末の定義を組み込み（--with-fallbacks）、terminfo を探さない
  # （--disable-database）。ゲストには TERM=xterm-256color だけを渡せばよい。
  container_run "${FORMICARIUM_C_IMAGE:-alpine:latest}" dist/guests "
    apk add --no-cache build-base linux-headers ncurses ncurses-terminfo-base >/dev/null
    mkdir -p /cache/nano-src && cd /cache/nano-src
    # 取得済みでも毎回 SHA-256 を確かめ、合わなければ捨てて止める。
    fetch() {
      if [ ! -f \"\$1\" ]; then
        wget -q -O \"\$1.part\" \"\$2\"
        mv \"\$1.part\" \"\$1\"
      fi
      echo \"\$3  \$1\" | sha256sum -c - || { rm -f \"\$1\"; exit 1; }
    }
    fetch ncurses-$ncurses_version.tar.gz https://ftp.gnu.org/gnu/ncurses/ncurses-$ncurses_version.tar.gz $ncurses_sha256
    fetch nano-$nano_version.tar.xz https://www.nano-editor.org/dist/v${nano_version%%.*}/nano-$nano_version.tar.xz $nano_sha256
    rm -rf /tmp/build && mkdir /tmp/build && cd /tmp/build
    tar -xzf /cache/nano-src/ncurses-$ncurses_version.tar.gz
    cd ncurses-$ncurses_version
    ./configure --prefix=/tmp/ncurses --without-shared --without-cxx --without-cxx-binding \\
      --without-ada --without-manpages --without-tests --without-progs --enable-widec \\
      --disable-database --with-fallbacks=xterm-256color >/dev/null
    make -j\$(nproc) >/dev/null
    make install >/dev/null
    cd /tmp/build
    tar -xJf /cache/nano-src/nano-$nano_version.tar.xz
    cd nano-$nano_version
    ./configure --disable-nls --disable-libmagic --disable-speller --enable-utf8 \\
      CPPFLAGS='-I/tmp/ncurses/include -I/tmp/ncurses/include/ncursesw' \\
      LDFLAGS='-static -L/tmp/ncurses/lib' NCURSESW_LIBS='-lncursesw' NCURSESW_CFLAGS=' ' >/dev/null
    make -j\$(nproc) >/dev/null
    strip -o /out/nano src/nano
    {
      echo \"nano=$nano_version\"
      echo \"nano-sha256=$nano_sha256\"
      echo \"ncurses=$ncurses_version\"
      echo \"ncurses-sha256=$ncurses_sha256\"
      echo \"fallbacks=xterm-256color\"
      echo \"alpine=\$(cat /etc/alpine-release)\"
    } > /out/nano.build-info
  " guest/probe/Cargo.toml
}

build_git() {
  echo "== git $git_version（curl $curl_version）をビルド（${FORMICARIUM_C_IMAGE:-alpine:latest}）"
  # curl は OpenSSL と zlib だけで static にする（Alpine の静的な libidn2 は git の error() とぶつかる）。
  # musl の regex には REG_STARTEND がないので git 同梱の regex を使い、Rust の部品は使わない。
  container_run "${FORMICARIUM_C_IMAGE:-alpine:latest}" dist/guests "
    apk add --no-cache build-base linux-headers openssl-dev openssl-libs-static zlib-dev zlib-static \\
      expat-dev expat-static perl >/dev/null
    mkdir -p /cache/git-src && cd /cache/git-src
    # 取得済みでも毎回 SHA-256 を確かめ、合わなければ捨てて止める。
    fetch() {
      if [ ! -f \"\$1\" ]; then
        wget -q -O \"\$1.part\" \"\$2\"
        mv \"\$1.part\" \"\$1\"
      fi
      echo \"\$3  \$1\" | sha256sum -c - || { rm -f \"\$1\"; exit 1; }
    }
    fetch curl-$curl_version.tar.xz https://curl.se/download/curl-$curl_version.tar.xz $curl_sha256
    fetch git-$git_version.tar.xz https://www.kernel.org/pub/software/scm/git/git-$git_version.tar.xz $git_sha256
    rm -rf /tmp/build && mkdir /tmp/build && cd /tmp/build
    tar -xJf /cache/git-src/curl-$curl_version.tar.xz
    cd curl-$curl_version
    ./configure --prefix=/tmp/curl --disable-shared --enable-static --with-openssl --with-zlib \\
      --without-libidn2 --without-libpsl --without-brotli --without-zstd --without-nghttp2 \\
      --without-libssh2 --disable-ldap --disable-docs --disable-manual \\
      --with-ca-bundle=/etc/ssl/certs/ca-certificates.crt >/dev/null
    make -j\$(nproc) >/dev/null
    make install >/dev/null
    cd /tmp/build
    tar -xJf /cache/git-src/git-$git_version.tar.xz
    cd git-$git_version
    make -j\$(nproc) prefix=/usr NO_GETTEXT=1 NO_REGEX=YesPlease NO_RUST=YesPlease NO_TCLTK=1 \\
      NO_PERL=1 NO_PYTHON=1 CURLDIR=/tmp/curl \\
      CURL_LDFLAGS='-L/tmp/curl/lib -lcurl -lssl -lcrypto -lz -pthread' LDFLAGS=-static CFLAGS=-O2 \\
      git git-remote-http >/dev/null
    strip -o /out/git git
    strip -o /out/git-remote-https git-remote-http
    {
      echo \"git=$git_version\"
      echo \"git-sha256=$git_sha256\"
      echo \"curl=$curl_version\"
      echo \"curl-sha256=$curl_sha256\"
      echo \"openssl=\$(apk info -e -v openssl-libs-static | sed 's/^openssl-libs-static-//')\"
      echo \"alpine=\$(cat /etc/alpine-release)\"
    } > /out/git.build-info
  " guest/probe/Cargo.toml
}

build_jj() {
  echo "== jj $jj_ref をビルド（${image}）"
  container_run "$image" dist/guests "
    apk add --no-cache musl-dev git >/dev/null
    src=/cache/jj-src/$jj_ref
    if [ ! -d \"\$src/.git\" ]; then
      rm -rf \"\$src\"
      git clone --quiet --depth 1 --branch '$jj_ref' '$jj_repo' \"\$src\"
    fi
    git -C \"\$src\" rev-parse HEAD > /out/jj.commit
    cd \"\$src\"
    git diff HEAD --exit-code
    cargo build --release --locked --target $target -p jj-cli --bin jj --target-dir /cache/jj
    cp /cache/jj/$target/release/jj /out/jj
  " guest/probe/Cargo.toml
}

case $what in
  probe) build_probe ;;
  aube) build_aube ;;
  pitchfork) build_pitchfork ;;
  nano) build_nano ;;
  git) build_git ;;
  jj) build_jj ;;
  all) build_probe; build_aube; build_pitchfork; build_nano; build_git; build_jj ;;
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
