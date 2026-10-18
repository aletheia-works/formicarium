#!/usr/bin/env bash
#MISE alias="showcase-typecheck"
#MISE description="U7 showcase typecheck"
set -euo pipefail
exec bun run showcase:typecheck "$@"
