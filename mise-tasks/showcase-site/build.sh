#!/usr/bin/env bash
#MISE alias="showcase-site-build"
#MISE description="U8 showcase site: check the candidate, stage the pack, install, assemble (usage: --mode verify|distribute)"
set -euo pipefail
export ASTRO_TELEMETRY_DISABLED=1
bun run showcase-site:prepare "$@"
(cd showcase/site && bun install --frozen-lockfile --ignore-scripts)
bun run showcase-site:assemble "$@"
