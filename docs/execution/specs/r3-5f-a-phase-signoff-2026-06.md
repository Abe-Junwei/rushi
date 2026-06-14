# ⑤″f-A 签收追踪（词表与改稿 · 阶段 A）

> **真源顺序**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md) §5  
> **2026-06-04 口径**：**R3t-E 词表校对已从产品移除**；阶段 A 以 **F2 手测** 闭合。

| 子项 | 状态 | 证据 |
|------|------|------|
| **R3t-E** | ❌ 已移除 | 产品决策 2026-06；见 [`archive/r3t-e/r3t-e-hand-test-checklist.md`](./archive/r3t-e/r3t-e-hand-test-checklist.md) |
| **VOC-1** | ✅ | [`asr-voc-1-hand-test-checklist.md`](./asr-voc-1-hand-test-checklist.md) 2026-06-02 |
| **VOC-5 eval baseline** | ✅ | [`asr-voc-5-hand-test-checklist.md`](./asr-voc-5-hand-test-checklist.md) 2026-06-03 |
| **F2 编码** | ✅ | `useFindReplaceController` + `FindReplaceDialog` |
| **F2 机器闸门** | ✅ | `segmentFindReplace.test.ts` |
| **F2 手测** | ✅ | [`f2-hand-test-checklist.md`](./f2-hand-test-checklist.md) 2026-06-04 |

## 阶段 A 闭合条件

```text
VOC-1 ✅  AND  VOC-5 ✅  AND  F2 手测 ✅
（R3t-E 不再挡签收）
→ ⑤″f-A 签收 ✅ → 开 ⑤″f-B（F1 + F6 + MEM-P0）
```

## 机器闸门（2026-06-04）

```bash
bash scripts/r3-5f-a-machine-gate.sh
```

| 项 | 结果 |
|----|------|
| typecheck | ✅ |
| vitest（findReplace） | ✅ |
| cargo `lexicon_pack` | ✅（F7 词表包，非 R3t-E） |
| architecture-guard | ✅ |

## 日志

```text
改动：F2 UI 手测签收
验证：docs/execution/specs/f2-hand-test-checklist.md 全绿
下一轮：⑤″f-B ✅（2026-06-04）→ B½ 或 F7
```
