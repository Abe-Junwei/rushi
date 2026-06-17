# 调研：FunASR 推理并发与队列 UX

> **状态**：规划门禁（2026-06-17）  
> **关联进度**：[`full-code-review-remediation-progress-2026-06-16.md`](./full-code-review-remediation-progress-2026-06-16.md) #12 衍生未修复项  
> **关联架构**：[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)  
> **门禁**：未完成本文与后续 spike 前，不得把 `RUSHI_FUNASR_INFERENCE_WORKERS` 从诊断字段改为真实多 worker 配置。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户连续提交多个转写任务或 async job 时，桌面端应清楚说明任务是在转写还是排队；若未来启用多 worker，应保证不因模型实例共享、VAD cache、PyTorch 线程池过度订阅导致错误或更慢。 |
| 本仓现状 | `services/asr/rushi_asr/inference_queue.py` 使用 `SingleWorkerInferenceQueue` 串行执行 `model.generate()`；`requested_inference_workers()` 仅返回环境变量诊断值，`inference_max_workers` 固定为 1；`funasr_engine.py` 仍有 `_runtime_lock` 包住 `_run_generate()`；`test_requested_workers_are_diagnostic_only` 明确锁住当前行为。 |
| 成功标准 | 近期：队列深度可观测并被 UI 使用，用户看到“前方 N 个任务排队”；远期：只有在真实 SKU spike 证明收益和稳定性后，才允许开启多 worker 或多进程。 |

---

## 2. 业内成熟路线（>=2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 单 worker FIFO + 显式队列 | 本仓当前侧车、很多桌面本地推理工具 | 一个模型实例串行推理；HTTP 可并发接收，但推理层排队；UI 展示 pending/running | `services/asr/rushi_asr/inference_queue.py` |
| B | 共享实例多线程 | PyTorch / FunASR Python `AutoModel` | 多线程调用同一模型实例；要求 forward 不写共享状态，且每线程显式 `no_grad` / `inference_mode`；需控制 torch intra/inter-op 线程 | https://discuss.pytorch.org/t/is-evaluating-the-network-thread-safe/37802 |
| C | 多 worker 多实例 / 多进程 | whisper.cpp server、FunASR runtime / C++ SDK、production ASR serving | 每个 worker 持有独立模型实例或独立进程；通过请求队列分发；内存换吞吐 | https://github.com/modelscope/FunASR/blob/main/runtime/docs/SDK_advanced_guide_online.md |
| D | Batch / vLLM 服务化 | Fun-ASR-Nano vLLM / FunASR runtime | 将多个请求合批或交给专用 serving runtime；更高吞吐但需要新依赖和服务形态 | https://github.com/FunAudioLLM/Fun-ASR |

公开风险参考：

- PyTorch 推理线程安全取决于模型 forward 是否写共享状态：`https://discuss.pytorch.org/t/is-evaluating-the-network-thread-safe/37802`
- PyTorch 全局线程池可能过度订阅：`https://pytorch.org/blog/optimizing-libtorch/`
- FunASR 曾修复 VAD 多线程 cache 问题：`https://github.com/modelscope/FunASR/pull/2613`
- FunASR runtime 文档支持 decoder / model thread 配置，但属于独立 runtime / SDK，不是当前 Python sidecar 主路径。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 单 worker FIFO + 队列 UX | 高 | `inference_queue_stats()` 已输出 pending/running/requested/max；`GET /health` 已合并 runtime caps | 不提升吞吐，只提升可观测与用户预期 | 几乎无额外内存；最适合近期薄片 |
| B 共享实例多线程 | 低 | 可把队列改为 N worker threads | FunASR `AutoModel` 内部有 mutable kwargs/cache 历史；`_runtime_lock` 正是为规避共享状态；CPU/MPS 上可能更慢 | 需真实模型压力测试；失败模式复杂 |
| C 多实例 / 多进程 | 中 | 可复用 queue API 与 timeout reset 语义 | 每 worker 加载一份模型，可能超出 5GB 策略；Windows CUDA / macOS MPS 行为需分别测 | 吞吐可控但内存成本高 |
| D 服务化 / vLLM | 低 | 仅可复用 HTTP 外层与 normalize | 引入第二运行时和大依赖；违背当前 FunASR sidecar-first 小白桌面策略 | 适合作远期雷达，不进近期 |

**本仓已有可复用模块**：

- `services/asr/rushi_asr/inference_queue.py`：队列深度、timeout reset、诊断字段。
- `services/asr/rushi_asr/runtime_caps.py`：`/health` 能力字段聚合。
- `services/asr/rushi_asr/transcribe_job.py`：async job phase / message，可承接 queue position。
- `apps/desktop/src/services/asr/` 与环境页能力 UI：可消费 queue stats 显示排队状态。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **近期选 A：保留单 worker FIFO，先做显式排队 UX**。`RUSHI_FUNASR_INFERENCE_WORKERS` 继续是诊断字段，不控制真实 worker。 |
| 不做什么 | 不直接把 `SingleWorkerInferenceQueue` 改成 thread pool；不移除 `_runtime_lock`；不在 Paraformer 上单独做一套并发而绕过 Nano / Qwen SKU 评估。 |
| 与 ADR / architecture 关系 | 对齐 `asr-sidecar-funasr-policy.md` 的本地侧车与 5GB 预算；保持 FunASR Python sidecar 为主路径；不新增第二套 provider / runtime。 |
| 风险与 spike 项 | 真并发须在 SKU spike 中测：Paraformer-large-vad-punc、SenseVoice/Nano、Qwen forced aligner；指标包括 wall clock、峰值 RSS、错误率、输出分段一致性、取消/timeout reset 行为。 |

---

## 5. 建议实施阶段

| 阶段 | 目标 | 落位 | 验证 |
|------|------|------|------|
| C1 | 排队 UX | `/health` 或 async job status 暴露 `inference_queue_pending` / `running`；桌面端显示“前方 N 个任务排队” | ASR pytest + desktop health parsing tests |
| C2 | Spike harness | 增加本地脚本并发提交 N 个短/长音频，记录 wall clock、RSS、warnings、segmentation_mode | 不进 CI；记录到 spike results |
| C3 | 多实例评估 | 若 C2 证明共享实例不安全或无收益，评估多进程/多实例成本 | 峰值内存不得突破产品预算；失败时登记 accepted limitation |
| C4 | 真实 worker 配置 | 仅在 spike Go 后，把 `requested_inference_workers()` 改为配置真源，并更新 tests | `test_requested_workers_are_diagnostic_only` 改为新行为 |

---

## 6. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | `services/asr/rushi_asr/inference_queue.py` | 近期仅保持 stats；不改 worker 数 |
| Python ASR | `services/asr/rushi_asr/runtime_caps.py` / `app.py` | 确认 health/status 输出 queue stats |
| Python ASR | `services/asr/rushi_asr/transcribe_job.py` | async job message 可带 queue position |
| UI | `apps/desktop/src/services/asr/` / 环境或转写状态组件 | 显示排队提示 |
| 测试 | `services/asr/tests/test_inference_queue.py` | 继续锁住 diagnostic-only，C4 前不得改 |
| 文档 | spike results / acceptance | 若维持单 worker，登记 accepted limitation 与用户文案 |

---

## 7. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-17 | 初版：确认近期保留单 worker FIFO，优先队列 UX；真并发等待 SKU spike |
