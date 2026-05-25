# Batch 4 — ASR 侧车与转写

## 链路

[chains/asr-sidecar-transcribe.md](./chains/asr-sidecar-transcribe.md)

## Python `rushi_asr`

| 检查项 | 结论 |
|--------|------|
| 上传阻塞事件循环 | **已修** `run_in_threadpool` + 分块 |
| 上传 OOM | **已修** `RUSHI_MAX_UPLOAD_BYTES` |
| loopback only | `bind_addr` + `_loopback_only` | OK |
| 热词真值 | 见 `docs/architecture/asr-hotword-bias-truth.md` | 文档对齐 |

## Rust 转写

| 检查项 | 结论 |
|--------|------|
| `reqwest::blocking` | **已移除**；async multipart |
| 保存原子性 | recovery 文件 | OK |
| **file_id 参数** | **错误** | R2-001 |

## 测试

- `npm run asr:test`（审查日未跑，建议 CI 保持）
- `bash scripts/p0-acceptance.sh` 与桌面命令独立
