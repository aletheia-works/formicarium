#!/usr/bin/env bash
#MISE alias="migration-preflight-verify"
#MISE description="U1 migration preflight verify"
set -euo pipefail
exec bun run migration:preflight:verify "$@"
