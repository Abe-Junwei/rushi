#!/usr/bin/env bash
# R3e-B hand-test runner: windowed transcribe + profile regression.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> R3e-B Layer 1: Python ASR"
(
  cd "${ROOT}/services/asr"
  python3 -m pytest -q \
    tests/test_transcribe_windows.py \
    tests/test_asr_model_profile.py \
    tests/test_funasr_engine.py
)

echo "==> R3e-B Layer 2: Desktop hints"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- src/services/asrTranscribeHints.test.ts
)

echo "==> R3e-B Layer 3: Rust transcribe timeout"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q transcribe_timeout
)

APP_LOG="${RUSHI_DESKTOP_LOG:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log}"
echo "==> R3e-B Layer 4: desktop.log windowed transcribe (optional)"
if [[ -f "${APP_LOG}" ]] && grep -q "transcribe_stage=save" "${APP_LOG}" 2>/dev/null; then
  grep -E "2918\.|transcribe_windowed|transcribe_stage=" "${APP_LOG}" | tail -6 || true
else
  echo "  (skip — no recent transcribe save in desktop.log)"
fi

echo ""
echo "==> R3e-B automated checks passed"
echo "Manual: 50min Paraformer → 拉取语段完成；侧车日志含 transcribe_window i= n="
