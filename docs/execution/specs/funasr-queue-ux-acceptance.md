# 验收：FunASR 单 worker 排队 UX

> **Research brief**：[`funasr-concurrency-research.md`](./funasr-concurrency-research.md)  
> **Plan**：[`funasr-queue-ux-plan.md`](./funasr-queue-ux-plan.md)

## 验收项

- [x] `/health` 或 async transcribe status 暴露可消费的 `inference_queue_pending` / `inference_queue_running` / `inference_max_workers`。
- [x] 桌面端能把 pending > running 的状态显示为排队提示，例如“前方 N 个任务排队”。
- [x] `inference_max_workers` 仍为 1，`RUSHI_FUNASR_INFERENCE_WORKERS` 仍仅诊断。
- [x] focused tests、desktop typecheck、architecture guard 通过。

## 后续

真实多 worker 仍等待 SKU spike，不在本薄片内验收。
