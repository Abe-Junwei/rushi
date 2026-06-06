# Plan: F0 — 转写后编排（阶段 A → 阶段 B）

> **调研**：[`post-transcribe-to-export-automation-research.md`](./post-transcribe-to-export-automation-research.md)（§3 阶段 A taxonomy · §6 决策）  
> **Acceptance**：[`f0-post-transcribe-orchestration-acceptance.md`](./f0-post-transcribe-orchestration-acceptance.md)  
> **手测**：[`f0-post-transcribe-hand-test-checklist.md`](./f0-post-transcribe-hand-test-checklist.md)  
> **套件**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) · 取代原「F0-lite = 仅规则」表述  
> **状态**：✅ **F0-v1 / v1.5 / v2 / v2.1 / v2.2** 机器 + 手测签收（v2.2 · 2026-06-06）

---

## 1. 目标

转写落库（L3）后，用 **单一编排入口** 引导用户完成：

```text
阶段 A（确定性规则，预览写回）→ 阶段 B（LLM 改稿，预览写回）→ 手动改稿 → 导出
```

**硬约束**

- **A 与 B 独立手动入口**；规则真源优先于 LLM，但 **不**强制顺序、**不**在 A 关闭后自动弹 B。
- **禁止** 静默写库；**禁止** 恢复 R3t-C/D **独立工具栏**（段界不进 B v1）。
- **不** 第二套 memory/glossary 真源；A1 复用 F1 / `list_stable_correction_rules`。

---

## 2. 分期

| 期 | 范围 | 估时 | 依赖 |
|----|------|------|------|
| **F0-v1** | A1+A2：工具栏「规则纠错」；转写 toast 用时/语段/字数 | 0.5–2d | MEM-P2 ✅、F1 ✅、手测 ✅ 2026-06-05 |
| **F0-v1.5** | A3 hints 清单、A4 冲突门禁 | 1–2d | F7 冲突逻辑 |
| **F0-v2** | 阶段 B：批处理标点 + 错字（一轮或两轮 LLM），接在 A 确认后 | 3–5d | `postprocess_*`、LLM 配置、隐私同意 |
| **F0-v2+** | A6 hygiene ✅、A9 词表卫生 ✅；A5/A7 仍为 Spike | — | research §3.2 |

---

## 3. 落位（编码时）

| 层 | 文件（新建或扩展） |
|----|-------------------|
| 编排 | `usePostTranscribeOrchestrationController.ts`（或扩 `useCorrectionRulesController`） |
| 入口 | `finishTranscribeSuccess` / 转写完成 toast「转写后处理…」 |
| 阶段 A UI | 复用 `CorrectionRulesPreviewDialog.tsx`（文案/步骤条） |
| 阶段 B UI | 复用/扩展 auto punctuate 预览模式；统一 proofread 待 spike |
| Rust A | 现有 `correction_store.rs`（无新表 v1） |
| Rust B | `postprocess_auto_punctuate_cmd.rs`；LexiconPack 错字待 v2 |

---

## 4. 明确不做（v1）

- R3t-D 段界、F0-full 一键增强、F5 语义默认开。
- 转写中改 stable 段触发 `postprocess_*`（见 R3e-C 门禁）。
- 用 `/health.ready_for_transcribe` 表示「LLM 改稿可用」（须走 postprocess 配置 + consent）。

---

## 5. 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
# v2 起：定向 Vitest + cargo test postprocess_*
```

手测：[`f0-post-transcribe-hand-test-checklist.md`](./f0-post-transcribe-hand-test-checklist.md)
