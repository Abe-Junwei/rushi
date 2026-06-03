# REV-LOC 切片 B 签收（2026-06-03）

> **验收真源**：[rev-loc-undo-edit-history-acceptance.md](./rev-loc-undo-edit-history-acceptance.md) § 切片 B  
> **手测清单**：[rev-loc-slice-b-hand-test-checklist.md](./rev-loc-slice-b-hand-test-checklist.md)

## 编码交付

| 项 | 证据 |
|----|------|
| B1 快照表 + 保存后写入 | `edit_log_snapshots`、`insert_snapshot`；`db.rs` migrate |
| B2 恢复 API | `file_restore_segments_from_edit_log` / `_inner` |
| B3 恢复 UI | `RestoreEditLogConfirmDialog`、`EditorSegmentToolbar`「恢复此版本」、`restoreEditorFromEditLog` |
| B4 历史 `has_snapshot` | `project_list_edit_log` LEFT JOIN |
| 保存前 baseline diff | `load_segment_text_by_uid` + `build_save_segments_edit_detail_from_baseline`（修复事务后读库空 diff） |
| 恢复行可读 diff | `build_restore_from_edit_log_detail` |
| 业内对照 | [rev-loc-undo-edit-history-research.md](./rev-loc-undo-edit-history-research.md) §2.1–§2.4 |

## 机器验证

```bash
npm run typecheck && npm run test -w @rushi/desktop
node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test edit_log
```

## 手测（切片 B）

> 步骤真源：[rev-loc-slice-b-hand-test-checklist.md](./rev-loc-slice-b-hand-test-checklist.md)  
> **须重编桌面端**后再测；旧 `edit_log` 行无 retroactive diff。

- [x] §1 胸襟→胸膺 双次保存 + 恢复第一次
- [x] §2 无快照 / busy 禁用
- [x] §3 恢复后 ⌘Z 栈空、可再编辑撤销

## 签收后补丁（2026-06-02）

| 项 | 说明 |
|----|------|
| 恢复竞态 | `busy` 时跳过 blur / `updateSegmentText`；恢复 `flushSync` + 清草稿 |
| 恢复入口 | `restore_from_edit_log` 带快照行可恢复；保存未 idle / busy 有 toast |
| 撤销 | 全局 ⌘Z 与 `undo`/`redo` 在 `busy` 时 no-op |

## 签收

| 日期 | 范围 | 结论 |
|------|------|------|
| 2026-06-03 | 编码 + 机器回归 | ✅ |
| 2026-06-02 | UI 手测 §1–§3 | ✅ |
