# Batch 1 — Rust 数据层与路径安全

## 模拟结论

| 场景 | 结论 | Issue |
|------|------|-------|
| 删单文件 `delete_file` | `remove_audio_file`，不删整项目目录 | 2025 P0 已修 |
| 删项目 `project_delete` | 单次 `remove_project_audio_parent_dir` | OK |
| symlink 音频/目录 | `canonicalize` + 拒绝 symlink | 2026-05-12 #9 已修 |
| `file_save_segments` | 事务：DELETE+INSERT+edit_log | OK |
| 转写落库失败 | `transcribe_recovery_*.json` | 2026-05-12 #8 已修 |
| `project_delete` DB 失败 | FS 已删、DB 仍在 | R1-002 |
| 并发 SQLite | `busy_timeout=5000` | 已修 |

## 测试证据

`cargo test`：29 passed，含 `delete_file_cascades`、`export_and_import_project_bundle_round_trip`、`import_project_bundle_rejects_unsafe_audio_path`

## 架构

- `project_cmd.rs` 887 行 → R1-001
- `export_cmd.rs` ~485 行 → R4-001

## 未完成切片

[file-container-refactor.md](../specs/file-container-refactor.md) 要求 `run_transcribe(file_id)`；实现仍用 `project_id` 查 `files` 表 → **R2-001 / R8-001**
