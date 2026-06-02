# ASR 生态改进 backlog（2026-05 调研）

> **状态**：📋 已采纳为路线图索引（2026-05-30）  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤″f**（R3t-F + ASR-VOC）、§4.1.8（并行 spike）  
> **词汇偏置落地**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md)  
> **专项 spike**：[`r3g-b-qwen3-asr-sku-spike-research.md`](./r3g-b-qwen3-asr-sku-spike-research.md)  
> **背景**：2026-04～05 行业 STT 动态（FunASR 1.3.3、Qwen3-ASR、OpenAI Realtime-Whisper、CUDA perf 等）与 Rushi 代码现状对照

---

## 1. 用途

本文 **不替代** §4.1.1 严格主序；用于：

1. 记录 **已调研、尚未立项** 的改进项  
2. 为每项标注 **收益 / 工作量 / 依赖 / 是否 spike**  
3. 与 **R3g-B、R3h、ACC、STREAM-*** 等已有 Epic 对齐，避免重复发明

---

## 2. 优先级总表

| 优先级 | ID / 名称 | 收益摘要 | 估时 | 依赖 | 路线图落点 | 状态 |
|--------|-----------|----------|------|------|------------|------|
| **P0** | **R3e-C** | 长音频 preview + 停止转写 | — | R3e-B ✅ | §4.1.1 **⑥½** | ✅ 2026-05-31 |
| **P0** | **R3g-C** | Profile/ITN/语言 UI；减 fallback warning | 3–5d | R3t-A ✅ | §4.1.1 **⑤g** | ✅ 2026-05-31 |
| **P0** | **ACC-STT-UNIFY** | 术语表 → 本机+在线 adapter 一致 | 2–4d | R3t-B ✅ | §4.1.1 **⑤h** | ✅ 本机 2026-05-31 |
| **P0** | **ACC-EVAL-1**（= **ASR-VOC-5**） | 专名 term_hit + hotwords on/off | 1–2d | fixtures/eval | §4.1.1 **⑤″f-5** / **⑤″f-A** | 📋 并入 ⑤″f |
| **P1** | **R3h-ASR-VER** | FunASR **≥1.3.3** lock + sidecar 回归 | 1–2d | R3h-0 smoke | §4.1.8 | 📋 |
| **P1** | **R3g-B Qwen3 spike** | 评估第三 SKU（0.6B）质量/磁盘；**须专测伪流式/G4** | 2–4d | R3h-ASR-VER 建议先 | §4.1.8、专项 research §8 | 📋 research ✅ |
| **P1** | **R3h-CUDA-PERF** | CUDA 侧车 p95/首段 SLA（抄 Together 思路） | 3–5d spike | R3e-C SLA log | §4.1.8 | 📋 |
| **P1** | **R3e-C.5 poll→event** | Tauri event 替代 800ms poll，降 CPU | 1–2d | R3e-C ✅ | §4.1.8 | 📋 |
| **P2** | **R3g-B Nano+vLLM** | GPU 用户长音频提速 | spike 2–4d | Qwen3 Go/No-go | §4.1.8 | ⏳ |
| **P2** | **ACC-ONLINE-U3** | Realtime-Whisper / U3 Pro 在线 STT | 设计 only | ACC-STT-UNIFY | **STREAM-*** | ⏳ |
| **P2** | **R3g-B diarization** | 说话人 id → schema/UI | 大 | R3t 段模型 | §8.1 | ⏳ |
| **P2** | **ASR-RADAR-FireRed** | FireRedASR2-AED：中文 CER SOTA、统一 VAD+LID+Punc；**非 FunASR 生态** | 跟踪 | Sherpa Spike 结论 | §3.3 | 📋 雷达 |
| **P2** | **ASR-RADAR-Moonshine** | Moonshine Tiny 27M / ~26MB；边缘低 RAM；中文精度未达 Paraformer | 跟踪 | 边缘场景需求 | §3.3 | 📋 雷达 |
| **—** | Parakeet/MiMo/换引擎 | 与 ADR-0003 冲突或接入成本高 | — | — | **不做** v1 | ❌ |
| **—** | Speech-to-speech Agent | 非文件编辑器形态 | — | — | **不做** | ❌ |

---

## 3. 分项说明

### 3.1 P0 — 主序内（必须做）

#### R3e-C ✅（2026-05-31）

| 项 | 内容 |
|----|------|
| **签收** | 制控.mp3 ~20.8min；197 段；首段 ~23.9s；blocking ≡ async final；cancel OK |
| **文档** | [`r3e-c-incremental-transcribe-hand-test-checklist.md`](./r3e-c-incremental-transcribe-hand-test-checklist.md) |

#### R3g-C / ACC-STT-UNIFY / ACC-EVAL-1

见路线图 **⑤g / ⑤h / §8.1**；与 2026-05 调研结论一致：**Preset-first + 词表统一** 仍是本仓精度主路径，不引入新引擎。

---

### 3.2 P1 — 同栈加深（FunASR 1.3.3 时代）

#### R3h-ASR-VER（侧车 FunASR 版本跟进）

| 项 | 内容 |
|----|------|
| **行业** | [FunASR v1.3.3](https://github.com/modelscope/FunASR/releases/tag/v1.3.3)（2026-05-23）：Qwen3 修复、`funasr-server` OpenAI 兼容 |
| **收益** | Qwen3 spike 前置；减少 stale async 侧车；eval 脚本可对齐 OpenAI SDK |
| **落位** | `services/asr/requirements-sidecar-*.lock`；`npm run asr:build-sidecar-unix`；pytest 全绿 |
| **不做** | 用 `funasr-server` **替换** `rushi_asr` 进程 |

#### R3g-B Qwen3-ASR SKU spike

见 [`r3g-b-qwen3-asr-sku-spike-research.md`](./r3g-b-qwen3-asr-sku-spike-research.md) §4.1 Go/No-go。**产品化** 仅在 spike **Go** 后进入 catalog。

#### R3h-CUDA-PERF

| 项 | 内容 |
|----|------|
| **行业** | [Together 2026-05-29](https://www.together.ai/blog/how-together-ai-built-the-worlds-fastest-speech-to-text-stack)：decoder CUDA graph、减 copy、`gc.freeze()` |
| **收益** | 20min Job 墙钟 ↓；`first_segments_visible_ms` ↓（Windows CUDA 用户） |
| **落位** | `funasr_engine.py` profiling；可选 benchmark 脚本；**不换 Parakeet 权重** |
| **闸门** | 同机 Paraformer **≤1.5×** 墙钟或 p95 改善可度量 |

#### R3e-C.5 poll → Tauri event（可选 polish）

| 项 | 内容 |
|----|------|
| **收益** | 降 800ms loopback poll CPU；UI 进度更跟手 |
| **落位** | 侧车 emit / Rust 转发 / 桌面订阅；**保留** poll fallback |
| **依赖** | R3e-C ✅ |

---

### 3.3 P2 — 新 Epic 或远期

| 项 | 说明 |
|----|------|
| **Fun-ASR-Nano + vLLM** | FunASR 宣称 batch **~340× RTF**；**GPU 速度线**；与 Qwen3 **质量线** 串行 spike |
| **OpenAI GPT-Realtime-Whisper** | 2026-05-07 在线流式 STT；属 **STREAM-*** / 在线 Provider 扩展，**不**替换 batch `project_run_transcribe` |
| **AssemblyAI U3 Pro / Deepgram Nova-3** | 在线 batch **专名/幻觉** 优化；在 ACC-STT-UNIFY 后 A/B |
| **FunASR diarization (`campplus`)** | 需 schema + UI + 导出；**非** v1 薄片 |
| **ASR-RADAR-FireRed**（FireRedASR2） | 2026-02 中文 SOTA（AED ~1.1B CER ~0.57%）；统一 VAD+LID+Punc 与 R3t-A 方向一致。**限制**：60s 最大输入（AED）、非 FunASR 生态、LLM 版 VRAM 高。**v1 不做**；Sherpa Spike Go 后评估第三引擎；跟踪 [`ADR-0003`](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) 附录 A |
| **ASR-RADAR-Moonshine** | 27M 参数 / ~26MB；低 RAM 边缘场景。**v1 不做**；中文精度未达 Paraformer |
| **SenseVoice 弃用时间线** | 百炼等平台 approaching deprecation；**R3g-C C4** 去 SenseVoice「推荐」标签；Qwen3 spike Go 后评估默认 SKU 迁移（**不删** SenseVoice v1） |

---

### 3.4 明确不做（调研归档）

| 技术 | 原因 |
|------|------|
| NVIDIA **Parakeet** 作中文主引擎 | 25 欧语；[ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) FunASR-first |
| **MiMo-V2.5-ASR** 直接接入 | 未进 FunASR 官方 SKU 表；成本 > Qwen3 路径 |
| **FunASR WS streaming** 替换 R3e-C | 与 SQLite 单真源冲突；[`r3e-c-incremental-transcribe-research.md`](./r3e-c-incremental-transcribe-research.md) 已否决 v1 |
| **GPT-Realtime-2** speech-to-speech | Agent 形态；L4 仍用户触发 |
| **Corti Symphony** 等垂直 STT | 非通用转写编辑器 |

---

## 4. 与代码现状对照（2026-05-30）

| 能力 | 代码 | backlog 项 |
|------|------|------------|
| 长音频分窗 | `transcribe_windows.py` ✅ | R3e-B ✅ |
| Async preview + cancel | `transcribe_job.py` + 桌面 controller ✅ | R3e-C ✅ 2026-05-31 |
| 双 SKU catalog | `model_catalog.py` ✅ | R3g-B Qwen3 spike |
| `qwen` 无 punc 管道 | `funasr_pipeline.py` ✅ | Qwen3 spike 可试 env |
| Profile generic | `asr_model_profile.py` 🟡 | **R3g-C** 优先 |
| 在线 STT batch | `stt_native/*` ✅ | ACC-STT-UNIFY |
| FunASR lock 版本 | pre-1.3.3 可能 | **R3h-ASR-VER** |

---

## 5. 建议执行顺序（在 §4.1.1 主序之外叠加）

```text
【主序】R3g-C → ACC-STT-UNIFY → ACC-EVAL-1 → R3t-D …
    ↓
【并行 P1】
  R3h-ASR-VER（1–2d）
    → R3g-B Qwen3 spike（2–4d）
    → R3h-CUDA-PERF spike（可选）
    ↓
【Polish】R3e-C.5 event（1–2d，可选）
```

---

## 6. 签收

- [x] backlog 完成（2026-05-30）  
- [x] 已并入 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8  
- [x] **R3e-C ✅**（2026-05-31）  
- [ ] R3h-ASR-VER 立项（可选 acceptance 单行）  
- [ ] Qwen3 spike 执行 + Go/No-go  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-30 | 初版：P0–P2 表 + 与 R3e-C/R3g-B/R3h 对齐 |
| 2026-05-30 | 外部评估吸收：FireRedASR2 / Moonshine 雷达；SenseVoice 弃用；Qwen3 伪流式 → spike §8 |
| 2026-05-31 | R3e-C 手测签收（制控.mp3） |
