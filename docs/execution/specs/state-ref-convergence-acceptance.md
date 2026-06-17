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

## S2.2b 验收项

- [x] `runProjectSavePersistPipeline` 保存前后的当前语段读取通过显式 `getCurrentSegmentsSnapshot()` 注入。
- [x] `segmentsRef` 在 save pipeline 中仍只作为发布同步入口，不作为业务读取真源。
- [x] 保存行为不变：保存前仍 flush draft，保存后仍按后端返回对齐 state/ref/selected index。
- [x] save pipeline focused tests、desktop typecheck、architecture guard 通过。

## S2.3a 验收项

- [x] `useSegmentUndoRedo` 的 undo/redo snapshot 读取通过显式 `getCurrentSegmentsSnapshot()` 注入。
- [x] undo/redo 发布仍经 `publishSegmentTextBulkMutation`，不绕过 draft / DOM 同步入口。
- [x] mutation controller 现有 undo/redo 行为不变。
- [x] undo / draft flush / mutation focused tests 通过。

## S2.3b 验收项

- [x] `updateSegmentTime` 不再只调用 `setSegments(prev => ...)`；提交后同步 state 与 `segmentsRef`。
- [x] `updateSegmentBounds` 的 commit 阶段经 `publishSegmentStructureMutation` 发布；live drag 阶段保留轻量 state 更新。
- [x] mutation focused tests 覆盖 `updateSegmentTime` 后 `segmentsRef` 同步。
- [x] combined state/ref focused tests、desktop typecheck、architecture guard 通过。

## 后续阶段

- S2.4：state-only 发布与 guard 最终翻转。
