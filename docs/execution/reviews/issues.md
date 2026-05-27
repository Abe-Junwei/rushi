# 审查问题登记表

审查日：2026-05-21 | 最近刷新：**2026-05-27**（路线图审查对齐）  
状态：`open` / `fixed` / `wontfix` / `debt`

| ID | 级别 | 批次 | 状态 | 摘要 |
|----|------|------|------|------|
| R2-001 | P0 | 2 | fixed | 转写命令用 `project_id` 当 `file_id` |
| R2-002 | P0 | 2 | fixed | 转写成功后未刷新 `segments`/`audioSrc` |
| R2-003 | P2 | 2 | fixed | `closeProject` 无未保存确认 |
| R2-004 | P2 | 2 | fixed | `runTranscribe` 未要求 `currentFileId` |
| R2-005 | P2 | 2 | fixed | `RunTranscribeOutcome` TS 类型与 Rust 不一致 |
| R1-001 | P1 | 1 | **fixed** | `project_cmd` 巨石 → 已拆 `project/` + `project_bundle_cmd.rs` ~277 行 |
| R1-002 | P2 | 1 | fixed | `project_delete` 先 FS 后 DB，DB 失败留孤儿 FS |
| R1-003 | P2 | 1 | **fixed** | 项目包导出：已 `export_project_bundle(file_id)`；见 R5-001 |
| R3-001 | P3 | 0 | fixed | 死代码 `projectSaveSegments` → 不存在 command |
| R3-002 | P1 | 3 | **debt↓** | lifecycle **~261 行**（原 358+）；**T-005 已解决**，观察即可 |
| R3-003 | P1 | 3 | **debt↓** | `SegmentTextListRow` **~110 行**（原 17 hooks 告警已缓解） |
| R3-004 | P3 | 3 | **fixed** | arbitrary hex → 仓库内已无 `text-[#`（2026-05-27 rg） |
| R5-001 | P2 | 5 | fixed | 导出项目包：语段来自当前文件、音频来自 DB 首个 paired |
| R7-001 | P1 | 7 | **fixed** | `EditorView` 巨石 → `editor/*` 拆分（路线图 §2） |
| R4-001 | P3 | 4 | **debt↓** | `transcribe.rs` ~300 行 + online 拆分；`export_cmd` 薄封装 |
| R8-001 | P1 | 8 | fixed | file-container 转写/保存/导出已 `file_id` |
| **T-010** | P1 | — | **open** | `install_support.rs` ~675、`asr_sidecar.rs` ~632、`useAsrSetup*` ~360；路线图 §7 |

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

## R1-001 — project_cmd 巨石模块（P1 技术债）— fixed

- 原 887+ 行；现 `project/` 模块 + `project_bundle_cmd.rs` ~277 行 + 独立 tests
- **剩余**：无 P1 阻塞；新债见 **T-010**（LRC）

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

- lifecycle：**~261 行**（2026-05-27）— **T-005 已解决**
- `SegmentTextListRow`：**~110 行**，hooks 已拆/缓解
- `EditorView`：已拆至 `editor/*` — **fixed**

---

## R3-004 — Tailwind arbitrary 颜色（P3）— fixed

- 2026-05-27：仓库 `apps/desktop` 内无 `text-[#` 匹配
- 新增颜色须走 `tokens.ts` / `tailwind.config.js`

---

## R4-001 — ASR / 导出模块体量（P3 债）

- `transcribe.rs` ~300 行 + `transcribe_native_online.rs` 已拆
- `export_cmd.rs` 薄封装 + `project_bundle_cmd`
- **新关注**：`asr_sidecar.rs`、`install_support.rs` → **T-010**

---

## R8-001 — file-container 迁移未完成（P1）— fixed

- 转写、导出、前端均以 `currentFileId` 为轴（R2/R5/R8 已修）

---

## T-010 — LRC / ASR 热点体量（2026-05-27 新增）

- **来源**：`check-architecture-guard.mjs` 7 警告
- **文件**：`install_support.rs` ~675、`asr_sidecar.rs` ~632、`useAsrSetupController.ts` ~364、`useLocalRuntimeSetupSupport.ts` ~359 等
- **穿插**：路线图 **R3h-2 / R3h-I1～I3**，不单独开重构周
