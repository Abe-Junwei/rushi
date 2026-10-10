# 调研：2026-06 至 2026-09 语音转文字进展及 Rushi 可借鉴项

> **状态**：调研完成，待按优先级立项 spike
> **调研窗口**：2026-06-05 至 2026-09-05
> **架构真源**：[`asr-evaluation-routes.md`](../../architecture/asr-evaluation-routes.md) · [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) · [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)
> **前序证据**：[`funasr-sidecar-dependency-upgrade-research-2026-08.md`](./funasr-sidecar-dependency-upgrade-research-2026-08.md) · [`funasr-1.3.30-vad-punctuation-regression-repro.md`](./funasr-1.3.30-vad-punctuation-regression-repro.md) · [`r3g-d-diarization-clustering-rework-research.md`](./r3g-d-diarization-clustering-rework-research.md)
> **范围约束**：不使用 SenseVoice；不改变现有 loopback HTTP sidecar、OpenAI-compatible、MCP 或 realtime 架构；不在本轮直接更换默认 SKU。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | macOS / Windows 桌面端本机处理中文长录音、会议与访谈音频，需要稳定文本、可编辑语段、时间轴、热词和可选说话人分离。 |
| 当前主链路 | Tauri + React 桌面壳 -> Rushi Python loopback sidecar -> FunASR `1.3.16` -> Paraformer + FSMN-VAD + CT-Transformer PUNC；异步默认 120 秒窗，阻塞 300 秒窗；统一落到 `segments[]`。 |
| 当前优势 | 中文长音频、分段、标点、热词、缓存准备、取消、进度、unload 和诊断契约已形成完整产品链。 |
| 当前痛点 | PyInstaller + Torch 包体和冷启动偏重；PUNC 与 VAD 文本边界耦合；会议说话人聚类仍需真实金标；噪声/远场 fixture 不足。 |
| 成功标准 | 只采纳能在同一 D3/会议金标上证明文本、时间轴或资源收益的技术；不以英文榜单、GPU 服务吞吐或接口兼容宣传代替本机产品证据。 |

### 已读清单

- `AI_QUICKSTART.md`、`CONTEXT.md`
- `services/asr/pyproject.toml`
- `services/asr/rushi_asr/model_catalog.py`、`asr_model_profile.py`
- `services/asr/rushi_asr/segmentation.py`、`transcribe_windows.py`
- `services/asr/rushi_asr/speaker_diarization.py`
- `scripts/eval-run.py`、`scripts/eval-diarization.py`
- 本文顶部列出的架构与前序评测真源

## 2. 近三个月的重要进展

| 日期 | 路线 | 新进展 | 对 Rushi 的直接相关性 |
|------|------|--------|----------------------|
| 2026-08-30 至 09-03 | FunASR llama.cpp / GGUF | `runtime-llamacpp-v0.2.6` 提供 macOS arm64、Windows x64、Linux 的独立二进制；支持 Paraformer Q8/F16/F32 与内置 FSMN-VAD，无 Python 运行时。官方称 Paraformer 文本与 PyTorch 一致；macOS arm64 runtime 约 7 MB，Windows CPU runtime 约 5 MB（均不含模型）。 | **最高价值新变量**。它可能在不改变 Rushi sidecar 对外契约的前提下，降低 Python/Torch 发行负担。当前文档没有给出 CT-PUNC、热词支持；且明确没有 CAM++/聚类，因此只能先做隔离 runtime spike。 |
| 2026-07 至 08 | sherpa-onnx `1.13.x` | 新增/完善 Tauri 与多平台 native 包；speaker diarization 增加 pyannote window shift 可配置、分阶段耗时；修复 Paraformer LFR 边界 padding；原生库约 7-10 MB。 | 不推翻既有 Sherpa ASR No-go，但其**可观测性、窗口参数与边界测试方法**值得借鉴到现有说话人链路；native 打包形态可作为 GGUF sidecar 的工程参照。 |
| 2026-07-01 至 08-04 | whisper.cpp `1.9.2` | VAD 开启后，把 token 时间戳重新映射到原始音频时间轴，并公开内部 VAD speech segments；同时修正 CJK 字符长度处理。 | whisper.cpp 模型本身仍是本仓 No-go；但“处理时间轴”和“原始音频时间轴”显式分离，是对 `_join_vad_texts()` 回归最直接的设计启示。 |
| 2026-07-09 | MOSS-Transcribe-Diarize 0.9B | Apache-2.0 开源，50+ 语言；单次生成转写、说话人标签、时间戳和声学事件，目标是长音频多人场景。 | 说明行业正尝试把 ASR 与 diarization 联合建模，减少串联系统误差。但其本地参考栈是 Torch/Transformers，优化服务偏 CUDA/SGLang/vLLM；尚无 Rushi CPU/MPS、包体、热词和编辑时间轴证据，仅列观察候选。 |
| 2026-09-01 | sherpa-onnx `1.13.7` | 修复 Qwen3-ASR 在静音音频且指定热词/语言时产生幻觉；修正 Qwen3 特征提取约定。 | 再次证明“热词命中率高”不能单独作为质量证据；必须加入静音/纯噪声负样本和文本污染指标。Qwen3 默认路线仍不重开。 |

### 官方来源

- [FunASR v1.4.14 release](https://github.com/modelscope/FunASR/releases/tag/v1.4.14)
- [FunASR llama.cpp runtime v0.2.6](https://github.com/modelscope/FunASR/releases/tag/runtime-llamacpp-v0.2.6)
- [FunASR llama.cpp / GGUF README](https://github.com/modelscope/FunASR/blob/runtime-llamacpp-v0.2.6/runtime/llama.cpp/README.md)
- [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases)
- [sherpa-onnx pyannote window shift PR](https://github.com/k2-fsa/sherpa-onnx/pull/3769)
- [whisper.cpp v1.9.2](https://github.com/ggml-org/whisper.cpp/discussions/3971)
- [whisper.cpp VAD token timestamp mapping](https://github.com/ggml-org/whisper.cpp/pull/3910)
- [MOSS-Transcribe-Diarize](https://github.com/OpenMOSS/MOSS-Transcribe-Diarize)

## 3. 成熟路线对照

| 路线 | 代表实现 | 核心机制 | 复用度 | 与 Rushi 的冲突 |
|------|----------|----------|--------|------------------|
| A. 同模型换轻量 runtime | FunASR Paraformer GGUF + FSMN-VAD | C++/ggml 单二进制、量化权重、SRT/VAD 轴 | **高，需 spike** | 缺少已证明的 PUNC、热词、CAM++；CLI wrapper 每请求启动进程，生命周期与进度需适配 |
| B. 保留识别器，强化边界与可观测性 | whisper.cpp VAD mapping、sherpa diarization | 原始轴与处理轴映射；窗口参数显式化；分阶段耗时 | **高，可直接借鉴原则** | 不能照搬库 API；应落在现有 `segmentation.py` 和 `speaker_diarization.py` |
| C. 端到端 speaker-aware ASR | MOSS-Transcribe-Diarize | 单模型生成文本、speaker、timestamp | **低，观察** | Torch/Transformers 与 CUDA 服务偏重；生成式时间轴和 speaker 稳定性需单独验证 |
| D. 换新 ASR 模型/通用 runtime | Sherpa Qwen3、Whisper、Nano | ONNX/GGUF/LLM-ASR | **低至中** | 本仓已有 CER、RTFx、热词或时间轴 No-go 证据；新 runtime 不能自动消除模型质量问题 |

## 4. 可借鉴项与优先级

### P0：先吸收，不换模型

#### 4.1 把“声学时间轴”和“展示分段”变成显式双层契约

当前 `segmentation.py` 已是唯一分段真源，并已在其上做保守短段合并。下一步应把以下不变量写进测试：

1. VAD/识别得到的原始 acoustic span 不因标点或展示合段而丢失。
2. 展示段可合并，但必须保留来源 span 列表或可验证映射。
3. PUNC 只改变文本呈现，不得静默重排文本到另一个声学边界。
4. 分窗去重、VAD 裁剪后的 token/句时间必须映射回原始音频轴。

这是 whisper.cpp 最近 VAD timestamp 修复可直接迁移的设计原则，也能防止 FunASR `1.3.30` `_join_vad_texts()` 类问题再次只被 CER 偶然发现。

#### 4.2 扩展评测为四组正交指标

现有 `content_cer_chars` 已把识别内容与标点质量分开。建议补齐：

| 维度 | 建议指标 | 原因 |
|------|----------|------|
| 内容 | content CER、术语真实命中 | 防止标点差异冒充识别退化；检查热词是否真的纠错 |
| 呈现 | 含标点 CER、标点密度、连续重复率 | 捕获重复标点、重复文本和生成式污染 |
| 时间轴 | 边界 MAE/P95、窗口接缝重复/缺字、原始轴单调性 | 捕获 VAD 裁剪、offset、重映射错误 |
| 粒度 | 段数、时长 P10/P50/P90、短段率、超长段率 | 防止“准确但碎”或“整轨一段” |

负样本至少加入静音、纯背景噪声、热词开启的静音、极短音频。sherpa `1.13.7` 的静音热词幻觉修复说明这一门禁不是理论风险。

#### 4.3 给 diarization 增加阶段耗时和窗口敏感性证据

本仓已实现 CAM++ center、跨窗聚类、小簇回收与上限钳制。可借鉴 sherpa 的做法：

- 分别记录 VAD/ASR、speaker embedding、聚类、回填耗时；
- 在 gold 上比较 30 秒基线与相邻窗口配置，而不是只看最终 speaker 数；
- 把 window/overlap、阈值、floor 和 max speakers 写入评测产物，确保结果可复现；
- 增加窗口边界前后同一人、短插话、重叠语音的定向 fixture。

不直接引入 pyannote runtime，也不新建第二套 VAD。

### P1：最值得做的隔离 spike

#### 4.4 Paraformer GGUF runtime，保留 Rushi sidecar 外壳

目标不是采用官方 server，而是验证能否把当前 Python/Torch **推理内核**替换为 Paraformer GGUF 二进制，同时继续由 Rushi sidecar 提供既有 `/health`、prepare、async progress、cancel、unload、错误语义与桌面能力状态。

建议先做命令行隔离对照，不改 catalog：

| 门禁 | 要求 |
|------|------|
| 文本 | D3 content CER `<= baseline + 0.01`（比率绝对量，约 +1pp） |
| 粒度 | 语段时长分布不劣于当前合段后基线；不得整轨一段 |
| 时间轴 | 单调、在原始音频范围内；接缝无重复/缺字 |
| 性能 | 冷启动、首条转写、稳态 RTFx、峰值 RSS 均实测；RSS 只与 baseline 比较 |
| 体积 | 分开报告 runtime、GGUF、VAD、可选 PUNC；不能只报约 5-7 MB 的空 runtime |
| 能力 | 明确 PUNC、热词、diarization 的缺口；任一默认能力缺失则不得替换主线 |
| 平台 | macOS arm64 与 Windows x64 各自取证，不互相代签 |

优先试 Paraformer F16 与 Q8，不试 SenseVoice；Nano 只有在 Paraformer runtime spike 证明整条产品契约可承载后再讨论。

### P2：补数据后再决定

#### 4.5 噪声增强作为可选预处理，不默认开启

sherpa-onnx 已有 GTCRN/DPDFNet 等本机 ONNX speech enhancement 路径。Rushi 可借鉴“轻量前处理组件”形态，但当前 noisy/far-field 金标不足。先补近讲、远场、风扇/空调、多人会议四类 fixture，再做 `原音 -> ASR` 与 `增强 -> ASR` A/B；只有 content CER、术语和时间轴净收益同时成立才进入可选能力。

#### 4.6 MOSS 只做离线参照评测

MOSS 的价值是验证“一次生成 speaker-aware transcript”能否减少当前 ASR + CAM++ 串联误差。建议未来在有合适 GPU 时，用同一会议 gold 离线跑一次，比较 content CER、DER、speaker count、timestamp MAE 和幻觉率。它不进入当前 sidecar、catalog 或发布包。

## 5. 明确不做

1. 不使用 SenseVoice，任何新 runtime 只以 Paraformer 为首个候选。
2. 不因 FunASR 已有 OpenAI-compatible server 就替换 Rushi 自有 sidecar。
3. 不引入 MCP、realtime/WebSocket、麦克风增量状态机。
4. 不因 MOSS/Qwen3/Nano 的榜单或 GPU 吞吐直接更换默认模型。
5. 不重开 whisper.cpp 默认路线；只借鉴其 VAD 时间轴设计。
6. 不把 sherpa native 库体积等同于完整 ASR 包体；模型、VAD、PUNC 必须一起核算。
7. 不使用 monkey patch 修上游 `_join_vad_texts()`；产品层保持独立可测的展示合段。

## 6. 建议落地顺序

| 顺序 | 薄片 | 预计 | 产出 | 决策点 |
|------|------|------|------|--------|
| A | ASR 评测与时间轴门禁补强 | 0.5-1 天 | 新指标、静音/噪声负样本、边界回归 | 后续任何模型/runtime spike 的统一门禁 |
| B | Paraformer GGUF 隔离 spike | 1-2 天/平台 | macOS 首轮报告；Windows 独立报告 | Go：进入 sidecar 内核适配 Plan；No-go：维持 Python 主线 |
| C | diarization 可观测性补强 | 0.5-1 天 | 分阶段耗时、参数快照、窗口敏感性报告 | 等真实 speaker gold 后再调默认值 |
| D | speech enhancement A/B | 1-2 天 | noisy/far-field 金标与净收益报告 | 仅净收益明确时进入可选能力 |
| Radar | MOSS 同金标离线评测 | 有 GPU 时 | ASR+DER+时间轴报告 | 不阻塞当前路线 |

## 7. 决策摘要

| 问题 | 结论 |
|------|------|
| 是否立即升级 FunASR Python 包 | **否**。`1.3.30/1.4.1` 已有标点/断句 No-go 证据；`1.4.14` 的主要新增价值是另一条 runtime，不等于 Python 主链路质量修复。 |
| 是否有值得借鉴的新技术 | **有**。优先吸收 VAD 原始轴映射、正交质量指标、diarization 可观测性；它们直接加固现有链路。 |
| 是否有值得重新评估的运行时 | **有**。Paraformer GGUF/C++ 是近三个月最贴合 Rushi 的候选，因为它保留同一模型家族并直指包体/冷启动问题。 |
| 是否出现可直接替换默认模型的候选 | **没有**。MOSS 偏 GPU/生成式，Sherpa/Qwen/Whisper/Nano 仍受本仓既有门禁约束。 |
| 架构是否需要变化 | **不需要**。所有近期收益均可在现有 sidecar 边界内验证和吸收。 |

## 8. 签收

- [x] 调研窗口与官方来源明确
- [x] 对照至少两条成熟路线
- [x] 已结合当前代码、既有 spike 与产品门禁
- [x] 已明确可复用项与不做项
- [ ] Slice A/B 另建 intent / plan / acceptance 后实施

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-09-05 | 初版；对照 FunASR GGUF、sherpa-onnx、whisper.cpp 与 MOSS，形成 P0/P1/P2 落地顺序 |
