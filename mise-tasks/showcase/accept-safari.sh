#!/usr/bin/env bash
#MISE alias="showcase-accept-safari"
#MISE description="showcase accept-safari"
set -euo pipefail
exec bun run showcase:accept-safari "$@"
