#!/usr/bin/env bash
#MISE alias="showcase-accept-node"
#MISE description="showcase accept-node"
set -euo pipefail
exec bun run showcase:accept-node "$@"
