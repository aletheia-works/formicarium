#!/usr/bin/env bash
#MISE alias="showcase-site-coverage"
#MISE description="U8 showcase site: merge node lcov and Chromium V8 coverage over the fixed denominator (80% lines)"
set -euo pipefail
exec bun run showcase-site:coverage "$@"
