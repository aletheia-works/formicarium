#!/usr/bin/env bash
#MISE alias="showcase-stage"
#MISE description="showcase stage"
set -euo pipefail
exec bun run showcase:stage "$@"
