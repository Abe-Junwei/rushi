# 调研：本机 ASR 加速 — GPU（MPS/CUDA）与分窗 / 长音频策略

> **状态**：已采纳（编码：GPU 自动 device；分窗默认不动）  
> **关联**：速度讨论「本机项 2 / 3」；策略真源 [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) §3；长音频 [`r3e-b-long-audio-chunking-research.md`](./r3e-b-long-audio-chunking-research.md)  
> **门禁**：分窗常量变更须另开 Plan；本文仅批准 **对齐 policy 的 device 自动解析**

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | Apple Silicon / Windows NVIDIA 本机转写要更快；长录音要控内存 |
| 本仓现状 | 策略写「MPS 优先 / Win CUDA 二选一」与「分窗」；**二进制选择与分窗已落地**，但推理 `device` 曾默认 `cpu` |
| 成功标准 | 未设 env 时 load/`/health` 可见自动 `mps`/`cuda`/`cpu`；`RUSHI_FUNASR_DEVICE` 仍可强制 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 |
|---|------|------|----------|
| A | 运行时选 device | FunASR `AutoModel(device=…)` / PyTorch | `cuda` → `mps` → `cpu` |
| B | 分发行物 | 本仓 Win 双包 | 壳探测驱动后启 CUDA/CPU onedir |
| C | 长音频切窗 | R3e-B 已签收 | 侧车内固定窗 + offset 合并 |

---

## 3. 可复用评估

| 路线 | 复用度 | 结论 |
|------|--------|------|
| A 自动 device | 高 | **采纳**：进程内探测；env 显式覆盖 |
| B Win 双包 | 高（已有） | 不改矩阵；CUDA 包内默认 `cuda` |
| C 调窗默认 | — | **本轮不改**（桌面主路径已 async 120s） |

**已有模块**：`candidates.rs`、`transcribe_windows.py`、`funasr_engine_load.py`、`segmentation.py`

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | `resolve_funasr_device()`：显式 env 优先；否则 `cuda` if available → `mps` → `cpu`；`/health` 上报 `funasr_device` + `funasr_device_source` |
| 不做什么 | 不改分窗默认；不做专家 UI；不上第二引擎；不要求壳注入 device（Python 侧解析即可） |
| 与 architecture | 兑现 policy §3「MPS 可用则优先」 |
| 风险 | 个别算子 MPS 差异 → 保留 `RUSHI_FUNASR_DEVICE=cpu` 强制回退；device 变更时 singleton 按 `_model_loaded_device` 重载 |
| 环境页 | 状态行「推理设备」展示 `/health.funasr_device`（+ loaded 不一致告警） |

### 项 2 / 3 摸底结论（执行前）

- **GPU**：Win 选对包 ≠ GPU 推理；mac 未自动 MPS（曾默认 cpu）。
- **分窗**：桌面本机走 async → **≥120s 即 120s 窗**；blocking 才是 1800s/300s。调窗收益次于开 GPU。

---

## 5. 落位

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `rushi_asr/funasr_device.py`（新）、`funasr_engine_load.py`、`runtime_caps.py` | resolve + health |
| 桌面类型 | `AsrHealthCapabilities` / `asrHealthParse` | 可选字段 |
| 文档 | policy §9、`services/asr/README.md` | 同步默认行为 |
| 测试 | `test_funasr_device.py`、health 断言 | 单元 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户确认执行（GPU 自动 device；分窗不动）

| 日期 | 说明 |
|------|------|
| 2026-07-11 | 初稿 + 采纳执行 |
