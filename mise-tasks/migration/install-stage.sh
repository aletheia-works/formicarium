#!/usr/bin/env bash
#MISE alias="migration-install-stage"
#MISE description="U3 migration install stage"
set -euo pipefail
exec bun run migration:install:stage "$@"
