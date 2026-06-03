# LLM-LOC-SPIKE — 阶段入口（2026-06-03）

> **前置**：v1 **R9** + **0.1.0 DMG** ✅  
> **下一产品编码**：**Gate-A 通过后** 才立项 **LLM-LOC-4a**（Q-LLM-5）

## 本阶段目标

用脚本 + Ollama 填齐 **Gate-A（G-A1～G-A6）**，书面决定 **Go / No-Go 4a**；**不写** 4a/4b 产品 UI。

## 真源三件套

| 文档 | 路径 |
|------|------|
| Research | [llm-loc-spike-research.md](./llm-loc-spike-research.md) ✅ |
| Plan | [llm-loc-spike-plan.md](./llm-loc-spike-plan.md) |
| Acceptance | [llm-loc-spike-acceptance.md](./llm-loc-spike-acceptance.md) 🟡 |

## 命令序（当前轮）

```bash
# 1. 导出 eval 子集（≥20 段）
bash scripts/llm-loc-spike-export-eval.sh

# 2. 环境预检
bash scripts/llm-loc-spike-preflight.sh

# 3. Ollama（本机）
ollama serve          # 或打开 Ollama.app
ollama pull qwen2.5:7b

# 4–5. 基线 + Ollama 对比（待 llm-loc-spike-run 脚本 / 桌面 R3t 手跑）
# 6. 填 Gate-A → llm-loc-spike-results-YYYY-MM.md
```

## 进度（2026-06-03）

| 步 | 状态 |
|----|------|
| Research | ✅ |
| eval 导出脚本 | ✅ `scripts/llm-loc-spike-export-eval.sh` |
| eval items ≥20 | ✅ **30** 段（`eval_manifest.v1.json`） |
| Spike run 脚本 | ✅ `llm-loc-spike-run.py` / `llm-loc-spike-run.sh` |
| Ollama serve + S1 | ✅ `qwen2.5:7b` |
| Ollama R3t-C eval (30 段) | ✅ `spike-output/llm-loc-ollama-qwen2.5-7b-2026-06-03.json`（errors=0，P95 **916ms**） |
| 云端 baseline | ✅ DeepSeek 30 段（P95 1183 ms） |
| 对比 + 结论 | ✅ [llm-loc-spike-results-2026-06.md](./llm-loc-spike-results-2026-06.md) |
| Gate-A 终判 | ⏳ G-A1 人工 20 段 |
| Gate-A 表 | ⏳ |

## 并行（不挡 Spike）

R3 **C 期** 收尾：TRN-DIAG、ASR-WARM、R3h-2 · **R5 MCP** · 公证分发
