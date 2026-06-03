#!/usr/bin/env bash
# LLM-LOC-SPIKE steps 3–4: cloud baseline + Ollama (R3t-C eval)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIMIT="${RUSHI_LLM_LOC_SPIKE_LIMIT:-}"
PY=(python3 "${ROOT}/scripts/llm-loc-spike-run.py")

limit_args=()
[[ -n "${LIMIT}" ]] && limit_args=(--limit "${LIMIT}")

bash "${ROOT}/scripts/llm-loc-spike-preflight.sh" || true

echo "== cloud baseline (needs DEEPSEEK_API_KEY) =="
if [[ -n "${DEEPSEEK_API_KEY:-}" ]]; then
  "${PY[@]}" --provider cloud "${limit_args[@]}"
else
  echo "  SKIP: export DEEPSEEK_API_KEY" >&2
fi

echo "== Ollama S1 =="
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:7b}"
if curl -sf --max-time 3 "http://127.0.0.1:11434/api/tags" >/dev/null; then
  if ! ollama list 2>/dev/null | grep -q "${OLLAMA_MODEL%%:*}"; then
    echo "  pulling ${OLLAMA_MODEL} ..."
    ollama pull "${OLLAMA_MODEL}"
  fi
  "${PY[@]}" --provider ollama --model "${OLLAMA_MODEL}" "${limit_args[@]}"
else
  echo "  SKIP: ollama not reachable" >&2
fi

echo "Results: ${ROOT}/docs/execution/spike-output/"
