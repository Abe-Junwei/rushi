# Spec(plan): STT-CANCEL Step 7a（D-1）

> **Research brief**：[`online-stt-cancel-v1.1-research.md`](./online-stt-cancel-v1.1-research.md)

## 改动

1. `project/transcribe_cancel_cmd.rs` — `TranscribeCancelState`、`project_cancel_transcribe`、`run_transcribe_abortable`
2. `run_transcribe_cmd.rs` — `request_id` 参数；在线 JSON 获取包 `Abortable`
3. `transcribe_timeline.rs` — `finish_cancelled()`
4. `lib.rs` / `mod.rs` / `permissions/project.toml` / `app_commands.rs`
5. `projectApi.ts` — `requestId`、`projectCancelTranscribe`
6. `useTranscribeJobController.ts` — 传 requestId；在线 cancel 调 command
7. `transcribePreviewState.ts` — `isTranscribeInvokeCancelled`

## 约束

- 本机路径不传 `request_id` 或忽略 Abortable
- 错误文案「转写已取消」与侧车 cancel 一致
