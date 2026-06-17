# 调研：BATCH-TXN（Hub 批量导入 + 串行转写队列）

> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 10–11  
> **状态**：已采纳 · 2026-06-17

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 多场口述课/会议录音需 **同一项目内** 导入多段音频并 **依次转写**，对标 MacWhisper Batch 子集 |
| 本仓现状 | `EmptyProjectPanel` 拖放已支持 **多路径** `importFileToProject(..., { skipReload: true })`；**无** 系统文件多选；Hub **单文件** picker；**无** 串行转写队列 |
| 成功标准 | Hub **≥3** 音频一次导入；**≥2** 音频串行转写；已有语段 **默认跳过**；单项失败不阻断 |

## 2. 业内路线（≥2）

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | 批量导入 + 串行队列 | MacWhisper Batch | 多选文件 → 逐文件转写；失败继续 |
| B | 拖放批量 | Descript / 本仓 Empty 拖放 | 循环 import；末尾一次 reload |

## 3. 可复用评估

| 路线 | 复用度 | 复用部分 | 冲突 |
|------|--------|----------|------|
| B + A | **高** | `importFileToProject`、`DuplicateImportConfirmDialog`、`executeTranscribe`、`openFileWrapped` | 须 **串行**；禁止并行 `project_run_transcribe` |

**本仓必须先复用**：`useProjectImportDuplicateController`、`useTranscribeJobExecute`、`closeGateDecision`；**禁止**第二套转写 Job 栈。

## 4. 决策

| 项 | 结论 |
|----|------|
| 选定 | **B-1**：`pick_audio_paths` + 抽 `projectBatchImport.ts`；**B-2**：`batchTranscribeQueue` + `useBatchTranscribeQueueController` + Hub 面板 |
| 不做什么 | 并行转写；跨项目队列；覆盖已有语段（须 ASR-VOC-1 单文件确认，批量 **默认 skip**）；新 Rust 批量 transcribe API |
| Close Gate | `busyReason: batch_transcribe` 与 `transcribe` 同等阻塞导航/关窗 |
| ADR | ADR-0003 FunASR-first；单真源 SQLite 项目内多文件 |

## 5. 落位预告

| 层 | 路径 |
|----|------|
| Rust | `picker_cmd.rs` → `pick_audio_paths` |
| 纯函数 | `services/projectBatchImport.ts`、`services/batchTranscribeQueue.ts` |
| Controller | 扩展 import controller；`useBatchTranscribeQueueController.ts` |
| UI | `BatchTranscribeQueueDialog.tsx`、`ProjectFilesHubPanel.tsx` |
| busy | `BusyReason` + `closeGateDecision.isTranscribeBusy` |
