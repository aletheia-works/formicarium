#!/usr/bin/env bash
#MISE alias="showcase-accept-node"
#MISE description="U7 showcase accept-node"
set -euo pipefail
exec bun run showcase:accept-node "$@"
