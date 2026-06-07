# Intent：语段编辑阶段视觉提示（四态 + 定稿）

> **Research**：[`segment-edit-stage-indicator-research.md`](./segment-edit-stage-indicator-research.md)  
> **Plan**：[`segment-edit-stage-indicator-plan.md`](./segment-edit-stage-indicator-plan.md)  
> **Acceptance**：[`segment-edit-stage-indicator-acceptance.md`](./segment-edit-stage-indicator-acceptance.md)

## 目标

用户在语段行 **右侧** 看到四态 badge（自动转写 / AI改稿 / 手动转写 / 定稿），并可通过 **⌘Enter** 或 **右键「标记定稿」** 将任意非定稿段设为定稿。

## 非目标

- 四态任意手动下拉、批量改 stage、撤销定稿、底栏统计（P2）
- 波形 overlay 重复展示 stage

## 成功标准

见 acceptance 手测清单 + `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
