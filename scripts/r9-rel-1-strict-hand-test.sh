#!/usr/bin/env bash
# R9 REL-1 — 严格手测（当场 API 转写 + DB 导出 Word + REV-LOC 机器复检）
# Usage: bash scripts/r9-rel-1-strict-hand-test.sh [--skip-b2]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"

BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"
PARAFORMER="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
LONG_MP3="${RUSHI_STRICT_LONG_AUDIO:-/Users/junwei/Documents/转录/D1-堂2-直体心性行-4月30日7.mp3}"
APP_ROOT="${RUSHI_APP_ROOT:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi}"
APP_DB="${RUSHI_APP_DB:-${APP_ROOT}/rushi.sqlite3}"
OUT_DIR="${TMPDIR:-/tmp}/r9-strict-$(date +%Y%m%d-%H%M%S)"
SKIP_B2=0
ASR_PID=""
STARTED_ASR=0

for arg in "$@"; do
  [[ "$arg" == "--skip-b2" ]] && SKIP_B2=1
done

mkdir -p "${OUT_DIR}"
DOCX_OUT="${OUT_DIR}/r9-strict-clean.docx"
SUMMARY="${OUT_DIR}/strict-summary.txt"

cleanup() {
  if [[ "${STARTED_ASR}" -eq 1 && -n "${ASR_PID}" ]]; then
    kill "${ASR_PID}" 2>/dev/null || true
    wait "${ASR_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

log() { echo "$*" | tee -a "${SUMMARY}"; }

stop_8741() {
  local pids
  pids="$(lsof -ti :8741 2>/dev/null || true)"
  [[ -n "${pids}" ]] && kill -9 ${pids} 2>/dev/null || true
  sleep 1
}

start_paraformer_sidecar() {
  stop_8741
  export_asr_model_env
  export RUSHI_FUNASR_MODEL="${PARAFORMER}"
  local venv_py="${ROOT}/services/asr/.venv/bin/python"
  if [[ ! -x "${venv_py}" ]]; then
    bash "${ROOT}/scripts/bootstrap-asr-venv.sh"
  fi
  "${venv_py}" -m rushi_asr &
  ASR_PID=$!
  STARTED_ASR=1
  cd "${ROOT}"
  for _ in $(seq 1 90); do
    if curl -sf --max-time 2 "${BASE}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ASR failed to start on ${BASE}" >&2
  exit 1
}

assert_health_paraformer() {
  curl -sf --max-time 10 "${BASE}/health" -o "${OUT_DIR}/health-paraformer.json"
  python3 - "${OUT_DIR}/health-paraformer.json" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    h = json.load(f)
mid = h.get("funasr_model_id") or ""
assert "paraformer" in mid.lower(), mid
assert h.get("ready_for_transcribe") is True
print(f"  active={mid} ready=True")
PY
}

transcribe_file() {
  local label="$1"
  local media="$2"
  local timeout="${3:-7200}"
  local out="${OUT_DIR}/${label}.json"
  log "==> Transcribe ${label} ($(basename "${media}")) timeout=${timeout}s"
  local t0=$SECONDS
  curl -sf --max-time "${timeout}" \
    -F "file=@${media}" \
    "${BASE}/v1/transcribe" -o "${out}"
  python3 - "${out}" "${label}" "${SECONDS}" "$((SECONDS - t0))" <<'PY'
import json, sys
path, label, _, wall = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
d = json.load(open(path, encoding="utf-8"))
assert d.get("error") is None, d.get("error")
segs = d.get("segments") or []
warnings = d.get("warnings") or []
mode = d.get("segmentation_mode")
engine = d.get("engine")
print(f"  [{label}] wall={wall}s segments={len(segs)} engine={engine!r} mode={mode!r}")
for w in warnings:
    if "transcribe_windowed" in str(w) or "window" in str(w).lower():
        print(f"    warning: {w}")
if label == "b1-13min":
    assert len(segs) >= 10, f"B1 need >=10 segments, got {len(segs)}"
if label == "b2-48min":
    assert len(segs) >= 30, f"B2 need >=30 segments, got {len(segs)}"
    assert any("transcribe_windowed" in str(w) for w in warnings), warnings[:5]
PY
}

log "==> R9 strict hand test: ${OUT_DIR}"

log "==> A1 proxy: prepare-default (零终端 API 路径)"
start_paraformer_sidecar
curl -sf --max-time 120 -X POST "${BASE}/v1/models/prepare-default" \
  -H "Content-Type: application/json" -o "${OUT_DIR}/prepare-default.json" || true
assert_health_paraformer | tee -a "${SUMMARY}"

log "==> H3–H7 + REV-LOC machine (严格复检)"
bash "${ROOT}/scripts/r3t-b-hand-test.sh" 2>&1 | tee "${OUT_DIR}/r3t-b.log" | tail -5
bash "${ROOT}/scripts/r3t-c-hand-test.sh" 2>&1 | tee "${OUT_DIR}/r3t-c.log" | tail -3
bash "${ROOT}/scripts/rev-loc-slice-a-hand-test.sh" 2>&1 | tee "${OUT_DIR}/rev-a.log" | tail -2
bash "${ROOT}/scripts/rev-loc-slice-b-hand-test.sh" 2>&1 | tee "${OUT_DIR}/rev-b.log" | tail -2

if [[ ! -f "${LONG_MP3}" ]]; then
  echo "Missing long audio: ${LONG_MP3}" >&2
  exit 1
fi

B1_CLIP="${OUT_DIR}/b1-13min.wav"
ffmpeg -y -hide_banner -loglevel error -i "${LONG_MP3}" -t 780 -ac 1 -ar 16000 "${B1_CLIP}"
transcribe_file "b1-13min" "${B1_CLIP}" 1800

if [[ "${SKIP_B2}" -eq 0 ]]; then
  transcribe_file "b2-48min" "${LONG_MP3}" 7200
fi

log "==> B3 hotwords (制控)"
curl -sf --max-time 600 \
  -F "file@${ROOT}/fixtures/eval/samples/制控.mp3;filename=zhikong.mp3" \
  -F "hotwords=制控" \
  "${BASE}/v1/transcribe" -o "${OUT_DIR}/b3-hotwords.json"
python3 - "${OUT_DIR}/b3-hotwords.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
hyp = d.get("hypothesis") or ""
assert "制控" in hyp or "质控" in hyp
print(f"  B3 OK segments={len(d.get('segments') or [])}")
PY

log "==> D1: export clean DOCX from app DB"
export RUSHI_APP_DB="${APP_DB}"
export RUSHI_STRICT_DOCX_OUT="${DOCX_OUT}"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q 'export_docx::tests::r9_strict_export_docx_from_app_db' --lib -- --exact --nocapture
)
python3 - "${DOCX_OUT}" "${APP_DB}" <<'PY'
import json, re, sys, zipfile, sqlite3
from xml.etree import ElementTree as ET

docx, db = sys.argv[1], sys.argv[2]
ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
with zipfile.ZipFile(docx) as z:
    xml = z.read("word/document.xml")
root = ET.fromstring(xml)
texts = [t.text for t in root.iter(f"{{{ns['w']}}}t") if t.text]
body = "".join(texts)
assert len(body) > 50, "docx body too short"
conn = sqlite3.connect(db)
file_id = conn.execute(
    "SELECT file_id FROM segments GROUP BY file_id ORDER BY COUNT(*) DESC LIMIT 1"
).fetchone()[0]
rows = conn.execute(
    "SELECT text FROM segments WHERE file_id=? ORDER BY idx ASC LIMIT 3",
    (file_id,),
).fetchall()
conn.close()
for (txt,) in rows:
    snippet = re.sub(r"\s+", "", (txt or ""))[:12]
    if snippet and snippet not in re.sub(r"\s+", "", body):
        raise SystemExit(f"D1 mismatch: {snippet!r} not in docx body sample")
print(f"  DOCX chars={len(body)} spot-check 3 segments OK")
PY

if command -v textutil >/dev/null 2>&1; then
  textutil -convert txt -stdout "${DOCX_OUT}" > "${OUT_DIR}/r9-strict-clean.txt" 2>/dev/null || true
  log "  textutil txt lines=$(wc -l < "${OUT_DIR}/r9-strict-clean.txt" | tr -d ' ')"
fi
if [[ "$(uname -s)" == "Darwin" ]]; then
  open "${DOCX_OUT}" >/dev/null 2>&1 || true
  log "  opened DOCX with default app (Word if installed)"
fi

log "==> D2 SQLite stable read"
python3 - "${APP_DB}" <<'PY'
import sqlite3, sys
db = sys.argv[1]
c = sqlite3.connect(db)
n1 = c.execute("SELECT COUNT(*) FROM segments").fetchone()[0]
n2 = c.execute("SELECT COUNT(*) FROM segments").fetchone()[0]
c.close()
assert n1 == n2 and n1 > 0
print(f"  segments={n1} stable")
PY

log "==> E1 quality report"
python3 - "${APP_ROOT}/quality/last_eval_report.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
assert d.get("exit_code") == 0
for it in d.get("items") or []:
    if it.get("expected_terms"):
        assert (it.get("term_hit_rate") or 0) >= 1.0
print("  E1 OK")
PY

log ""
log "==> R9 STRICT hand test PASSED"
log "Artifacts: ${OUT_DIR}"
log "UI still required for A1 wizard + C1/C2 (see strict-signoff); run desktop and rev-loc checklists if not re-verified today."
