#!/usr/bin/env bash
#MISE alias="migration-guest-build-verify"
#MISE description="U5 migration fixed guest build verify"
set -euo pipefail
exec bun run migration:guest-build:verify "$@"
