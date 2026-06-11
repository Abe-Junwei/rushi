#!/usr/bin/env bash
# TRN-DIAG hand-test runner: transcribe timeline + diagnostic export contract.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> TRN-DIAG Layer 1: Rust transcribe_timeline"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q transcribe_timeline
)

echo "==> TRN-DIAG Layer 2: TS transcribeDiag + banner + controller"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- src/services/transcribeDiag.test.ts
  npm run test -- src/components/ProjectStatusFeedback.test.ts
  npm run test -- src/pages/useTranscribeJobController.test.ts
)

echo "==> TRN-DIAG Layer 3: last timeline file on disk (optional)"
APP_ROOT="${RUSHI_APP_DATA:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi}"
TL="${APP_ROOT}/transcribe_timeline_last.json"
if [[ -f "${TL}" ]]; then
  python3 - "${TL}" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    doc = json.load(f)
timeline = doc.get("transcribe_timeline")
if not isinstance(timeline, list) or not timeline:
    raise SystemExit("transcribe_timeline[] missing or empty")
print(f"  found {path} with {len(timeline)} stage(s); outcome={doc.get('outcome')}")
PY
else
  echo "  (skip — no transcribe_timeline_last.json; optional after a failed transcribe)"
fi

echo "==> TRN-DIAG Layer 4: diagnostic export field contract (Rust)"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q persist_and_load_sidecar_failure_roundtrip
  cargo test -q diagnostic_export_timeline_json_contract
)

echo ""
echo "==> TRN-DIAG automated checks passed"
echo "Optional live: stop ASR on :8741 → transcribe → banner「转写失败（转写）」→ 导出诊断包含 transcribe_timeline.json"
