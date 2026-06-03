# Acceptance: REV-LOC — 撤销栈对齐 + 编辑历史恢复 MVP

> **状态**：切片 **A** ✅ 手测（2026-06-03）· 切片 **B** ✅ 编码 + 机器 + UI 手测（2026-06-02）· 路线图 **Q-REV-1** 闭环  
> **调研**：[rev-loc-undo-edit-history-research.md](./rev-loc-undo-edit-history-research.md)  
> **Plan**：[rev-loc-undo-edit-history-plan.md](./rev-loc-undo-edit-history-plan.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)  
> **Backlog**：[`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.3  
> **依赖**：`file_save_segments`、`edit_log` + `text_changes` 摘要（已落地）

---

## 目标

1. **会话内撤销**与**自动保存 / 草稿 flush**语义一致，避免「改了但栈里没有检查点」。  
2. **编辑历史**在可读摘要之外，支持将**当前文件语段正文**恢复到**某一历史保存点**（单机、非协作）。

---

## 范围

### 做

| # | 切片 | 交付 |
|---|------|------|
| A1 | 撤销对齐 | `flushSegmentTextDrafts` 在写回 `segments` 前，对每个将变更语段调用 `pushUndoForTextEdit(idx)` |
| A2 | 撤销对齐 | 行为与现有 `undo`（先 flush → pop → `discardEditingSession`）兼容；扩充分支测试 |
| B1 | 快照持久化 | 每次成功 `save_segments` 后，关联 `edit_log.id` 存储该 file 的 segments 快照（可恢复） |
| B2 | 恢复 API | Tauri 命令：按 `edit_log_id` 将快照写回 segments 表；写一条 `restore_from_edit_log` 审计行 |
| B3 | 恢复 UI | 编辑历史列表：对含快照的 `save_segments` 显示「恢复此版本」；确认后刷新编辑器并清空撤销栈 |
| B4 | 历史展示 | 保留现有 `summary` / `text_changes`；无快照的旧记录不显示恢复按钮 |

### 不做

- 协作 `revision_events`、CRDT、多用户合并  
- Word Track Changes / 导出修订气泡  
- 逐键 / 逐次拖边界的 `edit_log` 行（仍仅保存批次）  
- 跨文件 / 跨项目恢复  
- 无确认框的静默恢复  
- 恢复后自动保留「撤销到恢复前」的无限栈（恢复前单次 `pushUndo` 即可）

---

## 能力—UI 状态矩阵

| 能力 | UI 表面 | 不可用时的表现 |
|------|---------|----------------|
| 会话撤销 | 工具栏撤销 / 重做；语段内 ⌘Z | 栈空时按钮仍可见但无效果（保持现状） |
| 保存批次追溯 | 编辑历史下拉；摘要 + 子行 diff | 无记录时「暂无记录」 |
| 版本恢复 | 条目内「恢复此版本」 | 旧 log / 无快照 / `import_project_bundle` 等无按钮 |
| 恢复确认 | `compactDialog` 二次确认 | busy 时禁用 |

---

## 验收标准

### 切片 A — 撤销栈

- [x] **A-1** 选中语段改正文（**不失焦**），等待「已自动保存」后 ⌘Z：正文回到自动保存前（手测 2026-06-03）
- [x] **A-2** 工具栏「撤销」与 ⌘Z 结果一致（手测 2026-06-03）
- [x] **A-3** 结构操作撤销无退化（手测 2026-06-03）
- [x] **A-4** `flushSegmentTextDrafts.test.ts` + `useSegmentMutationController.test.ts` undo 用例 CI 通过

### 切片 B — 编辑历史恢复

- [x] **B-1** 改至少 2 处语段正文并触发保存后，`edit_log` 对应行存在可查询快照（`segment_cmd_tests::file_save_segments_edit_log_*` + `edit_log_snapshot` roundtrip）
- [x] **B-2** 编辑历史主行仍显示人类可读摘要（含 `胸襟→胸膺` 类 diff，若适用）（手测 2026-06-02）
- [x] **B-3** 对含快照条目点击「恢复此版本」→ 确认 → 列表与编辑器正文与**该保存点之后**状态一致（以快照为准）（手测 2026-06-02）
- [x] **B-4** 恢复后产生新 `edit_log`（`restore_from_edit_log` 或等价 kind），detail 含 `source_edit_log_id`（`file_restore_segments_from_edit_log_replaces_text_and_audits`）
- [x] **B-5** 恢复后撤销栈已清空；再改字可重新入栈（不崩溃）（手测 2026-06-02）
- [x] **B-6** 无快照条目（升级前历史 / 无正文变更的纯保存）不展示恢复按钮，不误点报错（手测 2026-06-02）
- [x] **B-7** busy（转写/保存中）时恢复入口 disabled（手测 2026-06-02）

### 机器守卫

- [x] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（2026-06-03；vitest 全绿，偶有 `useTierScrollLayout` teardown 告警）
- [x] `cargo test edit_log` 5 项（snapshot / text_changes baseline / restore audit）

---

## 手测场景（3 组）

### 1. 自动保存 + 撤销（切片 A）

1. 打开项目，选中语段，记住原句。  
2. 改字但**不点击其他语段**（保持聚焦），等底部/自动保存完成。  
3. ⌘Z → 正文应恢复步骤 1。  
4. ⇧⌘Z → 应回到步骤 2 修改后。

### 2. 历史恢复（切片 B）

1. 将某语段「胸襟」改为「胸膺」，触发保存。  
2. 再改另一句，再保存。  
3. 打开编辑历史，在**第一次保存**条目点「恢复此版本」并确认。  
4. 全文应回到第一次保存后状态（含「胸膺」、不含第二句修改）。

### 3. 误操作防护

1. 对无 `text_changes` 的「保存语段（177 条）」类条目：无恢复按钮。  
2. 转写进行中：恢复按钮不可用。

---

## 规划落位（实施时）

| 层 | 文件 |
|----|------|
| TS | `flushSegmentTextDrafts.ts`、`useSegmentMutationController.ts`、`useEditorEditHistory.ts`、`EditorSegmentToolbar.tsx`、`projectApi.ts` |
| Rust | `db.rs` migrate、`edit_log_snapshot.rs`、`segment_cmd.rs`、`project_query_cmd.rs`、`lib.rs` 注册命令 |
| 测试 | `useSegmentMutationController.test.ts`、`useEditorEditHistory.test.ts`、`segment_cmd` / snapshot tests |

---

## 与路线图关系

- 满足 [`personal-solo-v1-backlog.md`](./personal-solo-v1-backlog.md) §3.3「改 3 句 → 可从列表恢复某一保存点」  
- **不替代** P1 口径：逐键审计仍不要求；恢复粒度为 **保存批次快照**  
- 为 **EXP-WORD-4**（修订摘要附录）预留 `edit_log` + 快照元数据，但本切片不做 Word 导出
