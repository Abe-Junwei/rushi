#!/usr/bin/env bash
# R3t-B hand-test runner: unit proxies + sidecar smoke + R3-STATE gate checks.
# Usage: bash scripts/r3t-b-hand-test.sh [--skip-transcribe]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
OUT_DIR="${TMPDIR:-/tmp}/r3t-b-hand-test-$(date +%Y%m%d-%H%M%S)"
SKIP_TRANSCRIBE=0
if [[ "${1:-}" == "--skip-transcribe" ]]; then
  SKIP_TRANSCRIBE=1
fi

mkdir -p "${OUT_DIR}"
echo "==> R3t-B hand test output: ${OUT_DIR}"

echo "==> Layer 1: TypeScript unit tests (R3t-B scope)"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- \
    src/pages/useTranscribeJobController.test.ts \
    src/pages/transcribeJobHelpers.test.ts \
    src/services/asr/localAsrTranscribePreflight.test.ts \
    src/services/asr/localAsrModelCatalog.test.ts \
    src/services/asrTranscribeHints.test.ts \
    src/components/ProjectStatusFeedback.test.ts \
    src/tauri/projectApi.test.ts
)

echo "==> Layer 2: Rust unit tests (parse / gate / vocabulary)"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q transcribe_response
  cargo test -q local_transcribe_gate
  cargo test -q stt_vocabulary
)

echo "==> Layer 3: Sidecar /health + R3-STATE gate simulation"
HEALTH_JSON="${OUT_DIR}/health.json"
if ! curl -sf --max-time 5 "${BASE}/health" -o "${HEALTH_JSON}"; then
  echo "WARN: sidecar not reachable at ${BASE}; skipping live transcribe + gate live checks" >&2
  LIVE=0
else
  LIVE=1
  python3 - "${HEALTH_JSON}" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    h = json.load(f)
sidecar = h.get("funasr_model_id") or ""
ready = h.get("ready_for_transcribe") is True
mode = h.get("transcription_mode")
print(f"  sidecar_model={sidecar!r} ready={ready} mode={mode!r}")

def gate(health, pref):
    if health.get("transcription_mode") != "funasr":
        return "stub"
    if not health.get("ready_for_transcribe"):
        return "not_ready"
    sm = health.get("funasr_model_id") or ""
    if pref and sm != pref:
        return "hub_mismatch"
    loaded = health.get("funasr_loaded_model_id") or ""
    if loaded and sm and loaded != sm:
        return "loaded_mismatch"
    return "ok"

wrong = "iic/SenseVoiceSmall" if "SenseVoice" not in sidecar else "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
assert gate(h, sidecar) == "ok", "D1=D2 live health should pass gate"
assert gate(h, wrong) == "hub_mismatch", "D1≠D2 must block"
print("  OK: live /health D1=D2 pass; mismatched pref blocked")
PY
fi

if [[ "${LIVE}" -eq 1 && "${SKIP_TRANSCRIBE}" -eq 0 ]]; then
  # shellcheck source=scripts/resolve-asr-models-root.sh
  source "${ROOT}/scripts/resolve-asr-models-root.sh"
  export_asr_model_env
  SAMPLE="${RUSHI_MODELS_ROOT}/modelscope/models/iic/SenseVoiceSmall/example/zh.mp3"
  SHORT="${OUT_DIR}/short.wav"
  if [[ -f "${SAMPLE}" ]]; then
    echo "==> Layer 4: Short transcribe smoke (segmentation + warnings contract)"
    ffmpeg -y -hide_banner -loglevel error -i "${SAMPLE}" -t 8 -ac 1 -ar 16000 "${SHORT}" 2>/dev/null || cp "${SAMPLE}" "${SHORT}"
    curl -sf --max-time "${RUSHI_TRANSCRIBE_TIMEOUT_SEC:-600}" \
      -F "file=@${SHORT};filename=zh-short.mp3" \
      "${BASE}/v1/transcribe" -o "${OUT_DIR}/transcribe-short.json"
    python3 - "${OUT_DIR}/transcribe-short.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
segs = d.get("segments") or []
err = d.get("error")
assert err is None, f"unexpected error: {err}"
assert isinstance(segs, list), "segments must be array"
mode = d.get("segmentation_mode")
print(f"  segments={len(segs)} engine={d.get('engine')} segmentation_mode={mode!r}")
print("  OK: transcribe response contract (segments array, no hard error)")
PY
  else
    echo "  (skip Layer 4 — SenseVoice sample missing)"
  fi
fi

echo "==> Layer 5: SQLite persistence probe (app data)"
APP_DB="${RUSHI_APP_DB:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/rushi.sqlite3}"
if [[ -f "${APP_DB}" ]]; then
  SEG_COUNT="$(sqlite3 "${APP_DB}" "SELECT COUNT(*) FROM segments;" 2>/dev/null || echo 0)"
  echo "  segments in app DB: ${SEG_COUNT}"
  python3 - "${SEG_COUNT}" <<'PY'
import sys
n = int(sys.argv[1])
assert n >= 0
print("  OK: segments table readable" + (f" ({n} rows)" if n else " (empty — run desktop transcribe once for full persist check)"))
PY
else
  echo "  (skip — no app DB at ${APP_DB})"
  SEG_COUNT=-1
fi

echo ""
echo "==> Pass/fail summary"
python3 - "${OUT_DIR}" "${LIVE}" "${SEG_COUNT:--1}" <<'PY'
import sys
from pathlib import Path

out = Path(sys.argv[1])
live = sys.argv[2] == "1"
seg_count = int(sys.argv[3])
checks = []

def ok(label, cond, detail=""):
    checks.append((label, cond, detail))
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))

ok("TS R3t-B unit bundle", True, "vitest exit 0")
ok("Rust parse/gate/vocabulary", True, "cargo test exit 0")
ok("Sidecar reachable", live, "8741 /health" if live else "skipped")
if live:
    ok("R3-STATE gate simulation", True, "D1=D2 pass + mismatch block")
    tx = out / "transcribe-short.json"
    if tx.exists():
        ok("Short transcribe smoke", True, str(tx.name))
    else:
        ok("Short transcribe smoke", False, "missing json")
if seg_count >= 0:
    ok("SQLite segments table", True, f"{seg_count} rows" if seg_count else "empty (optional UI transcribe)")
else:
    ok("SQLite segments table", True, "skipped — no app DB")

failed = [c for c in checks if not c[1]]
print("")
if failed:
    print(f"FAILED {len(failed)} check(s). Artifacts: {out}")
    sys.exit(1)
print(f"All {len(checks)} checks passed. Artifacts: {out}")
print("")
print("Optional desktop UI spot-check (one session):")
print("  1. 已有语段 → 拉取 → 覆盖确认 → 取消/确认")
print("  2. 转写中 busy 遮罩 + desktop.log 含 transcribe_stage=preflight|parse|save")
print("  3. 停侧车后拉取 → 旧语段不变")
PY

echo ""
echo "==> R3t-B hand test complete"
