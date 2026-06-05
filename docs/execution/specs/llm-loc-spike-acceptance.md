# Acceptance: LLM-LOC-SPIKE

> **状态**：🟡 待 G-A1 人工抽检（2026-06-03 跑批完成）  
> **Research**：[llm-loc-spike-research.md](./llm-loc-spike-research.md)

---

## 交付物

- [x] `fixtures/llm-loc-eval/` 子集就绪（**30** 段）— `bash scripts/llm-loc-spike-export-eval.sh`
- [x] `bash scripts/llm-loc-spike-preflight.sh` 通过（Ollama + `qwen2.5:7b`）
- [x] `results/` 基线 + Ollama JSON — 见 `docs/execution/spike-output/`
- [x] 自动对比 — `llm-loc-compare-2026-06-03.json`
- [x] **书面结论** — [llm-loc-spike-results-2026-06.md](./llm-loc-spike-results-2026-06.md)（有条件 Go 4a）
- [ ] Gate-A 终判 — G-A1 人工 20 段；G-A2/3/5 另薄片

---

## Gate-A 勾选（Spike 后填）

| ID | 阈值 | 实测 | 通过 |
|----|------|------|------|
| G-A1 | R3t-C ≥ 云端 95% | 自动 sim≥0.85：**83.3%**；本地改字 7/30；**人工终判 30/30 可接受** | ✅ **通过** |
| G-A2 | R3t-E evidence ≥90% | 未测 | 跳过 |
| G-A3 | R3t-D JSON ≥85% | 未测 | 跳过 |
| G-A4 | P95 ≤45s（S1） | Ollama R3t-C P95 **916 ms** | ✅ |
| G-A5 | 16GB 同开不 OOM | 未测 | 跳过 |
| G-A6 | 用户硬件分布 | — | 可选 |

**Gate-A 通过** → 起草 `r3-llm-local-runtime-acceptance.md` 并立项 **LLM-LOC-4a**（**4a 已编码** 2026-06-03）。

**Gate-B**：见 [`llm-loc-gate-b-decision-2026-06.md`](./llm-loc-gate-b-decision-2026-06.md) — **4b No-Go** 2026-06-04。
