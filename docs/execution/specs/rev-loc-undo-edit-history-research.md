# 调研：REV-LOC — 撤销栈对齐 + 编辑历史恢复（单机）

> **状态**：已采纳（2026-05-31）  
> **关联**：[Acceptance](./rev-loc-undo-edit-history-acceptance.md) · [Plan](./rev-loc-undo-edit-history-plan.md)  
> **Backlog**：[`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.3  
> **现状真源**：[`useSegmentUndoRedo.ts`](../../../apps/desktop/src/pages/useSegmentUndoRedo.ts)、[`segment_cmd.rs`](../../../apps/desktop/src-tauri/src/project/segment_cmd.rs)、[`edit_log_detail.rs`](../../../apps/desktop/src-tauri/src/project/edit_log_detail.rs)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | ① 长时间改稿（含自动保存）后 ⌘Z 行为不符合预期；② 编辑历史只能看到 `save_segments` 元数据，无法回到某一保存时的正文。 |
| **本仓现状** | **撤销**：内存栈 40 帧全量 `segments`，`flushSegmentTextDrafts` 不入栈；**历史**：`edit_log` 在 `file_save_segments` 写摘要 + `text_changes`（2026-05 已增强），**无恢复 API/UI**。 |
| **成功标准** | 手测：纯 draft 编辑 + 自动保存后仍可撤销到改前；选一条含正文 diff 的历史记录可恢复语段正文并与列表一致。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 可验证参考 |
|---|------|------|----------|------------|
| A | **操作栈 + 检查点** | VS Code、多数桌面编辑器 | 每次可撤销事务入栈；保存前可选 checkpoint | [VS Code Undo](https://code.visualstudio.com/docs/editor/codebasics#_undo-and-redo) |
| B | **版本历史（里程碑）** | Google Docs、Notion、Descript | 持久化版本列表；选中即恢复整文档/项目快照 | Docs「版本历史」；Descript 项目历史 |
| C | **事件溯源 / revision** | Figma、协作文稿 R8 规划 | `revision_events` 追加式事件，可回放 | 本仓 [`collaboration-storage-schema.md`](../../architecture/collaboration-storage-schema.md) |
| D | **仅诊断日志** | 早期 IDE Local History 文件级 | 按文件时间戳恢复，非操作级 | 与本仓 `edit_log` 接近但缺 blob |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 / 成本 |
|------|--------|----------|-------------|
| A 检查点对齐 flush | **高** | 扩展 `flushSegmentTextDrafts` / `saveSegments` 前 `pushUndoForTextEdit` | 自动保存频繁 → 栈消耗快；需与 1.2s 合并策略一致 |
| B 版本历史 MVP | **中** | 每次 `save_segments` 后存 **file 级 segments 快照** + `edit_log_id` 关联 | 长项目 blob 体积；需保留策略（条数/总 MB） |
| C revision_events | **低** | 协议可借鉴 | 与 R8 重复建设；v1 不做 |
| D 仅增强 detail 文本 | **中** | 已有 `text_changes` | **无法整篇恢复**，仅适合阅读 |

**本仓已有（须扩展，禁止第二套真源）**：

- `useSegmentUndoRedo` — 会话撤销
- `edit_log` + `edit_log_detail` — 保存批次摘要
- `file_save_segments` — 语段真源 SQLite
- `discardEditingSession` / `flush` 包装 — 撤销与草稿协调

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **切片 A（撤销）** | `flushSegmentTextDrafts` 对每个将变更的 `idx` 先 `pushUndoForTextEdit(idx)`，再 `setSegments`；与 `undo` 现有 flush→pop 顺序兼容。 |
| **切片 B（恢复）** | 每次成功 `save_segments` 后写入 **file 级快照**（新表 `edit_log_snapshots` 或等价），`edit_log.id` 外键；UI「恢复此版本」调用 `file_restore_segments_from_edit_log`。 |
| **不做什么** | CRDT/协作 revision、Word Track Changes、逐键 audit、跨项目恢复、无确认的一键覆盖 |
| **与 ADR** | 对齐 P1 放宽口径（撤销=会话；追溯=保存批次）；不引入 R8 `revision_events` |
| **风险** | 快照体积；自动保存过密 → 快照保留条数上限 + UI 合并展示「无 diff 条目」 |

---

## 5. 落位预告

| 层 | 文件（预计） |
|----|----------------|
| Rust | `edit_log_snapshot.rs`、`segment_cmd.rs`（保存后写快照）、`project_query_cmd.rs`（list/restore） |
| TS | `flushSegmentTextDrafts.ts` 或 `useSegmentMutationController.ts`；`useEditorEditHistory.ts`、工具栏恢复确认 |
| 测试 | `useSegmentMutationController.test.ts`、`edit_log_snapshot` Rust test、历史 UI 解析 test |
