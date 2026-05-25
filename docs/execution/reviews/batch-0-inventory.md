# Batch 0 — 基线盘点

审查日：2026-05-21

## 1. Tauri 命令清单（`lib.rs` → Rust）

| Command | 模块 | 主要副作用 |
|---------|------|------------|
| `app_version` | `lib.rs` | 无 |
| `bundled_asr_launch_report` | `asr_sidecar` | 读启动状态 |
| `pick_audio_path` / `pick_text_path` | `project_cmd` | 对话框 |
| `project_create_from_audio` | `project_cmd` | FS 复制音频 + DB 项目/文件 |
| `create_empty_project` | `project_cmd` | DB |
| `create_project_from_text` | `project_cmd` | 解析文本 + DB + 可选音频 |
| `create_empty_text_file` | `project_cmd` | DB 文件行 |
| `import_audio_to_project` / `import_text_to_project` | `project_cmd` | FS + DB |
| `project_list` / `project_load` | `project_cmd` | DB 读 |
| `project_list_edit_log` | `project_cmd` | DB 读 |
| `file_save_segments` | `project_cmd` | DB 事务写 segments |
| `project_run_transcribe` | `run_transcribe_cmd` | HTTP ASR + **写 segments** |
| `project_delete` | `project_cmd` | FS 删目录 + DB DELETE |
| `list_files` / `load_file` / `rename_file` / `delete_file` | `project_cmd` | DB + 可选 FS |
| `export_project_bundle` / `import_project_bundle` | `export_cmd` | ZIP 读写 |
| `install_funasr_deps_interactive` | `install_cmd` | 外部脚本 |
| `retry_bundled_asr_sidecar` | `install_cmd` | 进程 |
| `open_app_data_folder` | `export_cmd` | 打开目录 |
| `export_text_file` | `export_cmd` | 写用户路径 |
| `glossary_*` | `glossary_cmd` | DB |
| `export_docx` | `export_docx` | 写 DOCX |
| `export_diagnostic_bundle` | `diagnostic` | ZIP 诊断 |

## 2. 前端 `src/tauri/*` 映射

| API 文件 | 封装命令 |
|----------|----------|
| `projectApi.ts` | 项目列表/加载/转写/删除/导出文本/包/侧车 |
| `fileApi.ts` | 文件容器 CRUD、`file_save_segments` |
| `glossaryApi.ts` | 术语表 |
| `exportDocxApi.ts` | DOCX |
| `diagnosticApi.ts` | 诊断 zip |

### 契约裂口（Batch 0 发现）

| 前端 | invoke 名 | 后端注册 | 状态 |
|------|-----------|----------|------|
| `projectSaveSegments` | `project_save_segments` | **无**（仅有 `file_save_segments`） | 死代码，未被引用 |
| `projectRunTranscribe` | `project_run_transcribe` | 有 | 参数语义错误（见 R2-001） |
| `RunTranscribeOutcome.detail` 类型为 `ProjectDetail` | 实际返回 `FileDetail` | 类型谎言 |

## 3. Controller 依赖图

```
ProjectPanel
  └── useProjectController
        ├── useProjectLifecycleController  ← 核心状态（projects/current/segments/busy）
        │     ├── useSegmentMutationController → useSegmentUndoRedo
        │     ├── useProjectCrudController
        │     └── useExportController
        └── useAsrBridgeController
```

**无测试**：`useProjectLifecycleController.ts`（384 行 / 17 hooks）

**有测试**：`useProjectCrudController`、`useSegmentMutationController`、`useProjectController`（浅层）

## 4. 测试覆盖缺口

| 区域 | 单测 | E2E |
|------|------|-----|
| Rust `project_cmd` / `export_cmd` | 有（29 tests） | — |
| lifecycle 编排 | **无** | — |
| `project_run_transcribe` | **无** | `asr-health.spec.ts` 仅健康检查 |
| `EditorView` | **无** | — |
| ASR Python | `services/asr/tests/*` | P0 脚本 |

## 5. 架构守卫热点（2026-05-21）

| 文件 | 警告 |
|------|------|
| `EditorView.tsx` | 762 行 |
| `EnvOnlineSttPanel.tsx` | 349 行 |
| `SegmentTextListRow.tsx` | 15 hooks；2 处 arbitrary hex |
| `useProjectLifecycleController.ts` | 384 行；17 hooks |
| `useProjectCrudController.test.ts` | 317 行 |
| `project_cmd.rs` | 887 行 |

## 6. 已修复项（相对 2025-05 / 2026-05-12 报告）

- SQLite `busy_timeout` 5000（`utils::open_db` + `db::migrate`）
- 删文件 / 删项目音频路径：`canonicalize` + symlink 拒绝
- 桌面日志：`DESKTOP_LOG_MUTEX`
- 转写失败恢复：`transcribe_recovery_*.json`（`run_transcribe_cmd.rs`）
- ASR 上传：`run_in_threadpool` + 分块上限（`app.py`）
- 在线 STT URL：`url::Url` + SSRF 单测（`online_stt_bridge.rs`）
- 诊断 zip：跳过 symlink 日志（`diagnostic.rs`）
- `flushSegmentTextDraftsFromDom`：DOM 在 `flushSync` 前收集，updater 纯函数
