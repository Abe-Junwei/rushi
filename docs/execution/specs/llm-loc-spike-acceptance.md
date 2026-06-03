# Acceptance: LLM-LOC-SPIKE

> **状态**：🟡 进行中（2026-06-03）  
> **Research**：[llm-loc-spike-research.md](./llm-loc-spike-research.md)

---

## 交付物

- [x] `fixtures/llm-loc-eval/` 子集就绪（**30** 段）— `bash scripts/llm-loc-spike-export-eval.sh`
- [ ] `bash scripts/llm-loc-spike-preflight.sh` 通过（Ollama serve + `qwen2.5:7b`）
- [ ] `results/` 基线 + Ollama 对比 JSON（计划步骤 3–4）
- [ ] Gate-A 表（G-A1～G-A6）已填 — 见 backlog §9.1
- [ ] **书面结论**（Go 4a / No-Go / defer）写入 `llm-loc-spike-results-YYYY-MM.md`

---

## Gate-A 勾选（Spike 后填）

| ID | 阈值 | 实测 | 通过 |
|----|------|------|------|
| G-A1 | R3t-C ≥ 云端 95% | | ⏳ |
| G-A2 | R3t-E evidence ≥90% | | ⏳ |
| G-A3 | R3t-D JSON ≥85% | | ⏳ |
| G-A4 | R3t-E P95 ≤45s | | ⏳ |
| G-A5 | 16GB 同开不 OOM | | ⏳ |
| G-A6 | 用户硬件分布 | 可选 | ⏳ |

**Gate-A 通过** → 起草 `r3-llm-local-runtime-acceptance.md` 并立项 **LLM-LOC-4a**。
