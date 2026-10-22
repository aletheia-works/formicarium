#!/usr/bin/env bash
#MISE alias="showcase-typecheck"
#MISE description="showcase typecheck"
set -euo pipefail
exec bun run showcase:typecheck "$@"
