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

S2.7 进入 publish / flush state-driven：写入经 React state setter；仍保留 publish 边界的 latest snapshot ref 作为同步事件与 async 闭包读缓存。

## S2.7（本轮）

- `flushSegmentTextDrafts.ts` 的 flush / commit / publish 函数改为接收 `getCurrentSegmentsSnapshot()` + `setSegments`。
- publish functional updater 基于 React state `prev` 解析，不再基于 `segmentsRef.current`。
- publish functional updater 仅在 React setter 内解析一次；`SegmentPublishApi` 在 setter 返回后同步 latest snapshot cache，不在 React updater 内写 ref。
- `applyFocusedDomTextToSegments()` 替代直接写 ref 的 `syncFocusedDomTextIntoSegments()`。
- `SegmentPublishApi` 仍持有 editor stack 内临时 snapshot ref 用于读取最新 state；live preview 不同步 snapshot cache，commit publish 才同步。
- guard 升级：`flushSegmentTextDrafts.ts` 禁止 `segmentsRef.current =` 写入；production 只允许 ref sync / publish boundary 持有 snapshot ref。

## S2.6（本轮）

- `useProjectEditorState` 不再创建或对外返回 `segmentsRef`；editor state 只负责 `segments` React state、load/refresh、选中索引与音频路径。
- `useProjectLifecycleWiring` 不再解构/透传 `segmentsRef`。
- `useProjectLifecycleEditorStack` 在 publish 边界内部维护临时 ref mirror，并创建 `SegmentPublishApi`。
- guard 增加防回归：`useProjectEditorState.ts` 禁止重新引用 `segmentsRef`。
- **仍不做**移除 latest snapshot ref；`SegmentPublishApi` 内部继续缓存最新 state，避免同事件连续 mutation 读到旧快照。

## S2.5c（收尾）

- `SegmentPublishApi.publishStructureLive`：bounds live drag 仅更新 React state，commit 仍经 `publishStructure`。
- `useSegmentMutationController` 移除 `setSegments` 依赖；guard 禁止 mutation controller 直接 `setSegments(prev => …)`。
- `flushSegmentTextDrafts` undo 集成测试对齐 publish API。
- **S2.5 系列至此收口**；`useProjectEditorState` 内 ref mirror 与全量 state-only 发布留后续薄片（非 S2.5 范围）。

## S2.5b（已完成）

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
| UI/controller | `useProjectEditorState.ts` / `useProjectLifecycleWiring.ts` / `useProjectLifecycleEditorStack.ts` | S2.6：editor state 去 `segmentsRef` API |
| UI/controller | save / find-replace / transcribe / stage B / correction / annotation | S2.5b：`segmentPublish` 替代 `segmentsRef` + 直接 publish |
| 守卫 | `scripts/check-architecture-guard.mjs` | S2.5b：`segmentPublishConsumerFiles` |
| UI/controller | `useExportController.ts` / `useCorrectionRules*.ts` / `useSegmentDeleteConfirmController.ts` 等 | S2.5a：snapshot 读 |
| 文档 | 本 plan / acceptance | 记录 S2.1–S2.5a |

## 不做

- 不把结构 mutation 改为 functional updater。
- 不在 S2.7 内移除 `SegmentPublishApi` 内部 latest snapshot ref。

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
