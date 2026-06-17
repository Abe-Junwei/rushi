# 计划：FunASR 单 worker 排队 UX

> **Research brief**：[`funasr-concurrency-research.md`](./funasr-concurrency-research.md)  
> **Acceptance**：[`funasr-queue-ux-acceptance.md`](./funasr-queue-ux-acceptance.md)

## 范围

本轮只做 C1：保留单 worker FIFO，把已有推理队列深度变成明确可消费的状态与文案。`RUSHI_FUNASR_INFERENCE_WORKERS` 仍是诊断字段，不控制真实并发。

## 落位

| 层 | 文件 | 改动 |
|----|------|------|
| Python ASR | `runtime_caps.py` / `inference_queue.py` | 确认 `/health` 输出 queue pending/running/max workers |
| Python ASR | `transcribe_job.py` | 如 async status 未带队列信息，则补充 queue stats |
| UI | `apps/desktop/src/services/asr/` 或状态组件 | 显示“前方 N 个任务排队”或等价文案 |
| 测试 | ASR pytest / desktop Vitest | 覆盖 queue stats 契约与文案 |

## 不做

- 不改 `SingleWorkerInferenceQueue` worker 数。
- 不移除 `_runtime_lock`。
- 不把 `requested_inference_workers()` 变成真实配置。

## 验证

```bash
npm run asr:test -- tests/test_inference_queue.py
npm run typecheck
node scripts/check-architecture-guard.mjs
```
