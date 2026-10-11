#!/usr/bin/env bash
#MISE description="Check JavaScript, GitHub Actions and shell scripts"
set -euo pipefail
bun run check
actionlint
# Run checks on maintained shell entry points and shared helpers.
rg --files --null -g '*.sh' mise-tasks scripts | xargs -0 shellcheck --severity=warning
