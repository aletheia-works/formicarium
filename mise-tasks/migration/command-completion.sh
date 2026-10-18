#!/usr/bin/env bash
#MISE alias="migration-command-completion"
#MISE description="U4 migration command completion"
set -euo pipefail
exec bun run migration:command:completion "$@"
