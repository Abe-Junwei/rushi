# Acceptance: 纠错记忆优化（MEM）

> **Plan**：[`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md)  
> **套件**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md)（F2/F6 条目仍适用）

---

## MEM-P0（⑤″f-B）

> **手测**：[`mem-p0-hand-test-checklist.md`](./mem-p0-hand-test-checklist.md) · **机器** `bash scripts/r3-5f-b-machine-gate.sh` ✅ 2026-06-04

- [x] **MEM-P0 简化规则**（[`mem-p0-hand-test-checklist.md`](./mem-p0-hand-test-checklist.md) ✅ 2026-06-04）：纳入记忆 → 自动/手动保存计次 → hit≥3 稳定 + 自动术语表 + F1 写回
- [ ] 学习失败可在 UI 或日志定位（非静默，本轮未强制）

## MEM-P1（⑤″f-B½ · Descript 晋升补全）

- [x] 记忆列表 / 搜索 / 删除 / 批量「采纳为规则」— [`mem-p1-hand-test-checklist.md`](./mem-p1-hand-test-checklist.md) ✅ 2026-06-04
- [x] LEX-MINE-1：有候选时「推荐加入术语表」可采纳/忽略（无候选时区块隐藏；满 3 已由 MEM-P0 自动进表）
- [x] F6 / 热词页文案与 MEM-P0 规则一致
- [ ] （可选）设置「hit≥3 自动进术语表」开关 — 未做（MEM-P0 已默认自动进表）

## MEM-P2（⑤″f-C）

- [ ] 合并/拆分后 1:1 uid 段的手改仍可学习（手测一条）
- [ ] ACC-TXT-0 spike：转写后规则预替换 **有预览**、可取消；`before_text` 未进 hotwords

## MEM-P3 / MEM-S1（P3 / Spike）

- [ ] 同 `before` 异 `after` 冲突有预览（或 F7 导入冲突已覆盖则记 N/A）
- [ ] MEM-S1：预替换仅 high 规则；与 hint 不重复刷屏
