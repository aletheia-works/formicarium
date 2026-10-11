#!/usr/bin/env bash
#MISE description="build"
set -euo pipefail
exec bun run --bun build "$@"
