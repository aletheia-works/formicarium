#!/usr/bin/env bash
#MISE alias="migration-install-measure"
#MISE description="U3 migration install measure"
set -euo pipefail
exec bun run migration:install:measure "$@"
