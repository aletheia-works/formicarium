#!/usr/bin/env bash
#MISE alias="migration-preflight-current-unit"
#MISE description="U1 migration preflight current unit"
set -euo pipefail
exec bun run migration:preflight:current-unit "$@"
