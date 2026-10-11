#!/usr/bin/env bash
#MISE alias="install-frozen"
#MISE description="install frozen"
set -euo pipefail
exec bun scripts/ci/tasks.ts install-frozen "$@"
