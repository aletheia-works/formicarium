#!/usr/bin/env bash
#MISE alias="migration-command-unit"
#MISE description="U4 migration command unit"
set -euo pipefail
exec bun run migration:command:unit "$@"
