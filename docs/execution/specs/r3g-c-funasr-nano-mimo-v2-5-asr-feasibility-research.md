# 调研：R3g-C — 在现有 FunASR 侧车上接入 Fun-ASR-Nano 与 MiMo-V2.5-ASR 的可行性

> **状态**：规划门禁（2026-06-16）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1 **R3g-C**（本地模型 catalog / Profile 改造）
> **关联 spec**：`r3g-c-funasr-nano-intent.md` / `…-plan.md` / `…-acceptance.md`（仅 Fun-ASR-Nano spike Go 后立项）
> **门禁**：未完成本文 **不得** 改 `localAsrModelCatalog.ts`、`model_catalog.py`、`funasr_engine.py` 主路径

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | Rushi v1 本机长音频转写已用 **FunASR + Paraformer-large-vad-punc** 签收；用户希望未来有更多本地 SKU 可选，尤其在高精度、远场/方言、中英混杂等场景比 Paraformer 更强。 |
| **本仓现状** | 侧车为 PyInstaller 包（`services/asr/`），HTTP 8741；`funasr_engine.py` 通过 `AutoModel` 单例加载模型；`segmentation.py` 以 `sentence_info`/`timestamp` 为分段真源；`asr_model_profile.py` 已支持 `generic_funasr_v1`、`qwen`、`paraformer` 等 family。 |
| **成功标准** | 在 **不改架构、不新增第二推理栈** 前提下，评估两款新模型能否复用现有 FunASR 侧车链路；输出 **Go / Defer / No-go** 及所需 spike 范围。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 | 核心机制 | 与现有 FunASR 侧车关系 |
|---|------|----------|----------|------------------------|
| **A** | **Fun-ASR-Nano-2512 via FunASR AutoModel** | `FunAudioLLM/Fun-ASR-Nano-2512` | 端到端 LLM-ASR；`trust_remote_code=True` + `remote_code="./model.py"`；VAD 切分；内置标点/ITN；`sentence_timestamp=True` 出时间轴 | **同栈**：直接替换 `AutoModel` 的 `model=` 参数 |
| **B** | **MiMo-V2.5-ASR via 官方 Xiaomi 推理栈** | `XiaomiMiMo/MiMo-V2.5-ASR` | 8.02B Qwen2-based；需独立 `MimoAudio` 类 + `MiMo-Audio-Tokenizer`；官方仅 Linux/CUDA 12+/Python 3.12/flash-attn | **异栈**：不走 FunASR `AutoModel`，需新增 Python 依赖与 HTTP 面 |
| **C** | **MiMo-V2.5-ASR via 社区 GGUF/MLX** | CrispASR / `mimo_mlx` / `carlos1224/MiMo-V2.5-ASR-MLX-*` | GGUF Q4_K 约 4.5GB；MLX int4/bf16/f32 支持 Apple Silicon；均需单独 tokenizer | **异栈**：C++ / MLX 运行时；与现有 PyInstaller 侧车不兼容 |

链接：
- Fun-ASR-Nano README / ModelScope：`FunAudioLLM/Fun-ASR-Nano-2512`
- MiMo-V2.5-ASR GitHub：`https://github.com/XiaomiMiMo/MiMo-V2.5-ASR`
- CrispASR MiMo 支持：`https://github.com/CrispStrobe/CrispASR`

---

## 3. 可复用评估

### 3.1 Fun-ASR-Nano-2512

| 维度 | 评估 |
|------|------|
| **复用度** | **高** |
| **可直接用** | `funasr_engine.py` 的 `_get_model` 单例、`transcribe_windows.py` 窗循环、`segmentation.py`、HTTP 面、LRC prepare 机制 |
| **冲突 / 缺口** | ① `trust_remote_code=True` + `remote_code="./model.py"`；PyInstaller 需验证 `model.py` 能打包；② `language="中文"` 而非 `zh`，需补 `asr_model_profile` 映射；③ `recognizer_needs_punc_pipeline` 应为 False（内置标点）；④ 磁盘 ~800M–1GB |
| **速度/资源** | CPU 可跑；MPS/CUDA 更快；官方未给明确 RTF，但 0.8B LLM-ASR 预计慢于 Paraformer，需实测 |
| **标点** | ✅ 内置，无需 ct-punc |
| **热词** | ✅ API 支持 `hotwords=[...]` |
| **时间轴/语段** | ✅ `sentence_timestamp=True` 输出句级时间轴；与 `segmentation.py` 契约对齐 |
| **长音频** | 需 VAD（`fsmn-vad`）切分，与现有 R3e-C 窗循环兼容 |

**接入方式示例（调研用）**：

```python
from funasr import AutoModel

model = AutoModel(
    model="FunAudioLLM/Fun-ASR-Nano-2512",
    trust_remote_code=True,
    remote_code="./model.py",          # PyInstaller 打包风险点
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 30000},
    device="cpu",                      # Rushi 默认 CPU/MPS
)

res = model.generate(
    input=["audio.mp3"],
    cache={},
    batch_size=1,
    hotwords=["制控"],
    language="中文",
    itn=True,
    sentence_timestamp=True,
)
```

### 3.2 MiMo-V2.5-ASR

| 维度 | 评估 |
|------|------|
| **复用度** | **低** |
| **可直接用** | 几乎无；仅音频预处理（ffmpeg 16kHz mono）可复用 |
| **冲突 / 缺口** | ① **不走 FunASR AutoModel**，需新增 `MimoAudio` 推理类；② 官方仅 Linux + CUDA 12.0 + Python 3.12 + flash-attn，与 Rushi 跨平台桌面（macOS/Windows）冲突；③ 8.02B 模型体积大（bf16 ~16GB 内存，Q4_K ~4.5GB）；④ 输出只有 `text`，**没有时间轴/语段**，需自研 VAD+对齐；⑤ **无热词 API** |
| **速度/资源** | 8B MoE，RTF 预计 0.1–0.3（GPU）；CPU 不可接受；Mac 仅社区 MLX/GGUF，非官方支持 |
| **标点** | ✅ 原生支持 |
| **热词** | ❌ 无 API |
| **时间轴/语段** | ❌ 需额外实现；不能直接进 `segments[]` |
| **长音频** | 未知；官方 demo 未强调长音频分窗 |

**官方接入方式（调研用）**：

```python
from src.mimo_audio.mimo_audio import MimoAudio

model = MimoAudio(
    model_path="./models/MiMo-V2.5-ASR",
    tokenizer_path="./models/MiMo-Audio-Tokenizer",
)
text = model.asr_sft("audio.wav")   # 仅返回 text
```

### 3.3 本仓必须先复用（禁止 fork 第二套分段写入）

| 模块 | 路径 | 用法 |
|------|------|------|
| 分段真源 | `services/asr/rushi_asr/segmentation.py` | 仅接受 `sentence_info` / `timestamp` 格式 |
| 引擎单例 | `services/asr/rushi_asr/funasr_engine.py` | `_get_model` 加载模型 |
| Profile | `services/asr/rushi_asr/asr_model_profile.py` | `sku_family`、`funasr_language_for_model` |
| 长音频窗 | `services/asr/rushi_asr/transcribe_windows.py` | VAD 切分 + 窗循环 |
| HTTP 面 | `services/asr/rushi_asr/app.py` | `/v1/transcribe` 契约 |
| LRC prepare | `local_runtime/` + `model_prepare*.py` | 模型下载/校验 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **Fun-ASR-Nano** | **可行，建议 spike**。它是 FunASR 官方继任者，与现有侧车同栈，集成成本远低于 Sherpa/Qwen/Aligner。 |
| **MiMo-V2.5-ASR** | **在现有 FunASR 基础上不可行**。必须引入第二套推理栈；官方不支持 macOS/Windows CPU；无时间轴/热词；建议 **Defer 或作为远期雷达**。 |
| **选定方案** | 仅对 **Fun-ASR-Nano-2512** 立项 spike；MiMo 仅记录为 **ASR-RADAR-MiMo**，不进入 R3g-C 编码。 |
| **不做什么** | 不为 MiMo 新增独立 Python 服务或 C++ 运行时；不在 R3g-C 同时上两个 SKU；不替换 Paraformer 默认位直至 spike Go。 |
| **与 ADR 关系** | 符合 [ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) FunASR-first；不影响 [ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md) Sherpa 远期路线。 |
| **风险** | Fun-ASR-Nano 的 `remote_code` 打包、速度、长音频语段稳定性需实测；MiMo 生态成熟度/跨平台/时间轴是硬 blocker。 |

---

## 5. 建议的 Spike 范围（Fun-ASR-Nano）

若进入 spike，参考 [r3g-b-qwen3-asr-sku-spike-research.md](./r3g-b-qwen3-asr-sku-spike-research.md) §4.1 硬闸门：

| # | 指标 | Paraformer 基准 | Fun-ASR-Nano 要求 |
|---|------|-----------------|-------------------|
| N1 | 长音频语段数（制控 ~21min） | 197 | **≥10**，且无 whole_track_fallback |
| N2 | 相对 baseline | 197 | **≥ max(15, 90%×baseline)** 或书面降级 |
| N3 | `segmentation_mode` | `sentence_info` | `sentence_info` / `timestamp` |
| N4 | 热词 term_hit | 1.0（制控） | **≥ baseline** |
| N5 | wall clock | ~168s | **≤2.0×** Go；**≤3.0×** Defer |
| N6 | 磁盘增量 | — | ≤2GB |
| N7 | prepare / health | ✅ | `/health` ready |
| N8 | PyInstaller 打包 | ✅ | bundled `/health` import 不 500 |

---

## 6. 落位预告（仅 Fun-ASR-Nano spike Go 后）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | `services/asr/rushi_asr/funasr_engine.py` | `_get_model` 增加 Nano 路径；`remote_code` 处理 |
| Python ASR | `services/asr/rushi_asr/asr_model_profile.py` | `sku_family=funasr_nano`；`language="中文"` 映射 |
| Python ASR | `services/asr/rushi_asr/funasr_pipeline.py` | 确认 `recognizer_needs_punc_pipeline` 为 False |
| Python ASR | `services/asr/rushi_asr/model_prepare*.py` | Nano + `model.py` 缓存规则 |
| TS | `apps/desktop/src/config/localAsrModelCatalog.ts` | 新增 `funasr-nano-2512` 条目 |
| TS | `apps/desktop/src/.../hubModelNeedsPuncPrepare.ts` | Nano 无需 punc prepare |
| 测试 | `services/asr/tests/test_funasr_engine.py` | Nano fixture / mock |
| 文档 | `r3g-c-funasr-nano-*` 系列 | intent / plan / acceptance |

---

## 7. 签收

- [x] 调研 brief 完成（2026-06-16）
- [x] 用户确认：对 **Fun-ASR-Nano** 立项 spike（2026-06-16）
- [x] 用户确认：**MiMo-V2.5-ASR** 不进入 R3g-C（2026-06-16）
- [x] 链接 [`r3g-c-funasr-nano-intent.md`](./r3g-c-funasr-nano-intent.md) / [`…-plan.md`](./r3g-c-funasr-nano-plan.md) / [`…-acceptance.md`](./r3g-c-funasr-nano-acceptance.md)

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-16 | 初版：评估 Fun-ASR-Nano 与 MiMo-V2.5-ASR 在现有 FunASR 侧车上的可行性 |
| 2026-06-16 | 签收：用户确认仅对 Fun-ASR-Nano 立项；MiMo 不进入 R3g-C；补齐 intent / plan / acceptance 三件套 |
