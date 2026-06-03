#!/usr/bin/env bash
# LLM-LOC-SPIKE 环境预检（Gate 前，无产品代码）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
MANIFEST="${ROOT}/fixtures/llm-loc-eval/eval_manifest.v1.json"

echo "== LLM-LOC-SPIKE preflight =="

if command -v ollama >/dev/null; then
  echo "  OK: ollama CLI: $(ollama --version 2>&1 | head -1)"
else
  echo "  FAIL: ollama not in PATH — install https://ollama.com for Spike step 4" >&2
  exit 1
fi

if curl -sf --max-time 3 "${OLLAMA_URL}/api/tags" -o /tmp/ollama-tags.json; then
  python3 - /tmp/ollama-tags.json <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
models = [m.get("name") for m in d.get("models") or []]
print(f"  OK: Ollama API reachable, {len(models)} model(s)")
for want in ("qwen2.5:7b", "qwen2.5:14b"):
    hit = [m for m in models if want in (m or "")]
    suffix = f" ({hit[0]})" if hit else f" — ollama pull {want}"
    print(f"    {'OK' if hit else 'MISS'}: {want}{suffix}")
PY
else
  echo "  WARN: Ollama not listening at ${OLLAMA_URL} — run: ollama serve" >&2
fi

N="$(python3 - "${MANIFEST}" <<'PY'
import json, sys
print(len(json.load(open(sys.argv[1], encoding="utf-8")).get("items") or []))
PY
)"
if [[ "${N}" -ge 20 ]]; then
  echo "  OK: eval manifest has ${N} items"
else
  echo "  WARN: eval manifest has ${N} items (need ≥20) — export segments into ${MANIFEST}" >&2
fi

echo ""
echo "Next: docs/execution/specs/llm-loc-spike-plan.md · fill Gate-A after run"
