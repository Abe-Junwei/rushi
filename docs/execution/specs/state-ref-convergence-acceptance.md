# 验收：Segment State/Ref 收敛 v2

> **Research brief**：[`state-ref-convergence-research.md`](./state-ref-convergence-research.md)  
> **Plan**：[`state-ref-convergence-plan.md`](./state-ref-convergence-plan.md)

## S2.1 验收项

- [x] 结构 mutation 文件不在 architecture guard 的 `segmentsRef.current = ...` 赋值白名单中。
- [x] 结构 mutation 仍必须通过 `publishSegmentStructureMutation` 发布，避免绕过 draft flush / state-ref 同步入口。
- [x] focused mutation tests、desktop typecheck、architecture guard 通过。

## S2.2a 验收项

- [x] `useSegmentDirtyState` 不再直接接收或读取 `segmentsRef`。
- [x] 当前 segments 读取通过显式 `getCurrentSegmentsSnapshot()` 注入，ref 读留在 `useProjectLifecycleEditorStack` 边界。
- [x] 本轮不改变 dirty 计算语义，也不改 save/undo 行为。
- [x] dirty / close gate / auto-save focused tests、desktop typecheck、architecture guard 通过。

## 后续阶段

- S2.2b：save pipeline 改显式 snapshot。
- S2.3：undo/redo 发布入口化。
- S2.4：state-only 发布与 guard 最终翻转。
