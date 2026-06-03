# Plan: LLM-LOC-SPIKE（Gate 前）

> **Research**：[llm-loc-spike-research.md](./llm-loc-spike-research.md)  
> **Acceptance**：[llm-loc-spike-acceptance.md](./llm-loc-spike-acceptance.md)  
> **Gate 表**：[`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md) §9.1

---

## 目标

在**不写 4a 产品代码**前提下，用脚本 + 可选 Ollama 跑出 **Gate-A** 证据，决定能否立项 **LLM-LOC-4a**。

---

## 步骤

| # | 动作 | 验证 |
|---|------|------|
| 1 | `bash scripts/llm-loc-spike-preflight.sh` | Ollama 安装/11434/已有模型列表 |
| 2 | 准备 eval 子集 | `fixtures/llm-loc-eval/eval_manifest.v1.json` ≥20 段 |
| 3 | 云端基线（DeepSeek） | 同 prompt 跑 R3t-C/E → `results/baseline.json` |
| 4 | Ollama S1 `qwen2.5:7b`（+ 可选 S2/S3） | `docs/execution/spike-output/llm-loc-ollama-*.json` via `bash scripts/llm-loc-spike-run.sh` |
| 5 | 填 Gate-A 表 + G-A5 同机 RAM | spike 结论 MD |
| 6 | 路线图 **Q-LLM-5** 书面结论 | Go 4a / No-Go / 仅 hidden loopback |

---

## 环境要求

```bash
# 安装 Ollama 后
ollama serve   # 或打开 Ollama.app
ollama pull qwen2.5:7b
```

桌面端仅需用于步骤 3（云端 probe 已配置时）；步骤 4 可用 `curl` + 与 `postprocess_cmd` 相同 endpoint 的独立脚本（待 SPIKE 脚本扩展）。

---

## 机器守卫（每轮）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

---

## 不做什么

- `LLM-LOC-4a` / `4b` 环境页与安装器  
- 修改 R3t prompt 契约  
- 阻塞 v1 热修复
