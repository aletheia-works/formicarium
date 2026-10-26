#!/usr/bin/env bash
# Builds one GNU package for x86_64 static musl from a tarball that build.ts
# already checked (signature at resolve, SHA256 at prepare) and unpacked.
# build.ts starts this script in its own process group with an allow-listed
# environment (no GITHUB_TOKEN). Only configure and make run; no upstream
# contributor wrapper is used.
#
#   autotools.sh library <source> <prefix> [configure args...]
#     builds and installs a static library into <prefix>
#   autotools.sh program <source> <prefix> <output> <file> [configure args...]
#     builds against <prefix> and copies <output> (linked with -s) to <file>
#
# `{prefix}` in a configure argument is replaced by <prefix>. Ubuntu's
# musl-gcc has no Linux headers, so the host's linux, asm and asm-generic
# directories are exposed through <prefix>/kernel and nothing else of
# /usr/include.
set -euo pipefail
mode=${1:?library or program required}
source=${2:?source directory required}
prefix=${3:?prefix required}
shift 3
case $mode in
  library) ;;
  program)
    output=${1:?program output path required}
    file=${2:?output file required}
    shift 2
    if [[ $output == /* || $output == *..* ]]; then
      echo 'program output must be a relative path' >&2
      exit 2
    fi
    ;;
  *)
    echo 'mode must be library or program' >&2
    exit 2
    ;;
esac
if [[ $source != /* || $prefix != /* ]]; then
  echo 'source and prefix must be absolute' >&2
  exit 2
fi
mkdir -p "$prefix/kernel"
link() {
  [[ -L $prefix/kernel/$2 ]] || ln -s "$1" "$prefix/kernel/$2"
}
link /usr/include/linux linux
link /usr/include/asm-generic asm-generic
link /usr/include/x86_64-linux-gnu/asm asm
args=()
for argument in "$@"; do
  args+=("${argument//\{prefix\}/$prefix}")
done
export CC=musl-gcc
export CPPFLAGS="-I$prefix/include -isystem $prefix/kernel"
export LDFLAGS="-static -s -L$prefix/lib"
cd "$source"
./configure --prefix="$prefix" ${args[@]+"${args[@]}"}
make -j"$(getconf _NPROCESSORS_ONLN)"
if [[ $mode == library ]]; then
  make install
else
  install -m 0755 "$output" "$file"
fi
