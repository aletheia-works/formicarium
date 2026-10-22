#!/usr/bin/env bash
#MISE alias="showcase-unit"
#MISE description="showcase unit"
set -euo pipefail
exec bun run showcase:unit "$@"
