# Batch 2 — 项目生命周期（前端编排）

## 链路

详见 [chains/project-load-transcribe-save.md](./chains/project-load-transcribe-save.md)

## 新发现（相对 2025-05-24）

| 项 | 2025 文档 | 2026-05-21 |
|----|-----------|------------|
| P2-1 loadProject 半加载 | 待修 | **已修**（catch 回滚） |
| P2-2 busy guard | 待修 | **部分**：transcribe/save/load 有；export 部分无 |
| P2-3 refresh 不刷新文件 | 待修 | **已修**（连带 loadFile） |
| P2-4 close 无确认 | 待修 | **仍 open** R2-003 |
| 转写 file_id | 未列 | **P0** R2-001/R2-002 |

## 编排层

- `useProjectLifecycleController`：384 行 / 17 hooks → 应拆 list/file/busy（2025 方案仍适用）→ R3-002
- 无 dedicated 单测

## applyDetail 语义

仅更新 `current` 项目元数据，**不**绑定 `currentFileId` 的 segments——创建/导入后需另调 `openFile`；转写后误用导致 R2-002
