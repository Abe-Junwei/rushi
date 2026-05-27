#!/usr/bin/env bash
# R3g-A S3 / ⑤c hand test helper: dump ASR health + catalog + sidecar build probes.
set -euo pipefail

BASE="${RUSHI_ASR_BASE:-http://127.0.0.1:8741}"
BASE="${BASE%/}"

fail=0

echo "=== GET ${BASE}/ (sidecar build probes) ==="
ROOT_JSON="$(curl -sf --max-time 5 "${BASE}/" 2>/dev/null || true)"
if [[ -z "${ROOT_JSON}" ]]; then
  echo "FAIL: 无法读取 ${BASE}/ — 侧车未启动或不是 rushi-asr" >&2
  fail=1
else
  echo "${ROOT_JSON}" | python3 -c "
import json, sys
v = json.load(sys.stdin)
for k in ('prepare_cancel', 'prepare_model_async', 'model_catalog'):
    print(f'  {k}:', v.get(k, '(missing)'))
has_cancel = 'prepare-cancel' in str(v.get('prepare_cancel', ''))
print('  supports_prepare_cancel:', has_cancel)
print('  supports_punc_prepare_build:', has_cancel)
if not has_cancel:
    print('', file=sys.stderr)
    print('WARN: 当前 8741 侧车缺少 prepare-cancel → 多为 app_data 旧包或重建后未重启侧车', file=sys.stderr)
    sys.exit(2)
" || fail=1
fi

echo ""
echo "=== GET ${BASE}/health ==="
if ! curl -sf --max-time 5 "${BASE}/health" | python3 -c "
import json, sys
h = json.load(sys.stdin)
cat = h.get('local_asr_model_catalog') or []
print(json.dumps({
  'funasr_model_id': h.get('funasr_model_id'),
  'ready_for_transcribe': h.get('ready_for_transcribe'),
  'funasr_required_models_cached': h.get('funasr_required_models_cached'),
  'funasr_punc_model_id': h.get('funasr_punc_model_id'),
  'funasr_punc_model_cached': h.get('funasr_punc_model_cached'),
  'funasr_default_model_cached': h.get('funasr_default_model_cached'),
  'catalog_items': [
    {
      'hub_model_id': i.get('hub_model_id'),
      'cached': i.get('cached'),
      'active': i.get('active'),
      'ready_for_transcribe': i.get('ready_for_transcribe'),
    }
    for i in cat
  ],
}, ensure_ascii=False, indent=2))
active = str(h.get('funasr_model_id') or '').lower()
if 'funasr_punc_model_id' not in h:
    print('NOTE: /health 无 funasr_punc_* 字段 → 侧车 Python 早于 2026-05-27 runtime_caps', file=sys.stderr)
elif 'paraformer' in active and not h.get('funasr_punc_model_id'):
    print('WARN: Paraformer 激活但 funasr_punc_model_id 为空 → 旧侧车或环境未加载 punc', file=sys.stderr)
    sys.exit(2)
elif 'paraformer' in active and h.get('funasr_punc_model_cached') is not True:
    print('WARN: Paraformer 激活但标点模型未缓存 → 请环境页校验/刷新缓存', file=sys.stderr)
    sys.exit(2)
"; then
  echo "health failed — is rushi-asr running on ${BASE}?" >&2
  fail=1
fi

echo ""
echo "=== GET ${BASE}/v1/models/prepare-status ==="
curl -sf --max-time 5 "${BASE}/v1/models/prepare-status" | python3 -c "
import json, sys
st = json.load(sys.stdin)
print(json.dumps(st, ensure_ascii=False, indent=2))
r = st.get('result') or {}
mid = str(r.get('model_id', '')).lower()
if st.get('phase') == 'done' and mid and 'paraformer' in mid:
    if r.get('punc_path'):
        print('OK: prepare result 含 punc_path', file=sys.stderr)
    else:
        print('WARN: prepare result 无 punc_path — ⑤c 易整轨 fallback；请完全退出应用后重开，或环境页「重试内置侧车」', file=sys.stderr)
        sys.exit(2)
" || fail=1

echo ""
echo "=== GET ${BASE}/v1/models/catalog ==="
curl -sf --max-time 5 "${BASE}/v1/models/catalog" | python3 -m json.tool 2>/dev/null | head -40 || echo "(catalog unavailable)"

if [[ "${fail}" -ne 0 ]]; then
  echo "" >&2
  echo "Preflight 有 WARN/FAIL。建议：完全退出 Rushi → npm run desktop:dev → 环境页「重试内置侧车」→ 再「校验/刷新缓存」→ 本脚本。" >&2
  exit 1
fi
