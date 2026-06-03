# REV-LOC 切片 A 签收（2026-06-03）

> **验收真源**：[rev-loc-undo-edit-history-acceptance.md](./rev-loc-undo-edit-history-acceptance.md) § 切片 A  
> **切片 B**：见 [rev-loc-slice-b-signoff-2026-06.md](./rev-loc-slice-b-signoff-2026-06.md)（✅ 2026-06-02/03 签收）。

## 编码交付

| 项 | 证据 |
|----|------|
| A1 `flushSegmentTextDrafts` → `pushUndoForTextEdit` | `beforeApplyUpdates` in `flushSegmentTextDrafts.ts`；`useSegmentMutationController` 包装层 |
| A-4 纯 draft + flush + undo 测试 | `flushSegmentTextDrafts.test.ts` |
| 保存批次 `text_changes` 非空（支撑历史摘要 B-2） | `segment_cmd.rs` 保存前快照；`segment_cmd_tests::file_save_segments_edit_log_records_text_changes_after_db_update` |
| 可纠错 span 码元对齐（编辑内 F6 高亮） | `findCorrectableSpans.ts` + 测试 |
| `last-workspace` 项目 id | `useProjectCloseGateController.ts` 显式 `workspaceProjectId` |

## 机器验证

```bash
npm run typecheck && npm run test -w @rushi/desktop
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml file_save_segments
```

## 手测（切片 A）

> 步骤真源：[`rev-loc-slice-a-hand-test-checklist.md`](./rev-loc-slice-a-hand-test-checklist.md)

- [x] §1 语段内改字、**不失焦**，等 **「已自动保存」** 后 ⌘Z → 回到保存前正文
- [x] §2 工具栏「撤销」与 ⌘Z 一致
- [x] §3 合并/拆分/删除语段撤销无退化（回归）

## 签收

| 日期 | 范围 | 结论 |
|------|------|------|
| 2026-06-03 | 切片 A 编码 + 手测 §1–§3 | ✅ 已签收（含正文右键菜单修复） |
