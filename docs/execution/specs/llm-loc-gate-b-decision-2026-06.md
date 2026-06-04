# Gate-B 决策：LLM-LOC-4b（LRC 自管本机 LLM）

> **日期**：2026-06-04  
> **真源**：[`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md) §9.2 · [`llm-loc-spike-results-2026-06.md`](./llm-loc-spike-results-2026-06.md)  
> **前置**：Gate-A 有条件 Go → **4a 已编码签收**（[`llm-loc-4a-acceptance.md`](./llm-loc-4a-acceptance.md) 2026-06-03）

## 结论

**Gate-B：No-Go — 暂不立项 LLM-LOC-4b**

维持 **云端 DeepSeek（默认）+ Ollama loopback（4a 可选）** 双轨；**不** 扩展 `local_runtime/` 为 `llm-runtime` catalog，**不** 在应用内下载/拉起 llama-server MVP。

## 指标对照

| ID | 阈值 | 现状 | 判定 |
|----|------|------|------|
| **G-B1** | 内测「不愿另装 Ollama」为 Top 阻碍 | 无书面内测数据；4a 已覆盖「已有 Ollama」路径 | **未满足** |
| **G-B2** | R3h-2 在 ASR 上稳定签收 | R3h-2 **⏳**（断点续传 / C 类回滚未交付） | **未满足** |
| **G-B3** | 4b MVP smoke：runtime+模型→probe→R3t-C 自动化 | **未实现**；无 llm-runtime manifest | **未满足** |

## 理由摘要

1. **4a 已满足当前 ROI**：Spike 显示 `qwen2.5:7b` 对 R3t-C 延迟与稳定性足够；4a 环境检测 + loopback 已签收。  
2. **4b 依赖未闭合**：LRC 下载/回滚成熟能力在 **R3h-2**，先于 4b 编码会重复止血。  
3. **产品纪律**：R3t-D/E 仍默认云端；4b 工程量 2–3w+ 首平台，在 Gate-A G-A1 人工终判未完成前不扩面。  
4. **路线图**：§10 已写「4b 待 Gate-B」；本决策与 **Q-LLM-5** 一致。

## 何时重开 Gate-B

同时满足下列 **≥2** 条时再起草 4b intent/plan/acceptance：

- R3h-2 **编码+发行门禁** 签收  
- 内测或支持记录：Ollama 版本碎片 / 用户拒绝安装外部 LLM 成为 **Top3** 阻碍  
- 书面需求：应用内 **零终端** 本机 LLM（与 ASR 一键准备同级）  
- Gate-A **G-A1** 人工 20 段终判 ≥95% 且 Promote 本机 LLM 为推荐路径

## 下一步（主序）

| 优先级 | 动作 |
|--------|------|
| **P0** | 闭合 **⑤″f-A** UI 手测（R3t-E + F2）→ **⑤″f-B**（F1+F6+MEM-P0） |
| **P1** | 可选：`ollama serve` 后补跑 `llm-loc-spike-run.py`、填 G-A1 人工表 |
| **P2** | 并行薄片见 [`parallel-backlog-2026-06.md`](./parallel-backlog-2026-06.md) |
| **不做** | LLM-LOC-4b 产品编码、llm-runtime catalog schema 变更 |

## 预检（2026-06-04）

```bash
bash scripts/llm-loc-spike-preflight.sh
# WARN: Ollama not listening — 手测 4a 前需 ollama serve
# OK: eval manifest 30 items
```
