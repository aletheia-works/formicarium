#!/usr/bin/env bash
#MISE alias="migration-command-stage"
#MISE description="U4 migration command stage"
set -euo pipefail
exec bun run migration:command:stage "$@"
