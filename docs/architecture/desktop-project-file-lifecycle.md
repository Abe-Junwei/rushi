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
- **`loadProjectAfterImport`**：导入完成后专用；刷新列表并打开目标文件（经 `openFileWrapped`，含未保存/转写闸门）。默认打开 `preferFileId`（Attach 导入传入）；未指定时打开 `updated_at_ms` 最新文件。
- **`refreshProjectHub`**：Hub 删/改名后专用；只刷新列表，**不** `openFile`。

## 重复导入

> 调研：[`project-import-dedupe-remediation-research.md`](../execution/specs/project-import-dedupe-remediation-research.md)

- 检测：源路径 canonical + 内容 SHA-256；legacy 文本用语段 canonical fingerprint；已有 provenance 的行不再对 `audio_path` 全量 re-hash
- 持久化：`import_source_size` / `import_source_modified_ms`（迁移 + 启动 backfill）
- UI：`DuplicateImportConfirmDialog`（`modal` 层）— 取消 / 打开已有 / 仍要导入
- 入口：`pickAndImportFileToProject`、`importFileToProject`（空项目、Hub、工具栏、拖放）

## Attach 字幕导入（Replace）

> Spec：[`audio-subtitle-attach-import-intent.md`](../execution/specs/audio-subtitle-attach-import-intent.md)

- **Editor**（`currentFileId` 存在）：`import_transcript_to_project` 带 `target_file_id` → 整轨 **Replace** 语段；保留 `audio_path` 与**音频** import provenance；跳过重复导入检测（R1）；未保存时经 Close Gate（G1）；转写中禁用（T2）。
- **Hub**（无当前文件）：按字幕 stem 匹配 `paired`/`audio_only` 文件名 — 0 命中新建 `text`；1 命中 Attach；2+ 命中 `AttachImportTargetDialog` 用户选目标。
- Rust 真源：`file_import_cmd.rs` · IPC：`import_transcript_to_project`。
- **`fallbackWaveFile`**：仅当当前 File 为 `text` 且无 `audioSrc` 时，才提示切换到项目内其它 `paired`/`audio_only` File（legacy 分裂数据）；Attach 成功后同一 `paired` File 不应再出现该按钮。

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
- **列表行次要信息**（`FileSummary` / `ProjectFilesHubFileList`）：
  - 音频行：类型（媒体一律「音频」、文本「文本」；语段进度见状态条）· 时长 · 体积（`import_source_size`，缺则回退磁盘媒体大小并回填）· 缺媒体 · 更新时间
  - 进度状态条（`HubFileStageMeter`）：色块比例 + 下方完整 `生稿/一校/定稿` 图例（有效语段 = 非 placeholder、非 whole-track fallback、正文非空）；空态「未转录/无语段」
  - 时长写入：import / `load_file` / transcribe probe 回写（禁止第二套探测）
- **欢迎页文件 ledger**（`WelcomeFileLedger`）：「最近」为最近文件行（左标题+meta · 右图例+细轨，`variant="ledger"`）；「所有」挂载 `WorkspaceProjectLibrary`（点项目仅展开；展开区含 Hub 迁入动作条：导入音频/文本、批量转写；项目信息/删除为项目行悬停显示 + 文件 hover 重命名/删除 + 右键；底部分页每页 10 项目；搜索靠右；见 [`welcome-all-files-library-migration-research.md`](../execution/specs/welcome-all-files-library-migration-research.md)）；无「星标」tab；侧栏仅导航/底栏，**无**项目树
- **语段 stage 刷新**：`FileSummary` stage 计数经 `list_files` / `projectLoad`；Welcome hub↔welcome **不卸载**，故「所有」跟 `current.updated_at_ms` 同步 files，保存/转写/Hub 刷新经 `projectFilesCacheBridge` 失效缓存并重刷「最近」（勿仅依赖 mount 拉取）
- **Hub 壳旁路**：`resolveWorkspaceShellVariant === "hub"`（有 current、无打开文件）时 `ProjectPanel` 渲染 `WelcomeView`（强制「所有文件」并自动展开 current），**不**再挂 `ProjectHubView`（源码保留待删）；编辑器 `closeFile` → 欢迎库；导入/批量/元数据经库动作条 `loadProject`（如需）后走既有 controller
- **转写忙碌 UI**：多窗 → `BlockingProgressCard` 确定条（`window_index/window_count`）+ 可选「约剩余」；单窗/在线无窗 → 不定条；**禁止**超时公式当 ETA

### 能力—UI（Hub 转写忙态）

| 信号 | 有确定条 | 无假 ETA | 约剩余 |
|------|----------|----------|--------|
| 本地多窗 `window_count>1` | ✅ `i/n` | ✅ | 暖机后可选 |
| 本地单窗 / 排队加载 | ❌ 不定条 | ✅ | ❌ |
| 在线无窗进度 | ❌ 不定条 | ✅ | ❌ |

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

## 媒体基准与相对路径（长期契约）

> 调研：[`user-library-location-sync-research.md`](../execution/specs/user-library-location-sync-research.md)

- **DB / models / secrets / logs**：始终在本机 `DbState.root`（app_data），禁止放消费级网盘。
- **媒体基准**（`prefs/media_base_dir.txt`）：新音频与 peaks 落在 `{media_base}/projects/{projectId}/`；`files.audio_path` 优先存相对该基准的路径。
- **改基准**：有受管媒体时必须搬迁（薄片 2），不可仅改指针。搬迁进行中 DB 写**绝对路径**（`relocate-allow` 扩 scope）；pref 切换成功后再相对化。失败时保留 allow，避免半态不可读。
- **搬迁收养**：`resolve_for_relocate` 可临时收养 **scoped 根之外但仍存在于磁盘的绝对路径**（历史 orphan / 半态绝对路径），迁入新基准后仍走 scoped 读；**播放禁止**直接读 orphan。
- **读路径**：`media_base_dir::resolve_audio_path`（scoped；相对路径优先 join relocate-allow；受控 symlink；网盘占位返回可执行错误文案）。
- **换机**：导出可选 **当前项目**（`rushi_project_bundle` v2）或 **整库**（`rushi_library_bundle`：嵌套各项目 v2 + 顶层一份词表）。均不含 live SQLite / models / secrets。Mac↔Win 可互通；导入按 `manifest.kind` 分流。

## 相关代码

| 模块 | 路径 |
|------|------|
| Close Gate | `apps/desktop/src/pages/useProjectCloseGateController.ts` |
| 脏检测 | `apps/desktop/src/pages/useSegmentDirtyState.ts` |
| 导入去重 | `apps/desktop/src/pages/useProjectImportDuplicateController.ts` |
| Hub 变更 | `apps/desktop/src/pages/useProjectFileMutationController.ts` |
| 项目 CRUD / 元信息 | `apps/desktop/src/pages/useProjectMutationController.ts` |
| Rust 去重 | `apps/desktop/src-tauri/src/project/import_duplicate.rs` |
| 媒体基准 / 搬迁 | `apps/desktop/src-tauri/src/media_base_dir.rs` · `media_base_relocate.rs` |
