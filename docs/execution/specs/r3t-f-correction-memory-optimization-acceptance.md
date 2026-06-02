# Acceptance: 纠错记忆优化（MEM）

> **Plan**：[`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md)  
> **套件**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md)（F2/F6 条目仍适用）

---

## MEM-P0（⑤″f-B）

- [ ] Replace All 确认保存后，`correction_memory` 存在预期 `before→after`（显式或 infer）
- [ ] F1 确认写回后 **1s 内** 落库（`quiet save`），无需等待自动保存
- [ ] 自动保存与手动保存的 **hit 策略** 符合 Plan D10（手测：仅改一个字停笔 vs 点保存）
- [ ] 学习失败可在 UI 或日志定位（非静默）

## MEM-P1（⑤″f-B½）

- [ ] 记忆列表可查看、删除 stable 规则（`hit≥2` 或 accepted）
- [ ] F1 或改正路径可「采纳为规则」，下次 Pack/hints 立即可见
- [ ] LEX-MINE-1：推荐列表、采纳进 glossary、忽略不再提示
- [ ] F6 弹窗文案无 SQLite/技术库用语

## MEM-P2（⑤″f-C）

- [ ] 合并/拆分后 1:1 uid 段的手改仍可学习（手测一条）
- [ ] ACC-TXT-0 spike：转写后规则预替换 **有预览**、可取消；`before_text` 未进 hotwords

## MEM-P3 / MEM-S1（P3 / Spike）

- [ ] 同 `before` 异 `after` 冲突有预览（或 F7 导入冲突已覆盖则记 N/A）
- [ ] MEM-S1：预替换仅 high 规则；与 hint 不重复刷屏
