#!/usr/bin/env bash
#MISE alias="verify-candidate"
#MISE description="verify candidate"
set -euo pipefail
exec bun run verify:candidate "$@"
