#!/usr/bin/env bash
#MISE alias="migration-preflight-browser"
#MISE description="U1 migration preflight browser"
set -euo pipefail
exec bun run migration:preflight:browser "$@"
