#!/usr/bin/env bash
# Copy Fun-ASR GitHub remote_code (model.py + ctc.py + tools/) into cached Nano weights.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/resolve-asr-models-root.sh
source "${ROOT}/scripts/resolve-asr-models-root.sh"
export_asr_model_env

VENV_PY="${ROOT}/services/asr/.venv/bin/python"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

"${VENV_PY}" <<PY
import os
from pathlib import Path
import sys
sys.path.insert(0, "${ROOT}/services/asr")
from rushi_asr.model_prepare_cache import find_cached_model_dir, recognizer_cache_spec

mid = "FunAudioLLM/Fun-ASR-Nano-2512"
req, weight, min_b = recognizer_cache_spec(mid)
cached = find_cached_model_dir(mid, req, min_b, weight_file=weight)
if cached is None:
    raise SystemExit("Nano weights not cached; download model.pt first")
from rushi_asr.funasr_nano_remote_code import sync_funasr_nano_remote_code
path = sync_funasr_nano_remote_code(cached, force=bool(${FORCE}))
print("OK:", path)
PY
