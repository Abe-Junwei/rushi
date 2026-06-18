# 调研：R3g-C — Fun-ASR-Nano-2512 + vLLM 路线

> **状态**：research ✅ · **❌ Defer 2026-06-18**（无 NVIDIA CUDA 环境 · **目前不做** CUDA spike；文档保留供日后重开）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.8 · §10.5  
> **前置专项**：[`r3g-c-funasr-nano-spike-results.md`](./r3g-c-funasr-nano-spike-results.md) — PyTorch `AutoModel` 路径 **Defer**；[`asr-landscape-top4-research-2026-06.md`](./asr-landscape-top4-research-2026-06.md) 路线 C  
> **门禁**：未完成本文 **不得** 进入 `r3g-c-funasr-nano-vllm-intent.md` 与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 中文长课音频（13～21min+）本机转写；Rushi 桌面用户中 **有 NVIDIA GPU 且愿意接受更大模型体积** 的群体，希望获得比 Paraformer 更好的鲁棒性 / 准确率 |
| **环境约束** | 当前开发机 **仅 macOS**，无 NVIDIA CUDA；vLLM 官方主路径为 CUDA，macOS 虽有 [vllm-metal](https://github.com/vllm-project/vllm-metal) 实验插件，但 **Fun-ASR-Nano + vLLM 在 Apple Silicon 上未经验证**。本 spike 必须在 Windows/Linux CUDA 环境执行 |
| **本仓现状** | R3g-C PyTorch `AutoModel` 路径已 **Defer**：全量制控触发 `tiktoken <|no|>` stub；3min 片段仅产 `vad_timestamp` 而非 `sentence_info`；180s 强制窗可跑通但段数 108 vs Paraformer 198，N2/N3 未达标（详见 [`r3g-c-funasr-nano-spike-results.md`](./r3g-c-funasr-nano-spike-results.md)） |
| **成功标准（spike）** | 在 **Windows CUDA 源码 venv** 下，`Fun-ASR-Nano-2512` 经 vLLM 后端复跑同一制控样本，验证是否：**A1** 不再 `<|no|>` stub；**A2** 产出 `sentence_info` 或至少稳定语段数 ≥ Paraformer 90%（≥178）；**A3** wall ≤ 1.5× Paraformer（≤ ~280s）；**A4** 峰值显存 ≤ 8GB；**A5** 失败时仍可降级到 Paraformer |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **FunASR `AutoModelVLLM` 同进程** | FunASR 官方 vLLM Guide、`yuekaizhang/Fun-ASR-vllm` | 侧车内 `from funasr.auto.auto_model_vllm import AutoModelVLLM`；vLLM 负责 LLM decode；FunASR 负责 encoder + VAD + segmentation | [FunASR vLLM Guide](https://modelscope.github.io/FunASR/vllm.html) · [GitHub yuekaizhang/Fun-ASR-vllm](https://github.com/yuekaizhang/Fun-ASR-vllm) |
| B | **vLLM `serve` 独立进程，侧车作 client** | vLLM 官方 Qwen3-ASR recipes、`funasr-server` | `vllm serve Qwen/Qwen3-ASR-1.7B` 或 `funasr-server --model fun-asr-nano`；OpenAI `/v1/audio/transcriptions` 兼容 | [vLLM Qwen3-ASR](https://docs.vllm.ai/projects/recipes/en/latest/Qwen/Qwen3-ASR.html) · [FunASR server](https://www.funasr.com/en/) |
| C | **云端 / 容器化 vLLM-ASR** | Modal.com Canary-Qwen、NVIDIA NIM4-ASR | GPU 云 serving；与 Rushi 离线桌面目标不同，仅方法论参考 | [Modal STT blog](https://modal.com/blog/open-source-stt) · [NIM4-ASR arXiv](https://arxiv.org/html/2604.18105v1) |

**路线 A 与 Rushi 最贴合**：仍走 `transcribe_upload()` → `funasr_engine` → `segmentation.py`，HTTP contract 可不变；vLLM 作为 engine 内部后端。

**路线 B 与 Rushi 产品策略冲突**：本仓 backlog 已明确不用 `funasr-server` 替换 `rushi_asr` HTTP 面；多进程增加启动/诊断复杂度，仅适合开发者模式。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A 同进程 `AutoModelVLLM`** | **中** | `funasr_engine.py` 模型单例、`generate_and_parse_funasr()`、`segmentation.py`、HTTP contract | CPU / MPS 不可用；侧车 lock 体积大增；vLLM 版本锁与现有 lock 分叉 | 推荐环境：vLLM 0.12.0 + torch 2.9.0；峰值显存 4–8GB；RTF 预期显著优于 PyTorch |
| **B 独立 vLLM server + client** | **低** | OpenAI transcription API 调用逻辑可参考 | 与「单 bundled 侧车 + 小白安装」策略冲突；端口/启动失败面增加 | 显存同 A；但侧车包可保持较小 |
| **C 云端** | **无** | — | 与 Rushi 本地优先 / 隐私叙事冲突 | — |

**本仓已有可复用模块**（必须先列再决定是否扩展）：

- `services/asr/rushi_asr/funasr_engine.py`：engine 抽象已有 `generate_and_parse_funasr()`，可新增 `VllmFunAsrEngine`
- `services/asr/rushi_asr/asr_model_profile.py`：SKU profile 与参数白名单机制
- `services/asr/rushi_asr/inference_queue.py`：vLLM 路径应 **绕过** `SingleWorkerInferenceQueue`
- `services/asr/rushi_asr/segmentation.py`：分段真源，必须继续解析 `sentence_info` / `timestamp`
- `services/asr/rushi_asr/transcribe_windows.py`：长音频分窗，180s 强制窗可复用
- `apps/desktop/src/services/asr/localAsrModelCatalog.ts` / `model_catalog.py`：catalog 条目与准备流程

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **先做 GPU-only research spike（路线 A：同进程 `AutoModelVLLM`）**，验证 vLLM 能否解决 R3g-C PyTorch 路径的 N1–N3 blockers |
| **不做什么** | ① 不替换现有 Paraformer 默认推荐；② 不进 CPU/MPS 侧车 lock；③ 不用 `funasr-server` 替换 `rushi_asr` HTTP 面；④ 不上架 catalog；⑤ 不为 Nano 单独 fork `segmentation.py` |
| **与 ADR / architecture 关系** | ADR-0003 FunASR-first ✅；[`postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md) 已否决 bundled vLLM 用于 LLM 后处理 — ASR vLLM 是 **不同用途**，但同样受 **侧车体积 ~2.5GB 硬顶** 约束，只能作为 **Windows CUDA 变体可选 SKU** |
| **风险与 spike 项** | **当前无 CUDA 环境，无法本地执行 spike**；macOS MPS 无官方支持证据；vLLM 版本敏感；`<\|no\|>` 可能源于 CTC forced_align 而与 engine 无关；`sentence_info` 契约仍可能不满足 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | `services/asr/rushi_asr/funasr_engine.py` | 新增 `VllmFunAsrEngine`（spike 级） |
| Python ASR | `services/asr/rushi_asr/asr_model_profile.py` | 扩展 Nano-vllm SKU profile |
| Python ASR | `services/asr/rushi_asr/inference_queue.py` | vLLM 路径绕过单 worker 队列 |
| 产物 | `requirements-sidecar-cuda-win_amd64.lock` | 可能 bump vLLM + torch（仅 spike 验证，不进默认 lock） |
| 测试 | `docs/execution/spike-output/funasr-nano-vllm-YYYY-MM-DD/` | 输出 JSON/CSV 证据 |

---

## 附录 A：非 NVIDIA 消费级显卡对位与 vLLM 支持现状

> 本附录回答「不买 NVIDIA 还能买什么」的问题，但结论仍然是：**Rushi 的 vLLM 路径目前只能以 NVIDIA CUDA 为主目标**，其他平台要么不支持 vLLM，要么支持的模型/后端与 Fun-ASR-Nano 不兼容。

### A.1 消费级显卡性能/价格对位表（2026-06）

按 Rushi 已定义的 GPU 门槛（最低舒适线 12GB、甜点线 16GB）整理：

| 性能档位 | NVIDIA（CUDA） | AMD（RDNA 4） | Intel（Battlemage） | Apple Silicon |
|----------|----------------|---------------|---------------------|---------------|
| **甜点 16GB** | RTX 5070 Ti ($749) · RTX 5080 ($999) | **RX 9070 XT ($599)** · RX 9070 ($549) | Arc Pro B70 (~$1000，专业卡) | Mac Studio M4 Max 64GB ($3,499) |
| **舒适 12GB** | RTX 5070 ($549) | — | — | — |
| **入门 16GB** | RTX 5060 Ti 16GB ($429) | **RX 9060 XT 16GB ($349)** | — | — |
| **入门 8–12GB** | RTX 5060 8GB ($299) · RTX 5060 Ti 8GB ($379) | RX 9060 XT 8GB ($299) | Arc B580 12GB ($249–$260) · Arc B570 10GB ($219) | Mac Mini M4 16–24GB ($599–$799) |

**关键观察**：
- **AMD RX 9070 XT**：16GB / $599，光栅性能介于 RTX 5070 与 RTX 5070 Ti 之间，**性价比显著优于同档 NVIDIA**，但 ray tracing 与 AI 生态仍落后。
- **AMD RX 9060 XT 16GB**：$349 即可获得 16GB 显存，对标 RTX 5060 Ti 16GB 的性价比优势明显。
- **Intel Arc B580/B570**：预算级选择，显存大方（10–12GB），但 ray tracing、驱动成熟度、AI 框架优化均弱于 NVIDIA/AMD。
- **Apple Silicon**：统一内存可跑大模型，但 **vLLM 官方不支持 Metal/CUDA**，只能走 MLX / llama.cpp / vLLM-Metal 实验分支，与 FunASR `AutoModelVLLM` 不兼容。

### A.2 各平台 vLLM / FunASR 支持状态

| 平台 | vLLM 支持 | Fun-ASR-Nano `AutoModelVLLM` | Rushi 结论 |
|------|-----------|------------------------------|------------|
| **NVIDIA CUDA** | 一等公民，预编译 wheel | 官方推荐路径 | ✅ 唯一主目标 |
| **AMD ROCm** | vLLM 官方提供 ROCm 7.0 wheel；主要验证 **MI300 / RX 7900 系列（gfx90a/gfx1100）**；RX 9070/9060（RDNA 4，gfx1200 系列）支持状态待确认 | 未经 FunASR 官方验证 | ⚠️ 理论上可跑，但需额外 spike；Rushi 不做默认承诺 |
| **Intel XPU / Arc** | vLLM 上游有 XPU 后端，Intel 官方容器基于 v0.10.2 验证 **Arc Pro B60/B70**；Qwen3 系列已有验证，但 Fun-ASR-Nano 未验证 | 无公开验证 | ⚠️ 可作为后续探索，但不进入当前 spike |
| **Apple Silicon** | vLLM-Metal 实验插件（MLX 后端），要求 MLX 优化模型；官方 CPU 后端可编译但无 GPU 加速 | 不兼容 | ❌ 不纳入 vLLM spike；macOS 维持现有 Paraformer / PyTorch 默认路径 |

### A.3 对 Rushi 路线图的直接影响

1. **vLLM spike 仍只针对 NVIDIA CUDA**。AMD/Intel/Apple 即使硬件规格对标，也缺乏 FunASR 官方背书，不能作为 R3g-C 默认解决方案。
2. **如果未来要支持 AMD/Intel**，需要单独的 `r3g-c-funasr-nano-rocm-research.md` / `r3g-c-funasr-nano-xpu-research.md`，验证 ROCm/XPU 后端下 `AutoModelVLLM` 是否能产出 `sentence_info`。
3. **Apple Silicon 用户**继续走现有侧车默认路径（Paraformer + 可选 PyTorch Nano），不等待 vLLM。

---

## 附录 B：国产消费级显卡对位与 vLLM/FunASR 支持现状

> 本附录聚焦中国大陆本土品牌的消费级/桌面级 GPU：摩尔线程、砺算科技、景嘉微。结论：**摩尔线程是国产阵营中唯一接近 vLLM 可用性的品牌，但 Fun-ASR-Nano `AutoModelVLLM` 在 MUSA 上的兼容性仍需单独验证**。

### B.1 国产消费级显卡对位表（2026-06）

| 厂商 | 代表型号 | 显存 | 参考价格 | 性能定位 | 主要战场 |
|------|----------|------|----------|----------|----------|
| **摩尔线程** | MTT S80 | 16GB GDDR6 | ¥2,999 | 对标 RTX 3060 / 接近 RTX 4060（驱动持续优化中） | 游戏、轻 AI、信创 |
| **摩尔线程** | MTT S70 | 8GB GDDR6 | 价格面议（约 ¥1,299 档） | 入门游戏/办公 | 游戏、办公 |
| **摩尔线程** | MTT S90 / S4000 同架构 | 16GB | 未正式零售 | 官方宣称对标 RTX 4060 | 游戏 + AI |
| **砺算科技** | LX 7G100 创始版 | 12GB GDDR6 | ¥3,299 | 官方对标 RTX 4060；实测约为 RTX 4060 的 30%–70% | 国产首款全自研消费级游戏卡 |
| **景嘉微** | JM9230 / JM9271 | 8GB / 16GB | 信创/政企采购 | JM9230 ≈ GTX 1050；JM11 目标 ≈ RTX 4060 | 信创、军工、工业显控 |
| **沐曦 / 寒武纪 / 华为昇腾** | C500 / 思元 590 / 昇腾 910 | — | 数据中心级 | A100/H100 级别 | 数据中心、大模型训练/推理 |

**关键观察**：
- **摩尔线程 MTT S80**：16GB 大显存 + ¥2,999 定价，纸面性价比高于 RTX 4060；但驱动成熟度、游戏兼容性与 CUDA 生态完整度仍是主要差距。
- **砺算 LX 7G100**：国产 GPU「从 0 到 1」的里程碑，通过微软 WHQL 认证，但首版驱动未解锁满血性能，且 AI 推理生态几乎空白。
- **景嘉微 JM9**：信创出货量大，但性能仅到 GTX 1050 级别，不适合 LLM-ASR 推理。
- **沐曦/寒武纪/昇腾**：均为数据中心/AI 训练推理卡，非消费级桌面产品，与 Rushi 桌面用户场景不直接相关。

### B.2 国产平台 vLLM / LLM 推理支持现状

| 平台 | vLLM 支持 | LLM 推理生态 | Fun-ASR-Nano `AutoModelVLLM` | Rushi 结论 |
|------|-----------|--------------|------------------------------|------------|
| **摩尔线程 MUSA** | 2024 年开源 [vLLM-MUSA](https://github.com/MooreThreads/vLLM_musa)（基于 vLLM 0.4.2）；2026 年官方宣称 MUSA 成为 **vLLM 官方后端**、合入 SGLang 主线 | 支持 llama.cpp、Ollama、DeepSeek 蒸馏、Qwen2.5；MUSA SDK 5.1.0 对标 CUDA 12.8，兼容 761 个 CUDA API | **未验证** | ⚠️ 最有希望的国产路径，但需专门 spike 验证 `AutoModelVLLM` + `sentence_info` |
| **砺算 TrueGPU** | 无公开 vLLM 后端 | 支持主流图形 API（DX12/Vulkan/OpenGL/OpenCL），AI 推理展示过 Qwen3 32B / DeepSeek 14B / SD3，但框架细节不明 | 无公开支持 | ❌ 当前不支持 vLLM spike |
| **景嘉微 JM9/JM11** | 无 vLLM 后端 | 面向信创图形显示，AI 推理能力有限 | 无公开支持 | ❌ 不适合 LLM-ASR |
| **华为昇腾 / 寒武纪 / 沐曦** | 各自有 CANN / 推理框架 / 兼容层，非 vLLM 主生态 | 数据中心大模型推理 | 无公开支持 | ❌ 非消费级目标 |

### B.3 对 Rushi 路线图的直接影响

1. **国产 GPU 中，只有摩尔线程值得纳入后续技术雷达**。如果 Rushi 未来要提供「国产化 CUDA-free」可选 SKU，应优先立项 `r3g-c-funasr-nano-musa-research.md`，在 MTT S80/S4000 上验证：
   - `funasr` + `vllm-musa` 能否安装并识别 GPU；
   - `AutoModelVLLM("FunAudioLLM/Fun-ASR-Nano-2512")` 是否能加载；
   - 输出是否仍含 `<|no|>` stub、是否产出 `sentence_info`。
2. **砺算、景嘉微等暂不作为 vLLM 路径目标**。即使图形性能接近 RTX 4060，缺乏 PyTorch/vLLM 后端意味着 Rushi 侧车无法直接复用现有 Python 代码。
3. **华为昇腾 / 寒武纪 / 沐曦等数据中心卡**与 Rushi 消费级桌面用户场景不符，不在本路线图考虑范围内。

---

## 6. spike 命令与通过标准

### 6.1 环境

> **当前开发机为 macOS，无法本地执行此 spike**。以下命令适用于 Windows/Linux CUDA 环境。

```bash
# 新建隔离 venv（不与 bundled 侧车 lock 混淆）
python -m venv .venv-nano-vllm
source .venv-nano-vllm/bin/activate  # Windows: .venv-nano-vllm\Scripts\activate
pip install funasr vllm==0.12.0 torch==2.9.0 torchaudio
```

**macOS 说明**：
- vLLM 官方不支持 Apple Silicon 作为一等目标。
- [vllm-metal](https://github.com/vllm-project/vllm-metal) 为社区实验插件，与 FunASR `AutoModelVLLM` 的兼容性未知。
- 在 macOS 上强行跑 `AutoModelVLLM` 通常会 fallback 到 CPU 或安装失败，不能作为有效 spike 证据。
- 若后续 Apple Silicon 用户场景变得重要，应单独立项 `r3g-c-funasr-nano-mps-research.md`。

---

## 附录 C：DeepSeek V4 国产芯片适配梳理

> 本附录说明 DeepSeek V4（2026-04-24 发布）适配的国产芯片阵营，并指出：**这些芯片几乎都是数据中心/训练推理卡，与 Rushi 消费级桌面用户场景并不直接重合**；只有摩尔线程同时有消费级产品线，但消费级能否承载 V4-Flash 仍是未知数。

### C.1 DeepSeek V4 模型版本

| 版本 | 总参数量 | 激活参数 | 上下文 | 定位 |
|------|----------|----------|--------|------|
| **DeepSeek-V4-Pro** | 1.6T | 490B | 1M tokens | 高性能版 |
| **DeepSeek-V4-Flash** | 284B | 13B | 1M tokens | 高性价比版 |

V4 采用 MoE 架构 + FP4/FP8 混合精度，推理时仅激活百亿级参数，因此对显存和吞吐的要求低于同规模 Dense 模型，但仍需大显存/多卡集群。

### C.2 已官宣适配的国产芯片

| 厂商 | 芯片型号 | 角色 | 适配状态 | 与 Rushi 相关性 |
|------|----------|------|----------|-----------------|
| **华为昇腾** | 910B / 910C（训练）；950PR / 950DT（推理） | 主力训练 + 推理 | V4 技术报告首次将昇腾 NPU 与 NVIDIA GPU 并列写入硬件验证清单；从 CUDA 迁移至 CANN，重写 200+ 核心算子；2026-06 完成 1.6T V4-Pro 全参数后训练 | ❌ 数据中心/集群级，非消费级 |
| **寒武纪** | 思元 590 | 推理 | Day-0 适配 V4-Pro / V4-Flash，基于 vLLM 框架，代码开源 | ❌ 数据中心卡 |
| **摩尔线程** | MTT S5000（数据中心/训推一体） | 推理 | Day-0 适配 V4-Flash；依托原生 FP8 支持；智源 FlagOS 合作 | ⚠️ 同厂商消费级 MTT S80 理论可参考，但 S80 算力远低于 S5000 |
| **海光信息** | DCU Z100 / 深算二号 | 推理 | Day-0 适配 | ❌ 数据中心卡 |
| **沐曦** | C500 / C600 | 推理 | Day-0 适配（预览级） | ❌ 数据中心卡 |
| **昆仑芯** | 2代 / 3代 | 推理 | 参与 DeepSeek / GLM-5 适配 | ❌ 数据中心/云侧 |
| **壁仞科技** | BR100 系列 | 推理 | 参与 SenseNova U1 / DeepSeek 适配 | ❌ 数据中心卡 |
| **燧原科技** | 邃思系列 | 推理 | 参与 GLM-5 / DeepSeek 适配 | ❌ 数据中心卡 |
| **天数智芯** | 天垓 100 | 推理 | 早期宣布适配 DeepSeek 系列 | ❌ 数据中心卡 |
| **中昊芯英** | 刹那 TPU | 推理 | TPU 架构，千卡集群适配千亿参数模型 | ❌ 数据中心 TPU |

### C.3 关键判断

1. **DeepSeek V4 的国产适配集中在「算力自主可控」叙事**，面向云服务商、政企私有化、智算中心，不是消费级桌面显卡。
2. **唯一有消费级产品线的国产厂商是摩尔线程**，但：
   - 适配 V4-Flash 的是 **MTT S5000**（企业级/训推一体卡），不是消费级 MTT S80；
   - MTT S80 单卡算力远低于 S5000，即便能跑 V4-Flash，也需极高量化/切分，不现实；
   - 对 Rushi 而言，更有意义的仍然是验证 **Fun-ASR-Nano（0.6B–1B 级 ASR 模型）在 MTT S80 上的 vLLM-MUSA 路径**。
3. **DeepSeek V4 的国产芯片适配不直接改变 Rushi 的 GPU 门槛判断**：
   - 如果 Rushi 未来要接入 DeepSeek 类 LLM 作为本地后处理/Agent 能力，需要单卡 ≥ 16GB 显存且框架支持（CUDA / MUSA / CANN 等）；
   - 但当前 R3g-C 只关注 **Fun-ASR-Nano + vLLM 的 ASR 推理**，与 DeepSeek V4 不在同一量级。

---

### 6.2 最小验证脚本

```python
from funasr.auto.auto_model_vllm import AutoModelVLLM

model = AutoModelVLLM(
    model="FunAudioLLM/Fun-ASR-Nano-2512",
    hub="hf",
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 30000},
    tensor_parallel_size=1,
    gpu_memory_utilization=0.6,
)
res = model.generate(
    ["fixtures/eval/制控.mp3"],
    language="中文",
    hotwords=[...],
)
print(res[0].keys())
print(len(res[0].get("sentence_info", [])))
```

### 6.3 通过标准（Go/Defer）

| # | 检查项 | Go 阈值 | Defer 阈值 |
|---|--------|---------|------------|
| V1 | 不触发 `<\|no\|>` / stub | 全量制控通过 | 任意窗仍触发 |
| V2 | `sentence_info` 存在 | 有 | 仅 `vad_timestamp` |
| V3 | 语段数 | ≥178（Paraformer 90%） | <178 |
| V4 | wall time | ≤280s（1.5× Paraformer） | >420s（3×） |
| V5 | 峰值显存 | ≤8GB | >8GB |
| V6 | 可降级 | 失败时 Paraformer 仍可用 | 侧车崩溃/状态污染 |

**必须全部满足 V1–V6 才进入 intent 阶段**。

---

## 7. 签收

- [x] 调研 brief 完成（2026-06-17）
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入 spike 执行
- [ ] spike 输出目录 `docs/execution/spike-output/funasr-nano-vllm-YYYY-MM-DD/` 已产生

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-17 | 初版：承接 R3g-C PyTorch Defer，评估 vLLM 作为 GPU 第二运行时的可行性 |
| 2026-06-17 | 补充附录 A：AMD RDNA 4 / Intel Battlemage / Apple Silicon 对位与 vLLM/FunASR 支持现状 |
| 2026-06-17 | 补充附录 B：摩尔线程 / 砺算 / 景嘉微等国产消费级显卡对位与 vLLM/FunASR 支持现状 |
| 2026-06-17 | 补充附录 C：DeepSeek V4 国产芯片适配梳理（昇腾 / 寒武纪 / 摩尔线程 / 海光 / 沐曦 等） |
