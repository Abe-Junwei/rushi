#!/usr/bin/env bash
# R3t-A hand-test runner: sidecar API + optional direct Python for SenseVoice.
# Usage: bash scripts/r3t-a-hand-test.sh [--skip-long]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"
export_asr_model_env

BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
VENV_PY="${ROOT}/services/asr/.venv/bin/python"
OUT_DIR="${TMPDIR:-/tmp}/r3t-a-hand-test-$(date +%Y%m%d-%H%M%S)"
SKIP_LONG=0
if [[ "${1:-}" == "--skip-long" ]]; then
  SKIP_LONG=1
fi

LONG_AUDIO="${RUSHI_R3T_LONG_AUDIO:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/projects/b61bba32-05d7-46af-9644-e71dd77ddc05/3de9484d-1cd9-40e2-a24b-09b526e8fd7b.mp3}"
SHORT_CLIP="${OUT_DIR}/short-30s.wav"
SENSEVOICE_SAMPLE="${RUSHI_MODELS_ROOT}/modelscope/models/iic/SenseVoiceSmall/example/zh.mp3"

mkdir -p "${OUT_DIR}"
echo "==> R3t-A hand test output: ${OUT_DIR}"

summarize_json() {
  local label="$1"
  local json_file="$2"
  python3 - "${label}" "${json_file}" <<'PY'
import json, sys
label, path = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    d = json.load(f)
segs = d.get("segments") or []
warn = d.get("warnings") or []
err = d.get("error")
print(f"\n--- {label} ---")
print(f"  segments: {len(segs)}")
print(f"  engine: {d.get('engine')}")
print(f"  segmentation_mode: {d.get('segmentation_mode')}")
print(f"  duration_sec: {d.get('duration_sec')}")
print(f"  warnings: {warn[:8]}{'…' if len(warn) > 8 else ''}")
if err:
    print(f"  ERROR: {err}")
if segs:
    t0 = segs[0].get("start_sec"), segs[0].get("end_sec")
    t1 = segs[-1].get("start_sec"), segs[-1].get("end_sec")
    print(f"  first segment: {t0}")
    print(f"  last segment: {t1}")
PY
}

curl_transcribe() {
  local out="$1"
  local file="$2"
  local name
  name="$(basename "${file}")"
  echo "==> POST /v1/transcribe (${name}) → ${out}"
  curl -sf --max-time "${RUSHI_TRANSCRIBE_TIMEOUT_SEC:-7200}" \
    -F "file=@${file};filename=${name}" \
    "${BASE}/v1/transcribe" -o "${out}"
}

direct_transcribe() {
  local out="$1"
  local file="$2"
  local model="$3"
  echo "==> Python direct transcribe (${model}) → ${out}"
  RUSHI_FUNASR_MODEL="${model}" "${VENV_PY}" - "${file}" "${out}" <<'PY'
import json, os, sys, tempfile
from pathlib import Path
from rushi_asr.engine import transcribe_upload

upload = Path(sys.argv[1])
out = Path(sys.argv[2])
with tempfile.TemporaryDirectory(prefix="r3t_a_") as tmp:
    result = transcribe_upload(upload, Path(tmp), None)
    out.write_text(json.dumps(result.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8")
print(f"  model env: {os.environ.get('RUSHI_FUNASR_MODEL')}")
PY
}

echo "==> Preflight"
bash "${ROOT}/scripts/r3g-s3-preflight.sh"

if [[ ! -f "${LONG_AUDIO}" ]]; then
  echo "FAIL: long audio not found: ${LONG_AUDIO}" >&2
  exit 1
fi

echo "==> Prepare ~30s clip from long audio"
ffmpeg -y -hide_banner -loglevel error -i "${LONG_AUDIO}" -t 30 -ac 1 -ar 16000 "${SHORT_CLIP}"

echo "==> Scenario A: Paraformer + ~30s (sidecar)"
curl_transcribe "${OUT_DIR}/paraformer-short.json" "${SHORT_CLIP}"
summarize_json "Paraformer ~30s" "${OUT_DIR}/paraformer-short.json"

if [[ "${SKIP_LONG}" -eq 0 ]]; then
  echo "==> Scenario B: Paraformer + ~13min (sidecar; may take many minutes)"
  curl_transcribe "${OUT_DIR}/paraformer-13min.json" "${LONG_AUDIO}"
  summarize_json "Paraformer ~13min" "${OUT_DIR}/paraformer-13min.json"

  echo "==> Scenario C: SenseVoice + ~13min (direct Python; separate model load)"
  direct_transcribe "${OUT_DIR}/sensevoice-13min.json" "${LONG_AUDIO}" "iic/SenseVoiceSmall"
  summarize_json "SenseVoice ~13min" "${OUT_DIR}/sensevoice-13min.json"
else
  echo "==> Skipping long scenarios (--skip-long)"
fi

if [[ -f "${SENSEVOICE_SAMPLE}" ]]; then
  echo "==> Scenario D: SenseVoice + short sample (whole_track_fallback probe)"
  direct_transcribe "${OUT_DIR}/sensevoice-short.json" "${SENSEVOICE_SAMPLE}" "iic/SenseVoiceSmall"
  summarize_json "SenseVoice short zh.mp3" "${OUT_DIR}/sensevoice-short.json"
fi

echo "==> Scenario E: deriveTranscribeHints for whole_track_fallback (desktop hints proxy)"
ROOT="${ROOT}" python3 - "${OUT_DIR}" <<'PY'
import json, os, subprocess, sys
from pathlib import Path

out_dir = Path(sys.argv[1])
sample = out_dir / "sensevoice-short.json"
if not sample.exists():
    print("  (skip — no sensevoice-short.json)")
    sys.exit(0)
d = json.loads(sample.read_text(encoding="utf-8"))
warn = d.get("warnings") or []
if not any("funasr_whole_track_fallback" in w for w in warn):
    print("  NOTE: sensevoice short did not emit funasr_whole_track_fallback")
else:
    print("  OK: sensevoice short emitted funasr_whole_track_fallback")
desktop = Path(os.environ["ROOT"]) / "apps" / "desktop"
cmd = [
    "npm", "run", "test", "--",
    "src/services/asrTranscribeHints.test.ts",
    "-t", "whole-track fallback",
]
print("  running:", " ".join(cmd), f"(cwd={desktop})")
subprocess.run(cmd, cwd=desktop, check=True)
print("  hints unit test OK (banner copy verified)")
PY

echo ""
echo "==> Pass/fail summary"
python3 - "${OUT_DIR}" <<'PY'
import json, sys
from pathlib import Path

out = Path(sys.argv[1])
checks = []

def load(name):
    p = out / name
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))

def ok(label, cond, detail=""):
    checks.append((label, cond, detail))
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))

# Paraformer 13min
d = load("paraformer-13min.json")
if d:
    n = len(d.get("segments") or [])
    warn = d.get("warnings") or []
    fb = any("funasr_whole_track_fallback" in w for w in warn)
    ok("Paraformer 13min ≥10 segments", n >= 10, f"n={n}")
    ok("Paraformer 13min no whole_track_fallback", not fb, str(warn[:3]))
    mode = d.get("segmentation_mode")
    mode_warn = any("segmentation_mode:" in w for w in warn)
    ok("Paraformer 13min segmentation mode present", mode == "sentence_info" or mode_warn or n >= 10, str(mode))
else:
    ok("Paraformer 13min", False, "missing json (use full run)")

# SenseVoice 13min
d = load("sensevoice-13min.json")
if d:
    n = len(d.get("segments") or [])
    warn = d.get("warnings") or []
    fb = any("funasr_whole_track_fallback" in w for w in warn)
    ok("SenseVoice 13min ≥3 segments", n >= 3, f"n={n}")
    ok("SenseVoice 13min no whole_track_fallback on long", not fb, str(warn[:3]))
else:
    ok("SenseVoice 13min", False, "missing json")

# Short
d = load("paraformer-short.json")
if d:
    n = len(d.get("segments") or [])
    ok("Paraformer ~30s 1–5 segments", 1 <= n <= 5, f"n={n}")
    ok("Paraformer ~30s no error", d.get("error") is None)
else:
    ok("Paraformer ~30s", False, "missing json")

failed = [c for c in checks if not c[1]]
print("")
if failed:
    print(f"FAILED {len(failed)} check(s). Artifacts: {out}")
    sys.exit(1)
print(f"All {len(checks)} checks passed. Artifacts: {out}")
PY
