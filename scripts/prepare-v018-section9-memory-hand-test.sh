#!/usr/bin/env bash
# Preflight + optional rebuild for v0.1.8.1 §9 memory hand test (ASR unload + WebView RSS).
#
# Usage:
#   bash scripts/prepare-v018-section9-memory-hand-test.sh           # gates + verify existing .app
#   bash scripts/prepare-v018-section9-memory-hand-test.sh --build   # rebuild sidecar + .app first
#   bash scripts/prepare-v018-section9-memory-hand-test.sh --gates-only
#
# Env:
#   RUSHI_RELEASE_APP — default target/release .app or /Applications/如是我闻.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

MODE="${1:-verify}"
APP="${RUSHI_RELEASE_APP:-${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app}"
SAMPLE="${ROOT}/fixtures/eval/samples/clear.wav"
APP_DATA="$(bash "${ROOT}/scripts/resolve-app-data-root.sh")"
EVIDENCE="${ROOT}/docs/execution/specs/v0.1.8-section9-memory-hand-test-evidence.md"
# shellcheck source=/dev/null
source "${ROOT}/scripts/rushi-resolve-git-sha.sh"
SHA="$(rushi_resolve_git_sha "${ROOT}")"

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== v0.1.8.1 §9 memory hand test preflight =="
echo "    sha=${SHA}"
echo "    app=${APP}"
echo "    mode=${MODE}"
echo ""

run_gates() {
  echo "== machine gates =="
  npm run typecheck
  npm run test -w @rushi/desktop -- useAsrModelUnloadOnFileSwitch asrModelUnload asrModelMemoryState asrEnvStatus
  (cd services/asr && pytest tests/test_model_unload.py tests/test_funasr_engine.py::test_invalidate_funasr_model_cache_calls_mps_empty_cache -q)
  node scripts/check-architecture-guard.mjs
  echo "OK: machine gates"
  echo ""
}

stop_dev_interference() {
  pkill -f "npm run desktop:dev" 2>/dev/null || true
  sleep 1
  if lsof -ti :8741 >/dev/null 2>&1; then
    echo "WARN: port 8741 in use — quit dev sidecar or release app before MU-H* hand test"
    lsof -i :8741 2>/dev/null || true
  else
    echo "OK: port 8741 free"
  fi
}

verify_sidecar_unload() {
  local sidecar="$1"
  if [[ ! -x "$sidecar" ]]; then
    fail "sidecar missing: $sidecar"
  fi
  echo "== sidecar smoke (unload endpoint) =="
  if bash scripts/smoke-asr-sidecar-health.sh "$sidecar"; then
    echo "OK: sidecar has warmup + unload + RSS smoke"
  else
    fail "sidecar smoke failed — run: bash $0 --build"
  fi
  echo ""
}

verify_app() {
  [[ -d "${APP}" ]] || fail "Release app missing: ${APP} (run: bash $0 --build)"
  [[ -x "${APP}/Contents/MacOS/rushi-desktop" ]] || fail "Binary missing in ${APP}"

  local sidecar="${APP}/Contents/Resources/resources/bundled-asr/rushi-asr-sidecar/rushi-asr-sidecar"
  verify_sidecar_unload "$sidecar"

  bash scripts/release-postbuild-verify.sh
  echo ""
}

build_fresh() {
  echo "== rebuild sidecar + release .app (Plan B) =="
  npm run asr:build-sidecar-unix
  bash scripts/build-desktop-local-hand-test.sh
  APP="${ROOT}/apps/desktop/src-tauri/target/release/bundle/macos/如是我闻.app"
  export RUSHI_RELEASE_APP="${APP}"
  verify_app
}

case "${MODE}" in
  --gates-only)
    run_gates
    stop_dev_interference
    ;;
  --build)
    run_gates
    build_fresh
    stop_dev_interference
    ;;
  verify|--verify|"")
    run_gates
    verify_app || {
      echo ""
      echo "Hint: bundled sidecar likely stale. Rebuild with:"
      echo "  bash scripts/prepare-v018-section9-memory-hand-test.sh --build"
      exit 1
    }
    stop_dev_interference
    ;;
  *)
    fail "unknown mode: ${MODE} (use --build | --gates-only | verify)"
    ;;
esac

[[ -f "${SAMPLE}" ]] || fail "test audio missing: ${SAMPLE}"
echo "OK: test audio ${SAMPLE} ($(wc -c < "${SAMPLE}" | awk '{print $1}') bytes)"
echo ""

cat <<EOF
== Ready for §9 hand test ==

Checklist: docs/execution/specs/v0.1.8-mac-release-hand-test-checklist.md §9
Evidence:  ${EVIDENCE}
Runbook:   docs/execution/specs/asr-model-unload-on-file-switch-acceptance.md

1. Open release app (not desktop:dev):
   export RUSHI_RELEASE_APP="${APP}"
   open -a "\${RUSHI_RELEASE_APP}"

2. Import project + ≥2min audio (or use ${SAMPLE} for smoke path).

3. RSS samples (after each step):
   bash scripts/sample-rushi-memory-rss.sh H1-baseline      # after transcribe
   bash scripts/sample-rushi-memory-rss.sh H3-after-unload  # Hub/File switch + wait ≥3s
   bash scripts/sample-rushi-memory-rss.sh W3-after-hub

4. Blockers: MU-H1 sidecar ≥2GB · MU-H3 sidecar <600MB after unload

5. Log:
   tail -f "${APP_DATA}/logs/desktop.log"

Fill evidence table → sign acceptance §9.
EOF
