# Spec(plan): BATCH-TXN

> **Research**：[`batch-transcribe-queue-research.md`](./batch-transcribe-queue-research.md)  
> **Intent**：[`batch-transcribe-queue-intent.md`](./batch-transcribe-queue-intent.md)

## B-1 实施

1. `picker_cmd.rs`：`pick_audio_paths()` → `FileDialog::pick_files()`
2. `fileApi.pickAudioPaths()`
3. `services/projectBatchImport.ts`：从 `EmptyProjectPanel` 抽出 `importDroppedPathsToProject`、`importAudioPathsToProject`
4. `useProjectImportDuplicateController`：`pickAndImportAudioPathsToProject`、`importAudioPathsToProject`
5. `EmptyProjectPanel` / `ProjectFilesHubPanel`：音频按钮改多选

## B-2 实施

1. `services/batchTranscribeQueue.ts`：`listBatchTranscribableFiles`、`initialBatchQueueItems`
2. `BusyReason` 增 `batch_transcribe`；`isTranscribeBusy` 含 batch
3. `transcribeExecuteGate`：`batchChild` + `busyReason` 放行
4. `useTranscribeJobExecute`：`executeTranscribe(opts?: { batchChild?, fileId? })`
5. `useBatchTranscribeQueueController.ts`：串行 `loadFile` → skip / `openFileWrapped` → `executeTranscribe`
6. `BatchTranscribeQueueDialog.tsx` + Hub 入口
7. `useProjectLifecycleWiring` 接线 + `projectLifecycleReturn`

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

手测：[`rel-1.1-hand-test-checklist.md`](./rel-1.1-hand-test-checklist.md) **H-BATCH-1**
