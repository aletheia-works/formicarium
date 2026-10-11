#!/usr/bin/env bash
#MISE alias="test-consumer"
#MISE description="test consumer"
set -euo pipefail
exec bun run test:consumer "$@"
