#!/usr/bin/env bash
# Builds one GNU package for x86_64 static musl from a tarball that build.ts
# already checked (signature at resolve, SHA256 at prepare) and unpacked.
# build.ts starts this script in its own process group with an allow-listed
# environment (no GITHUB_TOKEN). Only configure and make run; no upstream
# contributor wrapper is used.
#
#   autotools.sh library <source> <prefix> [configure args...]
#     builds and installs a static library into <prefix>
#   autotools.sh program <source> <prefix> <programs> [<output> <file>]...
#                <variables> [NAME=value]... [configure args...]
#     builds against <prefix> with the <variables> make variables and copies
#     each of the <programs> built <output> paths (linked with -s) to <file>
#
# `{prefix}` in a configure argument or make variable is replaced by
# <prefix>. Ubuntu's musl-gcc has no Linux headers, so the host's linux, asm
# and asm-generic directories are exposed through <prefix>/kernel and nothing
# else of /usr/include.
set -euo pipefail
mode=${1:?library or program required}
source=${2:?source directory required}
prefix=${3:?prefix required}
shift 3
outputs=()
files=()
variables=()
count() {
  if [[ ! ${1:-} =~ ^[0-9]{1,2}$ ]]; then
    echo "$2 must be a count" >&2
    exit 2
  fi
}
case $mode in
  library) ;;
  program)
    count "${1:-}" 'program count'
    programs=$1
    shift
    if ((programs < 1 || $# < 2 * programs)); then
      echo 'program needs at least one output and file' >&2
      exit 2
    fi
    for ((index = 0; index < programs; index++)); do
      if [[ $1 == /* || $1 == *..* || $2 != /* ]]; then
        echo 'program output must be relative and its file absolute' >&2
        exit 2
      fi
      outputs+=("$1")
      files+=("$2")
      shift 2
    done
    count "${1:-}" 'make variable count'
    total=$1
    shift
    if (($# < total)); then
      echo 'missing make variables' >&2
      exit 2
    fi
    for ((index = 0; index < total; index++)); do
      if [[ ! $1 =~ ^[A-Za-z][A-Za-z0-9_]*= ]]; then
        echo 'make variable must be NAME=value' >&2
        exit 2
      fi
      variables+=("${1//\{prefix\}/$prefix}")
      shift
    done
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
make -j"$(getconf _NPROCESSORS_ONLN)" ${variables[@]+"${variables[@]}"}
if [[ $mode == library ]]; then
  make install
else
  for index in "${!outputs[@]}"; do
    install -m 0755 "${outputs[$index]}" "${files[$index]}"
  done
fi
