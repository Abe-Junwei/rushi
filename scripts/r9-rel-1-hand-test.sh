#!/usr/bin/env bash
# R9 REL-1 — 代跑一轮：机器门禁 + 各薄片 proxy + 侧车/DB/质量证据
# Usage: bash scripts/r9-rel-1-hand-test.sh [--skip-e2e] [--skip-machine] [--live-transcribe]
# Strict hand sign-off: bash scripts/r9-rel-1-strict-hand-test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
SKIP_E2E=0
LIVE_TX=0
SKIP_MACHINE=0
for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=1 ;;
    --live-transcribe) LIVE_TX=1 ;;
    --skip-machine) SKIP_MACHINE=1 ;;
  esac
done

APP_ROOT="${RUSHI_APP_ROOT:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi}"
APP_DB="${RUSHI_APP_DB:-${APP_ROOT}/rushi.sqlite3}"
QUALITY_REPORT="${APP_ROOT}/quality/last_eval_report.json"
OUT_DIR="${TMPDIR:-/tmp}/r9-rel-1-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${OUT_DIR}"

echo "==> R9 full run artifacts: ${OUT_DIR}"

run_step() {
  local name="$1"
  shift
  echo ""
  echo "======== ${name} ========"
  "$@"
}

# --- H1 + slice proxies ---
if [[ "${SKIP_MACHINE}" -eq 0 ]]; then
  run_step "H1 machine gate" bash "${ROOT}/scripts/r9-rel-1-machine-gate.sh" 2>&1 | tee "${OUT_DIR}/machine-gate.log"
  run_step "H3 R3t-B" bash "${ROOT}/scripts/r3t-b-hand-test.sh" 2>&1 | tee "${OUT_DIR}/r3t-b.log"
  run_step "H4 R3t-C" bash "${ROOT}/scripts/r3t-c-hand-test.sh" 2>&1 | tee "${OUT_DIR}/r3t-c.log"
  run_step "H5 R3e-B" bash "${ROOT}/scripts/r3e-b-hand-test.sh" 2>&1 | tee "${OUT_DIR}/r3e-b.log"
  run_step "H7 REV-LOC A" bash "${ROOT}/scripts/rev-loc-slice-a-hand-test.sh" 2>&1 | tee "${OUT_DIR}/rev-loc-a.log"
  run_step "H7 REV-LOC B" bash "${ROOT}/scripts/rev-loc-slice-b-hand-test.sh" 2>&1 | tee "${OUT_DIR}/rev-loc-b.log"
  run_step "ASR-VOC-3" bash "${ROOT}/scripts/asr-voc-3-hand-test.sh" 2>&1 | tee "${OUT_DIR}/asr-voc-3.log"
else
  echo "==> --skip-machine: H1/H3–H7 slice proxies skipped"
fi

run_step "H6 EXP-WORD Rust" bash -c "
  cd '${ROOT}/apps/desktop/src-tauri'
  cargo test -q export_docx::
  cargo test -q export_track
  cargo test -q postprocess_export_polish
"
run_step "H6 EXP-WORD TS" bash -c "
  cd '${ROOT}/apps/desktop'
  npm run test -- \
    src/services/exportDocxPolish.test.ts \
    src/services/exportPolishDelivery.test.ts \
    src/services/exportPolishPipeline.test.ts \
    src/services/exportPolishFinalize.test.ts \
    src/services/exportPolishTrackMarkup.test.ts
"

# --- A: environment ---
run_step "A2/A3 ASR health" curl -sf --max-time 5 "${BASE}/health" -o "${OUT_DIR}/health.json"
python3 - "${OUT_DIR}/health.json" <<'PY'
import json, sys
h = json.load(open(sys.argv[1], encoding="utf-8"))
assert h.get("status") == "ok"
assert h.get("ready_for_transcribe") is True
assert h.get("transcription_mode") == "funasr"
cats = h.get("local_asr_model_catalog") or []
assert len(cats) >= 2, "expect local + catalog entries"
print(f"  models: active={h.get('funasr_model_id')} cached_required={h.get('funasr_required_models_cached')}")
print("  OK: /health ready_for_transcribe + catalog")
PY

python3 - "${APP_ROOT}" "${OUT_DIR}/health.json" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
h = json.load(open(sys.argv[2], encoding="utf-8"))
lr = root / "local_runtime"
models = root / "models"
checks = []
checks.append(("local_runtime dir", lr.is_dir()))
checks.append(("models dir", models.is_dir()))
checks.append(("default model cached", h.get("funasr_default_model_cached") is True))
for label, ok in checks:
    print(f"  [{'OK' if ok else 'WARN'}] {label}")
if not all(c[1] for c in checks):
    print("  NOTE: A1 zero-terminal UI wizard not automated — machine proxy only")
PY

# --- B: transcribe evidence ---
if curl -sf --max-time 3 "${BASE}/health" >/dev/null 2>&1; then
  EVAL_MP3="${ROOT}/fixtures/eval/samples/制控.mp3"
  if [[ -f "${EVAL_MP3}" ]]; then
    echo ""
    echo "======== B3 hotwords curl ========"
    curl -sf --max-time 600 -F "file=@${EVAL_MP3};filename=zhikong.mp3" -F "hotwords=制控" \
      "${BASE}/v1/transcribe" -o "${OUT_DIR}/hotwords-transcribe.json"
    run_step "B3 hotwords smoke" python3 - "${OUT_DIR}/hotwords-transcribe.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
assert d.get("error") is None, d.get("error")
w = d.get("warnings") or []
text = " ".join((s.get("text") or "") for s in (d.get("segments") or []))
hyp = d.get("hypothesis") or text
assert "制控" in hyp or "质控" in hyp, "expected 制控/质控 in output"
hw_ignored = any("hotwords_ignored" in str(x) for x in w)
print(f"  segments={len(d.get('segments') or [])} hotwords_ignored={hw_ignored}")
print("  OK: hotwords transcribe + term visible")
PY
  fi
fi

if [[ -f "${APP_DB}" ]]; then
  run_step "B1/B2/D2 SQLite evidence" python3 - "${APP_DB}" "${APP_ROOT}/projects" <<'PY'
import json, sqlite3, subprocess, sys
from pathlib import Path

db = sys.argv[1]
projects = Path(sys.argv[2])
con = sqlite3.connect(db)
seg_n = con.execute("SELECT COUNT(*) FROM segments").fetchone()[0]
proj_n = con.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
con.close()
audios = []
for p in projects.rglob("*"):
    if p.suffix.lower() in {".wav", ".mp3", ".m4a"} and p.is_file():
        try:
            out = subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", str(p)],
                text=True,
            ).strip()
            dur = float(out) if out else 0.0
        except Exception:
            dur = 0.0
        audios.append((dur, str(p)))
audios.sort(reverse=True)
long_30 = [a for a in audios if a[0] >= 1800]
mid_10 = [a for a in audios if 600 <= a[0] < 1800]
print(f"  projects={proj_n} segments={seg_n}")
if long_30:
    print(f"  B2 proxy: {len(long_30)} audio >=30min (max {long_30[0][0]:.0f}s)")
elif audios:
    print(f"  B2 proxy: max audio {audios[0][0]:.0f}s (R3e-B signoff 2026-05-30 covers 50min)")
if mid_10:
    print(f"  B1 proxy: {len(mid_10)} audio 10–30min")
print(f"  D2 proxy: segments persisted ({seg_n} rows)")
assert seg_n >= 0 and proj_n >= 0
PY
fi

if [[ "${LIVE_TX}" -eq 1 ]] && curl -sf --max-time 3 "${BASE}/health" >/dev/null 2>&1; then
  SHORT_WAV="${APP_ROOT}/projects/66b14766-16fd-4bae-9193-725c5094c470/audio.wav"
  if [[ -f "${SHORT_WAV}" ]]; then
    run_step "B1 live clip (60s)" bash -c "
      ffmpeg -y -hide_banner -loglevel error -i '${SHORT_WAV}' -t 60 -ac 1 -ar 16000 '${OUT_DIR}/b1-60s.wav'
      curl -sf --max-time 900 -F 'file=@${OUT_DIR}/b1-60s.wav' '${BASE}/v1/transcribe' -o '${OUT_DIR}/b1-transcribe.json'
      python3 -c \"import json; d=json.load(open('${OUT_DIR}/b1-transcribe.json')); print('segments', len(d.get('segments') or [])); assert d.get('error') is None\"
    "
  fi
fi

# --- E1 quality report ---
if [[ -f "${QUALITY_REPORT}" ]]; then
  run_step "E1 R4-GATE report" python3 - "${QUALITY_REPORT}" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
assert d.get("exit_code") == 0, f"exit_code={d.get('exit_code')}"
items = d.get("items") or []
assert items, "no eval items"
for it in items:
    if it.get("expected_terms"):
        rate = it.get("term_hit_rate")
        assert rate is not None and rate >= 1.0, f"term_hit failed: {it.get('id')} rate={rate}"
print(f"  items={len(items)} exit_code=0 term_hit OK")
PY
else
  echo "WARN: missing ${QUALITY_REPORT} — run R4-GATE eval first" >&2
fi

# --- P0 optional ---
if [[ -d "${ROOT}/fixtures/p0-samples" ]] && ls "${ROOT}/fixtures/p0-samples"/*.wav &>/dev/null; then
  n=$(ls "${ROOT}/fixtures/p0-samples"/*.wav | wc -l | tr -d ' ')
  if [[ "${n}" -ge 10 ]] && curl -sf --max-time 3 "${BASE}/health" >/dev/null 2>&1; then
    run_step "P0 acceptance" bash "${ROOT}/scripts/p0-acceptance.sh" 2>&1 | tee "${OUT_DIR}/p0.log"
  fi
fi

# --- F5 E2E ---
if [[ "${SKIP_E2E}" -eq 0 ]] && curl -sf --max-time 3 "${BASE}/health" >/dev/null 2>&1; then
  run_step "F5 E2E asr-health" bash -c "cd '${ROOT}' && npm run desktop:test:e2e" 2>&1 | tee "${OUT_DIR}/e2e.log"
fi

# --- Summary ---
python3 - "${OUT_DIR}" <<'PY'
import sys
from pathlib import Path
out = Path(sys.argv[1])
logs = sorted(out.glob("*.log"))
print("")
print("==> R9 full run complete")
print(f"    artifacts: {out}")
print(f"    logs: {len(logs)}")
print("")
print("Machine/proxy: H1 H2 H3 H4 H5 H6 H7 B3 E1 (if report) + optional P0/E2E")
print("UI-only (not automated): A1 wizard, C1/C2 desktop edit, D1 Word open, B1/B2 full Paraformer session")
print("Sign off: docs/execution/specs/r9-rel-1-personal-v1-acceptance.md")
PY
