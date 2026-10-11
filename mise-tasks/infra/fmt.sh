#!/usr/bin/env bash
#MISE description="Format GitHub infrastructure"
set -euo pipefail
exec tofu fmt -recursive infra "$@"
