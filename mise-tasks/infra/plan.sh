#!/usr/bin/env bash
#MISE description="OpenTofu plan for GitHub settings"
#MISE dir="infra/github"
set -euo pipefail
exec tofu plan "$@"
