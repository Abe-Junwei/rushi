# 调研：ASR Runtime Readiness 与推理并发

> **状态**：已采纳（2026-06-16）  
> **关联**：R3-STATE · [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)  
> **进度项**：#15 ready_for_transcribe · #12 单 worker 队列

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户选择 Paraformer SKU 后，环境页与转写门控应反映「所选模型是否已加载可转写」，而非全局文件探测 |
| 本仓现状 | `runtime_caps.py` 的 `ready_for_transcribe` = disk cache + ffmpeg；前端 `computeLocalAsrTranscribeReady` 已去全局 fallback；`inference_queue.py` 单 worker FIFO |
| 成功标准 | `/health` 暴露分层 readiness；UI 显示队列 pending/running；Rust gate 与所选 SKU 对齐 |

---

## 2. 业内成熟路线

| # | 路线 | 代表 | 机制 |
|---|------|------|------|
| A | **分层 capability 矩阵** | Kubernetes readiness/liveness 分离 | disk / loadable / loaded / selected-ready 分列 |
| B | **单 worker + 队列 UX** | Celery single worker | 吞吐不变，暴露 queue depth |
| C | **多 worker 多模型实例** | Ray Serve / 多进程 | 内存线性涨，FunASR AutoModel 非线程安全 |

---

## 3. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A + B**：additive `/health` 字段 + 队列统计 UI；**不提升 worker 数**（v1.1） |
| 不做什么 | 不在 v1.1 做多 worker / 多进程 ASR |
| 字段 | 保留 `ready_for_transcribe`（兼容）；新增 `model_loaded_in_memory`、`selected_model_ready`（侧车 config 与 loaded id 一致且 required cached） |

---

## 4. 落位预告

| 层 | 文件 |
|----|------|
| Python | `runtime_caps.py` |
| Rust | `local_transcribe_gate.rs` |
| UI | `localAsrModelCatalog.ts`、`AsrTopStatusChips` / env panel |
| 测试 | `test_health.py`、`localAsrModelCatalog.test.ts` |

---

## 5. 签收

- [x] 调研 brief 完成
- [x] 可进入 Phase 7 实施
