# Spec(acceptance): BATCH-TXN

> **Research**：[`batch-transcribe-queue-research.md`](./batch-transcribe-queue-research.md)

## 机器门禁

- [x] `projectBatchImport` 单测
- [x] `batchTranscribeQueue` 单测
- [x] `useBatchTranscribeQueueController` 集成测（execute 失败契约）
- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error

## B-1

- [ ] `pick_audio_paths` 已注册（`lib.rs` + `app_commands.rs`）
- [ ] Hub「导入音频」支持多选 ≥3 文件一次导入
- [ ] Empty 拖放逻辑改用 `projectBatchImport`（行为不变）

## B-2

- [x] Hub「批量转写」串行处理项目内全部可转写音频
- [x] 已有非空语段文件标记 **跳过**
- [x] 单项转写失败不阻断后续（含静默 return / 0 语段）
- [x] `batch_transcribe` busy 阻塞关窗/换文件（同 transcribe）

## 能力—UI 状态矩阵

| UI 控件 | 状态维度 | 数据源 | 手测 |
|---------|----------|--------|------|
| Hub「批量转写」 | 本机 ASR 就绪 + 非 busy | `localTranscribePreflight` / `busy` | ASR 未就绪时禁用或报错 |
| 队列对话框 | 当前文件进度 | `batchQueueItems` + `transcribeProgress` | 2 文件队列可见 running/done/skipped + 窗进度 |

## 手测 H-BATCH-1

见 [`rel-1.1-hand-test-checklist.md`](./rel-1.1-hand-test-checklist.md)
