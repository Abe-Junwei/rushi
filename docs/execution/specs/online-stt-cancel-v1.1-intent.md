# Spec(intent): STT-CANCEL（Q-STT-CANCEL-1）

> **Research brief**：[`online-stt-cancel-v1.1-research.md`](./online-stt-cancel-v1.1-research.md)

## 目标

在线 STT 转写支持真 Abort（非 v1 丢弃结果）；统一 `project_cancel_transcribe` command；本机侧车 cancel 保持现状。

## 切片

| 切片 | 范围 |
|------|------|
| **7a D-1** | `TranscribeCancelState` + `project_cancel_transcribe` + `request_id` + 在线 `Abortable` + TS 接线 |
| **7b–d** | 各 adapter HTTP/poll 可中断 |
| **7e P2** | generic multipart 尽力取消 |

## 7a 验收

- 在线转写中 `cancelTranscribe` 调用 `project_cancel_transcribe`
- `project_run_transcribe` 接受 `requestId`，在线路径注册 AbortHandle
- 取消后 invoke 失败「转写已取消」、语段恢复、timeline `cancelled`
- 本机 async cancel 测试仍绿
