#!/usr/bin/env bash
#MISE description="check"
set -euo pipefail
exec bun run --bun check "$@"
