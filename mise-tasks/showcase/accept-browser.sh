#!/usr/bin/env bash
#MISE alias="showcase-accept-browser"
#MISE description="U7 showcase accept-browser"
set -euo pipefail
exec bun run showcase:accept-browser "$@"
