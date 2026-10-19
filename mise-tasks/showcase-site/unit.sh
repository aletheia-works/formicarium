#!/usr/bin/env bash
#MISE alias="showcase-site-unit"
#MISE description="U8 showcase site unit tests (node:test, lcov for the coverage merge)"
set -euo pipefail
mkdir -p showcase/site/.work/coverage
exec bun run showcase-site:unit "$@"
