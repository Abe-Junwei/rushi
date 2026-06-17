# 计划：Segment State/Ref 收敛 v2

> **Research brief**：[`state-ref-convergence-research.md`](./state-ref-convergence-research.md)  
> **Acceptance**：[`state-ref-convergence-acceptance.md`](./state-ref-convergence-acceptance.md)

## 范围

本轮执行 S2.1、S2.2，并推进 S2.3 的保守子步：

- S2.1：收紧结构 mutation 的 ref 写入边界。
- S2.2a：`useSegmentDirtyState` 不再直接接收 `segmentsRef`，改为接收显式 `getCurrentSegmentsSnapshot()`；当前调用点仍从 editor stack 边界读取 `segmentsRef.current`，因此 dirty 计算语义不变。
- S2.2b：`runProjectSavePersistPipeline` 保存前后的当前语段读取改走显式 `getCurrentSegmentsSnapshot()`；`segmentsRef` 仍仅用于发布同步。
- S2.3a：`useSegmentUndoRedo` 的 undo/redo snapshot 读取改走显式 `getCurrentSegmentsSnapshot()`；发布仍经 `publishSegmentTextBulkMutation`。
- S2.3b：`updateSegmentTime` 与 `updateSegmentBounds` commit 阶段经发布入口同步 state/ref；live drag 阶段保留轻量 state 更新。

state-only 发布仍不在本轮内，避免一次性触碰 Editor 核心链路。

## 落位

| 层 | 文件 | 改动 |
|----|------|------|
| 守卫 | `scripts/check-architecture-guard.mjs` | 结构 mutation 文件不再允许直接 `segmentsRef.current = ...` |
| UI/controller | `segmentMutationMergeDelete.ts` / `segmentMutationInsert.ts` / `useSegmentSplitController.ts` | 确认只读 `segmentsRef.current` 并经 `publishSegmentStructureMutation` 发布 |
| UI/controller | `useSegmentDirtyState.ts` / `useProjectLifecycleEditorStack.ts` | dirty hook 改为显式 snapshot getter，ref 读留在 editor stack 边界 |
| UI/controller | `projectSavePersistPipeline.ts` / `useProjectSaveController.ts` | save pipeline 当前语段读取改为显式 snapshot getter |
| UI/controller | `useSegmentUndoRedo.ts` / `useSegmentMutationController.ts` | undo/redo snapshot 读取改为显式 snapshot getter，发布入口保持不变 |
| UI/controller | `useSegmentMutationController.ts` | time/bounds commit 改经发布入口同步 state/ref |
| 文档 | 本 plan / acceptance | 记录本轮完成 S2.1、S2.2、S2.3a，不改 state-only 发布 |

## 不做

- 不把结构 mutation 改为 functional updater。
- 不移除 `segmentsRef` 对外 API。

## 验证

```bash
npm run test -- useSegmentMutationController
npm run test -- useSegmentDirtyState useProjectCloseGateController useAutoSaveSegments
npm run test -- projectSavePersistPipeline
npm run test -- useSegmentUndoRedo flushSegmentTextDrafts useSegmentMutationController
npm run test -- useSegmentMutationController useSegmentUndoRedo flushSegmentTextDrafts projectSavePersistPipeline useSegmentDirtyState useProjectCloseGateController useAutoSaveSegments
npm run typecheck
node scripts/check-architecture-guard.mjs
```
