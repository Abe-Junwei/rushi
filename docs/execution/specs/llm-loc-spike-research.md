# 调研：LLM-LOC-SPIKE — 本机 LLM 校对 Go/No-Go

> **状态**：✅ 调研签收（2026-06-03）· **Spike 进行中**  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §3.1 v1 后  
> **Backlog 真源**：[`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md) §8–10  
> **Plan**：[llm-loc-spike-plan.md](./llm-loc-spike-plan.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | v1 已用**云端** LLM 做 R3t 标点/校对；部分用户希望**数据不出本机**完成同类任务 |
| 本仓现状 | `postprocess_cmd` + `llm_probe_connection` 已支持 OpenAI-compatible loopback（`allow_insecure_http`）；**无** Ollama 预设、环境页「本机 LLM」灯、LRC `llm-runtime` |
| 成功标准 | Spike 填齐 **Gate-A** 表（G-A1～G-A6）；书面 **Go/No-Go 4a**；未过 Gate **不编码** 4a/4b |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 | 链接 |
|---|------|------|------|------|
| A | **外置 Ollama** | Ollama.app、LM Studio | 用户装运行时；App 连 `127.0.0.1:11434/v1` | [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) |
| B | **应用内嵌 llama.cpp server** | Jan、部分笔记 App | manifest 下载 GGUF；应用拉起子进程 | llama.cpp server mode |
| C | **仅云端 API** | Descript/多数 SaaS | 默认；本仓 v1 已走此路径 | R3t + DeepSeek 等 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 资源 |
|------|--------|----------|------|------|
| A Ollama | **高** | `postprocess_probe`、R3t 同一 HTTP 客户端 | 多一个外部 App；版本不可控 | 7B Q4 ~4.5GB + ASR 争用 RAM |
| B LRC 自管 | **中** | R3h installer/integrity/rollback 模式 | 2–3w+；GPU 矩阵自扛 | 与 A 长期并存（Q-LLM-4） |
| C 云端 | **高** | 已签收 R3t | 隐私诉求 | 无本机 RAM |

**本仓必复用**：`postprocess_cmd.rs`、`EnvLlmConfigPanel`、LexiconPack 契约（R3t-E）、LRC 仅 ASR 的 `local_runtime/`。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定路径 | **先 SPIKE → Gate-A → 再 LLM-LOC-4a（Ollama）**；Gate-B 再议 4b |
| 不做什么 | Gate 前：**4a/4b UI**、llm-runtime catalog、LiteLLM 网关、LLM 进 ASR 侧车 |
| ADR | 对齐 [`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md) §7 |
| Spike | `fixtures/llm-loc-eval/` + `scripts/llm-loc-spike-preflight.sh`；完整跑需本机 Ollama + 模型 |

---

## 5. 落位预告

| 层 | Spike / 4a |
|----|------------|
| 脚本 | `scripts/llm-loc-spike-*.sh` |
| 数据 | `fixtures/llm-loc-eval/` |
| 4a（Gate 后） | `postprocessRuntimeContract` · 环境第三路灯 · Ollama 预设 |
| 4b（Gate-B 后） | `local_runtime/` 扩展 llm-runtime |

---

## 6. 修订

| 日期 | 变更 |
|------|------|
| 2026-06-03 | 初版；v1 后发版进入 SPIKE 阶段 |
