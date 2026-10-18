#!/usr/bin/env bash
#MISE alias="migration-command-browser"
#MISE description="U4 migration command browser"
set -euo pipefail
exec bun run migration:command:browser "$@"
