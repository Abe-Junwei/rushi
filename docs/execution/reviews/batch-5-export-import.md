# Batch 5 — 导出 / 导入 / 诊断

## 导出文本 / SRT / DOCX

- 经 `useExportController`：先 `flushSegmentTextDrafts`（草稿 store），用 `segmentsRef` — OK
- 不强制 `currentFileId`；空项目时 `current` 有即可 — 边界可接受

## 项目包 ZIP

- Round-trip 有 Rust 测：`export_and_import_project_bundle_round_trip`
- 不安全 zip 路径：`import_project_bundle_rejects_unsafe_audio_path` — OK
- **多文件**：音频 DB `LIMIT 1`，语段来自前端当前编辑 → R5-001

## 诊断包

- symlink 日志跳过 — 2026-05-12 #15 已修
- DB >5MB 跳过拷贝 — 设计如此

## 死 API

- `projectSaveSegments` — R3-001
