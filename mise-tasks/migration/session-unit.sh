#!/usr/bin/env bash
#MISE alias="migration-session-unit"
#MISE description="U2 migration session unit"
set -euo pipefail
exec bun run migration:session:unit "$@"
