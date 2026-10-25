#!/usr/bin/env bash
#MISE alias="showcase-site-accept"
#MISE description="showcase site acceptance in one browser (usage: --project=chromium|firefox|webkit|safari; safari needs macOS and safaridriver)"
set -euo pipefail
exec bun run showcase-site:accept "$@"
