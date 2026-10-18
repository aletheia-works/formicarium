#!/usr/bin/env bash
#MISE alias="showcase-boundary"
#MISE description="U7 showcase boundary"
set -euo pipefail
exec bun run showcase:boundary "$@"
