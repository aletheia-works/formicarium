#!/usr/bin/env bash
#MISE alias="showcase-boundary"
#MISE description="showcase boundary"
set -euo pipefail
exec bun run showcase:boundary "$@"
