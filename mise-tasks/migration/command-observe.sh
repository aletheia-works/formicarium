#!/usr/bin/env bash
#MISE alias="migration-command-observe"
#MISE description="U4 observe one migration acceptance CI run"
set -euo pipefail
exec bun run migration:command:observe "$@"
