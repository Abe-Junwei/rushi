# Intent：语段正文输入路径 P0

> **Research**：[`segment-text-input-p0-research.md`](./segment-text-input-p0-research.md)  
> **Plan**：[`segment-text-input-p0-plan.md`](./segment-text-input-p0-plan.md)  
> **Acceptance**：[`segment-text-input-p0-acceptance.md`](./segment-text-input-p0-acceptance.md)

## 目标

降低语段正文 **连续输入** 时的卡顿与跳闪感，在不改变 **段级 SQLite 真源 / blur 落库 / 自动保存** 语义的前提下：

1. **合并** 草稿 store 的全局通知（避免每键全表副作用）
2. **延迟** 错词/查找替换镜像层更新（输入路径优先）
3. **节流** 页脚字数统计更新
4. **聚焦时** 用户始终看见 textarea 实字（非 `text-transparent`）

## 非目标（P0）

- 未选中行改 `readOnly` textarea（→ P1）
- 换段滚动策略 / 虚拟列表阈值
- 新编辑器栈（ProseMirror / CodeMirror）
- 波形、转写、ASR 侧车

## 成功标准

1. 手测清单 **H1–H5** 通过（见 acceptance）
2. 既有 `segmentDraftStore` / `flushSegmentTextDrafts` / 自动保存单测 **仍绿**
3. `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 通过
