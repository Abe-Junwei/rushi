#!/usr/bin/env bash
# R3e-A hand-test runner: dynamic timeout + failure classification + hints regression.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> R3e-A Layer 1: Rust transcribe timeout + errors"
(
  cd "${ROOT}/apps/desktop/src-tauri"
  cargo test -q transcribe_
)

echo "==> R3e-A Layer 2: Desktop transcribe hints"
(
  cd "${ROOT}/apps/desktop"
  npm run test -- src/services/asrTranscribeHints.test.ts
)

echo "==> R3e-A Layer 3: ffprobe duration probe (fixture 制控.mp3)"
FIXTURE="${ROOT}/fixtures/eval/samples/制控.mp3"
if [[ -f "${FIXTURE}" ]]; then
  DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${FIXTURE}" 2>/dev/null || true)"
  if [[ -n "${DUR}" ]]; then
    SEC="${DUR%.*}"
    echo "  fixture duration_sec≈${SEC} (expect >600s budget when transcribed via desktop)"
  else
    echo "  (skip — ffprobe could not read fixture)"
  fi
else
  echo "  (skip — fixture missing)"
fi

APP_LOG="${RUSHI_DESKTOP_LOG:-${HOME}/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/logs/desktop.log}"
echo "==> R3e-A Layer 4: desktop.log long-audio timeout (optional)"
if [[ -f "${APP_LOG}" ]]; then
  if grep -qE "audio_duration_sec=Some\(2918|timeout_s=7200" "${APP_LOG}" 2>/dev/null; then
    grep -E "audio_duration_sec=Some\(2918|timeout_s=7200|transcribe_stage=" "${APP_LOG}" | tail -6 || true
  else
    echo "  (no ~50min evidence in current log — see r3e-b-hand-test-checklist.md 2026-05-30)"
  fi
else
  echo "  (skip — desktop.log not found)"
fi

echo ""
echo "==> R3e-A automated checks passed"
echo "Manual: ~50min Paraformer → desktop.log timeout_s=7200; stop sidecar → 中文失败文案"
