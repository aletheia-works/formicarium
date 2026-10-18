#!/usr/bin/env bash
#MISE alias="migration-session-stage"
#MISE description="U2 migration session stage"
set -euo pipefail
exec bun run migration:session:stage "$@"
