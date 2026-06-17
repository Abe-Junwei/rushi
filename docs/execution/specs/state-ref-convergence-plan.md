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

## S2.5b（本轮）

- 新增 `segmentPublishApi.ts`：editor stack 边界封装 `segmentsRef` 写入；下游 controller 只经 `SegmentPublishApi` 读/写。
- mutation / save / find-replace / correction rules / stage B / transcribe / annotation 移除 `segmentsRef` 与直接 `publishSegment*` 调用。
- `projectLifecycleReturn` 输入移除未使用的 `segmentsRef`；wiring 透传 `segmentPublish`。
- guard：`segmentPublishConsumerFiles` 禁止 `segmentsRef` 与直接 `publishSegment*Mutation`。
- **仍不做** state-only 终态（ref 仍在 editor stack 内由 `createSegmentPublishApi` 持有）。

## S2.5a（已完成）

## S2.4b（已完成）

- find/replace、transcribe execute/local poll、stage B 改 `getCurrentSegmentsSnapshot()` 读。
- editor stack 导出 snapshot getter；guard 扩展至上述 consumer 文件。

## S2.4a（已完成）

- `publishSegmentStructureMutation` / `publishSegmentTextBulkMutation` 支持 functional updater。
- 结构 mutation 模块改 `getCurrentSegmentsSnapshot()` 读；guard 禁止结构文件直接读 `segmentsRef.current`。
- `useSegmentMutationController` mutation 路径统一 snapshot + updater publish。

## 落位

| 层 | 文件 | 改动 |
|----|------|------|
| 守卫 | `scripts/check-architecture-guard.mjs` | 结构 mutation 文件不再允许直接 `segmentsRef.current = ...` |
| UI/controller | `segmentMutationMergeDelete.ts` / `segmentMutationInsert.ts` / `useSegmentSplitController.ts` | 确认只读 `segmentsRef.current` 并经 `publishSegmentStructureMutation` 发布 |
| UI/controller | `useSegmentDirtyState.ts` / `useProjectLifecycleEditorStack.ts` | dirty hook 改为显式 snapshot getter，ref 读留在 editor stack 边界 |
| UI/controller | `projectSavePersistPipeline.ts` / `useProjectSaveController.ts` | save pipeline 当前语段读取改为显式 snapshot getter |
| UI/controller | `useSegmentUndoRedo.ts` / `useSegmentMutationController.ts` | undo/redo snapshot 读取改为显式 snapshot getter，发布入口保持不变 |
| UI/controller | `useSegmentMutationController.ts` | time/bounds commit 改经发布入口同步 state/ref |
| UI/controller | `segmentMutationMergeDelete.ts` / `segmentMutationInsert.ts` / `useSegmentSplitController.ts` | S2.4a：`getCurrentSegmentsSnapshot()` 读 + publish |
| UI/controller | `flushSegmentTextDrafts.ts` | S2.4a：publish 支持 functional updater |
| UI/controller | `useFindReplaceMutations.ts` / `useFindReplaceSearch.ts` | S2.4b：snapshot 读 |
| UI/controller | `usePostTranscribeStageBController.ts` / `usePostTranscribeStageBPreviewRun.ts` | S2.4b：snapshot 读 |
| UI/controller | `useTranscribeJobExecute.ts` / `transcribeLocalJobRun.ts` | S2.4b：snapshot 读 |
| UI/controller | `useProjectLifecycleEditorStack.ts` | 导出 `getCurrentSegmentsSnapshot` |
| UI/controller | `segmentPublishApi.ts` / `useProjectLifecycleEditorStack.ts` | S2.5b：publish API 边界 |
| UI/controller | save / find-replace / transcribe / stage B / correction / annotation | S2.5b：`segmentPublish` 替代 `segmentsRef` + 直接 publish |
| 守卫 | `scripts/check-architecture-guard.mjs` | S2.5b：`segmentPublishConsumerFiles` |
| UI/controller | `useExportController.ts` / `useCorrectionRules*.ts` / `useSegmentDeleteConfirmController.ts` 等 | S2.5a：snapshot 读 |
| 文档 | 本 plan / acceptance | 记录 S2.1–S2.5a |

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
