#!/usr/bin/env bash
#MISE description="typecheck"
set -euo pipefail
exec bun run --bun typecheck "$@"
