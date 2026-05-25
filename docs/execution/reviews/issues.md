# 审查问题登记表

审查日：2026-05-21 | 状态：`open` / `fixed` / `wontfix` / `debt`

| ID | 级别 | 批次 | 状态 | 摘要 |
|----|------|------|------|------|
| R2-001 | P0 | 2 | fixed | 转写命令用 `project_id` 当 `file_id` |
| R2-002 | P0 | 2 | fixed | 转写成功后未刷新 `segments`/`audioSrc` |
| R2-003 | P2 | 2 | fixed | `closeProject` 无未保存确认 |
| R2-004 | P2 | 2 | fixed | `runTranscribe` 未要求 `currentFileId` |
| R2-005 | P2 | 2 | fixed | `RunTranscribeOutcome` TS 类型与 Rust 不一致 |
| R1-001 | P1 | 1 | debt | `project_cmd.rs` 953 行未拆模块 → 见 [architecture-split-plan.md](../specs/architecture-split-plan.md) S1 |
| R1-002 | P2 | 1 | fixed | `project_delete` 先 FS 后 DB，DB 失败留孤儿 FS |
| R1-003 | P2 | 1 | open | `export_cmd.rs` 多文件项目只导出首个音频 |
| R3-001 | P3 | 0 | fixed | 死代码 `projectSaveSegments` → 不存在 command |
| R3-002 | P1 | 3 | debt | lifecycle 358 行/14 hooks → 方案 S2 |
| R3-003 | P1 | 3 | debt | `SegmentTextListRow` 17 hooks → 方案 S4 |
| R3-004 | P3 | 3 | open | arbitrary hex 颜色未入库 token |
| R5-001 | P2 | 5 | fixed | 导出项目包：语段来自当前文件、音频来自 DB 首个 paired |
| R7-001 | P1 | 7 | debt | `EditorView.tsx` 762 行 → 方案 S3 |
| R4-001 | P3 | 4 | debt | `transcribe.rs`/`export_cmd.rs` → 方案 S5 |
| R8-001 | P1 | 8 | fixed | file-container 转写/保存/导出已 `file_id` |

---

## R2-001 — 转写 API 参数语义错误（P0）

- **位置**：`run_transcribe_cmd.rs`（`file_detail_from_conn(&conn, &project_id)`、`file_save_segments_inner(..., &project_id, ...)`）；`useProjectLifecycleController.ts`（`projectRunTranscribe(current.id, ...)`）
- **模拟**：创建音频项目 → `loadProject` → `openFile` → 点「从 ASR 拉取语段」
- **预期**：对**当前打开文件**的 `file_id` 拉音频、写 segments
- **实际**：传入 `project_id`（与 `file_id` 为不同 UUID，`project_create_from_audio` 显式分配两个 id）
- **结果**：Rust 查 `files WHERE id = project_id` 失败，或极少数历史数据误匹配；与 [file-container-refactor.md](../specs/file-container-refactor.md) §语段级 `run_transcribe(file_id)` **不一致**
- **建议**：命令改名为 `file_run_transcribe(file_id)`；前端传 `currentFileId`；恢复文件命名含 `file_id`

---

## R2-002 — 转写成功后 UI 语段不更新（P0）

- **位置**：`useProjectLifecycleController.ts` `runTranscribe` → `applyDetail(out.detail)`
- **模拟**：假设 R2-001 已绕过（手工同 id）或修复后
- **预期**：列表与波形展示新 segments
- **实际**：`applyDetail` 只 `setCurrent` + `resetMutationHistory`，**不** `setSegments` / `setAudioSrc`；展示仍来自旧 `segments` state
- **建议**：转写成功后 `await openFile(currentFileId)` 或 `setSegments(cloneSegments(out.detail.segments))` + 刷新 project 元数据

---

## R2-003 — 关闭项目无未保存确认（P2）

- **位置**：`closeProject` → `setCurrent(null)` + `closeFile()`
- **对比**：`saveSegments` 有 busy guard；删除项目有 `window.confirm`
- **建议**：对比 `segmentsRef` 与上次 `loadFile` 快照，或 dirty flag

---

## R2-004 — 转写未校验已打开文件（P2）

- **位置**：`runTranscribe` 仅 `if (busy || !current)`
- **建议**：与 `saveSegments` 一致，要求 `currentFileId`

---

## R2-005 — RunTranscribeOutcome 类型不一致（P2）

- **Rust**：`types.rs` → `detail: FileDetail`
- **TS**：`projectApi.ts` → `detail: ProjectDetail`
- **连带**：`applyDetail` 把 `FileDetail` 当 `ProjectDetail`，`current.files` 可能 undefined，侧边栏/多文件 UI 异常

---

## R1-001 — project_cmd 巨石模块（P1 技术债）

- 887 行，含创建/导入/列表/删改/保存；守卫持续告警
- **建议**：按 `file-container-refactor` 拆 `file_cmd.rs`、`segment_cmd.rs`

---

## R1-002 — project_delete 顺序风险（P2）— fixed

- **修复**：先 `DELETE FROM projects`（CASCADE 清 files/segments），再尽力 `remove_project_audio_parent_dir`；FS 失败仅 WARN 日志
- **实现**：`project_delete_inner` + 单测 `project_delete_removes_db_row_first`

---

## R1-003 / R5-001 — 项目包导出多文件语义（P2）— fixed

- **修复**：`export_project_bundle` 增加 `file_id`；按当前打开文件取 `audio_path`；前端传 `currentFileId`
- **测试**：`export_project_bundle_uses_requested_file_audio`

---

## R3-001 — 死 API projectSaveSegments（P3）

- `projectApi.ts` 调用 `project_save_segments`，handler 未注册
- 实际保存路径：`fileApi.fileSaveSegments` → `file_save_segments`
- **建议**：删除 `projectSaveSegments` 或改为 deprecated 包装 `fileSaveSegments`

---

## R3-002 / R3-003 / R7-001 — 架构阈值（P1 债）

- lifecycle controller：384 行、17 hooks，无 focused test
- `SegmentTextListRow`：15 hooks
- `EditorView`：762 行
- 参照 [code-review-fix-2025-05-24.md](../specs/code-review-fix-2025-05-24.md) 拆分方案

---

## R3-004 — Tailwind arbitrary 颜色（P3）

- `SegmentTextListRow.tsx`：`text-[#8b8b8b]`、`text-[#5f5f5f]`
- **建议**：映射 `tokens.ts` / `tailwind.config.js`

---

## R4-001 — ASR / 导出模块体量（P3 债）

- `transcribe.rs`、`export_cmd.rs` 仍超 AI_QUICKSTART 建议拆分线
- 当前：`post_transcribe_multipart` 已 async；blocking 已移除

---

## R8-001 — file-container 迁移未完成（P1）

- DB/schema、文件 API 已 file-centric
- **转写、部分导出、前端 `applyDetail` 仍 project-centric**
- 完成标准：全链路以 `currentFileId` 为轴；补集成测试
