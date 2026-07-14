# Intent：语段冻结（Freeze）

> **Research**：[segment-freeze-research.md](./segment-freeze-research.md)（已采纳 · 2026-07-14）  
> **Plan**：[segment-freeze-plan.md](./segment-freeze-plan.md) · **Acceptance**：[segment-freeze-acceptance.md](./segment-freeze-acceptance.md)

## 用户意图

审校时把暂不处理的语段 **冻结**：保留分段与正文，全局通读 **跳过**，正文 **不可改**，波形/文本有 **斜纹** 提示；需要时解冻恢复。浮层仍可试听冻结段。交付导出 **不含** 冻结语段。

## 非目标

- 词级 Ignore、裁切音频、Mute（时钟仍走）
- 复用 `kind` / `detail` / `text_stage`
- 协作锁、导出「可选包含冻结」开关

## 成功一句话

冻结后听通读自动跳过、斜纹可见、改不了字；解冻后一切恢复；导出文件无冻结行。
