#!/usr/bin/env bash
# Lightweight self-check for ci-r2-env.sh (no aws / no network).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export R2_ACCESS_KEY_ID=test
export R2_SECRET_ACCESS_KEY=test
export R2_ENDPOINT="https://c5f4e6de7c4f543bfe0ffb3da40d5e0b.r2.cloudflarestorage.com/rushi-updates"
# shellcheck source=scripts/ci-r2-env.sh
source "$ROOT/scripts/ci-r2-env.sh"
test "$R2_ENDPOINT" = "https://c5f4e6de7c4f543bfe0ffb3da40d5e0b.r2.cloudflarestorage.com"
test "$R2_BUCKET" = "rushi-updates"
echo "ci-r2-env.test.sh OK"
