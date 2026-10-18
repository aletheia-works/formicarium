#!/usr/bin/env bash
#MISE alias="migration-preflight-completion"
#MISE description="U1 migration preflight completion"
set -euo pipefail
exec bun run migration:preflight:completion "$@"
