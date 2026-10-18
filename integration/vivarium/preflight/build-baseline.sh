#!/usr/bin/env bash
set -euo pipefail

# Local, reviewable CI proposal. Install this file and its pinned Node bundle
# only after the separate approval of a concrete vivarium change.
if [[ "${1:-}" != "--bounded" ]]; then
  exec timeout --signal=TERM --kill-after=30s 4h bash "$0" --bounded "$@"
fi
shift
controller="${PREFLIGHT_CONTROLLER:?pinned baseline-controller.mjs required}"
template="${PREFLIGHT_INPUT_TEMPLATE:?fixed build-input template required}"
inputs="${PREFLIGHT_ACTUAL_INPUTS:?new actual input path required}"
cache="${PREFLIGHT_CACHE:?cache directory required}"
source="${PREFLIGHT_SOURCE:?full-commit checkout Action directory required}"
if [[ "$(node --version)" != "v26.12.0" ]]; then
  echo 'Node v26.12.0 is required' >&2
  exit 1
fi
# Actual rustc/cargo strings come from the immutable image, never placeholders.
# The outer deadline includes image pull, dependency acquisition, both builds,
# reuse validation and child-process/container cleanup.
node "$controller" --prepare-inputs "$template" "$inputs"
node "$controller" "$inputs" "$cache" "$source" "${PREFLIGHT_FIRST_RECEIPT:?first receipt path required}"
node "$controller" "$inputs" "$cache" "$source" "${PREFLIGHT_REUSE_RECEIPT:?reuse receipt path required}"
