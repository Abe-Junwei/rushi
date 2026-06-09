# 桌面端：项目 / 文件生命周期与 Close Gate

> 状态：2026-06-08（Round 1–5 + Phase 6 签收 ✅ + Phase 10 项目 Hub 元信息 ✅ · [`project-hub-metadata-acceptance.md`](../execution/specs/project-hub-metadata-acceptance.md)）

## 状态机（摘要）

```text
Welcome → 打开/创建项目 → EmptyProject | FileHub → openFile → Editor
Editor → closeFile → FileHub
FileHub / Editor → closeProject → Welcome
```

- **项目**：`current: ProjectDetail`（SQLite `projects` + `files` 列表）
- **文件**：`currentFileId` + 内存 `segments[]`；持久化经 `file_save_segments`
- **脏检测**：`useSegmentDirtyState` snapshot + textarea draft；驱动 Close Gate 与自动保存

## Close Gate 矩阵

| 动作 | 未保存语段 | 转写中 | 行为 |
|------|------------|--------|------|
| 关窗 | 是 | 否 | `UnsavedCloseDialog` |
| 关窗 | 否 | 是 | `TranscribeNavBlockDialog`（`shouldBlockClose` 含转写 busy） |
| 关窗 | 是 | 是 | 转写闸门优先；停止后链式未保存闸门 |
| `closeFile` | 是 | — | `UnsavedCloseDialog`（navigate） |
| `closeProject` / 换项目 | 是 | — | 同上 |
| `openFile`（换文件） | 是 | — | 同上 |
| 转写中离开 | — | 是 | `TranscribeNavBlockDialog` → 停止并离开（再经未保存闸门）/ 继续转写 |

对话框真源：`UnsavedCloseDialog`、`TranscribeNavBlockDialog`（禁止 `window.confirm`）。

## 同项目 reload

- **`loadProject(sameId)` + 有未保存修改**：仅 `applyDetail` 刷新 files 列表，**不重载**当前 file 语段。
- **`loadProject(sameId)` + Hub（`currentFileId === null`）**：仅刷新项目/文件列表，**不**自动 `openFile`。
- **`loadProjectAfterImport`**：导入完成后专用；刷新列表并打开**最新**文件（经 `openFileWrapped`，含未保存/转写闸门）。
- **`refreshProjectHub`**：Hub 删/改名后专用；只刷新列表，**不** `openFile`。

## 重复导入

> 调研：[`project-import-dedupe-remediation-research.md`](../execution/specs/project-import-dedupe-remediation-research.md)

- 检测：源路径 canonical + 内容 SHA-256；legacy 文本用语段 canonical fingerprint；已有 provenance 的行不再对 `audio_path` 全量 re-hash
- 持久化：`import_source_size` / `import_source_modified_ms`（迁移 + 启动 backfill）
- UI：`DuplicateImportConfirmDialog`（`modal` 层）— 取消 / 打开已有 / 仍要导入
- 入口：`pickAndImportFileToProject`、`importFileToProject`（空项目、Hub、工具栏、拖放）

## 对话框叠层

| 层 | z-index | 组件 |
|----|---------|------|
| overlay | 100 | 删语段等 |
| modal | 110 | 重复导入、删项目文件 |
| gate | 120 | 未保存、转写拦截 |

真源：`apps/desktop/src/config/dialogStack.ts`（**完整字面量** `z-[n]`，禁止模板拼接）+ `DialogOverlay`（`createPortal` → `document.body`）

## 文件 Hub CRUD

- 重命名：inline 编辑 → `rename_file`（事务）
- 删除：`DeleteProjectFileConfirmDialog` → `delete_file`（事务 + 清理音频副本）
- 控制器：`useProjectFileMutationController`

## 项目 Hub CRUD 与元信息（Phase 10）

| 动作 | 入口 | 行为 |
|------|------|------|
| 编辑 → 文件 Hub | 顶栏「文件」、面包屑项目名、`⌘⇧E` | `closeFile`（经 Close Gate）→ `currentFileId === null` |
| 项目信息 | Hub header | `ProjectMetadataDialog` → `update_project_metadata` → `refreshProjectHub` |
| 重命名项目 | Hub header inline | `rename_project`；重名软提示，可继续 |
| 删除项目 | Hub header / Welcome 侧栏 | `DeleteProjectConfirmDialog` → `delete_project`；删当前项目 → Welcome |
| 创建项目 | Welcome / 侧栏 | `CreateProjectModal`；重名软提示；成功后可选填元信息 |

- 控制器：`useProjectMutationController`
- Rust：`project_metadata_cmd.rs`（`rename_project`、`update_project_metadata`）
- DB：`projects` 表 P0 五列（`narrator`、`recorded_at`、`location`、`subject`、`transcriber`）
- DOCX 导出：封面抬头读取上述字段（见 `buildDocxExportMetaLine`）

## 未保存可见性

- 编辑器面包屑：saffron ●（`hasUnsavedFileEdits`）
- 底栏：`autoSaveFooterStatus`（pending / saving / saved）

## 相关代码

| 模块 | 路径 |
|------|------|
| Close Gate | `apps/desktop/src/pages/useProjectCloseGateController.ts` |
| 脏检测 | `apps/desktop/src/pages/useSegmentDirtyState.ts` |
| 导入去重 | `apps/desktop/src/pages/useProjectImportDuplicateController.ts` |
| Hub 变更 | `apps/desktop/src/pages/useProjectFileMutationController.ts` |
| 项目 CRUD / 元信息 | `apps/desktop/src/pages/useProjectMutationController.ts` |
| Rust 去重 | `apps/desktop/src-tauri/src/project/import_duplicate.rs` |
