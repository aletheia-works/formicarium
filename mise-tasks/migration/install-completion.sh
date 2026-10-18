#!/usr/bin/env bash
#MISE alias="migration-install-completion"
#MISE description="U3 migration install completion"
set -euo pipefail
exec bun run migration:install:completion "$@"
