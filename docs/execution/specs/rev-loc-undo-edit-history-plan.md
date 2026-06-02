# Plan: REV-LOC — 撤销栈对齐 + 编辑历史恢复 MVP

> **状态**：📋 规格已定 · **编码后置**（路线图 **Q-REV-1**）  
> **调研**：[rev-loc-undo-edit-history-research.md](./rev-loc-undo-edit-history-research.md)  
> **验收**：[rev-loc-undo-edit-history-acceptance.md](./rev-loc-undo-edit-history-acceptance.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤‴½**

---

## 1. 切片与顺序

| 序 | 切片 | 依赖 |
|----|------|------|
| **A** | 撤销栈与 `flushSegmentTextDrafts` / 自动保存对齐 | 无 |
| **B1** | Rust：保存后写 `edit_log_snapshots` + `file_restore_segments_from_edit_log` | `edit_log` 已有 |
| **B2** | UI：历史条目「恢复此版本」+ 确认对话框 | B1 |

建议 **先 A 后 B**；A 可独立上线。

---

## 2. 切片 A — 实现要点

1. 在 [`flushSegmentTextDrafts.ts`](../../../apps/desktop/src/pages/flushSegmentTextDrafts.ts) 或 `useSegmentMutationController.flushSegmentTextDrafts` 包装层：
   - 收集 `updates: { idx, text }[]` 后，对每个 `idx` 调用 `pushUndoForTextEdit(idx)`（在 `setSegments` **之前**）。
2. 保持 [`useSegmentUndoRedo.ts`](../../../apps/desktop/src/pages/useSegmentUndoRedo.ts) 1.2s 同语段合并逻辑不变。
3. 测试：纯 draft、无 blur → `flush` → `undo` 恢复改前正文（扩展现有 draft+undo 用例）。

**验证**：`npm run test -- useSegmentMutationController.test.ts`

---

## 3. 切片 B — 实现要点

### 3.1 存储

- 新表（示例）：

```sql
CREATE TABLE edit_log_snapshots (
  edit_log_id INTEGER PRIMARY KEY,
  file_id TEXT NOT NULL,
  segments_json TEXT NOT NULL,  -- 规范化后 SegmentDto[] JSON
  segment_count INTEGER NOT NULL,
  FOREIGN KEY (edit_log_id) REFERENCES edit_log(id) ON DELETE CASCADE
);
```

- `file_save_segments` 事务提交、`edit_log` INSERT 成功后：写入当前 file 全部 segments 快照。
- 保留策略：**每 file 最近 30 条** 或 **总大小上限**（实施时二选一，写入 plan 注释）。

### 3.2 恢复 API

- `file_restore_segments_from_edit_log(file_id, edit_log_id)`：
  - 校验 `edit_log.project_id` 与 file 所属 project 一致；
  - 读快照 → 替换该 file 下 segments（复用 `file_save_segments_inner` 或专用 replace）；
  - **新写一条** `edit_log`（`kind: restore_from_edit_log`，detail 含 `source_edit_log_id`）；
  - `pushUndo` 由前端在恢复前调用（或命令内不碰撤销栈，由 UI 显式 `pushUndo`）。

### 3.3 UI

- [`useEditorEditHistory.ts`](../../../apps/desktop/src/components/editor/useEditorEditHistory.ts)：条目含 `has_snapshot`（或根据 `kind===save_segments` + 查询）。
- [`EditorSegmentToolbar.tsx`](../../../apps/desktop/src/components/editor/EditorSegmentToolbar.tsx)：按钮「恢复此版本」→ `compactDialog` 确认 → invoke 恢复 → `loadFile` 刷新 → `resetMutationHistory` + `discardEditingSession`。

**验证**：Rust integration test + 手测 acceptance §手测

---

## 4. 机器守卫

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test edit_log_snapshot
```

---

## 5. 文档

- 更新 [`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.3 验收链接  
- [`docs/execution/acceptance.md`](../../execution/acceptance.md) 补充「恢复点」一句（可选）
