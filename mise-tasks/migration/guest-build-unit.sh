#!/usr/bin/env bash
#MISE alias="migration-guest-build-unit"
#MISE description="U5 migration fixed guest build unit"
set -euo pipefail
exec bun run migration:guest-build:unit "$@"
