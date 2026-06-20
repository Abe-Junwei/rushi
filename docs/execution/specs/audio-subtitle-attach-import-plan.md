# Plan：音频 + 字幕 Attach import（Replace）

> **Research**：[audio-subtitle-attach-import-research.md](./audio-subtitle-attach-import-research.md)  
> **Intent**：[audio-subtitle-attach-import-intent.md](./audio-subtitle-attach-import-intent.md)  
> **Acceptance**：[audio-subtitle-attach-import-acceptance.md](./audio-subtitle-attach-import-acceptance.md)

## 目标

用单一 Rust 真源 `import_transcript_to_file` 实现 **Attach + Replace**，替换「项目内盲 `import_text_to_project` INSERT text」路径；前端按 Editor/Hub 传入 target 解析结果。

## 受影响代码地图

| 文件 | 变更 |
|------|------|
| `apps/desktop/src-tauri/src/project/project_create_cmd.rs`（或新 `file_import_cmd.rs`） | `import_transcript_to_file_inner` |
| `apps/desktop/src-tauri/src/project/import_duplicate/check.rs` | 同 target Replace bypass |
| `apps/desktop/src-tauri/src/lib.rs` / `app_commands.rs` | 注册 command |
| `apps/desktop/src/tauri/fileApi.ts` | IPC 封装 |
| `apps/desktop/src/pages/useProjectImportDuplicateController.ts` | Attach / Hub stem / 选 File |
| `apps/desktop/src/pages/closeGateProjectLoad.ts` | import 后 open 正确 fileId |
| `apps/desktop/src/components/EditorToolbar.tsx` | 文案 + busy disabled |
| `apps/desktop/src/components/AttachImportTargetDialog.tsx`（新） | Hub 歧义 |
| `apps/desktop/src/components/EditorView.tsx` | 降级 fallbackWaveFile 依赖 |

## 实施顺序（vertical slices）

### ASI-1 — Rust 真源（2–4h）

1. `import_transcript_to_file_inner(st, file_id, src_path) -> FileDetail`
   - 解析 SRT/TXT（复用 `import_parse`）
   - 事务：DELETE segments WHERE file_id；INSERT 新 segments
   - UPDATE files：provenance 字段；若 `audio_path` 存在 → `file_type = paired`
   - 更新 `projects.updated_at_ms`
2. `resolve_transcript_import_target(project_id, src_path, explicit_file_id?) -> Target`
   - `explicit_file_id` 有值 → 直接用（Editor）
   - 否则 stem 匹配 `paired`/`audio_only` → 0/1/N
3. `import_transcript_to_project(project_id, src_path, target_file_id?)` Tauri command
4. Rust tests：`replace_segments_keeps_audio_path`、`stem_unique_match`、`stem_zero_creates_text`（wrapper 层）

**验证**：`cargo test import_transcript` · `cargo clippy -D warnings`

### ASI-2 — Editor 接线（2–3h）

1. `importFileToProject("text")` 当 `currentFileId` 存在：
   - 若 dirty → 现有 Close Gate（G1）后再调 IPC（带 `targetFileId`）
   - 若 transcribe busy → disabled + toast（T2）
   - 成功 → `openFile(currentFileId)`（不换 File）
2. 同 target re-import：**不**调 `checkProjectImportDuplicate`（R1）
3. Editor 菜单：「导入字幕…」（保留 Hub「导入转录文本」）

**验证**：Vitest `useProjectImportDuplicateController` 扩展用例

### ASI-3 — Hub Sidecar + 导航（2–3h）

1. Hub（`currentFileId === null`）：
   - stem 唯一 → attach
   - stem 0 → 保留现 `import_text_to_project` 新建 text（或 wrapper 内分支）
   - stem 2+ → `AttachImportTargetDialog` → 用户选 → attach
2. `loadProjectAfterImport`：
   - attach 成功 → `openFile(attachedId)`
   - 新建 text → `openFile(newId)`
   - **禁止**无脑 `sort(updated_at_ms)[0]` 当唯一策略
3. 移除/收缩 `fallbackWaveFile` 作为主路径（attach 后同 File 应有 `audioSrc`）

**验证**：Vitest `closeGateProjectLoad` · 手测 Hub 歧义

### ASI-4 — 文档与闸门（1h）

1. 更新 [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) §重复导入 / §loadProjectAfterImport
2. acceptance 手测勾选

## 约束

- 不新增 DB 表；segments 仍挂 `file_id`
- 单 hook / controller 文件不突破 architecture guard（必要时拆 dialog 组件）
- 重复导入对话框 z-index 仍走 `dialogStack.ts`
- Replace 不触发 `file_save_segments` 学习 diff（与现 import 一致）

## TDD 锚点

| RED → GREEN | 测试 |
|-------------|------|
| Replace 保留 audio | `project_create_cmd` / `file_import` rust test |
| stem 唯一 | rust test + vitest stem helper |
| Editor bypass dedupe | `useProjectImportDuplicateController.test.ts` |
| loadProjectAfterImport open attached | `useProjectCloseGateController.test.ts` |
