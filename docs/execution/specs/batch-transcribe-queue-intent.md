# Spec(intent): BATCH-TXN

> **Research**：[`batch-transcribe-queue-research.md`](./batch-transcribe-queue-research.md)

## 目标

Project Hub **多选音频导入** + **串行批量转写队列**（MacWhisper Batch 子集），支撑 v1.1 REL-1.1 **H-BATCH-1**。

## 切片

| 切片 | 范围 |
|------|------|
| **B-1** | `pick_audio_paths` + `projectBatchImport` + Hub/Empty **导入音频** 多选 |
| **B-2** | `batchTranscribeQueue` + controller + Hub「批量转写」+ Close Gate + `batch_transcribe` busy |

## B-1 验收

- Hub / Empty「导入音频」打开系统多选对话框（可选 1～N 个）
- 循环 `importFileToProject(..., { skipReload: true })`，末尾一次 `loadProjectAfterImport`
- 重复文件仍走 `DuplicateImportConfirmDialog`

## B-2 验收

- Hub 有 **≥1** 可转写音频时显示「批量转写」
- **串行**：一次只跑一个 `project_run_transcribe`
- **已有非空语段** → 状态 `skipped`（不弹覆盖框）
- **单项失败** → `failed`，继续下一项
- 队列进行中：`batch_transcribe` busy；导航/关窗与单文件转写同等阻塞

## 不做

- 并行 Job；跨项目队列；批量覆盖确认；Hub 拖放（可后续）；在线 STT 批量专用 API
