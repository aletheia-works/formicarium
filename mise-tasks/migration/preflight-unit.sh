#!/usr/bin/env bash
#MISE alias="migration-preflight-unit"
#MISE description="U1 migration preflight unit"
set -euo pipefail
exec bun run migration:preflight:unit "$@"
