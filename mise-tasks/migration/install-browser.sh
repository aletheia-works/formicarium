#!/usr/bin/env bash
#MISE alias="migration-install-browser"
#MISE description="U3 migration install browser"
set -euo pipefail
exec bun run migration:install:browser "$@"
