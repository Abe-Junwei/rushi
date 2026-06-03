# LLM-LOC-SPIKE eval 子集

用于 **Gate-A** 对比：云端 DeepSeek vs Ollama 本地（同 R3t prompt）。

## 清单

- `eval_manifest.v1.json` — 语段文本 + 可选 `glossary_terms` / `memory_rules` 引用 id
- 首批可**手工**从现有 SQLite 项目导出 20～50 段（脱敏后写入 `items[].segment_text`）

## 用法（规划）

```bash
# 预检
bash scripts/llm-loc-spike-preflight.sh

# 导出子集
bash scripts/llm-loc-spike-export-eval.sh

# 对比（R3t-C 标点；云端需 DEEPSEEK_API_KEY）
export DEEPSEEK_API_KEY=...
python3 scripts/llm-loc-spike-run.py --provider cloud --limit 5
python3 scripts/llm-loc-spike-run.py --provider ollama --model qwen2.5:7b --limit 5
# 或一步：bash scripts/llm-loc-spike-run.sh
```

产物建议写入 `docs/execution/spike-output/llm-loc-YYYY-MM-DD/`。
