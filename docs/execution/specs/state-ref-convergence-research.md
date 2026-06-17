# 调研：Segment State/Ref 收敛 v2

> **状态**：规划门禁（2026-06-17）  
> **关联进度**：[`full-code-review-remediation-progress-2026-06-16.md`](./full-code-review-remediation-progress-2026-06-16.md) #2  
> **继承调研**：[`project-controller-state-refactor-research.md`](./project-controller-state-refactor-research.md)（2026-06-16 已采纳）  
> **门禁**：本文为 v2 收敛 brief。未完成 plan / acceptance 前，不得把结构 mutation 改为 state-only 或放宽 `check-architecture-guard.mjs` 的 `segmentsRef` 规则。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Editor 中语段拆分、合并、插入、删除、正文草稿、撤销/重做、保存与 Close Gate 必须读到同一份 segment 数据；不能因 React state 延迟提交或 ref 领先而出现脏读、误判已保存、撤销栈错位。 |
| 本仓现状 | `useProjectEditorState.ts` 同时维护 `segments` state 与 `segmentsRef`；`flushSegmentTextDrafts.ts` 的 `publishSegmentStructureMutation()` / `publishSegmentTextBulkMutation()` 先写 ref 再 `flushSync(setSegments)`；`useSegmentDirtyState.ts`、undo/redo、save pipeline 仍从 `segmentsRef.current` 读。当前 architecture guard 还要求结构 mutation 读取 `segmentsRef.current`，禁止在结构 mutation 文件中直接 `setSegments(prev => ...)`。 |
| 成功标准 | v2 分阶段减少 `segmentsRef.current` 业务读写：结构 mutation 仍单入口；dirty / undo / save 有 focused tests；最终 guard 从“要求读 ref”转为“禁止非发布入口写 ref”。 |

---

## 2. 业内成熟路线（>=2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | React state 单一真源 + controlled mutation | React `useState` functional updater / `useReducer` | 所有结构变更通过 reducer/updater 基于 `prev` 计算 next；ref 只缓存最新提交值给异步闭包读取 | https://react.dev/reference/react/useState |
| B | 外部 store 单一真源 | Zustand / Jotai / 本仓 `createModuleStore` | segment list 迁入模块 store，React 订阅派生视图；mutation action 由 store 串行化 | 本仓 env / LLM store 模式 |
| C | 当前过渡态：React state + ref mirror | Rushi v1.1 已采纳方案 | ref 可在同步编辑/DOM draft flush 中领先 state；发布函数统一同步 ref 与 state | `flushSegmentTextDrafts.ts` / `segmentSegmentsRefSync.ts` |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A state 单一真源 | 中 | `publishSegmentStructureMutation` 可演进为受控 updater；现有 mutation controller 测试可复用 | 与当前 guard 和 `flushSync` ref-leading 假设冲突；需重写 dirty / undo / save 的读取时机 | 不增加内存；但 regression 面覆盖 Editor 核心链路 |
| B external store | 中低 | `createModuleStore` 模式可参考 | 会引入第二层 store 真源，影响 20+ consumer；与既有 flat controller API 冲突 | 初期改动大，调试成本高 |
| C 过渡态收敛 | 高 | 当前 `publishSegment*`、`commitSegmentTextDraftsForStructureMutation`、`segmentDraftStore`、guard | 只能降低风险，不能根除双轨；若长期停留会继续产生歧义 | 最适合分薄片推进 |

**本仓已有可复用模块**：

- `apps/desktop/src/pages/flushSegmentTextDrafts.ts`：草稿物化与 segment 发布入口。
- `apps/desktop/src/pages/segmentSegmentsRefSync.ts`：state/ref reconcile 过渡逻辑。
- `apps/desktop/src/pages/useSegmentDirtyState.ts`：Close Gate dirty 计算入口。
- `apps/desktop/src/pages/useSegmentUndoRedo.ts`：撤销/重做 snapshot 入口。
- `scripts/check-architecture-guard.mjs`：当前保护 ref-leading 过渡态的结构守卫。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **C -> A 分阶段收敛**。不一次性迁 external store；先保留 `publishSegment*` 作为唯一发布入口，减少散落的 ref 写入；再让 dirty / undo / save 从“显式传入的当前 segments”或发布后的 snapshot 派生；最后把结构 mutation 改成 updater 形态并调整 guard。 |
| 不做什么 | 不在一个 PR 把 `segmentsRef` 从 public controller API 移除；不把 segment list 迁入 Zustand；不保留两套 mutation 真源。 |
| 与 ADR / architecture 关系 | 承接 `project-controller-state-refactor-research.md` 的 v1 结论；保持 Editor 编排层分离，不把脏检查/撤销/save 逻辑回塞 Orchestrator；继续复用 `segmentDraftStore`，但禁止它成为 segment 结构真源。 |
| 风险与 spike 项 | 最大风险是正文 draft flush 与结构 mutation 的同步顺序。需要先用 tests 锁住：编辑 textarea 未 blur -> split/merge -> save -> close gate；undo/redo 后 dirty；转写失败 restore。 |

---

## 5. 建议实施阶段

| 阶段 | 目标 | 落位 | 验证 |
|------|------|------|------|
| S2.1 | 收敛写入口 | 仅允许 `flushSegmentTextDrafts.ts` / editor load-refresh 写 `segmentsRef.current`；结构 mutation 文件改为返回 next，由发布入口写 ref/state | architecture guard 从 allowlist 转为发布入口白名单；mutation controller tests |
| S2.2 | Dirty / save 改为显式 snapshot | `useSegmentDirtyState` 接收 `segments` 或 `getCurrentSegmentsSnapshot`；save pipeline 不直接依赖散落 ref | close gate / autosave focused tests |
| S2.3 | Undo/redo state updater 化 | `useSegmentUndoRedo` 接收发布函数；push/pop 不直接改 ref | undo/redo + draft text tests |
| S2.4 | state-only 发布 | `publishSegmentStructureMutation` 支持 functional updater；ref 只在 layout/effect 或 async closure 缓存最新 state | guard 改为禁止业务逻辑写 ref；typecheck + test + architecture guard |

---

## 6. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI/controller | `apps/desktop/src/pages/useSegmentMutationController.ts` | 继续作为 mutation 路由；逐步减少直接 `segmentsRef.current` 读写 |
| UI/controller | `apps/desktop/src/pages/segmentMutationMergeDelete.ts` / `segmentMutationInsert.ts` / `useSegmentSplitController.ts` | 先返回 next，再由发布入口提交 |
| UI/service | `apps/desktop/src/pages/flushSegmentTextDrafts.ts` | 成为唯一 segment 发布与 draft flush 入口 |
| UI/controller | `apps/desktop/src/pages/useSegmentDirtyState.ts` / `useSegmentUndoRedo.ts` / `useProjectSaveController.ts` | 改为显式 snapshot / publish API |
| 守卫 | `scripts/check-architecture-guard.mjs` | 分阶段调整 `segmentsRef` 规则 |
| 测试 | `apps/desktop/src/pages/*segment*.test.ts(x)` | 补结构 mutation、dirty、undo/redo、save/close gate focused tests |

---

## 7. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-17 | 初版：定义 State/Ref v2 收敛路线，承接已采纳 v1 过渡方案 |
