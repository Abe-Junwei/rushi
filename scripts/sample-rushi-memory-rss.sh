#!/usr/bin/env bash
# Sample sidecar + main app RSS for v0.1.8.1 memory hand tests.
# Usage:
#   bash scripts/sample-rushi-memory-rss.sh [label]
# Env:
#   RUSHI_SAMPLE_SIDECAR_MATCH — default rushi-asr-sidecar
#   RUSHI_SAMPLE_APP_MATCH     — default 如是我闻
set -euo pipefail

LABEL="${1:-sample}"
SIDECAR_MATCH="${RUSHI_SAMPLE_SIDECAR_MATCH:-rushi-asr-sidecar}"
APP_MATCH="${RUSHI_SAMPLE_APP_MATCH:-如是我闻}"

find_pid() {
  local pattern="$1"
  pgrep -f "$pattern" 2>/dev/null | head -1 || true
}

print_rss() {
  local name="$1"
  local pid="$2"
  if [[ -z "$pid" ]]; then
    echo "${name}_pid="
    echo "${name}_rss_kb="
    echo "${name}_rss_mb="
    return
  fi
  local rss
  rss="$(ps -o rss= -p "$pid" 2>/dev/null | awk '{print $1}' || true)"
  if [[ -z "$rss" ]]; then
    echo "${name}_pid=${pid}"
    echo "${name}_rss_kb="
    echo "${name}_rss_mb="
    return
  fi
  echo "${name}_pid=${pid}"
  echo "${name}_rss_kb=${rss}"
  echo "${name}_rss_mb=$(( rss / 1024 ))"
}

SIDECAR_PID="$(find_pid "$SIDECAR_MATCH")"
APP_PID="$(find_pid "$APP_MATCH")"

echo "label=${LABEL}"
echo "timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
print_rss sidecar "$SIDECAR_PID"
print_rss app "$APP_PID"

if [[ -n "$SIDECAR_PID" ]]; then
  HEALTH_URL="${RUSHI_ASR_HEALTH_URL:-http://127.0.0.1:8741/health}"
  if curl -sf "$HEALTH_URL" >/tmp/rushi-sample-health.json 2>/dev/null; then
    python3 - <<'PY'
import json
with open("/tmp/rushi-sample-health.json", encoding="utf-8") as f:
    body = json.load(f)
print("funasr_loaded_model_id=", body.get("funasr_loaded_model_id"))
print("selected_model_ready=", body.get("selected_model_ready"))
PY
  else
    echo "health=unreachable url=${HEALTH_URL}"
  fi
fi
