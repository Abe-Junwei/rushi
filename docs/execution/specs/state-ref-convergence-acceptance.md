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

## S2.6 验收项

- [x] `useProjectEditorState` 不再创建、写入或返回 `segmentsRef`。
- [x] `useProjectLifecycleWiring` 不再解构/透传 `segmentsRef`。
- [x] `useProjectLifecycleEditorStack` 在 publish 边界内部维护临时 ref mirror，并继续创建 `SegmentPublishApi`。
- [x] load / refresh 行为保持：打开文件、刷新项目后仍按 uid 恢复选中索引。
- [x] guard：`useProjectEditorState.ts` 禁止 `segmentsRef` 回流。

## S2.7 验收项

- [x] `flushSegmentTextDrafts` / `commitSegmentTextDraftsForStructureMutation` / `publishSegment*` 入参改为 `getCurrentSegmentsSnapshot()` + `setSegments`。
- [x] publish functional updater 基于 React state `prev` 解析，不再基于 `segmentsRef.current`。
- [x] publish functional updater 只解析一次，且 latest snapshot cache 不在 React state updater 内写入。
- [x] focused DOM text 合并改为 `applyFocusedDomTextToSegments()` 返回 next segments，不直接写 ref。
- [x] `segmentDraftStore` / `flushSegmentTextDrafts` tests 对齐 state-only publish 入口。
- [x] guard：`flushSegmentTextDrafts.ts` 禁止直接 `segmentsRef.current =` 写入。

## S2.5c 验收项

- [x] `publishStructureLive` 封装 bounds live drag；mutation controller 不再直接 `setSegments`。
- [x] `flushSegmentTextDrafts` undo 集成测试经 `SegmentPublishApi`。
- [x] guard：`useSegmentMutationController` 禁止 `setSegments(prev => …)` 结构变更。
- [x] S2.5 系列（a/b/c）focused tests + architecture guard 通过。

## S2.5 收口说明

- **已完成**：业务 consumer snapshot 读（S2.5a）、publish API 封装（S2.5b）、mutation live preview 收拢（S2.5c）。
- **后续可选薄片（非 S2.5）**：将 `SegmentPublishApi` 内部 latest snapshot ref 抽象为通用 `useLatestRef`，进一步弱化命名歧义。

## S2.5b 验收项

- [x] `createSegmentPublishApi` 在 editor stack 创建并向下游透传；下游 controller 不再接收 `segmentsRef`。
- [x] save pipeline / restore / find-replace replace-all / stage B writeback / transcribe clear-restore / annotation 改经 `segmentPublish.publish*`。
- [x] `projectLifecycleReturn` 输入移除 `segmentsRef`；lifecycle 对外 API 本就不暴露 ref。
- [x] architecture guard：`segmentPublishConsumerFiles` 禁止 `segmentsRef` 与直接 `publishSegment*Mutation`。
- [x] `segmentPublishApi.test.ts` + save / undo / transcribe / correction / annotation focused tests、architecture guard 通过。

## S2.5a 验收项

- [x] export / correction rules / delete confirm / annotation / auto punctuate / editor inline correct 改经 `getCurrentSegmentsSnapshot()` 读。
- [x] `useProjectSaveController` restore 路径改 snapshot 读；`projectLifecycleReturn` merge 快捷键改 snapshot 读。
- [x] architecture guard 扩展至上述 consumer 文件。
- [x] export / delete confirm / annotation / correction rules focused tests、architecture guard 通过。

## S2.4b 验收项

- [x] find/replace（search + mutations）改经 `getCurrentSegmentsSnapshot()` 读当前语段。
- [x] transcribe execute / local job poll delta 改经 snapshot 读；转写成功 stage sync 改 snapshot。
- [x] stage B（offer + preview + writeback）改经 snapshot 读。
- [x] editor stack 对外导出 `getCurrentSegmentsSnapshot`；wiring 透传至 tools / transcribe。
- [x] architecture guard：上述 consumer 文件禁止 `segmentsRef.current` 读。
- [x] stage B / transcribe local job focused tests、architecture guard 通过。

## S2.4a 验收项

- [x] `publishSegmentStructureMutation` / `publishSegmentTextBulkMutation` 支持 functional updater（基于 publish 时 ref 快照解析）。
- [x] 结构 mutation 模块（merge/insert/split）改经 `getCurrentSegmentsSnapshot()` 读当前语段，不再直接读 `segmentsRef.current`。
- [x] `useSegmentMutationController` 内 text/time/bounds/undo/redo 读改走 `getCurrentSegmentsSnapshot()`；publish 使用 updater 形态。
- [x] architecture guard：结构 mutation 文件禁止 `segmentsRef.current` 读，要求 `getCurrentSegmentsSnapshot()`。
- [x] flush / mutation focused tests、typecheck、architecture guard 通过。
