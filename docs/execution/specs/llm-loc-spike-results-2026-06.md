# LLM-LOC-SPIKE 结果（2026-06-03）

> **Research**：[llm-loc-spike-research.md](./llm-loc-spike-research.md)  
> **Acceptance**：[llm-loc-spike-acceptance.md](./llm-loc-spike-acceptance.md)

## 运行摘要

| 跑批 | 模型 | 段数 | 错误 | P50 | P95 |
|------|------|------|------|-----|-----|
| 云端基线 | `deepseek-chat` | 30 | 0 | 919 ms | 1183 ms |
| Ollama S1 | `qwen2.5:7b` | 30 | 0 | 514 ms | **916 ms** |

产物目录：`docs/execution/spike-output/`

- `llm-loc-baseline-cloud-deepseek-2026-06-03.json`
- `llm-loc-ollama-qwen2.5-7b-2026-06-03.json`
- `llm-loc-compare-2026-06-03.json`

任务：**R3t-C `auto_punctuate`**（与 `postprocess_cmd` 同 prompt）。

## 自动对比（云端 vs 本地）

| 指标 | 值 |
|------|-----|
| 配对段数 | 30 |
| 去标点后输出相似度 ≥0.85 | **25/30（83.3%）** |
| 相对原文「改字」（去标点）云端 | 1/30 |
| 相对原文「改字」本地 | **7/30** |

相似度偏低样例（需人工看可接受性）：`seg-b94cf65e-25`、`seg-f521c828-41`、`seg-be4eec5a-16`、`seg-2f0e0c58-28`、`seg-33724730-33`。

复跑：

```bash
bash scripts/llm-loc-spike-export-eval.sh   # 如需刷新 eval
python3 scripts/llm-loc-spike-run.py --provider cloud
python3 scripts/llm-loc-spike-run.py --provider ollama --model qwen2.5:7b
python3 scripts/llm-loc-spike-compare.py \
  --cloud docs/execution/spike-output/llm-loc-baseline-cloud-deepseek-2026-06-03.json \
  --ollama docs/execution/spike-output/llm-loc-ollama-qwen2.5-7b-2026-06-03.json
```

## Gate-A（§9.1）

| ID | 阈值 | 实测 | 判定 |
|----|------|------|------|
| G-A1 | R3t-C ≥ 云端 95% 可接受 | 自动相似 ≥0.85：**83.3%**；本地改字 **7/30** | **待定** — 需 20 段人工抽检 |
| G-A2 | R3t-E evidence ≥90% | 未跑 | **跳过**（本 Spike 未含 LexiconPack） |
| G-A3 | R3t-D JSON ≥85% | 未跑 | **跳过** |
| G-A4 | R3t-E P95 ≤45s（S1） | R3t-C P95 **916 ms**（Ollama） | **通过**（任务为 C，延迟余量极大） |
| G-A5 | 16GB 同开 ASR+LLM | 未测 | **跳过** |
| G-A6 | 用户硬件分布 | — | 可选 |

## Q-LLM-5 书面结论

**建议：有条件 Go → 立项 LLM-LOC-4a（Ollama loopback）** — **4a 已编码**见 [llm-loc-4a-acceptance.md](./llm-loc-4a-acceptance.md)

1. **R3t-C + `qwen2.5:7b`**：延迟与稳定性满足 Spike；可产品化环境检测 + loopback 预设。  
2. **纪律**：本地 7B **改词率高于云端**（7 vs 1），4a 须在 UI/文案强调「仅标点、可能改字」并保留 diff 预览（已有 R3t-C 链路）。  
3. **R3t-D / R3t-E**：**不**因本 Spike 宣称本地可用；上线前仍默认 **云端 DeepSeek**。  
4. **G-A1 终判**：完成 20 段人工「可接受」表后，在 acceptance 勾选 G-A1；若 <95% 则维持 hidden loopback、不 Promote 环境灯。

**不做**：Gate 未全过前 **LLM-LOC-4b**；不在 Spike 内改 prompt 契约。

## 下一步

1. 人工抽检 20 段（填 G-A1）。  
2. 起草 `r3-llm-local-runtime-acceptance.md` 并 roadmap 标注 **立项 4a**。  
3. 可选：G-A5 手测（13min 转写后立即本地标点 ×3，记 RAM）。
