#!/usr/bin/env bash
#MISE alias="migration-session-browser"
#MISE description="U2 migration session browser"
set -euo pipefail
exec bun run migration:session:browser "$@"
