#!/usr/bin/env bash
#MISE description="OpenTofu validate for GitHub settings"
#MISE dir="infra/github"
set -euo pipefail
exec tofu validate "$@"
