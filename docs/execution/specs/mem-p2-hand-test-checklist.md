# MEM-P2 手测清单（⑤″f-C）

**签收** ✅ 2026-06-04（用户手测通过）

> **Plan**：[`r3t-f-correction-memory-optimization-plan.md`](./r3t-f-correction-memory-optimization-plan.md) §6  
> **Acceptance**：[`r3t-f-correction-memory-optimization-acceptance.md`](./r3t-f-correction-memory-optimization-acceptance.md) § MEM-P2  
> **机器**：`bash scripts/r3-5f-mem-p2-machine-gate.sh`

## 前置

- 已有稳定纠错规则（某对 `wrong→right` 命中 ≥3 或已「采纳为规则」）
- 打开含多语段的录音文件

## 1. 合并后仍可学习

1. 保存当前稿为基线。
2. 合并相邻两段（保留左段 uid）。
3. 在合并段内把手改字（如 `智控`→`制控`），保存。
4. **期望**：纠错记忆中该对 hit 增加（或新写入），非静默失败。

## 2. 拆分后左段可学、新段不误学

1. 保存基线。
2. 在时间轴拆分一段；右半段为新 uid。
3. 仅编辑**左半段**并保存 → **期望**可学习。
4. 仅编辑**右半段**（新段）并保存 → **期望**不因「空 baseline→全文」误写入整段 infer。

## 3. ACC-TXT-0 / F0 阶段 A 入口（2026-06-05 修订）

与 F0 手测 **§2–§3** 重叠；完整步骤见 [`f0-post-transcribe-hand-test-checklist.md`](./f0-post-transcribe-hand-test-checklist.md)。

1. 确保存在可匹配的稳定规则。
2. 对本文件执行转写（覆盖或空稿均可）。
3. 转写落库完成后 **期望** toast 仅汇报用时、语段数、字符数；**不** 自动弹预览。点工具栏 **「规则纠错」** 打开预览（有匹配时）；可取消。
4. 取消后语段正文与转写结果一致；确认写回后仅字面替换，**热词/术语表未**新增 `before_text` 词条。

## 签收

| 项 | 结果 | 日期 |
|----|------|------|
| §1 合并学习 | ✅ | 2026-06-04 |
| §2 拆分学习 | ✅ | 2026-06-04 |
| §3 转写后预检 | ✅ | 2026-06-04 |
