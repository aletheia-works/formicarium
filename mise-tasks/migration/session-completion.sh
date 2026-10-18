#!/usr/bin/env bash
#MISE alias="migration-session-completion"
#MISE description="U2 migration session completion"
set -euo pipefail
exec bun run migration:session:completion "$@"
