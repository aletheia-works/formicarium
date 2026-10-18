#!/usr/bin/env bash
# Builds one Cargo binary for x86_64-unknown-linux-musl from a source tree that
# build.ts already fetched at the resolved commit and checked. build.ts starts
# this script in its own process group with an allow-listed environment
# (no GITHUB_TOKEN, MISE_AUTO_INSTALL=0). Cargo is called directly by absolute
# path; no upstream contributor wrapper (mise tasks, just, make) is used.
set -euo pipefail
cargo=${1:?absolute cargo path required}
out=${2:?output directory required}
binary=${3:?binary name required}
package=${4:-}
target=x86_64-unknown-linux-musl
if [[ $cargo != /* || ! -x $cargo ]]; then
  echo 'cargo must be an absolute executable path' >&2
  exit 2
fi
if [[ ! $binary =~ ^[A-Za-z0-9_-]+$ || ! $package =~ ^[A-Za-z0-9_-]*$ ]]; then
  echo 'invalid Cargo build configuration' >&2
  exit 2
fi
: "${CARGO_TARGET_DIR:?CARGO_TARGET_DIR required}"
args=(build --locked --release --target "$target" --bin "$binary")
if [[ -n $package ]]; then
  args+=(-p "$package")
fi
"$cargo" "${args[@]}"
install -m 0755 "$CARGO_TARGET_DIR/$target/release/$binary" "$out/$binary"
