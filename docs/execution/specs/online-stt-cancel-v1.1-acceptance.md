# Spec(acceptance): STT-CANCEL（Q-STT-CANCEL-1）

## 7a 自动门禁

- [x] `TranscribeCancelState` + `project_cancel_transcribe` 注册（`lib.rs` / `permissions/project.toml`）
- [x] `project_run_transcribe` 接受 `requestId`；在线 JSON 获取包 `Abortable`
- [x] `transcribe_timeline` `finish_cancelled()`；取消 outcome=`cancelled`
- [x] TS：`projectCancelTranscribe` + 在线 `cancelTranscribe` 接线 + `isTranscribeInvokeCancelled`
- [x] `npm run typecheck` / `npm run test`（1282）/ `cargo test transcribe_cancel` / guard 绿
- [x] 本机 async cancel 测试仍绿

## 7b–d 自动门禁（2026-06-12）

- [x] `ensure_transcribe_not_cancelled` + `transcribe_poll_wait`（`transcribe_cancel_cmd.rs`）
- [x] OpenAI / Deepgram：HTTP 前后 cancel 检查
- [x] AssemblyAI / Dashscope：poll 循环内 cancel 检查 + 250ms 切片 sleep
- [x] generic multipart（7e）：`post_transcribe_multipart` 发送前 cancel 检查

## 手测（发版前 REL-1.1）

| ID | 项 | 状态 |
|----|-----|------|
| H-STT-1 | 在线 STT 转写中停止，语段恢复 | ✅ 2026-06-12 macOS · 百炼 file_asr |
| H-STT-2 | TRN-DIAG outcome=`cancelled` | ✅ 2026-06-12 · `transcribe_timeline_last.json` |
| H-STT-3 | 本机侧车 async 停止回归 | ✅ 2026-06-12 · 操作员确认 |

### 签收证据（2026-06-12）

**环境**：macOS · dev 壳 · 在线 STT **百炼 Fun-ASR 录音文件**（`dashscopeAsr` / OSS 上传 + Job）

| 字段 | 值 |
|------|-----|
| `fileId` | `b642fdc3-fd4b-4069-bad4-cf1f63aad5e8` |
| `jobId` | `online-stt-1781263347825` |
| `source` | `online` |
| `outcome` | `cancelled` |
| `errorMessage` | `转写已取消` |
| `failedStage` / `errorCode` | 均为空（无 failed 污染） |
| 任务时长 | ~8.4s（preflight → OSS 上传中途取消） |

**`desktop.log` 摘录**（同次会话，时间戳对齐）：

```text
1781263347882  INFO transcribe_stage=preflight
1781263347883  INFO dashscope upload_policy model=fun-asr
1781263350431  INFO dashscope upload_oss bytes=14455168 …/b642fdc3-fd4b-4069-bad4-cf1f63aad5e8.mp3
1781263356184  INFO transcribe_cancelled
```

**操作员结论**：停止转写符合预期（语段恢复 + toast）；机器证据与 timeline 一致。

**H-STT-3（2026-06-12）**：本机 async 长音频转写中停止 — 操作员确认语段恢复 + toast 正常；日志见 `transcribe_async_start` / `job_id=6407010d-88df-4a9d-8882-f0fbaaf4af03`（`fileId` `c0588fb5-7015-4ad8-8a64-38200fd3ca26`，12 窗）。本机路径不写 `INFO transcribe_cancelled`（预期）。

> **REL-1.1 STT 子集**：H-STT-1/2/3 均已签收（2026-06-12）。

> 手测步骤真源：[`online-stt-cancel-v1.1-hand-test-checklist.md`](./online-stt-cancel-v1.1-hand-test-checklist.md)
