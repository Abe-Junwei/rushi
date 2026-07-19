#!/usr/bin/env bash
# Post-build smoke: bundled sidecar starts and /health reports bundled FunASR + ffmpeg.
# Usage:
#   bash scripts/smoke-asr-sidecar-health.sh [path/to/rushi-asr-sidecar]
# Env:
#   RUSHI_SMOKE_ASR_PORT — default 18741 (avoid clashing with dev 8741)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXE="${1:-$ROOT/apps/desktop/src-tauri/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar}"
# Git Bash: Win32 paths (E:\... / E:/...) are not absolute Unix (`/*`); do not prepend $PWD.
if command -v cygpath >/dev/null 2>&1; then
  case "$EXE" in
    [A-Za-z]:[\\/]* | \\\\*) EXE="$(cygpath -u "$EXE")" ;;
  esac
fi
if [[ "$EXE" != /* && "$EXE" != [A-Za-z]:[\\/]* && "$EXE" != \\\\* ]]; then
  EXE="$PWD/$EXE"
fi
# Windows onedir ships *.exe; accept either.
if [[ ! -e "$EXE" && -e "${EXE}.exe" ]]; then
  EXE="${EXE}.exe"
fi
PORT="${RUSHI_SMOKE_ASR_PORT:-18741}"
WORKDIR="$(dirname "$EXE")"
INTERNAL="$WORKDIR/_internal"

if [[ ! -f "$EXE" && ! -x "$EXE" ]]; then
  echo "smoke: executable not found or not executable: $EXE" >&2
  exit 1
fi

if [[ ! -f "$INTERNAL/funasr/version.txt" ]]; then
  echo "smoke: missing PyInstaller data file: $INTERNAL/funasr/version.txt" >&2
  echo "hint: rebuild sidecar so funasr package data lands in _internal/" >&2
  exit 1
fi

if [[ ! -x "$INTERNAL/ffmpeg" && ! -x "$INTERNAL/ffmpeg.exe" ]]; then
  echo "smoke: missing bundled ffmpeg binary under $INTERNAL/" >&2
  exit 1
fi

if [[ ! -x "$INTERNAL/ffprobe" && ! -x "$INTERNAL/ffprobe.exe" ]]; then
  echo "smoke: missing bundled ffprobe binary under $INTERNAL/" >&2
  exit 1
fi

if lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "smoke: port $PORT already in use" >&2
  exit 1
fi

cd "$WORKDIR"
ASR_HOST=127.0.0.1 ASR_PORT="$PORT" "$EXE" >/tmp/rushi-sidecar-smoke.log 2>&1 &
PID=$!
cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
}
trap cleanup EXIT

HEALTH_URL="http://127.0.0.1:${PORT}/health"
for _ in $(seq 1 120); do
  if curl -sf "$HEALTH_URL" >/tmp/rushi-sidecar-smoke-health.json 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if [[ ! -s /tmp/rushi-sidecar-smoke-health.json ]]; then
  echo "smoke: /health did not become ready (see /tmp/rushi-sidecar-smoke.log)" >&2
  tail -30 /tmp/rushi-sidecar-smoke.log >&2 || true
  exit 1
fi

python3 - <<'PY'
import json
import sys

with open("/tmp/rushi-sidecar-smoke-health.json", encoding="utf-8") as f:
    body = json.load(f)
if body.get("service") != "rushi-asr":
    sys.exit(f"unexpected service field: {body!r}")
if body.get("funasr_import_ok") is not True:
    sys.exit(f"funasr_import_ok is not true: {body!r}")
if body.get("ffmpeg_ok") is not True:
    sys.exit(f"ffmpeg_ok is not true: {body!r}")
if body.get("funasr_ready") is not True:
    sys.exit(f"funasr_ready is not true: {body!r}")
if "funasr_loaded_model_id" not in body:
    sys.exit(f"missing funasr_loaded_model_id: {body!r}")
print("smoke OK:", body.get("transcription_mode"), "ffmpeg_ok=", body.get("ffmpeg_ok"))
PY

ROOT_URL="http://127.0.0.1:${PORT}/"
if ! curl -sf "$ROOT_URL" >/tmp/rushi-sidecar-smoke-root.json 2>/dev/null; then
  echo "smoke: GET / failed" >&2
  exit 1
fi
python3 - <<'PY2'
import json
import sys
with open("/tmp/rushi-sidecar-smoke-root.json", encoding="utf-8") as f:
    body = json.load(f)
if body.get("service") != "rushi-asr":
    sys.exit(f"unexpected root service: {body!r}")
if not body.get("prepare_model_async"):
    sys.exit(f"missing prepare_model_async on root: {body!r}")
warmup_model = str(body.get("warmup_model", ""))
if "warmup" not in warmup_model:
    sys.exit(f"missing warmup_model on root: {body!r}")
unload_model = str(body.get("unload_model", ""))
if "unload" not in unload_model:
    sys.exit(f"missing unload_model on root: {body!r}")
print("smoke root OK: catalog + warmup + unload endpoints present")
PY2

WARMUP_URL="http://127.0.0.1:${PORT}/v1/models/warmup"
WARMUP_CODE="$(curl -s -o /tmp/rushi-sidecar-smoke-warmup.json -w '%{http_code}' -X POST "$WARMUP_URL")"
if [[ "$WARMUP_CODE" == "404" ]]; then
  echo "smoke: POST /v1/models/warmup returned 404 — rebuild sidecar from current services/asr (stale PyInstaller bundle)" >&2
  cat /tmp/rushi-sidecar-smoke-warmup.json >&2 || true
  exit 1
fi
if [[ "$WARMUP_CODE" != "200" && "$WARMUP_CODE" != "503" ]]; then
  echo "smoke: unexpected warmup HTTP $WARMUP_CODE" >&2
  cat /tmp/rushi-sidecar-smoke-warmup.json >&2 || true
  exit 1
fi
echo "smoke warmup OK: HTTP $WARMUP_CODE"

WARMUP_RSS=""
if [[ "$WARMUP_CODE" == "200" ]]; then
  WARMUP_RSS="$(ps -o rss= -p "$PID" | tr -d ' ')"
fi

UNLOAD_URL="http://127.0.0.1:${PORT}/v1/models/unload"
UNLOAD_CODE="$(curl -s -o /tmp/rushi-sidecar-smoke-unload.json -w '%{http_code}' -X POST "$UNLOAD_URL")"
if [[ "$UNLOAD_CODE" == "404" ]]; then
  echo "smoke: POST /v1/models/unload returned 404 — rebuild sidecar from current services/asr" >&2
  cat /tmp/rushi-sidecar-smoke-unload.json >&2 || true
  exit 1
fi
if [[ "$UNLOAD_CODE" != "200" && "$UNLOAD_CODE" != "409" ]]; then
  echo "smoke: unexpected unload HTTP $UNLOAD_CODE" >&2
  cat /tmp/rushi-sidecar-smoke-unload.json >&2 || true
  exit 1
fi
if [[ "$UNLOAD_CODE" == "200" ]]; then
  curl -sf "$HEALTH_URL" >/tmp/rushi-sidecar-smoke-health-after-unload.json
  python3 - <<'PY3'
import json
import sys
with open("/tmp/rushi-sidecar-smoke-health-after-unload.json", encoding="utf-8") as f:
    body = json.load(f)
loaded = body.get("funasr_loaded_model_id")
if loaded not in (None, ""):
    sys.exit(f"expected funasr_loaded_model_id empty after unload, got {loaded!r}")
print("smoke unload OK: funasr_loaded_model_id cleared")
PY3
fi
echo "smoke unload OK: HTTP $UNLOAD_CODE"

# RSS hint: macOS often retains process RSS after gc; health.loaded is the hard gate (D8).
if [[ "$WARMUP_CODE" == "200" && "$UNLOAD_CODE" == "200" && -n "$WARMUP_RSS" ]]; then
  sleep 2
  UNLOAD_RSS="$(ps -o rss= -p "$PID" | tr -d ' ')"
  MAX_RSS="${RUSHI_SMOKE_UNLOAD_MAX_RSS_KB:-819200}"
  THRESHOLD=$((WARMUP_RSS * 35 / 100))
  if (( UNLOAD_RSS > THRESHOLD && UNLOAD_RSS > MAX_RSS )); then
    echo "smoke WARN: loaded_model_id cleared but RSS still high: ${UNLOAD_RSS}KB vs warmup ${WARMUP_RSS}KB (see hand-test H3)" >&2
  else
    echo "smoke RSS OK: unload ${UNLOAD_RSS}KB vs warmup ${WARMUP_RSS}KB"
  fi
fi
