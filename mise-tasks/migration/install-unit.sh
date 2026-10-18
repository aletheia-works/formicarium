#!/usr/bin/env bash
#MISE alias="migration-install-unit"
#MISE description="U3 migration install unit"
set -euo pipefail
exec bun run migration:install:unit "$@"
