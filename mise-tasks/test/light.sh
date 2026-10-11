#!/usr/bin/env bash
#MISE alias="test-light"
#MISE description="test light"
set -euo pipefail
exec bun run test:light "$@"
